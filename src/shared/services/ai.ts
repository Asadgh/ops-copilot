import type { PageTaskSuggestion, ParsedCommand, Reminder, ReportFilters, Shift, Task, TaskCleanupSuggestion } from "../types";
import { getAppSettings, getOpenAIApiKey } from "../storage/settings";
import { parseCommand } from "./commandParser";
import { buildDailyBriefingLocal, cleanupTasksLocal, suggestPageTaskLocal, summarizeCaptureLocal, summarizeTasksLocal } from "./localAi";
import { parseReminderDueAt } from "./commandParser";

const commandActions: ParsedCommand["action"][] = [
  "createTask",
  "addBlocker",
  "setReminder",
  "startFocus",
  "capturePage",
  "summarize",
  "generatePlan",
  "optimizePlan",
  "shutdown",
  "exportReport",
  "unknown"
];

function extractOutputText(data: unknown): string {
  const root = data as { output_text?: string; output?: Array<{ content?: Array<{ text?: string; type?: string }> }> };
  if (root.output_text) return root.output_text;
  return (
    root.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text)
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

async function callOpenAIText(input: string, model?: string): Promise<string> {
  const [settings, apiKey] = await Promise.all([getAppSettings(), getOpenAIApiKey()]);
  if (!apiKey || settings.aiMode === "off") {
    throw new Error("OpenAI API key is not configured or AI mode is off.");
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model ?? settings.textModel,
      input
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  const data = await response.json();
  return extractOutputText(data).trim();
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/i);
  if (fenced?.[1]) return fenced[1];
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coercePriority(value: unknown): PageTaskSuggestion["priority"] {
  return value === "critical" || value === "high" || value === "low" || value === "medium" ? value : "medium";
}

export async function parseCommandWithAI(command: string): Promise<ParsedCommand> {
  const local = parseCommand(command);
  if (local.confidence >= 0.7) return local;
  const prompt = [
    "You are Ops Copilot, an operational command parser.",
    "Return only one JSON object with action, payload, feedback, and confidence.",
    "Allowed actions: createTask, addBlocker, setReminder, startFocus, capturePage, summarize, generatePlan, optimizePlan, shutdown, exportReport, unknown.",
    "For task titles, remove filler words like create/new/task/work on/remind me. Keep the real work item.",
    "For commands that create a task and mention a reminder, use action createTask and include payload.task, payload.priority, and payload.reminderTitle. Relative reminder timing is handled separately by the app.",
    "Examples:",
    "Input: create high priority task investigate routing delay",
    "Output: {\"action\":\"createTask\",\"payload\":{\"task\":\"investigate routing delay\",\"priority\":\"high\"},\"feedback\":\"Task queued: investigate routing delay\",\"confidence\":0.9}",
    "Input: Create new task, work on Monthly Audit system for unreceived products. Remind me to start by midday",
    "Output: {\"action\":\"createTask\",\"payload\":{\"task\":\"Monthly Audit system for unreceived products\",\"priority\":\"medium\",\"reminderTitle\":\"Start: Monthly Audit system for unreceived products\"},\"feedback\":\"Task and reminder queued: Monthly Audit system for unreceived products\",\"confidence\":0.9}",
    `Command: ${command}`
  ].join("\n");
  const text = await callOpenAIText(prompt);
  try {
    const json = JSON.parse(extractJsonObject(text)) as Partial<ParsedCommand>;
    const action = commandActions.includes(json.action ?? "unknown") ? json.action ?? "unknown" : "unknown";
    const payload = isRecord(json.payload) ? { ...json.payload } : {};
    const dueAt = parseReminderDueAt(command);
    if (dueAt && (action === "createTask" || action === "setReminder") && typeof payload.dueAt !== "number") {
      payload.dueAt = dueAt;
    }
    if (dueAt && action === "createTask" && typeof payload.reminderTitle !== "string" && typeof payload.task === "string") {
      payload.reminderTitle = `Reminder: ${payload.task}`;
    }
    return {
      action,
      raw: command,
      payload,
      feedback: json.feedback ?? "AI interpreted the command.",
      confidence: typeof json.confidence === "number" ? Math.min(Math.max(json.confidence, 0), 1) : 0.75,
      source: "ai"
    };
  } catch {
    return { ...local, source: "ai", feedback: text || local.feedback, confidence: 0.55 };
  }
}

export async function summarizeTasksWithAI(tasks: Task[], scope = "today"): Promise<string> {
  const fallback = summarizeTasksLocal(tasks);
  try {
    return await callOpenAIText(
      [
        `Generate a concise operational ${scope} summary.`,
        "Use bullets. Include completed work, active risks, blockers, and carry-forward focus.",
        JSON.stringify(tasks.slice(0, 80))
      ].join("\n")
    );
  } catch {
    return fallback;
  }
}

export async function summarizePageWithAI(input: { title: string; url: string; selectedText?: string }): Promise<string> {
  const fallback = summarizeCaptureLocal(input);
  try {
    return await callOpenAIText(
      [
        "Summarize this browser context for an operational task log.",
        "Keep the summary brief, concrete, and action-oriented.",
        `Title: ${input.title}`,
        `URL: ${input.url}`,
        `Selected text: ${input.selectedText || "None"}`
      ].join("\n")
    );
  } catch {
    return fallback;
  }
}

export async function suggestPageTaskWithAI(input: {
  title: string;
  url: string;
  selectedText?: string;
  description?: string;
  headings?: string[];
  excerpt?: string;
}): Promise<PageTaskSuggestion> {
  const fallback = suggestPageTaskLocal(input);
  try {
    const text = await callOpenAIText(
      [
        "Create an operational task suggestion from this browser page.",
        "Return only JSON with task, priority, dueAt, tags, summary, nextAction, confidence.",
        "priority must be one of low, medium, high, critical. dueAt must be a Unix timestamp in milliseconds or omitted.",
        `Title: ${input.title}`,
        `URL: ${input.url}`,
        `Selected text: ${input.selectedText || "None"}`,
        `Description: ${input.description || "None"}`,
        `Headings: ${(input.headings ?? []).join(" | ") || "None"}`,
        `Page excerpt: ${input.excerpt || "None"}`
      ].join("\n")
    );
    const json = JSON.parse(extractJsonObject(text)) as Record<string, unknown>;
    return {
      task: typeof json.task === "string" && json.task.trim() ? json.task.trim().slice(0, 140) : fallback.task,
      priority: coercePriority(json.priority),
      dueAt: typeof json.dueAt === "number" ? json.dueAt : fallback.dueAt,
      tags: Array.isArray(json.tags) ? json.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 8) : fallback.tags,
      summary: typeof json.summary === "string" && json.summary.trim() ? json.summary.trim() : fallback.summary,
      nextAction: typeof json.nextAction === "string" && json.nextAction.trim() ? json.nextAction.trim() : fallback.nextAction,
      confidence: typeof json.confidence === "number" ? Math.min(Math.max(json.confidence, 0), 1) : 0.72
    };
  } catch {
    return fallback;
  }
}

export async function cleanupTasksWithAI(tasks: Task[]): Promise<TaskCleanupSuggestion[]> {
  const fallback = cleanupTasksLocal(tasks);
  try {
    const text = await callOpenAIText(
      [
        "Clean this task list for an operations workspace.",
        "Return only JSON: {\"suggestions\":[{\"taskId\":\"...\",\"task\":\"clean title\",\"notes\":\"optional added context\",\"tags\":[\"...\"],\"status\":\"archived|pending|active|blocked|completed\",\"reason\":\"short reason\"}]}",
        "Prefer small safe edits: remove filler, improve vague titles, tag related work, and archive obvious duplicates only.",
        JSON.stringify(tasks.slice(0, 80))
      ].join("\n")
    );
    const json = JSON.parse(extractJsonObject(text)) as { suggestions?: Array<Record<string, unknown>> };
    const taskIds = new Set(tasks.map((task) => task.id));
    return (json.suggestions ?? [])
      .filter((item) => typeof item.taskId === "string" && taskIds.has(item.taskId))
      .map((item): TaskCleanupSuggestion => ({
        taskId: String(item.taskId),
        task: typeof item.task === "string" ? item.task.trim().slice(0, 160) : undefined,
        notes: typeof item.notes === "string" ? item.notes.trim().slice(0, 1000) : undefined,
        tags: Array.isArray(item.tags) ? item.tags.map(String).map((tag) => tag.trim()).filter(Boolean).slice(0, 8) : undefined,
        status: item.status === "archived" || item.status === "pending" || item.status === "active" || item.status === "blocked" || item.status === "completed" ? item.status : undefined,
        reason: typeof item.reason === "string" ? item.reason.trim().slice(0, 180) : "AI cleanup suggestion"
      }))
      .slice(0, 32);
  } catch {
    return fallback;
  }
}

export async function generateDailyBriefingWithAI(input: { tasks: Task[]; reminders: Reminder[]; shifts: Shift[] }): Promise<string> {
  const fallback = buildDailyBriefingLocal(input);
  try {
    return await callOpenAIText(
      [
        "Generate a concise daily operations briefing.",
        "Use 4-6 bullets. Prioritize current shift, critical/high tasks, blockers, due reminders, and what to do next.",
        `Shifts: ${JSON.stringify(input.shifts.slice(0, 3))}`,
        `Reminders: ${JSON.stringify(input.reminders.slice(0, 30))}`,
        `Tasks: ${JSON.stringify(input.tasks.slice(0, 80))}`
      ].join("\n")
    );
  } catch {
    return fallback;
  }
}

export async function generateAIReport(input: { title: string; tasks: Task[]; focusMinutes: number; filters?: ReportFilters }): Promise<string> {
  const settings = await getAppSettings();
  return callOpenAIText(
    [
      `Generate a performance-review-ready operational report titled "${input.title}".`,
      "Include Key Contributions, Operational Strengths, Recurring Challenges, Focus/Execution Metrics, and Carry Forward.",
      `Focus minutes: ${input.focusMinutes}`,
      `Filters: ${JSON.stringify(input.filters ?? {})}`,
      JSON.stringify(input.tasks.slice(0, 160))
    ].join("\n"),
    settings.reportModel
  );
}

export async function transcribeAudio(audio: ArrayBuffer, mimeType: string): Promise<string> {
  const [settings, apiKey] = await Promise.all([getAppSettings(), getOpenAIApiKey()]);
  if (!apiKey || settings.aiMode === "off" || !settings.voiceEnabled) {
    throw new Error("Voice transcription requires AI mode, voice, and an OpenAI API key.");
  }
  const form = new FormData();
  form.append("model", settings.transcriptionModel);
  form.append("file", new Blob([audio], { type: mimeType }), "ops-copilot-voice.webm");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Transcription failed (${response.status}): ${detail.slice(0, 240)}`);
  }
  const data = (await response.json()) as { text?: string };
  return data.text?.trim() ?? "";
}
