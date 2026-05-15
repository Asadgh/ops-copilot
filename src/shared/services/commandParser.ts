import type { ParsedCommand, Priority } from "../types";

const priorityPattern = /\b(critical|high|medium|low)\b/i;

function getPriority(input: string): Priority {
  const match = input.match(priorityPattern)?.[1]?.toLowerCase();
  return match === "critical" || match === "high" || match === "medium" || match === "low" ? match : "medium";
}

function stripLead(input: string, expressions: RegExp[]): string {
  let output = input.trim();
  for (const expression of expressions) {
    output = output.replace(expression, "").trim();
  }
  return output.replace(/^for\s+/i, "").trim();
}

export function parseDurationMinutes(input: string): number | undefined {
  const hourMatch = input.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  const minuteMatch = input.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
  const hours = hourMatch ? Number(hourMatch[1]) * 60 : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  if (hours + minutes > 0) return Math.round(hours + minutes);
  if (/\bdeep work\b/i.test(input)) return 45;
  if (/\bextended\b/i.test(input)) return 60;
  if (/\bstandard\b/i.test(input)) return 25;
  return undefined;
}

export function parseReminderDueAt(input: string, now = Date.now()): number | undefined {
  const inMinutes = input.match(/\bin\s+(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
  if (inMinutes) return now + Number(inMinutes[1]) * 60_000;
  const inHours = input.match(/\bin\s+(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (inHours) return now + Number(inHours[1]) * 60 * 60_000;
  const tomorrow = input.match(/\btomorrow\b/i);
  if (tomorrow) return now + 24 * 60 * 60_000;
  return undefined;
}

function parsed(input: string, action: ParsedCommand["action"], payload: Record<string, unknown>, feedback: string, confidence = 0.84): ParsedCommand {
  return { action, raw: input, payload, feedback, confidence, source: "local" };
}

export function parseCommand(input: string): ParsedCommand {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return parsed(raw, "unknown", {}, "Enter an operational command.", 0);
  }

  if (/^(new|create|add)\b.*\btask\b/i.test(raw)) {
    const priority = getPriority(raw);
    const task = stripLead(raw, [
      /^(new|create|add)\s+/i,
      /\b(critical|high|medium|low)\s+priority\b/i,
      /\b(critical|high|medium|low)\b/i,
      /\btask\b/i
    ]);
    return parsed(raw, "createTask", { task: task || "Untitled operational task", priority }, `Task queued: ${task || "Untitled operational task"}`);
  }

  if (/^blocked\b|\badd blocker\b|\bwaiting on\b/i.test(raw)) {
    const blocker = stripLead(raw, [/^blocked\b/i, /^add blocker\b/i, /^waiting on\b/i]);
    return parsed(raw, "addBlocker", { blocker: blocker || raw }, `Blocker captured: ${blocker || raw}`);
  }

  if (/\bremind me\b|\badd reminder\b|\bsnooze\b/i.test(raw)) {
    const dueAt = parseReminderDueAt(raw);
    const title = raw
      .replace(/\bremind me\b/i, "")
      .replace(/\badd reminder\b/i, "")
      .replace(/\bin\s+\d+(?:\.\d+)?\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i, "")
      .trim();
    return parsed(raw, "setReminder", { dueAt, title: title || "Operational reminder" }, "Reminder details prepared", dueAt ? 0.9 : 0.58);
  }

  if (/\bstart\b.*\bfocus\b|\bfocus session\b/i.test(raw)) {
    const durationMinutes = parseDurationMinutes(raw) ?? 25;
    return parsed(raw, "startFocus", { durationMinutes }, `${durationMinutes} minute focus session ready`);
  }

  if (/\bcapture page\b|\btrack this page\b|\battach page\b|\bsave page\b/i.test(raw)) {
    return parsed(raw, "capturePage", {}, "Page capture requested");
  }

  if (/\bsummarize\b|\bsummary\b/i.test(raw)) {
    const scope = /\btoday\b/i.test(raw) ? "today" : /\bpage\b/i.test(raw) ? "page" : "current";
    return parsed(raw, "summarize", { scope }, `Summary requested for ${scope}`);
  }

  if (/\bgenerate\b.*\bplan\b|\bplan today\b|\bdaily plan\b/i.test(raw)) {
    return parsed(raw, "generatePlan", {}, "Daily plan generation requested");
  }

  if (/\boptimize\b.*\b(today|day|plan)\b/i.test(raw)) {
    return parsed(raw, "optimizePlan", {}, "Daily plan optimization requested");
  }

  if (/\bshutdown\b|\bend shift\b|\bhandoff\b/i.test(raw)) {
    return parsed(raw, "shutdown", {}, "Shutdown workflow requested");
  }

  if (/\bexport\b/i.test(raw)) {
    const format = lower.includes("xlsx") || lower.includes("excel")
      ? "xlsx"
      : lower.includes("markdown") || lower.includes("md")
        ? "markdown"
        : lower.includes("txt") || lower.includes("text")
          ? "txt"
          : "csv";
    return parsed(raw, "exportReport", { format }, `${format.toUpperCase()} export requested`);
  }

  return parsed(raw, "unknown", {}, "I could not map that to a safe local action.", 0.25);
}
