import type { Priority, Task } from "./types";

export type TaskTemplate = {
  key: string;
  label: string;
  priority: Priority;
  task: string;
  notes: string;
  blockers?: string;
  tags: string[];
  estimatedMinutes?: number;
};

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    key: "incident",
    label: "Incident",
    priority: "high",
    task: "Investigate operational incident",
    notes: "Capture impact, current state, owner, mitigation, and follow-up.",
    blockers: "Root cause not confirmed.",
    tags: ["incident", "ops"],
    estimatedMinutes: 45
  },
  {
    key: "follow-up",
    label: "Follow-up",
    priority: "medium",
    task: "Follow up on pending operational item",
    notes: "Confirm owner, latest update, next action, and expected completion.",
    tags: ["follow-up"],
    estimatedMinutes: 25
  },
  {
    key: "audit",
    label: "Audit",
    priority: "medium",
    task: "Run operational audit check",
    notes: "Review records, identify exceptions, document gaps, and summarize corrective actions.",
    tags: ["audit", "quality"],
    estimatedMinutes: 60
  },
  {
    key: "blocker",
    label: "Blocker",
    priority: "high",
    task: "Resolve active blocker",
    notes: "Document the blocked workflow, dependency, escalation path, and unblock criteria.",
    blockers: "Needs owner or dependency confirmation.",
    tags: ["blocked", "escalation"],
    estimatedMinutes: 30
  },
  {
    key: "reminder",
    label: "Reminder",
    priority: "low",
    task: "Reminder follow-up",
    notes: "Set context and due time for follow-up.",
    tags: ["reminder"],
    estimatedMinutes: 10
  }
];

export function taskFromTemplate(template: TaskTemplate): Partial<Task> {
  return {
    task: template.task,
    priority: template.priority,
    status: template.blockers ? "blocked" : "pending",
    blockers: template.blockers ?? "",
    notes: template.notes,
    tags: template.tags,
    estimatedMinutes: template.estimatedMinutes
  };
}
