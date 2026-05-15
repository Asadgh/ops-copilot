import { BrainCircuit, Check, GripVertical, RefreshCw } from "lucide-react";
import { useAppStore } from "../../app/store";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";

export function PlannerView() {
  const plans = useAppStore((store) => store.plans);
  const generatePlan = useAppStore((store) => store.generatePlan);
  const plan = plans[0];

  return (
    <div className="space-y-4 p-4">
      <Card>
        <SectionTitle
          title="Today's Plan"
          subtitle={plan?.rationale ?? "Editable operational planning, not rigid calendar scheduling."}
          action={
            <div className="flex gap-2">
              <Button size="sm" onClick={() => generatePlan(false)}><RefreshCw size={14} /> Regenerate</Button>
              <Button size="sm" variant="primary" onClick={() => generatePlan(true)}><BrainCircuit size={14} /> Optimize</Button>
            </div>
          }
        />
        {plan ? (
          <div className="space-y-2">
            {plan.items.map((item) => (
              <div key={item.id} className="grid grid-cols-[18px_92px_1fr_24px] items-start gap-3 rounded-md border border-oc-border bg-oc-elevated/42 p-3 text-xs">
                <GripVertical size={14} className="mt-1 text-oc-muted" />
                <span className="font-mono text-oc-blue">{item.startTime}<br />{item.endTime}</span>
                <div>
                  <p className="font-medium text-oc-text">{item.title}</p>
                  {item.reason ? <p className="mt-1 text-oc-muted">{item.reason}</p> : null}
                </div>
                {item.status === "completed" ? <Check size={16} className="text-oc-success" /> : null}
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
