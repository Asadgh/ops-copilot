import { DEFAULT_SHIFT } from "../constants";
import type { DailyPlan, DailyPlanItem, PlanMode, Shift, Task } from "../types";
import { addClockMinutes, toDateKey } from "../utils/date";
import { createId } from "../utils/id";

const priorityWeight = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

function item(startTime: string, duration: number, title: string, taskId?: string, reason?: string): DailyPlanItem {
  return {
    id: createId("plan_item"),
    startTime,
    endTime: addClockMinutes(toDateKey(), startTime, duration),
    title,
    taskId,
    reason,
    status: "planned"
  };
}

export function generateDailyPlan(tasks: Task[], shifts: Shift[] = [DEFAULT_SHIFT], mode: PlanMode = "assisted"): DailyPlan {
  const now = Date.now();
  const date = toDateKey(now);
  const shift = shifts[0] ?? DEFAULT_SHIFT;
  let cursor = shift.startHour || "07:00";
  const eligible = tasks
    .filter((task) => !["completed", "archived"].includes(task.status))
    .sort((a, b) => {
      const dueDiff = (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER);
      if (dueDiff !== 0) return dueDiff;
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

  const items: DailyPlanItem[] = [];
  items.push(item(cursor, 30, "Routine dashboard maintenance", undefined, "Front-load recurring checks before operational load rises."));
  cursor = items[items.length - 1].endTime;

  items.push(item(cursor, 30, "Review overnight incidents", undefined, "Shift handoff review keeps active work aligned."));
  cursor = items[items.length - 1].endTime;

  eligible.slice(0, 8).forEach((task, index) => {
    const duration = Math.min(Math.max(task.estimatedMinutes ?? (task.priority === "critical" ? 60 : 45), 25), 90);
    const reason =
      task.priority === "critical" || task.priority === "high"
        ? "Prioritized because of operational urgency."
        : index < 2
          ? "Scheduled during the strongest early focus window."
          : "Placed after priority work to keep momentum without overfitting the day.";
    items.push(item(cursor, duration, task.task, task.id, reason));
    cursor = items[items.length - 1].endTime;
    if (index === 1) {
      items.push(item(cursor, 15, "Break", undefined, "Short reset to reduce interruption fatigue."));
      cursor = items[items.length - 1].endTime;
    }
  });

  if (eligible.length === 0) {
    items.push(item(cursor, 45, "Open operational capture block", undefined, "Reserved for incoming tasks and unplanned interruptions."));
  }

  return {
    id: createId("plan"),
    date,
    mode,
    createdAt: now,
    updatedAt: now,
    items,
    rationale:
      mode === "manual"
        ? "Manual plan initialized from current shift defaults."
        : "Plan balances priority, due dates, early-shift routine work, focus blocks, and interruption recovery."
  };
}
