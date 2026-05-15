import { CheckCircle2, Clock3, ExternalLink, Focus, NotebookPen } from "lucide-react";
import type { Task } from "../../shared/types";
import { toTimeLabel } from "../../shared/utils/date";
import { useAppStore } from "../../app/store";
import { Button } from "./Button";
import { PriorityBadge, StatusBadge } from "./Badge";
import { Progress } from "./Progress";
import { cn } from "../utils";

export function TaskCard({ task, compact = false }: { task: Task; compact?: boolean }) {
  const updateTask = useAppStore((store) => store.updateTask);
  const startFocus = useAppStore((store) => store.startFocus);
  const capturePage = useAppStore((store) => store.capturePage);
  const tone = task.priority === "critical" ? "critical" : task.status === "completed" ? "success" : task.status === "blocked" ? "warning" : "blue";
  const rail =
    task.priority === "critical"
      ? "bg-oc-critical"
      : task.priority === "high"
        ? "bg-oc-warning"
        : task.status === "completed"
          ? "bg-oc-success"
          : "bg-oc-blue";

  return (
    <article className="group relative overflow-hidden rounded border border-oc-border/90 bg-oc-surface/92 transition hover:border-oc-muted/60">
      <span className={cn("absolute left-0 top-0 h-full w-1", rail)} />
      <div className="space-y-3 p-3 pl-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
          <span className="font-mono text-[11px] text-oc-muted">{task.completion}%</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold leading-5 text-oc-text">{task.task}</h3>
          <p className="mt-1 text-xs text-oc-muted">{task.location || "No location"} | Updated {toTimeLabel(task.metadata.updatedAt)}</p>
        </div>
        <Progress value={task.completion} tone={tone} />
      {!compact ? (
        <div className="grid gap-2 rounded border border-oc-border/70 bg-oc-bg/55 p-2 text-xs text-oc-muted sm:grid-cols-2">
          <p><span className="font-medium text-oc-text">Blocker:</span> {task.blockers || "None"}</p>
          <p><span className="font-medium text-oc-text">Notes:</span> {task.notes || "None"}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => startFocus(task.id, task.estimatedMinutes ?? 25)}>
          <Focus size={14} /> Focus
        </Button>
        <Button size="sm" variant="ghost" onClick={() => capturePage(task.id)}>
          <ExternalLink size={14} /> Capture
        </Button>
        <Button size="sm" variant="ghost" onClick={() => updateTask(task.id, { notes: `${task.notes ? `${task.notes}\n` : ""}Quick note added ${new Date().toLocaleTimeString()}` })}>
          <NotebookPen size={14} /> Note
        </Button>
        <Button size="sm" variant="success" onClick={() => updateTask(task.id, { status: "completed", completion: 100 })}>
          <CheckCircle2 size={14} /> Complete
        </Button>
        <Button size="sm" variant="ghost" onClick={() => updateTask(task.id, { status: "active" })}>
          <Clock3 size={14} /> Resume
        </Button>
      </div>
      </div>
    </article>
  );
}
