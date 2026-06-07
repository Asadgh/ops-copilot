import { BellPlus, CheckCircle2, Clock3, ExternalLink, Focus, NotebookPen, Pencil } from "lucide-react";
import { useState } from "react";
import type { Task } from "../../shared/types";
import { toTimeLabel } from "../../shared/utils/date";
import { useAppStore } from "../../app/store";
import { Button } from "./Button";
import { PriorityBadge, StatusBadge } from "./Badge";
import { Progress } from "./Progress";
import { cn } from "../utils";
import { TaskEditorDialog } from "./TaskEditorDialog";
import { ReminderDialog } from "./ReminderDialog";

export function TaskCard({ task, compact = false }: { task: Task; compact?: boolean }) {
  const updateTask = useAppStore((store) => store.updateTask);
  const startFocus = useAppStore((store) => store.startFocus);
  const capturePage = useAppStore((store) => store.capturePage);
  const [editorOpen, setEditorOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
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
    <article className="group relative overflow-hidden rounded-lg border border-oc-border/70 bg-oc-surface/88 shadow-sm shadow-black/10 transition hover:-translate-y-0.5 hover:border-oc-muted/55 hover:bg-oc-surface">
      <span className={cn("absolute inset-x-0 top-0 h-1", rail)} />
      <div className="space-y-4 p-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>
          <span className="rounded-full bg-oc-elevated/70 px-2 py-1 text-[11px] font-semibold text-oc-muted">{task.completion}%</span>
        </div>
        <div>
          <button className="text-left text-sm font-semibold leading-5 text-oc-text transition hover:text-oc-blue" onClick={() => setEditorOpen(true)}>
            {task.task}
          </button>
          <p className="mt-1 text-xs text-oc-muted">{task.location || "No location"} - Updated {toTimeLabel(task.metadata.updatedAt)}</p>
        </div>
        <Progress value={task.completion} tone={tone} />
      {!compact ? (
        <div className="grid gap-3 rounded-lg border border-oc-border/58 bg-oc-bg/45 p-3 text-xs leading-5 text-oc-muted sm:grid-cols-2">
          <p><span className="font-medium text-oc-text">Blocker:</span> {task.blockers || "None"}</p>
          <p><span className="font-medium text-oc-text">Notes:</span> {task.notes || "None"}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-oc-border/50 pt-3">
        <Button size="sm" variant="secondary" onClick={() => setEditorOpen(true)}>
          <Pencil size={14} /> Edit
        </Button>
        <Button size="sm" variant="primary" onClick={() => startFocus(task.id, task.estimatedMinutes ?? 25)}>
          <Focus size={14} /> Focus
        </Button>
        {!compact ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => capturePage(task.id)}>
              <ExternalLink size={14} /> Capture
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setReminderOpen(true)}>
              <BellPlus size={14} /> Remind
            </Button>
            <Button size="sm" variant="ghost" onClick={() => updateTask(task.id, { notes: `${task.notes ? `${task.notes}\n` : ""}Quick note added ${new Date().toLocaleTimeString()}` })}>
              <NotebookPen size={14} /> Note
            </Button>
          </>
        ) : null}
        <Button size="sm" variant="success" onClick={() => updateTask(task.id, { status: "completed", completion: 100 })}>
          <CheckCircle2 size={14} /> Complete
        </Button>
        {!compact ? (
          <Button size="sm" variant="ghost" onClick={() => updateTask(task.id, { status: "active" })}>
            <Clock3 size={14} /> Resume
          </Button>
        ) : null}
      </div>
      </div>
      <TaskEditorDialog task={task} open={editorOpen} onOpenChange={setEditorOpen} />
      <ReminderDialog task={task} open={reminderOpen} onOpenChange={setReminderOpen} />
    </article>
  );
}
