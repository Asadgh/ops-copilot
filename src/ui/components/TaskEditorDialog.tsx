import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import { priorityValues, taskStatusValues, type Priority, type Task, type TaskStatus } from "../../shared/types";
import { Button } from "./Button";

type TaskFormState = {
  task: string;
  priority: Priority;
  status: TaskStatus;
  completion: number;
  location: string;
  dueAt: string;
  estimatedMinutes: string;
  blockers: string;
  improvements: string;
  notes: string;
  tags: string;
};

function toDateTimeInput(value?: number): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string): number | undefined {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function formFromTask(task?: Task): TaskFormState {
  return {
    task: task?.task ?? "",
    priority: task?.priority ?? "medium",
    status: task?.status ?? "pending",
    completion: task?.completion ?? 0,
    location: task?.location ?? "",
    dueAt: toDateTimeInput(task?.dueAt),
    estimatedMinutes: task?.estimatedMinutes ? String(task.estimatedMinutes) : "",
    blockers: task?.blockers ?? "",
    improvements: task?.improvements ?? "",
    notes: task?.notes ?? "",
    tags: task?.tags?.join(", ") ?? ""
  };
}

function fieldClass(multiline = false): string {
  return [
    "w-full border border-oc-border/78 bg-oc-bg/72 px-3 text-sm text-oc-text placeholder:text-oc-muted",
    multiline ? "oc-textarea" : "oc-input",
    multiline ? "min-h-24 py-2 leading-5" : "h-9 py-1.5"
  ].join(" ");
}

function Label({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-oc-muted">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export function TaskEditorDialog({
  task,
  open,
  onOpenChange
}: {
  task?: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createTask = useAppStore((store) => store.createTask);
  const updateTask = useAppStore((store) => store.updateTask);
  const [form, setForm] = useState<TaskFormState>(() => formFromTask(task));
  const [error, setError] = useState("");
  const title = task ? "Edit Task" : "New Task";
  const description = task ? "Update operational task details, blockers, notes, and progress." : "Create a trackable operational task.";

  useEffect(() => {
    if (open) {
      setForm(formFromTask(task));
      setError("");
    }
  }, [open, task]);

  const canSave = useMemo(() => form.task.trim().length > 0, [form.task]);

  function update<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) {
      setError("Task title is required.");
      return;
    }

    const patch: Partial<Task> = {
      task: form.task.trim(),
      priority: form.priority,
      status: form.status,
      completion: Math.min(Math.max(Number(form.completion) || 0, 0), 100),
      location: form.location.trim(),
      dueAt: fromDateTimeInput(form.dueAt),
      estimatedMinutes: form.estimatedMinutes ? Math.max(Number(form.estimatedMinutes) || 0, 0) : undefined,
      blockers: form.blockers.trim(),
      improvements: form.improvements.trim(),
      notes: form.notes.trim(),
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    };

    if (task) {
      await updateTask(task.id, patch);
    } else {
      await createTask(patch);
    }
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/62 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(760px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-oc-border/70 bg-oc-surface shadow-2xl shadow-black/35">
          <form onSubmit={submit}>
            <div className="flex items-start justify-between gap-4 border-b border-oc-border/55 px-4 py-3">
              <div>
                <Dialog.Title className="text-base font-semibold text-oc-text">{title}</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-oc-muted">{description}</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="Close task editor">
                  <X size={16} />
                </Button>
              </Dialog.Close>
            </div>

            <div className="max-h-[68vh] overflow-auto p-4">
              <div className="grid gap-4">
                <Label label="Task">
                  <input className={fieldClass()} value={form.task} onChange={(event) => update("task", event.target.value)} autoFocus placeholder="Investigate routing delay" />
                </Label>

                <div className="grid gap-3 md:grid-cols-4">
                  <Label label="Priority">
                    <select className={fieldClass()} value={form.priority} onChange={(event) => update("priority", event.target.value as Priority)}>
                      {priorityValues.map((priority) => (
                        <option key={priority} value={priority}>{priority}</option>
                      ))}
                    </select>
                  </Label>
                  <Label label="Status">
                    <select className={fieldClass()} value={form.status} onChange={(event) => update("status", event.target.value as TaskStatus)}>
                      {taskStatusValues.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </Label>
                  <Label label="Completion">
                    <input className={fieldClass()} type="number" min="0" max="100" value={form.completion} onChange={(event) => update("completion", Number(event.target.value))} />
                  </Label>
                  <Label label="Effort">
                    <input className={fieldClass()} type="number" min="0" value={form.estimatedMinutes} onChange={(event) => update("estimatedMinutes", event.target.value)} placeholder="45" />
                  </Label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <Label label="Location">
                    <input className={fieldClass()} value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="Dispatch dashboard" />
                  </Label>
                  <Label label="Due At">
                    <input className={fieldClass()} type="datetime-local" value={form.dueAt} onChange={(event) => update("dueAt", event.target.value)} />
                  </Label>
                </div>

                <Label label="Blockers">
                  <textarea className={fieldClass(true)} value={form.blockers} onChange={(event) => update("blockers", event.target.value)} placeholder="Waiting on logs" />
                </Label>
                <Label label="Improvements">
                  <textarea className={fieldClass(true)} value={form.improvements} onChange={(event) => update("improvements", event.target.value)} placeholder="Automation or process improvements" />
                </Label>
                <Label label="Notes">
                  <textarea className={fieldClass(true)} value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Operational context" />
                </Label>
                <Label label="Tags">
                  <input className={fieldClass()} value={form.tags} onChange={(event) => update("tags", event.target.value)} placeholder="routing, dispatch, qa" />
                </Label>
              </div>
              {error ? <p className="mt-3 text-xs text-oc-critical">{error}</p> : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-oc-border/55 px-4 py-3">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button type="submit" variant="primary" disabled={!canSave}>Save Task</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
