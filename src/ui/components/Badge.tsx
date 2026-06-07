import { cn } from "../utils";
import type { Priority, TaskStatus } from "../../shared/types";

const priorityStyles: Record<Priority, string> = {
  low: "border-oc-muted/40 text-oc-muted bg-oc-muted/8",
  medium: "border-oc-blue/35 text-oc-blue bg-oc-blue/10",
  high: "border-oc-warning/45 text-oc-warning bg-oc-warning/12",
  critical: "border-oc-critical/50 text-oc-critical bg-oc-critical/12"
};

const statusStyles: Record<TaskStatus, string> = {
  pending: "border-oc-muted/35 text-oc-muted bg-oc-muted/8",
  active: "border-oc-blue/35 text-oc-blue bg-oc-blue/10",
  blocked: "border-oc-warning/45 text-oc-warning bg-oc-warning/12",
  completed: "border-oc-success/45 text-oc-success bg-oc-success/12",
  archived: "border-oc-border text-oc-muted bg-oc-elevated/50"
};

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-semibold capitalize", className)}>{children}</span>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={priorityStyles[priority]}>{priority}</Badge>;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <Badge className={statusStyles[status]}>{status}</Badge>;
}
