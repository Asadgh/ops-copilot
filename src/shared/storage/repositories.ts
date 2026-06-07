import { endOfToday, getMonthLabel, getWeekLabel, startOfToday, toDateKey } from "../utils/date";
import { createId } from "../utils/id";
import type {
  ActivityEvent,
  BrowserCapture,
  DailyPlan,
  FocusSession,
  Priority,
  Reminder,
  ReminderStatus,
  Report,
  ReportFilters,
  Shift,
  Task,
  TaskStatus
} from "../types";
import { db } from "./db";
import { backupToSyncStorageQuietly } from "./syncBackup";

export function buildTask(input: Partial<Task> & { task?: string }): Task {
  const now = Date.now();
  const title = input.task?.trim() || "Untitled operational task";
  return {
    id: input.id ?? createId("task"),
    month: input.month ?? getMonthLabel(now),
    week: input.week ?? getWeekLabel(now),
    priority: input.priority ?? "medium",
    task: title,
    location: input.location ?? "",
    timeline: input.timeline ?? now,
    status: input.status ?? "pending",
    completion: input.completion ?? 0,
    blockers: input.blockers ?? "",
    improvements: input.improvements ?? "",
    notes: input.notes ?? "",
    dueAt: input.dueAt,
    estimatedMinutes: input.estimatedMinutes,
    tags: input.tags ?? [],
    metadata: {
      createdAt: input.metadata?.createdAt ?? now,
      updatedAt: now,
      sourceUrl: input.metadata?.sourceUrl,
      sourceTitle: input.metadata?.sourceTitle,
      pageSummary: input.metadata?.pageSummary,
      aiTags: input.metadata?.aiTags,
      aiSummary: input.metadata?.aiSummary,
      reminderAt: input.metadata?.reminderAt,
      linkedTasks: input.metadata?.linkedTasks ?? [],
      activityLog: input.metadata?.activityLog ?? []
    }
  };
}

export async function addActivity(event: Omit<ActivityEvent, "id" | "timestamp"> & { id?: string; timestamp?: number }): Promise<ActivityEvent> {
  const activity: ActivityEvent = {
    id: event.id ?? createId("event"),
    timestamp: event.timestamp ?? Date.now(),
    type: event.type,
    title: event.title,
    details: event.details,
    taskId: event.taskId,
    source: event.source ?? "system"
  };
  await db.activityEvents.put(activity);
  if (activity.taskId) {
    const task = await db.tasks.get(activity.taskId);
    if (task) {
      const updated: Task = {
        ...task,
        metadata: {
          ...task.metadata,
          updatedAt: Date.now(),
          activityLog: [...(task.metadata.activityLog ?? []), activity].slice(-100)
        }
      };
      await db.tasks.put(updated);
    }
  }
  await backupToSyncStorageQuietly();
  return activity;
}

export async function createTask(input: Partial<Task>, source: ActivityEvent["source"] = "ui"): Promise<Task> {
  const task = buildTask(input);
  await db.tasks.put(task);
  await addActivity({
    type: "task.created",
    title: `Created task: ${task.task}`,
    taskId: task.id,
    source
  });
  return task;
}

export async function updateTask(id: string, patch: Partial<Task>, source: ActivityEvent["source"] = "ui"): Promise<Task> {
  const existing = await db.tasks.get(id);
  if (!existing) throw new Error(`Task not found: ${id}`);
  const task: Task = {
    ...existing,
    ...patch,
    metadata: {
      ...existing.metadata,
      ...(patch.metadata ?? {}),
      updatedAt: Date.now()
    }
  };
  await db.tasks.put(task);
  await addActivity({
    type: task.status === "completed" ? "task.completed" : task.status === "blocked" ? "task.blocked" : "task.updated",
    title: `Updated task: ${task.task}`,
    taskId: task.id,
    source
  });
  return task;
}

export async function deleteTask(id: string, source: ActivityEvent["source"] = "ui"): Promise<Task> {
  const existing = await db.tasks.get(id);
  if (!existing) throw new Error(`Task not found: ${id}`);
  await db.tasks.delete(id);
  await addActivity({
    type: "task.updated",
    title: `Deleted task: ${existing.task}`,
    taskId: id,
    source
  });
  return existing;
}

export async function restoreTask(task: Task, source: ActivityEvent["source"] = "ui"): Promise<Task> {
  const restored: Task = {
    ...task,
    metadata: {
      ...task.metadata,
      updatedAt: Date.now()
    }
  };
  await db.tasks.put(restored);
  await addActivity({
    type: "task.updated",
    title: `Restored task: ${restored.task}`,
    taskId: restored.id,
    source
  });
  return restored;
}

export async function listTasks(filters: ReportFilters = {}): Promise<Task[]> {
  const tasks = await db.tasks.orderBy("timeline").reverse().toArray();
  return tasks.filter((task) => {
    if (filters.dateFrom && task.timeline < filters.dateFrom) return false;
    if (filters.dateTo && task.timeline > filters.dateTo) return false;
    if (filters.priority && filters.priority !== "all" && task.priority !== filters.priority) return false;
    if (filters.status && filters.status !== "all" && task.status !== filters.status) return false;
    if (filters.unresolvedOnly && task.status === "completed") return false;
    if (filters.includeCompleted === false && task.status === "completed") return false;
    if (filters.tags?.length && !filters.tags.some((tag) => task.tags?.includes(tag))) return false;
    return true;
  });
}

export async function listTodayTasks(): Promise<Task[]> {
  return listTasks({ dateFrom: startOfToday(), dateTo: endOfToday() });
}

export async function activeTasks(): Promise<Task[]> {
  return listTasks({ status: "active" }).then((tasks) => tasks.concat([]));
}

