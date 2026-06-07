import type { BrowserCapture, PageTaskSuggestion, Reminder, Report, ReportFilters, Shift, Task, TaskCleanupSuggestion } from "../types";
import { formatDuration, toTimeLabel } from "../utils/date";

export function summarizeCaptureLocal(capture: Pick<BrowserCapture, "title" | "url" | "selectedText">): string {
  if (capture.selectedText?.trim()) {
    const text = capture.selectedText.trim().replace(/\s+/g, " ");
    return `Captured context from ${capture.title}: ${text.slice(0, 260)}${text.length > 260 ? "..." : ""}`;
  }
  return `Captured ${capture.title || "page"} for operational follow-up: ${capture.url}`;
}

export function summarizeTasksLocal(tasks: Task[]): string {
  if (tasks.length === 0) return "No operational tasks are currently captured for this period.";
  const active = tasks.filter((task) => task.status === "active").length;
  const blocked = tasks.filter((task) => task.status === "blocked").length;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const critical = tasks.filter((task) => task.priority === "critical").length;
  return `${tasks.length} tasks tracked: ${active} active, ${blocked} blocked, ${completed} completed, ${critical} critical. Top current work: ${tasks
    .slice(0, 3)
    .map((task) => task.task)
    .join("; ")}.`;
}

