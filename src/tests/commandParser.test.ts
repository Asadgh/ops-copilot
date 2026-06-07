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
    const midday = new Date(now);
    midday.setHours(12, 0, 0, 0);
    expect(parseReminderDueAt("remind me to start by midday", now)).toBe(midday.getTime());
    expect(parseDurationMinutes("start deep work focus")).toBe(45);
    expect(parseDurationMinutes("start 1 hour 15 minute focus")).toBe(75);
  });

  it("parses compound task and reminder commands cleanly", () => {
    const command = parseCommand("Create new task, work on Monthly Audit system for unreceived products. Remind me to start by midday");
    expect(command.action).toBe("createTask");
    expect(command.payload.task).toBe("Monthly Audit system for unreceived products");
    expect(command.payload.priority).toBe("medium");
    expect(command.payload.reminderTitle).toBe("Start: Monthly Audit system for unreceived products");
    expect(typeof command.payload.dueAt).toBe("number");
  });

  it("maps shutdown and export commands", () => {
    expect(parseCommand("shutdown").action).toBe("shutdown");
    expect(parseCommand("export excel").payload.format).toBe("xlsx");
  });
});
