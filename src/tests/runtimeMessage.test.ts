import { describe, expect, it } from "vitest";
import { RuntimeMessageSchema } from "../shared/types";

describe("runtime message validation", () => {
  it("accepts page capture and focus messages", () => {
    expect(RuntimeMessageSchema.safeParse({ type: "CAPTURE_PAGE", payload: { selectedText: "selected page text" } }).success).toBe(true);
    expect(RuntimeMessageSchema.safeParse({ type: "START_FOCUS", payload: { durationMinutes: 45 } }).success).toBe(true);
  });

  it("accepts serialized voice transcription payloads", () => {
    expect(RuntimeMessageSchema.safeParse({ type: "VOICE_TRANSCRIBE", payload: { audioBase64: "AAAA", mimeType: "audio/webm" } }).success).toBe(true);
    expect(RuntimeMessageSchema.safeParse({ type: "VOICE_TRANSCRIBE", payload: { audioBase64: "", mimeType: "audio/webm" } }).success).toBe(false);
  });

  it("rejects invalid focus duration", () => {
    expect(RuntimeMessageSchema.safeParse({ type: "START_FOCUS", payload: { durationMinutes: 0 } }).success).toBe(false);
  });
});
