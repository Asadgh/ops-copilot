import { Mic, MicOff } from "lucide-react";
import { useRef, useState } from "react";
import { sendRuntimeMessage } from "../../shared/chrome";
import type { VoiceResult } from "../../shared/types";
import { useAppStore } from "../../app/store";
import { Button } from "./Button";

type VoiceState = "idle" | "listening" | "processing" | "error" | "success";

export function VoiceButton() {
  const [state, setState] = useState<VoiceState>("idle");
  const [detail, setDetail] = useState("");
  const chunks = useRef<Blob[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const load = useAppStore((store) => store.load);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.current.push(event.data);
      };
      mediaRecorder.onstop = async () => {
        setState("processing");
        try {
          const blob = new Blob(chunks.current, { type: "audio/webm" });
          const audio = await blob.arrayBuffer();
          const response = await sendRuntimeMessage<VoiceResult>({ type: "VOICE_TRANSCRIBE", payload: { audio, mimeType: blob.type } });
          if (!response.ok || !response.data) throw new Error(response.error ?? "Voice command failed");
          setDetail(response.data.execution.ok ? response.data.transcript : response.data.execution.error ?? response.data.transcript);
          setState(response.data.execution.ok ? "success" : "error");
          await load();
        } catch (error) {
          setDetail(error instanceof Error ? error.message : String(error));
          setState("error");
        } finally {
          stream.getTracks().forEach((track) => track.stop());
        }
      };
      mediaRecorder.start();
      setDetail("Listening...");
      setState("listening");
    } catch (error) {
      setDetail(error instanceof Error ? error.message : String(error));
      setState("error");
    }
  }

  function stop() {
    recorder.current?.stop();
  }

  const listening = state === "listening";
  return (
    <div className="flex items-center gap-2">
      <Button
        size="icon"
        variant={listening ? "danger" : state === "success" ? "success" : "secondary"}
        aria-label={listening ? "Stop voice command" : "Start voice command"}
        title={listening ? "Stop voice command" : "Start voice command"}
        onClick={listening ? stop : start}
      >
        {listening ? <MicOff size={16} /> : <Mic size={16} />}
      </Button>
      {detail ? <span className="hidden max-w-48 truncate text-xs text-oc-muted md:inline">{detail}</span> : null}
    </div>
  );
}
