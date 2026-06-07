import { Check, LoaderCircle, Mic, MicOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sendRuntimeMessage } from "../../shared/chrome";
import type { VoiceResult } from "../../shared/types";
import { useAppStore } from "../../app/store";
import { Button } from "./Button";

type VoiceState = "idle" | "listening" | "processing" | "error" | "success";
const maxRecordingMs = 12_000;
const permissionHelpMs = 12_000;

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

async function microphonePermissionState(): Promise<PermissionState | "unknown"> {
  if (!navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
}

function microphoneErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  const normalized = `${name} ${message}`.toLowerCase();

  if (normalized.includes("dismiss")) {
    return "Microphone permission was dismissed. Click the mic again and choose Allow.";
  }

  if (normalized.includes("notallowed") || normalized.includes("permission") || normalized.includes("denied")) {
    return "Microphone is blocked. Allow microphone access for Ops Copilot in Chrome, then try again.";
  }

  if (normalized.includes("notfound") || normalized.includes("device")) {
    return "No microphone was found. Connect or enable a microphone, then try again.";
  }

  return message || "Could not start voice recording.";
}

export function VoiceButton() {
  const [state, setState] = useState<VoiceState>("idle");
  const [detail, setDetail] = useState("");
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const stopTimer = useRef<number | undefined>(undefined);
  const clearTimer = useRef<number | undefined>(undefined);
  const load = useAppStore((store) => store.load);
  const executeCommand = useAppStore((store) => store.executeCommand);

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
      const permissionState = await microphonePermissionState();
      if (permissionState === "denied") {
        setTemporaryDetail("error", "Microphone is blocked. Allow microphone access for Ops Copilot in Chrome, then try again.", permissionHelpMs);
        return;
      }
      setDetail(permissionState === "prompt" ? "Chrome will ask for microphone access. Choose Allow." : "Requesting microphone access...");
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
          const response = await sendRuntimeMessage<VoiceResult>({ type: "VOICE_PREVIEW_TRANSCRIBE", payload: { audioBase64, mimeType: blob.type } });
          if (!response.ok || !response.data) throw new Error(response.error ?? "Voice command failed");
          setState("success");
          setTranscriptDraft(response.data.transcript);
          setDetail(`I heard: ${response.data.transcript}`);
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
      setTemporaryDetail("error", microphoneErrorMessage(error), permissionHelpMs);
    }
  }

  function stop() {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    if (recorder.current?.state === "recording") {
      recorder.current.stop();
    }
  }

  async function confirmTranscript() {
    const command = transcriptDraft.trim();
    if (!command) {
      setTemporaryDetail("error", "Transcript is empty. Try recording again.");
      return;
    }
    setState("processing");
    setDetail("Running voice command...");
    await executeCommand(command);
    await load();
    setTranscriptDraft("");
    setTemporaryDetail("success", `Ran: ${command}`, 5200);
  }

  function cancelTranscript() {
    setTranscriptDraft("");
    setTemporaryDetail("idle", "", 1);
  }

  const listening = state === "listening";
  const processing = state === "processing";
  return (
    <div className="relative flex items-center gap-2">
      <Button
        size="icon"
        variant={listening ? "danger" : state === "success" ? "success" : state === "error" ? "danger" : "secondary"}
        aria-label={listening ? "Stop voice command" : "Start voice command"}
        title={state === "error" ? detail || "Voice permission needs attention" : listening ? "Stop voice command" : processing ? "Processing voice command" : "Start voice command"}
        disabled={processing}
        onClick={listening ? stop : start}
      >
        {processing ? <LoaderCircle className="animate-spin" size={16} /> : listening ? <MicOff size={16} /> : <Mic size={16} />}
      </Button>
      {detail ? (
        <div
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
          <p>{detail}</p>
          {transcriptDraft ? (
            <div className="mt-2 grid gap-2">
              <textarea className="oc-textarea min-h-16 w-full border border-oc-border/70 bg-oc-bg/70 px-2 py-1.5 text-xs text-oc-text outline-none" value={transcriptDraft} onChange={(event) => setTranscriptDraft(event.target.value)} />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={cancelTranscript}><X size={13} /> Cancel</Button>
                <Button size="sm" variant="primary" onClick={() => void confirmTranscript()}><Check size={13} /> Run</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