export async function createCapture(input: Omit<BrowserCapture, "id" | "timestamp"> & { id?: string; timestamp?: number }): Promise<BrowserCapture> {
  const capture: BrowserCapture = {
    id: input.id ?? createId("capture"),
    timestamp: input.timestamp ?? Date.now(),
    taskId: input.taskId,
    url: input.url,
    title: input.title,
    selectedText: input.selectedText,
    summary: input.summary
  };
  await db.captures.put(capture);
  if (capture.taskId) {
    const task = await db.tasks.get(capture.taskId);
    if (task) {
      await updateTask(
        task.id,
        {
          metadata: {
            ...task.metadata,
            sourceUrl: capture.url,
            sourceTitle: capture.title,
            pageSummary: capture.summary
          }
        },
        "browser"
      );
    }
  }
  await addActivity({
    type: "task.captured",
    title: `Captured page: ${capture.title}`,
    details: capture.url,
    taskId: capture.taskId,
    source: "browser"
  });
  return capture;
}

export async function startFocusSession(input: { taskId?: string; durationMinutes: number; source?: ActivityEvent["source"] }): Promise<FocusSession> {
  const session: FocusSession = {
    id: createId("focus"),
    taskId: input.taskId,
    startTime: Date.now(),
    durationMinutes: input.durationMinutes,
    status: "active",
    interruptions: 0
  };
  await db.focusSessions.put(session);
  if (input.taskId) {
    await updateTask(input.taskId, { status: "active" }, input.source ?? "ui");
  }
  await addActivity({
    type: "focus.started",
    title: `${input.durationMinutes} minute focus session started`,
    taskId: input.taskId,
    source: input.source ?? "ui"
  });
  return session;
}

export async function completeFocusSession(id: string): Promise<FocusSession> {
  const session = await db.focusSessions.get(id);
  if (!session) throw new Error(`Focus session not found: ${id}`);
  const completed: FocusSession = { ...session, status: "completed", endTime: Date.now() };
  await db.focusSessions.put(completed);
  await addActivity({
    type: "focus.completed",
    title: `Completed ${session.durationMinutes} minute focus session`,
    taskId: session.taskId,
    source: "system"
  });
  return completed;
}

export async function createReminder(input: { taskId?: string; title: string; dueAt: number }): Promise<Reminder> {
  const reminder: Reminder = {
    id: createId("reminder"),
    taskId: input.taskId,
    title: input.title,
    dueAt: input.dueAt,
    status: "scheduled",
    createdAt: Date.now()
  };
  await db.reminders.put(reminder);
  if (input.taskId) {
    const task = await db.tasks.get(input.taskId);
    if (task) {
      await updateTask(input.taskId, { metadata: { ...task.metadata, reminderAt: input.dueAt } }, "system");
    }
  }
  await addActivity({
    type: "reminder.created",
    title: `Reminder scheduled: ${reminder.title}`,
    taskId: input.taskId,
    source: "system"
  });
  return reminder;
}

export async function updateReminder(id: string, patch: Partial<Reminder>): Promise<Reminder> {
  const existing = await db.reminders.get(id);
  if (!existing) throw new Error(`Reminder not found: ${id}`);
  const reminder = { ...existing, ...patch };
  await db.reminders.put(reminder);
  if (patch.status) {
    await addActivity({
      type: "reminder.fired",
      title: `Reminder ${patch.status}: ${reminder.title}`,
      taskId: reminder.taskId,
      source: "ui"
    });
  } else {
    await backupToSyncStorageQuietly();
  }
  return reminder;
}

export async function setReminderStatus(id: string, status: ReminderStatus): Promise<Reminder> {
  return updateReminder(id, { status });
}

export async function saveShift(shift: Shift): Promise<Shift> {
  await db.shifts.put(shift);
  await addActivity({
    type: "system",
    title: `Shift updated: ${shift.name}`,
    source: "ui"
  });
  return shift;
}

export async function saveDailyPlan(plan: DailyPlan): Promise<DailyPlan> {
  await db.dailyPlans.put(plan);
  await addActivity({
    type: "plan.generated",
    title: `Daily plan generated for ${plan.date}`,
    source: plan.mode === "manual" ? "ui" : "ai"
  });
  return plan;
}

export async function getTodayPlan(): Promise<DailyPlan | undefined> {
  return db.dailyPlans.where("date").equals(toDateKey()).last();
}

export async function saveReport(report: Report): Promise<Report> {
  await db.reports.put(report);
  await addActivity({
    type: report.type === "shutdown" ? "shutdown.completed" : "report.generated",
    title: `Generated ${report.type} report: ${report.title}`,
    source: report.aiGenerated ? "ai" : "system"
  });
  return report;
}

export async function taskStats(): Promise<{ total: number; active: number; blocked: number; completed: number; focusMinutes: number }> {
  const [tasks, sessions] = await Promise.all([db.tasks.toArray(), db.focusSessions.toArray()]);
  const focusMinutes = sessions
    .filter((session) => session.status === "completed")
    .reduce((sum, session) => sum + session.durationMinutes, 0);
  return {
    total: tasks.length,
    active: tasks.filter((task) => task.status === "active").length,
    blocked: tasks.filter((task) => task.status === "blocked").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    focusMinutes
  };
}

export function coercePriority(value?: unknown): Priority {
  return value === "critical" || value === "high" || value === "medium" || value === "low" ? value : "medium";
}

export function coerceStatus(value?: unknown): TaskStatus {
  return value === "pending" || value === "active" || value === "blocked" || value === "completed" || value === "archived" ? value : "pending";
}
