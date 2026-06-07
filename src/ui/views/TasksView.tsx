import { BrainCircuit, Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import type { Priority, TaskStatus } from "../../shared/types";
import { TASK_TEMPLATES } from "../../shared/taskTemplates";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { TaskCard } from "../components/TaskCard";
import { TaskEditorDialog } from "../components/TaskEditorDialog";

export function TasksView() {
  const tasks = useAppStore((store) => store.tasks);
  const searchQuery = useAppStore((store) => store.searchQuery);
  const createTaskFromTemplate = useAppStore((store) => store.createTaskFromTemplate);
  const cleanupTasks = useAppStore((store) => store.cleanupTasks);
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [status, setStatus] = useState<TaskStatus | "open" | "all">("open");
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const filtered = useMemo(
    () => {
      const query = searchQuery.trim().toLowerCase();
      return tasks.filter((task) => {
        const matchesPriority = priority === "all" || task.priority === priority;
        const matchesStatus = status === "all" || (status === "open" ? (query ? true : !["completed", "archived"].includes(task.status)) : task.status === status);
        const searchable = [task.task, task.location, task.blockers, task.notes, task.improvements, task.tags?.join(" "), task.metadata.sourceTitle, task.metadata.pageSummary, task.metadata.aiSummary].filter(Boolean).join(" ").toLowerCase();
        const matchesSearch = !query || searchable.includes(query);
        return matchesPriority && matchesStatus && matchesSearch;
      });
    },
    [priority, searchQuery, status, tasks]
  );

  return (
    <div className="oc-page space-y-4">
      <Card>
        <SectionTitle
          title="Task Board"
          subtitle="Operational work items, blockers, progress, and browser context."
          action={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setNewTaskOpen(true)}><Plus size={14} /> New Task</Button>
              <Button variant="secondary" onClick={() => cleanupTasks()}><BrainCircuit size={14} /> Clean Up</Button>
            </div>
          }
        />
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          {TASK_TEMPLATES.map((template) => (
            <Button key={template.key} size="sm" variant="ghost" onClick={() => createTaskFromTemplate(template.key)}>
              {template.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <SlidersHorizontal size={14} className="text-oc-muted" />
          <select className="oc-select px-3 py-2" value={priority} onChange={(event) => setPriority(event.target.value as Priority | "all")}>
            <option value="all">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select className="oc-select px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus | "open" | "all")}>
            <option value="open">Open work</option>
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          {searchQuery ? <span className="rounded-full bg-oc-blue/10 px-2.5 py-1 text-oc-blue">Search: {searchQuery}</span> : null}
        </div>
      </Card>
      <div className="grid gap-2 xl:grid-cols-2">
        {filtered.map((task) => <TaskCard key={task.id} task={task} />)}
      </div>
      {!filtered.length ? <EmptyState title="No matching tasks" detail="Change filters or create a new task." /> : null}
      <TaskEditorDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </div>
  );
}
