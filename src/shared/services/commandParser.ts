import type { ParsedCommand, Priority } from "../types";

const priorityPattern = /\b(critical|high|medium|low)\b/i;
const reminderLeadPattern = /\b(?:remind me(?: to)?|set (?:a )?reminder(?: to)?|add (?:a )?reminder(?: to)?|reminder(?: to)?)\b[\s,:-]*/i;

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

function tidyText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[\s,;:.!?-]+|[\s,;:.!?-]+$/g, "")
    .trim();
}

function splitReminderClause(input: string): { commandText: string; reminderText?: string } {
  const match = input.match(reminderLeadPattern);
  if (!match || match.index === undefined) return { commandText: input };
  return {
    commandText: tidyText(input.slice(0, match.index)),
    reminderText: tidyText(input.slice(match.index))
  };
}

function stripReminderTime(input: string): string {
  return tidyText(
    input
      .replace(/\b(?:by|at|before|around)\s+(?:midday|noon|midnight|eod|end of day|close of business)\b/i, "")
      .replace(/\b(?:midday|noon|midnight|eod|end of day|close of business)\b/i, "")
      .replace(/\b(?:today|tomorrow)\b/i, "")
      .replace(/\bin\s+\d+(?:\.\d+)?\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/i, "")
      .replace(/\b(?:at|by|before|around)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, "")
  );
}

function extractTaskTitle(input: string): string {
  const withoutReminder = splitReminderClause(input).commandText;
  const title = stripLead(withoutReminder, [
    /^(?:please\s+)?(?:new|create|add)\s+(?:a\s+)?(?:new\s+)?(?:task|todo|to-do)\b[\s,:-]*/i,
    /^(?:please\s+)?(?:new|create|add)\s+/i,
    /\b(critical|high|medium|low)\s+priority\b/i,
    /\b(critical|high|medium|low)\b/i,
    /^task\b[\s,:-]*/i,
    /^(?:to\s+)?work on\b[\s,:-]*/i
  ]);
  return tidyText(title);
}

function reminderTitleForTask(task: string, reminderText?: string): string {
  if (reminderText && /\bstart\b/i.test(reminderText)) return `Start: ${task}`;
  if (reminderText && /\bfollow up\b/i.test(reminderText)) return `Follow up: ${task}`;
  if (reminderText && /\breview\b/i.test(reminderText)) return `Review: ${task}`;
  return `Reminder: ${task}`;
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
  const lower = input.toLowerCase();
  const hasTomorrow = /\btomorrow\b/.test(lower);
  const hasToday = /\btoday\b/.test(lower);

  const atClock = (hours: number, minutes = 0): number => {
    const date = new Date(now);
    if (hasTomorrow) date.setDate(date.getDate() + 1);
    date.setHours(hours, minutes, 0, 0);
    if (!hasTomorrow && !hasToday && date.getTime() <= now) date.setDate(date.getDate() + 1);
    return date.getTime();
  };

  if (/\b(midday|noon)\b/i.test(input)) return atClock(12);
  if (/\b(eod|end of day|close of business)\b/i.test(input)) return atClock(17);
  if (/\bmidnight\b/i.test(input)) return /\bby\s+midnight\b/i.test(input) ? atClock(23, 59) : atClock(0);
  if (/\bmorning\b/i.test(input)) return atClock(9);
  if (/\bafternoon\b/i.test(input)) return atClock(14);
  if (/\bevening\b/i.test(input)) return atClock(18);

  const timeMatch = input.match(/\b(?:at|by|before|around)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2] ?? 0);
    const meridiem = timeMatch[3]?.toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (!meridiem && hours > 0 && hours <= 6) hours += 12;
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) return atClock(hours, minutes);
  }

  if (hasTomorrow) return now + 24 * 60 * 60_000;
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

  if (/^(?:please\s+)?(new|create|add)\b.*\b(task|todo|to-do)\b/i.test(raw)) {
    const priority = getPriority(raw);
    const { reminderText } = splitReminderClause(raw);
    const task = extractTaskTitle(raw) || "Untitled operational task";
    const dueAt = parseReminderDueAt(raw);
    return parsed(
      raw,
      "createTask",
      {
        task,
        priority,
        ...(dueAt ? { dueAt, reminderTitle: reminderTitleForTask(task, reminderText) } : {})
      },
      dueAt ? `Task and reminder queued: ${task}` : `Task queued: ${task}`,
      dueAt ? 0.92 : 0.88
    );
  }

  if (/^blocked\b|\badd blocker\b|\bwaiting on\b/i.test(raw)) {
    const blocker = stripLead(raw, [/^blocked\b/i, /^add blocker\b/i, /^waiting on\b/i]);
    return parsed(raw, "addBlocker", { blocker: blocker || raw }, `Blocker captured: ${blocker || raw}`);
  }

  if (/\bremind me\b|\badd reminder\b|\bsnooze\b/i.test(raw)) {
    const dueAt = parseReminderDueAt(raw);
    const title = stripReminderTime(raw.replace(reminderLeadPattern, ""));
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
