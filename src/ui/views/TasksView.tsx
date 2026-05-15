import { Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import type { Priority, TaskStatus } from "../../shared/types";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { TaskCard } from "../components/TaskCard";

export function TasksView() {
  const tasks = useAppStore((store) => store.tasks);
  const createTask = useAppStore((store) => store.createTask);
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const filtered = useMemo(
    () => tasks.filter((task) => (priority === "all" || task.priority === priority) && (status === "all" || task.status === status)),
    [priority, status, tasks]
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4">
      <Card>
        <SectionTitle
          title="Task Board"
          subtitle="Operational work items, blockers, progress, and browser context."
          action={<Button onClick={() => createTask({ task: "New operational task", priority: "medium" })}><Plus size={14} /> New Task</Button>}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <SlidersHorizontal size={14} className="text-oc-muted" />
          <select className="rounded border border-oc-border bg-oc-bg px-2 py-1.5" value={priority} onChange={(event) => setPriority(event.target.value as Priority | "all")}>
            <option value="all">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="rounded border border-oc-border bg-oc-bg px-2 py-1.5" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | "all")}>
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </Card>
      <div className="grid gap-2 xl:grid-cols-2">
        {filtered.map((task) => <TaskCard key={task.id} task={task} />)}
      </div>
      {!filtered.length ? <EmptyState title="No matching tasks" detail="Change filters or create a new task." /> : null}
    </div>
  );
}
