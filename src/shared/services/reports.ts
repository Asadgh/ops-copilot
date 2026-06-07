import { FIELD_LABELS } from "../constants";
import type { ExportFormat, ExportPayload, ReportFilters, Task } from "../types";
import { endOfToday, formatDuration, startOfToday, toDateKey } from "../utils/date";
import { createId } from "../utils/id";
import { db } from "../storage/db";
import { listTasks, saveReport } from "../storage/repositories";
import { buildLocalPerformanceReport } from "./localAi";

const defaultFields = ["month", "week", "priority", "task", "location", "timeline", "status", "completion", "blockers", "improvements", "notes"];

function escapeCsv(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function taskValue(task: Task, field: string): string | number | undefined {
  switch (field) {
    case "sourceUrl":
      return task.metadata.sourceUrl;
    case "aiTags":
      return task.metadata.aiTags?.join(", ");
    case "aiSummary":
      return task.metadata.aiSummary;
    case "focusTime":
      return undefined;
    default:
      return (task as unknown as Record<string, string | number | undefined>)[field];
  }
}

export async function reportStats(filters: ReportFilters = {}): Promise<{ tasks: Task[]; focusMinutes: number; completed: number; blocked: number }> {
  const tasks = await listTasks(filters);
  const sessions = await db.focusSessions.toArray();
  const taskIds = new Set(tasks.map((task) => task.id));
  const focusMinutes = sessions
    .filter((session) => session.status === "completed" && (!session.taskId || taskIds.has(session.taskId)))
    .reduce((sum, session) => sum + session.durationMinutes, 0);
  return {
    tasks,
    focusMinutes,
    completed: tasks.filter((task) => task.status === "completed").length,
    blocked: tasks.filter((task) => task.status === "blocked").length
  };
}

export async function createLocalReport(type: "daily" | "weekly" | "monthly" | "performance", filters: ReportFilters = {}) {
  const now = Date.now();
  const scopedFilters = {
    dateFrom: filters.dateFrom ?? (type === "daily" ? startOfToday() : undefined),
    dateTo: filters.dateTo ?? (type === "daily" ? endOfToday() : undefined),
    ...filters
  };
  const stats = await reportStats(scopedFilters);
  const title = `${type[0].toUpperCase()}${type.slice(1)} Operational Report - ${toDateKey(now)}`;
  const report = {
    id: createId("report"),
    type,
    title,
    createdAt: now,
    periodStart: scopedFilters.dateFrom ?? 0,
    periodEnd: scopedFilters.dateTo ?? now,
    aiGenerated: false,
    filters: scopedFilters,
    content: buildLocalPerformanceReport({ title, tasks: stats.tasks, focusMinutes: stats.focusMinutes, filters: scopedFilters })
  };
  return saveReport(report);
}

export async function exportTasks(format: ExportFormat, filters: ReportFilters = {}): Promise<ExportPayload> {
  const fields = filters.fields?.length ? filters.fields : defaultFields;
  const tasks = await listTasks(filters);
  const rows = tasks.map((task) => {
    const row: Record<string, string | number | undefined> = {};
    fields.forEach((field) => {
      row[(FIELD_LABELS as Record<string, string>)[field] ?? field] = taskValue(task, field);
    });
    return row;
  });
  const dateKey = toDateKey();

  if (format === "csv") {
    const header = fields.map((field) => (FIELD_LABELS as Record<string, string>)[field] ?? field);
    const body = rows.map((row) => header.map((key) => escapeCsv(row[key])).join(","));
    return {
      filename: `ops-copilot-${dateKey}.csv`,
      mimeType: "text/csv;charset=utf-8",
      format,
      content: [header.join(","), ...body].join("\n"),
      encoding: "text"
    };
  }

  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, "Ops Copilot");
    return {
      filename: `ops-copilot-${dateKey}.xlsx`,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      format,
      content: XLSX.write(workbook, { bookType: "xlsx", type: "base64" }) as string,
      encoding: "base64"
    };
  }

  if (format === "markdown") {
    const content = [
      `# Ops Copilot Export - ${dateKey}`,
      "",
      ...tasks.map((task) => [`## ${task.task}`, `- Priority: ${task.priority}`, `- Status: ${task.status}`, `- Completion: ${task.completion}%`, `- Location: ${task.location || "None"}`, `- Blockers: ${task.blockers || "None"}`, `- Notes: ${task.notes || "None"}`].join("\n"))
    ].join("\n\n");
    return {
      filename: `ops-copilot-${dateKey}.md`,
      mimeType: "text/markdown;charset=utf-8",
      format,
      content,
      encoding: "text"
    };
  }

  const content = tasks
    .map((task) => `${task.task}\nPriority: ${task.priority}\nStatus: ${task.status}\nFocus: ${formatDuration(task.estimatedMinutes ?? 0)}\nBlockers: ${task.blockers || "None"}\nNotes: ${task.notes || "None"}`)
    .join("\n\n---\n\n");
  return {
    filename: `ops-copilot-${dateKey}.txt`,
    mimeType: "text/plain;charset=utf-8",
    format,
    content,
    encoding: "text"
  };
}
