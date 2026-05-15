import { Pause, Play, TimerReset } from "lucide-react";
import { useAppStore } from "../../app/store";
import { formatDuration, toTimeLabel } from "../../shared/utils/date";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";

export function FocusView() {
  const sessions = useAppStore((store) => store.sessions);
  const tasks = useAppStore((store) => store.tasks);
  const startFocus = useAppStore((store) => store.startFocus);
  const activeSession = sessions.find((session) => session.status === "active");
  const activeTask = activeSession?.taskId ? tasks.find((task) => task.id === activeSession.taskId) : undefined;

  return (
    <div className="space-y-4 p-4">
      <Card className="grid min-h-[280px] place-items-center text-center">
        {activeSession ? (
          <div>
            <p className="text-5xl font-semibold tracking-normal">{activeSession.durationMinutes}:00</p>
            <p className="mt-3 text-lg font-medium">{activeTask?.task ?? "Current Focus Session"}</p>
            <p className="mt-2 text-xs text-oc-muted">Started {toTimeLabel(activeSession.startTime)} | Interruptions {activeSession.interruptions}</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button><Pause size={14} /> Pause</Button>
              <Button variant="success"><TimerReset size={14} /> Complete</Button>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-3xl font-semibold">Ready to focus</p>
            <p className="mt-2 text-sm text-oc-muted">Start a standard, deep work, or extended focus block.</p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={() => startFocus(undefined, 25)}><Play size={14} /> 25m</Button>
              <Button onClick={() => startFocus(undefined, 45)}>45m</Button>
              <Button onClick={() => startFocus(undefined, 60)}>60m</Button>
            </div>
          </div>
        )}
      </Card>
      <Card>
        <SectionTitle title="Focus History" subtitle={`Completed focus: ${formatDuration(sessions.filter((session) => session.status === "completed").reduce((sum, session) => sum + session.durationMinutes, 0))}`} />
        <div className="space-y-2">
          {sessions.slice(0, 8).map((session) => (
            <div key={session.id} className="flex items-center justify-between rounded-md border border-oc-border bg-oc-elevated/42 p-3 text-xs">
              <span>{session.durationMinutes} minute session</span>
              <span className="text-oc-muted">{session.status} | {toTimeLabel(session.startTime)}</span>
            </div>
          ))}
          {!sessions.length ? <EmptyState title="No focus sessions yet" /> : null}
        </div>
      </Card>
    </div>
  );
}
