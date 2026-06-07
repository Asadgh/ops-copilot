import { BrainCircuit, Check, GripVertical, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppStore } from "../../app/store";
import type { DailyPlan } from "../../shared/types";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";

export function PlannerView() {
  const plans = useAppStore((store) => store.plans);
  const generatePlan = useAppStore((store) => store.generatePlan);
  const savePlan = useAppStore((store) => store.savePlan);
  const plan = plans[0];
  const [draft, setDraft] = useState<DailyPlan | undefined>(plan);

  useEffect(() => {
    setDraft(plan);
  }, [plan]);

  function updateItem(id: string, patch: Partial<DailyPlan["items"][number]>) {
    setDraft((current) => current ? { ...current, items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item) } : current);
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
              <div key={item.id} className="grid grid-cols-[18px_92px_minmax(0,1fr)_130px] items-start gap-3 rounded-lg border border-oc-border/62 bg-oc-elevated/34 p-3 text-xs">
                <GripVertical size={14} className="mt-1 text-oc-muted" />
                <div className="grid gap-1">
                  <input className="oc-input w-full px-2 py-1 font-mono text-oc-blue" value={item.startTime} onChange={(event) => updateItem(item.id, { startTime: event.target.value })} />
                  <input className="oc-input w-full px-2 py-1 font-mono text-oc-blue" value={item.endTime} onChange={(event) => updateItem(item.id, { endTime: event.target.value })} />
                </div>
                <div>
                  <input className="oc-input w-full px-2 py-1 font-medium text-oc-text" value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} />
                  {item.reason ? <p className="mt-1 text-oc-muted">{item.reason}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <select className="oc-select w-full px-2 py-1 text-oc-text" value={item.status} onChange={(event) => updateItem(item.id, { status: event.target.value as DailyPlan["items"][number]["status"] })}>
                    <option value="planned">planned</option>
                    <option value="active">active</option>
                    <option value="completed">completed</option>
                    <option value="skipped">skipped</option>
                  </select>
                  {item.status === "completed" ? <Check size={16} className="text-oc-success" /> : null}
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
