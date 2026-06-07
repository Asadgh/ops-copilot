import { LoaderCircle, Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sendRuntimeMessage } from "../../shared/chrome";
import type { VoiceResult } from "../../shared/types";
import { useAppStore } from "../../app/store";
import { Button } from "./Button";

type VoiceState = "idle" | "listening" | "processing" | "error" | "success";
const maxRecordingMs = 12_000;

function preferredMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((candidate) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate));
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read recorded audio."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.readAsDataURL(blob);
  });
}

export function VoiceButton() {
  const [state, setState] = useState<VoiceState>("idle");
  const [detail, setDetail] = useState("");
  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopTimer = useRef<number | undefined>(undefined);
  const clearTimer = useRef<number | undefined>(undefined);
  const load = useAppStore((store) => store.load);

  useEffect(() => {
    return () => {
      if (stopTimer.current) window.clearTimeout(stopTimer.current);
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function setTemporaryDetail(nextState: VoiceState, nextDetail: string, timeout = 5200) {
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    setState(nextState);
    setDetail(nextDetail);
    clearTimer.current = window.setTimeout(() => {
      setDetail("");
      setState("idle");
    }, timeout);
  }

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setTemporaryDetail("error", "Voice recording is not available in this browser context.");
      return;
    }
    try {
      setState("processing");
      setDetail("Requesting microphone access...");
      const activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = activeStream;
      chunks.current = [];
      const mimeType = preferredMimeType();
      const mediaRecorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        if (stopTimer.current) window.clearTimeout(stopTimer.current);
        setState("processing");
        setDetail("Processing voice command...");
        try {
          if (!chunks.current.length) throw new Error("No audio was recorded. Try again and speak after the mic turns on.");
          const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
          const audioBase64 = await blobToBase64(blob);
          const response = await sendRuntimeMessage<VoiceResult>({ type: "VOICE_TRANSCRIBE", payload: { audioBase64, mimeType: blob.type } });
          if (!response.ok || !response.data) throw new Error(response.error ?? "Voice command failed");
          setTemporaryDetail(
            response.data.execution.ok ? "success" : "error",
            response.data.execution.ok ? `Heard: ${response.data.transcript}` : response.data.execution.error ?? response.data.transcript
          );
          await load();
        } catch (error) {
          setTemporaryDetail("error", error instanceof Error ? error.message : String(error), 8000);
        } finally {
          activeStream.getTracks().forEach((track) => track.stop());
          stream.current = null;
          recorder.current = null;
        }
      };
      mediaRecorder.start();
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
      stopTimer.current = window.setTimeout(() => stop(), maxRecordingMs);
      setDetail("Listening... click again to stop.");
      setState("listening");
    } catch (error) {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setTemporaryDetail("error", error instanceof Error ? error.message : String(error), 8000);
    }
  }

  function stop() {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
    }
  }

  const listening = state === "listening";
  const processing = state === "processing";
  return (
    <div className="relative flex items-center gap-2">
      <Button
        size="icon"
        variant={listening ? "danger" : state === "success" ? "success" : state === "error" ? "danger" : "secondary"}
        aria-label={listening ? "Stop voice command" : "Start voice command"}
        title={listening ? "Stop voice command" : processing ? "Processing voice command" : "Start voice command"}
        disabled={processing}
        onClick={listening ? stop : start}
      >
        {processing ? <LoaderCircle className="animate-spin" size={16} /> : listening ? <MicOff size={16} /> : <Mic size={16} />}
      </Button>
      {detail ? (
        <span
          className={`absolute right-0 top-11 z-50 w-[min(280px,calc(100vw-1.5rem))] rounded-lg border px-3 py-2 text-xs font-medium shadow-lg shadow-black/15 ${
            state === "error"
              ? "border-oc-critical/35 bg-oc-critical/12 text-oc-critical"
              : state === "success"
                ? "border-oc-success/35 bg-oc-success/12 text-oc-success"
                : "border-oc-blue/35 bg-oc-blue/12 text-oc-blue"
          }`}
          role="status"
          aria-live="polite"
        >
          {detail}
        </span>
      ) : null}
    </div>
  );
}
