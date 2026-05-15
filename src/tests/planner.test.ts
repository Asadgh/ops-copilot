import { describe, expect, it } from "vitest";
import { DEFAULT_SHIFT } from "../shared/constants";
import { generateDailyPlan } from "../shared/services/planner";
import type { Task } from "../shared/types";

const task = (overrides: Partial<Task>): Task => ({
  id: "task-1",
  month: "May 2026",
  week: "2026-W20",
  priority: "high",
  task: "Investigate dispatch escalation",
  location: "Dispatch",
  timeline: Date.now(),
  status: "pending",
  completion: 0,
  blockers: "",
  improvements: "",
  notes: "",
  metadata: { createdAt: Date.now(), updatedAt: Date.now() },
  ...overrides
});

describe("planner", () => {
  it("front-loads routine work and prioritizes operational tasks", () => {
    const plan = generateDailyPlan(
      [
        task({ id: "low", priority: "low", task: "Low priority cleanup" }),
        task({ id: "critical", priority: "critical", task: "Critical routing incident" })
      ],
      [DEFAULT_SHIFT],
      "adaptive"
    );
    expect(plan.mode).toBe("adaptive");
    expect(plan.items[0].title).toContain("Routine");
    expect(plan.items.some((item) => item.taskId === "critical")).toBe(true);
  });
});
