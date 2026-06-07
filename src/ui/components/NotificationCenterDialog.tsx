import * as Dialog from "@radix-ui/react-dialog";
import { Bell, CheckCircle2, Clock3, Focus, X } from "lucide-react";
import { useMemo } from "react";
import { useAppStore } from "../../app/store";
import { toTimeLabel } from "../../shared/utils/date";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

export function NotificationCenterDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const reminders = useAppStore((store) => store.reminders);
  const tasks = useAppStore((store) => store.tasks);
  const snoozeReminder = useAppStore((store) => store.snoozeReminder);
  const dismissReminder = useAppStore((store) => store.dismissReminder);
  const startFocus = useAppStore((store) => store.startFocus);
  const updateTaskWithUndo = useAppStore((store) => store.updateTaskWithUndo);
  const setActiveView = useAppStore((store) => store.setActiveView);
  const visibleReminders = useMemo(
    () => reminders.filter((reminder) => reminder.status !== "dismissed").sort((a, b) => a.dueAt - b.dueAt),
    [reminders]
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed right-4 top-16 z-50 max-h-[82vh] w-[min(420px,calc(100vw-32px))] overflow-hidden rounded-lg border border-oc-border/70 bg-oc-surface shadow-2xl shadow-black/35">
          <div className="flex items-start justify-between gap-4 border-b border-oc-border/55 px-4 py-3">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold text-oc-text">
                <Bell size={15} /> Notifications
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-oc-muted">Reminders, blocker follow-ups, and focus alerts.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="Close notifications"><X size={16} /></Button>
            </Dialog.Close>
          </div>
          <div className="max-h-[66vh] overflow-auto p-3">
            <div className="space-y-2">
              {visibleReminders.map((reminder) => (
                <article key={reminder.id} className="rounded-lg border border-oc-border/58 bg-oc-bg/55 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-oc-text">{reminder.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-oc-muted">
                        <Clock3 size={13} /> {toTimeLabel(reminder.dueAt)} | {reminder.status}
                      </p>
                    </div>
                    {reminder.dueAt <= Date.now() ? <span className="rounded-full bg-oc-warning/12 px-2 py-1 text-[11px] font-semibold text-oc-warning">Due</span> : null}
                  </div>
                  {reminder.taskId ? <p className="mt-2 text-xs text-oc-muted">Task: {tasks.find((task) => task.id === reminder.taskId)?.task ?? "Linked task"}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => { setActiveView("tasks"); onOpenChange(false); }}>Open Task</Button>
                    {reminder.taskId ? (
                      <>
                        <Button size="sm" variant="primary" onClick={() => startFocus(reminder.taskId, 25)}><Focus size={14} /> Focus</Button>
                        <Button size="sm" variant="success" onClick={() => updateTaskWithUndo(reminder.taskId!, { status: "completed", completion: 100 }, "complete reminder task")}><CheckCircle2 size={14} /> Complete</Button>
                      </>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => snoozeReminder(reminder.id, 10)}>Snooze 10m</Button>
                    <Button size="sm" variant="danger" onClick={() => dismissReminder(reminder.id)}>Dismiss</Button>
                  </div>
                </article>
              ))}
              {!visibleReminders.length ? <EmptyState title="No active notifications" detail="Create reminders from the console, task cards, or quick actions." /> : null}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
