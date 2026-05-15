import type { ActivityEvent, ExportFormat, ParsedCommand, RuntimeResponse, Task } from "../types";
import { ensureDefaultShift, getAppSettings } from "../storage/settings";
import {
  addActivity,
  createReminder,
  createTask,
  listTasks,
  listTodayTasks,
  saveDailyPlan,
  saveReport,
  startFocusSession,
  updateTask
} from "../storage/repositories";
import { db } from "../storage/db";
import { createId } from "../utils/id";
import { endOfToday, startOfToday, toDateKey } from "../utils/date";
import { generateDailyPlan } from "./planner";
import { parseCommand } from "./commandParser";
import { exportTasks, reportStats } from "./reports";
import { buildShutdownReport, summarizeTasksLocal } from "./localAi";

async function latestActiveTask(): Promise<Task | undefined> {
  const tasks = await listTasks();
  return tasks.find((task) => task.status === "active") ?? tasks.find((task) => !["completed", "archived"].includes(task.status));
}

export async function executeParsedCommand(
  parsed: ParsedCommand,
  source: ActivityEvent["source"] = "terminal"
): Promise<RuntimeResponse> {
  try {
    if (parsed.action === "createTask") {
      const task = await createTask(
        {
          task: String(parsed.payload.task ?? "Untitled operational task"),
          priority: parsed.payload.priority as Task["priority"],
          location: String(parsed.payload.location ?? ""),
          notes: String(parsed.payload.notes ?? "")
        },
        source
      );
      return { ok: true, data: { task, message: `Created task: ${task.task}` } };
    }

    if (parsed.action === "addBlocker") {
      const task = await latestActiveTask();
      if (!task) return { ok: false, error: "No active task found for blocker." };
      const blocker = String(parsed.payload.blocker ?? parsed.raw);
      const updated = await updateTask(task.id, { status: "blocked", blockers: blocker }, source);
      return { ok: true, data: { task: updated, message: `Blocker added to ${updated.task}` } };
    }

    if (parsed.action === "setReminder") {
      const dueAt = typeof parsed.payload.dueAt === "number" ? parsed.payload.dueAt : Date.now() + 20 * 60_000;
      const task = await latestActiveTask();
      const reminder = await createReminder({
        taskId: task?.id,
        title: String(parsed.payload.title ?? task?.task ?? "Operational reminder"),
        dueAt
      });
      return { ok: true, data: { reminder, message: "Reminder scheduled" } };
    }

    if (parsed.action === "startFocus") {
      const task = await latestActiveTask();
      const durationMinutes = typeof parsed.payload.durationMinutes === "number" ? parsed.payload.durationMinutes : 25;
      const session = await startFocusSession({ taskId: task?.id, durationMinutes, source });
      return { ok: true, data: { session, message: `${durationMinutes} minute focus session started` } };
    }

    if (parsed.action === "generatePlan" || parsed.action === "optimizePlan") {
      const [tasks, settings, shift] = await Promise.all([listTasks(), getAppSettings(), ensureDefaultShift()]);
      const plan = generateDailyPlan(tasks, [shift], parsed.action === "optimizePlan" ? "adaptive" : settings.planMode);
      await saveDailyPlan(plan);
      return { ok: true, data: { plan, message: "Daily plan generated" } };
    }

    if (parsed.action === "summarize") {
      const tasks = parsed.payload.scope === "today" ? await listTodayTasks() : await listTasks();
      const summary = summarizeTasksLocal(tasks);
      return { ok: true, data: { summary, message: summary } };
    }

    if (parsed.action === "shutdown") {
      const tasks = await listTasks({ dateFrom: startOfToday(), dateTo: endOfToday() });
      const stats = await reportStats({ dateFrom: startOfToday(), dateTo: endOfToday() });
      const content = buildShutdownReport({
        tasks,
        focusMinutes: stats.focusMinutes,
        answers: {
          completed: String(parsed.payload.completed ?? ""),
          blocked: String(parsed.payload.blocked ?? ""),
          tomorrow: String(parsed.payload.tomorrow ?? ""),
          unresolved: String(parsed.payload.unresolved ?? "")
        }
      });
      const report = await saveReport({
        id: createId("report"),
        type: "shutdown",
        title: `Shift Shutdown - ${toDateKey()}`,
        createdAt: Date.now(),
        periodStart: startOfToday(),
        periodEnd: Date.now(),
        content,
        aiGenerated: false
      });
      return { ok: true, data: { report, message: "Shutdown report generated" } };
    }

    if (parsed.action === "exportReport") {
      const format = (parsed.payload.format ?? "csv") as ExportFormat;
      const payload = await exportTasks(format, {});
      return { ok: true, data: { export: payload, message: `${format.toUpperCase()} export prepared` } };
    }

    if (parsed.action === "capturePage") {
      return { ok: true, data: { message: "Capture page must be handled by the browser context." } };
    }

    await addActivity({ type: "system", title: `Unknown command: ${parsed.raw}`, source });
    return { ok: false, error: parsed.feedback };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function executeCommand(command: string, source: ActivityEvent["source"] = "terminal"): Promise<RuntimeResponse> {
  return executeParsedCommand(parseCommand(command), source);
}

export async function seedDemoDataIfEmpty(): Promise<void> {
  const taskCount = await db.tasks.count();
  if (taskCount > 0) return;
  await createTask({ task: "Investigate routing delays", priority: "high", location: "Dispatch Dashboard", status: "active", completion: 65, blockers: "Waiting on Ops logs", estimatedMinutes: 60 }, "system");
  await createTask({ task: "Review overnight incidents", priority: "medium", location: "Incident Queue", status: "pending", completion: 10, estimatedMinutes: 30 }, "system");
  await createTask({ task: "Prepare shift handoff notes", priority: "low", location: "Ops Journal", status: "pending", completion: 0, estimatedMinutes: 25 }, "system");
}
