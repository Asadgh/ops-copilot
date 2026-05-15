import { CalendarClock, CheckCircle2, CircleAlert, Focus, RefreshCw, RadioTower } from "lucide-react";
import { useAppStore } from "../../app/store";
import { formatDuration, toTimeLabel } from "../../shared/utils/date";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { TaskCard } from "../components/TaskCard";

export function OverviewView() {
  const settings = useAppStore((store) => store.settings);
  const stats = useAppStore((store) => store.stats);
  const tasks = useAppStore((store) => store.tasks);
  const plans = useAppStore((store) => store.plans);
  const sessions = useAppStore((store) => store.sessions);
  const events = useAppStore((store) => store.events);
  const generatePlan = useAppStore((store) => store.generatePlan);
  const activeSession = sessions.find((session) => session.status === "active");
  const plan = plans[0];
  const liveTasks = tasks.filter((task) => task.status === "active" || task.status === "blocked").slice(0, 5);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-oc-border pb-4">
        <div>
          <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-oc-cyan">
            <RadioTower size={13} /> Live shift
          </p>
          <h1 className="text-2xl font-semibold tracking-normal text-oc-text">Good day, {settings?.userName || "Operator"}</h1>
        </div>
        <div className="grid grid-cols-3 gap-2 text-right text-xs">
          <span className="rounded border border-oc-border bg-oc-surface px-2 py-1 text-oc-muted">07:00-19:00</span>
          <span className="rounded border border-oc-border bg-oc-surface px-2 py-1 text-oc-muted">{stats.active} active</span>
          <span className="rounded border border-oc-border bg-oc-surface px-2 py-1 text-oc-warning">{stats.blocked} blocked</span>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <Card className="p-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-oc-muted"><CalendarClock size={13} /> Tasks</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.total}</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-oc-muted"><Focus size={13} /> Focus</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatDuration(stats.focusMinutes)}</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-oc-muted"><CircleAlert size={13} /> Blocked</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-oc-warning">{stats.blocked}</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-oc-muted"><CheckCircle2 size={13} /> Completed</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-oc-success">{stats.completed}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
      <Card className="min-h-[300px]">
        <SectionTitle
          title="Operational Plan"
          subtitle={plan?.rationale ?? "Generate a shift-aware plan from active work."}
          action={<Button size="sm" onClick={() => generatePlan(false)}><RefreshCw size={14} /> Generate</Button>}
        />
        {plan ? (
          <div className="space-y-2">
            {plan.items.slice(0, 5).map((item) => (
              <div key={item.id} className="grid grid-cols-[88px_1fr] gap-3 border-b border-oc-border/70 py-2.5 text-xs last:border-b-0">
                <span className="font-mono text-oc-blue">{item.startTime}-{item.endTime}</span>
                <div>
                  <p className="font-medium text-oc-text">{item.title}</p>
                  {item.reason ? <p className="mt-1 text-oc-muted">{item.reason}</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No plan generated yet" detail="Use generate plan, optimize today, or the button above." />
        )}
      </Card>

        <Card className="min-h-[300px]">
          <SectionTitle title="Focus State" subtitle="Timer state is persisted and completed through Chrome alarms." />
          {activeSession ? (
            <div className="rounded border border-oc-blue/35 bg-oc-blue/10 p-4">
              <p className="font-mono text-4xl font-semibold tabular-nums">{activeSession.durationMinutes}:00</p>
              <p className="mt-2 text-xs text-oc-muted">Started {toTimeLabel(activeSession.startTime)} | Interruptions {activeSession.interruptions}</p>
            </div>
          ) : (
            <EmptyState title="No active focus session" detail="Start one from a task card or with start focus." />
          )}
          <div className="mt-4">
            <SectionTitle title="Live Queue" />
            <div className="space-y-2">
              {liveTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 border-b border-oc-border/60 py-2 text-xs last:border-b-0">
                  <span className="min-w-0 truncate text-oc-text">{task.task}</span>
                  <span className={task.status === "blocked" ? "font-mono text-oc-warning" : "font-mono text-oc-blue"}>{task.status}</span>
                </div>
              ))}
              {!liveTasks.length ? <p className="text-xs text-oc-muted">No active queue items.</p> : null}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
        <Card>
          <SectionTitle title="Operational Timeline" />
          <div className="space-y-2">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="grid grid-cols-[48px_1fr] gap-2 text-xs">
                <span className="font-mono text-oc-muted">{toTimeLabel(event.timestamp)}</span>
                <span className="text-oc-text">{event.title}</span>
              </div>
            ))}
            {!events.length ? <EmptyState title="No timeline events yet" /> : null}
          </div>
        </Card>

      <Card>
        <SectionTitle title="Current Priorities" />
        <div className="grid gap-2 xl:grid-cols-2">
          {tasks.slice(0, 4).map((task) => <TaskCard key={task.id} task={task} compact />)}
          {!tasks.length ? <EmptyState title="No tasks captured yet" detail="Try new task investigate routing delay." /> : null}
        </div>
      </Card>
      </div>
    </div>
  );
}
