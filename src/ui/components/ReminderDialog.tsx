import * as Dialog from "@radix-ui/react-dialog";
import { BellPlus, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAppStore } from "../../app/store";
import type { Task } from "../../shared/types";
import { Button } from "./Button";

function defaultDueAt(): string {
  const date = new Date(Date.now() + 20 * 60_000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ReminderDialog({
  task,
  open,
  onOpenChange
}: {
  task?: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const scheduleReminder = useAppStore((store) => store.scheduleReminder);
  const [title, setTitle] = useState(task ? `Follow up: ${task.task}` : "Operational reminder");
  const [dueAt, setDueAt] = useState(defaultDueAt);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const timestamp = new Date(dueAt).getTime();
    await scheduleReminder({
      taskId: task?.id,
      title: title.trim() || task?.task || "Operational reminder",
      dueAt: Number.isNaN(timestamp) ? Date.now() + 20 * 60_000 : timestamp
    });
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/58" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-oc-border bg-oc-surface shadow-2xl">
          <form onSubmit={submit}>
            <div className="flex items-start justify-between gap-4 border-b border-oc-border px-4 py-3">
              <div>
                <Dialog.Title className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-oc-text">
                  <BellPlus size={15} /> Add Reminder
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-oc-muted">{task?.task ?? "Schedule an operational reminder."}</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="Close reminder dialog"><X size={16} /></Button>
              </Dialog.Close>
            </div>
            <div className="grid gap-3 p-4">
              <label className="text-xs font-medium text-oc-muted">
                <span className="mb-1.5 block">Title</span>
                <input className="h-9 w-full rounded border border-oc-border bg-oc-bg px-3 text-sm text-oc-text" value={title} onChange={(event) => setTitle(event.target.value)} />
              </label>
              <label className="text-xs font-medium text-oc-muted">
                <span className="mb-1.5 block">Due At</span>
                <input className="h-9 w-full rounded border border-oc-border bg-oc-bg px-3 text-sm text-oc-text" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-oc-border px-4 py-3">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button type="submit" variant="primary">Schedule</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
