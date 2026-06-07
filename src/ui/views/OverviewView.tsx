import { CalendarClock, CheckCircle2, CircleAlert, Focus, RefreshCw, RadioTower, Sparkles } from "lucide-react";
import { useAppStore } from "../../app/store";
import { DEFAULT_SHIFT } from "../../shared/constants";
import { formatDuration, isWithinShift, toTimeLabel } from "../../shared/utils/date";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { TaskCard } from "../components/TaskCard";

function hourForTimezone(timezone: string): number {
  try {
    const hour = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find((part) => part.type === "hour")?.value;
    return Number(hour);
  } catch {
    return new Date().getHours();
  }
}

function greetingForTimezone(timezone: string): string {
  const hour = hourForTimezone(timezone);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function OverviewView() {
  const settings = useAppStore((store) => store.settings);
  const stats = useAppStore((store) => store.stats);
  const tasks = useAppStore((store) => store.tasks);
  const plans = useAppStore((store) => store.plans);
  const sessions = useAppStore((store) => store.sessions);
  const events = useAppStore((store) => store.events);
  const shifts = useAppStore((store) => store.shifts);
  const generatePlan = useAppStore((store) => store.generatePlan);
  const generateDailyBriefing = useAppStore((store) => store.generateDailyBriefing);
  const activeSession = sessions.find((session) => session.status === "active");
  const plan = plans[0];
  const liveTasks = tasks.filter((task) => task.status === "active" || task.status === "blocked").slice(0, 5);
  const shift = shifts[0] ?? DEFAULT_SHIFT;
  const liveShift = isWithinShift(shift);
  const greeting = greetingForTimezone(shift.timezone);

  return (
    <div className="oc-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-oc-border/65 bg-oc-surface/72 p-4 shadow-sm shadow-black/10">
        <div>
          <p className={`mb-2 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${liveShift ? "bg-oc-cyan/10 text-oc-cyan" : "bg-oc-muted/10 text-oc-muted"}`}>
            {liveShift ? <RadioTower size={13} /> : <CalendarClock size={13} />} {liveShift ? "Live shift" : "Off shift"}
          </p>
          <h1 className="text-2xl font-semibold text-oc-text">{greeting}, {settings?.userName || "Operator"}</h1>
          <p className="mt-1 text-sm text-oc-muted">{liveShift ? "Here is the work that needs attention right now." : "You are outside scheduled shift hours; here is what is queued for attention."}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-xs">
          <span className="oc-pill">{shift.startHour}-{shift.endHour}</span>
          <span className="oc-pill">{stats.active} active</span>
          <span className="oc-pill border-oc-warning/35 bg-oc-warning/10 text-oc-warning">{stats.blocked} blocked</span>
          <Button size="sm" variant="primary" onClick={() => generateDailyBriefing()}><Sparkles size={14} /> Briefing</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-oc-muted"><CalendarClock size={14} className="text-oc-blue" /> Tasks</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-oc-muted"><Focus size={14} className="text-oc-cyan" /> Focus</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{formatDuration(stats.focusMinutes)}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-oc-muted"><CircleAlert size={14} className="text-oc-warning" /> Blocked</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-oc-warning">{stats.blocked}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-2 text-xs font-medium text-oc-muted"><CheckCircle2 size={14} className="text-oc-success" /> Completed</p>
          <p className="mt-3 text-3xl font-semibold tabular-nums text-oc-success">{stats.completed}</p>
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
              <div key={item.id} className="grid grid-cols-[92px_1fr] gap-3 rounded-lg border border-oc-border/50 bg-oc-elevated/34 p-3 text-xs">
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
            <div className="rounded-lg border border-oc-blue/35 bg-oc-blue/10 p-4">
              <p className="text-4xl font-semibold tabular-nums">{activeSession.durationMinutes}:00</p>
              <p className="mt-2 text-xs text-oc-muted">Started {toTimeLabel(activeSession.startTime)} | Interruptions {activeSession.interruptions}</p>
            </div>
          ) : (
            <EmptyState title="No active focus session" detail="Start one from a task card or with start focus." />
          )}
          <div className="mt-4">
            <SectionTitle title="Live Queue" />
            <div className="space-y-2">
              {liveTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-oc-border/48 bg-oc-elevated/28 px-3 py-2 text-xs">
                  <span className="min-w-0 truncate text-oc-text">{task.task}</span>
                  <span className={task.status === "blocked" ? "font-semibold text-oc-warning" : "font-semibold text-oc-blue"}>{task.status}</span>
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
              <div key={event.id} className="grid grid-cols-[52px_1fr] gap-3 rounded-lg border border-oc-border/42 bg-oc-elevated/24 px-3 py-2 text-xs">
                <span className="font-mono text-oc-blue">{toTimeLabel(event.timestamp)}</span>
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
