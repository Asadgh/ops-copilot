import { ArrowDown, ArrowUp, BrainCircuit, Check, GripVertical, RefreshCw, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppStore } from "../../app/store";
import type { DailyPlan } from "../../shared/types";
import { addClockMinutes } from "../../shared/utils/date";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";

export function PlannerView() {
  const plans = useAppStore((store) => store.plans);
  const generatePlan = useAppStore((store) => store.generatePlan);
  const savePlan = useAppStore((store) => store.savePlan);
  const startFocus = useAppStore((store) => store.startFocus);
  const tasks = useAppStore((store) => store.tasks);
  const plan = plans[0];
  const [draft, setDraft] = useState<DailyPlan | undefined>(plan);

  useEffect(() => {
    setDraft(plan);
  }, [plan]);

  function updateItem(id: string, patch: Partial<DailyPlan["items"][number]>) {
    setDraft((current) => current ? { ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) } : current);
  }

  function shiftItem(id: string, minutes: number) {
    setDraft((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === id ? {
        ...item,
        startTime: addClockMinutes(current.date, item.startTime, minutes),
        endTime: addClockMinutes(current.date, item.endTime, minutes)
      } : item)
    } : current);
  }

  function assignTask(itemId: string, taskId: string) {
    const task = tasks.find((candidate) => candidate.id === taskId);
    updateItem(itemId, {
      taskId: task?.id,
      title: task?.task ?? "Open operational block",
      reason: task ? `Scheduled from ${task.priority} priority task.` : undefined
    });
  }

  return (
    <div className="oc-page space-y-4">
      <Card>
        <SectionTitle
          title="Today's Plan"
          subtitle={plan?.rationale ?? "Editable operational planning, not rigid calendar scheduling."}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => generatePlan(false)}><RefreshCw size={14} /> Regenerate</Button>
              <Button size="sm" variant="primary" onClick={() => generatePlan(true)}><BrainCircuit size={14} /> Optimize</Button>
              {draft ? <Button size="sm" variant="success" onClick={() => savePlan(draft)}>Save</Button> : null}
            </div>
          }
        />
        {draft ? (
          <div className="space-y-2">
            {draft.items.map((item) => (
              <div key={item.id} className="grid gap-3 rounded-lg border border-oc-border/62 bg-oc-elevated/34 p-3 text-xs lg:grid-cols-[18px_92px_minmax(0,1fr)_150px]">
                <GripVertical size={14} className="mt-1 text-oc-muted" />
                <div className="grid gap-1">
                  <input className="oc-input w-full px-2 py-1 font-mono text-oc-blue" value={item.startTime} onChange={(event) => updateItem(item.id, { startTime: event.target.value })} />
                  <input className="oc-input w-full px-2 py-1 font-mono text-oc-blue" value={item.endTime} onChange={(event) => updateItem(item.id, { endTime: event.target.value })} />
                  <div className="grid grid-cols-2 gap-1">
                    <Button size="sm" variant="ghost" title="Move earlier" onClick={() => shiftItem(item.id, -15)}><ArrowUp size={13} /></Button>
                    <Button size="sm" variant="ghost" title="Move later" onClick={() => shiftItem(item.id, 15)}><ArrowDown size={13} /></Button>
                  </div>
                </div>
                <div>
                  <input className="oc-input w-full px-2 py-1 font-medium text-oc-text" value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} />
                  <select className="oc-select mt-2 w-full px-2 py-1 text-oc-text" value={item.taskId ?? ""} onChange={(event) => assignTask(item.id, event.target.value)}>
                    <option value="">Assign task to block</option>
                    {tasks.filter((task) => !["completed", "archived"].includes(task.status)).map((task) => (
                      <option key={task.id} value={task.id}>{task.task}</option>
                    ))}
                  </select>
                  {item.reason ? <p className="mt-1 text-oc-muted">{item.reason}</p> : null}
                </div>
                <div className="grid gap-2">
                  <select className="oc-select w-full px-2 py-1 text-oc-text" value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as DailyPlan["items"][number]["status"] })}>
                    <option value="planned">planned</option>
                    <option value="active">active</option>
                    <option value="completed">completed</option>
                    <option value="skipped">skipped</option>
                  </select>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" disabled={!item.taskId} onClick={() => startFocus(item.taskId, 25)}><Timer size={13} /> Focus</Button>
                    {item.status === "completed" ? <Check size={16} className="text-oc-success" /> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No plan yet" detail="Generate or optimize your day to create a shift-aware plan." />
        )}
      </Card>
    </div>
  );
}
