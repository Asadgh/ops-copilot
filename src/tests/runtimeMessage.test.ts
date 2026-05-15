import { describe, expect, it } from "vitest";
import { RuntimeMessageSchema } from "../shared/types";

describe("runtime message validation", () => {
  it("accepts launcher and focus messages", () => {
    expect(RuntimeMessageSchema.safeParse({ type: "GET_LAUNCHER_SETTINGS", hostname: "example.com" }).success).toBe(true);
    expect(RuntimeMessageSchema.safeParse({ type: "START_FOCUS", payload: { durationMinutes: 45 } }).success).toBe(true);
  });

  it("rejects invalid focus duration", () => {
    expect(RuntimeMessageSchema.safeParse({ type: "START_FOCUS", payload: { durationMinutes: 0 } }).success).toBe(false);
  });
});
