import { describe, expect, it } from "vitest";
import { parseCommand, parseDurationMinutes, parseReminderDueAt } from "../shared/services/commandParser";

describe("command parser", () => {
  it("parses task creation with priority", () => {
    const command = parseCommand("create high priority task investigate routing delay");
    expect(command.action).toBe("createTask");
    expect(command.payload.priority).toBe("high");
    expect(command.payload.task).toBe("investigate routing delay");
  });

  it("parses reminders and focus durations", () => {
    const now = Date.UTC(2026, 4, 15, 10, 0, 0);
    expect(parseReminderDueAt("remind me in 20 mins", now)).toBe(now + 20 * 60_000);
    expect(parseDurationMinutes("start deep work focus")).toBe(45);
    expect(parseDurationMinutes("start 1 hour 15 minute focus")).toBe(75);
  });

  it("maps shutdown and export commands", () => {
    expect(parseCommand("shutdown").action).toBe("shutdown");
    expect(parseCommand("export excel").payload.format).toBe("xlsx");
  });
});
