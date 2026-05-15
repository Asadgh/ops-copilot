import type { ParsedCommand, ReportFilters, Task } from "../types";
import { getAppSettings, getOpenAIApiKey } from "../storage/settings";
import { parseCommand } from "./commandParser";
import { summarizeCaptureLocal, summarizeTasksLocal } from "./localAi";

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

export async function parseCommandWithAI(command: string): Promise<ParsedCommand> {
  const local = parseCommand(command);
  if (local.confidence >= 0.7) return local;
  const prompt = [
    "You are Ops Copilot, an operational command parser.",
    "Return only JSON with action, payload, feedback, and confidence.",
    "Allowed actions: createTask, addBlocker, setReminder, startFocus, capturePage, summarize, generatePlan, optimizePlan, shutdown, exportReport, unknown.",
    `Command: ${command}`
  ].join("\n");
  const text = await callOpenAIText(prompt);
  try {
    const json = JSON.parse(text) as Partial<ParsedCommand>;
    return {
      action: json.action ?? "unknown",
      raw: command,
      payload: json.payload ?? {},
      feedback: json.feedback ?? "AI interpreted the command.",
      confidence: typeof json.confidence === "number" ? json.confidence : 0.75,
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
