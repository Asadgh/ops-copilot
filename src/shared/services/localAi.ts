import type { BrowserCapture, Report, ReportFilters, Task } from "../types";
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