function cleanTitle(value: string): string {
  return value
    .replace(/^(new|create|task|todo|work on|follow up:?|review:?)+\s*,?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function suggestPageTaskLocal(input: { title: string; url: string; selectedText?: string; description?: string; headings?: string[] }): PageTaskSuggestion {
  const sourceText = input.selectedText || input.description || input.headings?.[0] || input.title || "current page";
  const task = cleanTitle(sourceText.split(/[.!?]/)[0] || input.title || "Review current page").slice(0, 96);
  const urgent = /\b(error|failed|blocked|incident|urgent|critical|delay|outage)\b/i.test(sourceText);
  return {
    task: task.startsWith("Review") ? task : `Follow up: ${task}`,
    priority: urgent ? "high" : "medium",
    tags: ["page", "capture", urgent ? "urgent" : "review"].filter(Boolean),
    summary: summarizeCaptureLocal({ title: input.title, url: input.url, selectedText: input.selectedText || input.description }),
    nextAction: "Review the captured page context and decide the next operational action.",
    confidence: 0.62
  };
}

export function cleanupTasksLocal(tasks: Task[]): TaskCleanupSuggestion[] {
  const seen = new Set<string>();
  const suggestions: TaskCleanupSuggestion[] = [];
  for (const task of tasks.filter((item) => item.status !== "archived")) {
    const nextTitle = cleanTitle(task.task);
    const key = nextTitle.toLowerCase();
    const tags = Array.from(new Set([...(task.tags ?? []), task.status === "blocked" ? "blocked" : "", task.priority === "critical" ? "critical" : ""].filter(Boolean)));
    if (nextTitle && nextTitle !== task.task) {
      suggestions.push({ taskId: task.id, task: nextTitle, tags, reason: "Cleaned filler words and normalized title casing." });
    } else if (tags.length !== (task.tags ?? []).length) {
      suggestions.push({ taskId: task.id, tags, reason: "Added missing operational grouping tags." });
    }
    if (seen.has(key)) {
      suggestions.push({ taskId: task.id, status: "archived", reason: "Archived likely duplicate task." });
    }
    seen.add(key);
  }
  return suggestions.slice(0, 24);
}

export function buildDailyBriefingLocal(input: { tasks: Task[]; reminders: Reminder[]; shifts: Shift[] }): string {
  const open = input.tasks.filter((task) => !["completed", "archived"].includes(task.status));
  const blocked = open.filter((task) => task.status === "blocked");
  const due = input.reminders.filter((reminder) => reminder.status !== "dismissed" && reminder.dueAt <= Date.now() + 2 * 60 * 60_000);
  const focus = blocked.concat(open.filter((task) => task.priority === "critical" || task.priority === "high"), open).slice(0, 5);
  return [
    "Daily briefing",
    `- Open tasks: ${open.length}; blocked: ${blocked.length}; due reminders: ${due.length}.`,
    focus.length ? `- Start with: ${focus.map((task) => task.task).join("; ")}.` : "- No open work is queued.",
    blocked.length ? `- Clear blockers: ${blocked.map((task) => `${task.task}${task.blockers ? ` (${task.blockers})` : ""}`).slice(0, 3).join("; ")}.` : "- No blockers captured.",
    due.length ? `- Reminder attention: ${due.slice(0, 3).map((reminder) => reminder.title).join("; ")}.` : "- No reminders due soon.",
    input.shifts[0] ? `- Shift window: ${input.shifts[0].startHour}-${input.shifts[0].endHour} ${input.shifts[0].timezone}.` : ""
  ].filter(Boolean).join("\n");
}

export function buildLocalPerformanceReport(input: {
  title: string;
  tasks: Task[];
  focusMinutes: number;
  filters?: ReportFilters;
}): string {
  const completed = input.tasks.filter((task) => task.status === "completed");
  const blocked = input.tasks.filter((task) => task.status === "blocked");
  const active = input.tasks.filter((task) => task.status === "active");
  const blockers = blocked.map((task) => task.blockers).filter(Boolean).slice(0, 6);
  return [
    `# ${input.title}`,
    "",
    "## Key Contributions",
    completed.length
      ? completed.slice(0, 10).map((task) => `- Completed ${task.task}`).join("\n")
      : "- No completed tasks captured in this period.",
    "",
    "## Operational Load",
    `- Tasks tracked: ${input.tasks.length}`,
    `- Active tasks: ${active.length}`,
    `- Blocked tasks: ${blocked.length}`,
    `- Focus time: ${formatDuration(input.focusMinutes)}`,
    "",
    "## Current Risks",
    blockers.length ? blockers.map((blocker) => `- ${blocker}`).join("\n") : "- No blockers captured.",
    "",
    "## Carry Forward",
    active.concat(blocked).slice(0, 8).map((task) => `- ${task.task}`).join("\n") || "- No carry-forward tasks captured."
  ].join("\n");
}

export function buildShutdownReport(input: { tasks: Task[]; answers: Record<string, string>; focusMinutes: number }): string {
  const completed = input.tasks.filter((task) => task.status === "completed");
  const blocked = input.tasks.filter((task) => task.status === "blocked");
  const carry = input.tasks.filter((task) => !["completed", "archived"].includes(task.status));
  return [
    "# Shift Shutdown Summary",
    "",
    "## Completed",
    input.answers.completed || completed.map((task) => `- ${task.task} (${toTimeLabel(task.metadata.updatedAt)})`).join("\n") || "- Nothing marked complete.",
    "",
    "## Blocked",
    input.answers.blocked || blocked.map((task) => `- ${task.task}: ${task.blockers || "No blocker detail"}`).join("\n") || "- No blocked tasks.",
    "",
    "## Tomorrow Focus",
    input.answers.tomorrow || carry.slice(0, 5).map((task) => `- ${task.task}`).join("\n") || "- No carry-over focus captured.",
    "",
    "## Unresolved Issues",
    input.answers.unresolved || carry.slice(0, 8).map((task) => `- ${task.task} (${task.status})`).join("\n") || "- No unresolved issues captured.",
    "",
    `Focus time today: ${formatDuration(input.focusMinutes)}`
  ].join("\n");
}

export function reportFromContent(report: Omit<Report, "id" | "createdAt" | "aiGenerated"> & { id: string; createdAt: number; aiGenerated?: boolean }): Report {
  return {
    ...report,
    aiGenerated: report.aiGenerated ?? false
  };
}
