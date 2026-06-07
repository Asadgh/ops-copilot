import * as Dialog from "@radix-ui/react-dialog";
import { BrainCircuit, ClipboardList, FilePlus2, Focus, Moon, PanelTopClose, Search, Settings, Sparkles, Sun, X } from "lucide-react";
import { useMemo, useState } from "react";
import { TASK_TEMPLATES } from "../../shared/taskTemplates";
import { useAppStore } from "../../app/store";
import { Button } from "./Button";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const tasks = useAppStore((store) => store.tasks);
  const settings = useAppStore((store) => store.settings);
  const saveSettings = useAppStore((store) => store.saveSettings);
  const setActiveView = useAppStore((store) => store.setActiveView);
  const createTaskFromTemplate = useAppStore((store) => store.createTaskFromTemplate);
  const capturePage = useAppStore((store) => store.capturePage);
  const startFocus = useAppStore((store) => store.startFocus);
  const generateReport = useAppStore((store) => store.generateReport);
  const cleanupTasks = useAppStore((store) => store.cleanupTasks);
  const generateDailyBriefing = useAppStore((store) => store.generateDailyBriefing);
  const firstOpenTask = tasks.find((task) => !["completed", "archived"].includes(task.status));

  const actions = useMemo(() => {
    const base = [
      { label: "Capture current page as task", hint: "Browser context", icon: FilePlus2, run: () => capturePage() },
      { label: "Start focus on next task", hint: firstOpenTask?.task ?? "No open task", icon: Focus, disabled: !firstOpenTask, run: () => startFocus(firstOpenTask?.id, firstOpenTask?.estimatedMinutes ?? 25) },
      { label: "Generate daily briefing", hint: "What should I do next?", icon: Sparkles, run: () => generateDailyBriefing() },
      { label: "Clean up task list", hint: "Rename, tag, dedupe", icon: BrainCircuit, run: () => cleanupTasks() },
      { label: "Generate performance report", hint: "Today", icon: ClipboardList, run: () => generateReport(true) },
      {
        label: settings?.theme === "light" ? "Switch to dark theme" : "Switch to light theme",
        hint: "Appearance",
        icon: settings?.theme === "light" ? Moon : Sun,
        run: () => saveSettings({ theme: settings?.theme === "light" ? "dark" : "light" })
      },
      { label: "Open settings", hint: "Preferences", icon: Settings, run: () => setActiveView("settings") }
    ];
    return [
      ...base,
      ...TASK_TEMPLATES.map((template) => ({
        label: `Create ${template.label} task`,
        hint: template.notes,
        icon: ClipboardList,
        run: () => createTaskFromTemplate(template.key)
      }))
    ];
  }, [capturePage, cleanupTasks, createTaskFromTemplate, firstOpenTask, generateDailyBriefing, generateReport, saveSettings, setActiveView, settings?.theme, startFocus]);

  const filtered = actions.filter((action) => `${action.label} ${action.hint}`.toLowerCase().includes(query.trim().toLowerCase()));

  async function run(action: (typeof actions)[number]) {
    if ("disabled" in action && action.disabled) return;
    await action.run();
    setQuery("");
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-20 z-50 w-[min(620px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-lg border border-oc-border/70 bg-oc-surface shadow-2xl shadow-black/35">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-oc-border/55 px-3 py-2">
            <Search size={16} className="text-oc-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-sm text-oc-text outline-none placeholder:text-oc-muted/70" placeholder="Run a command..." autoFocus />
            <Button size="icon" variant="ghost" onClick={() => onOpenChange(false)} aria-label="Close command palette"><X size={16} /></Button>
          </div>
          <div className="max-h-[62vh] overflow-auto p-2">
            {filtered.map((action) => {
              const Icon = action.icon;
              const disabled = "disabled" in action && action.disabled;
              return (
                <button
                  key={action.label}
                  disabled={disabled}
                  onClick={() => void run(action)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-oc-elevated/62 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg border border-oc-border/60 bg-oc-bg/60 text-oc-blue"><Icon size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-oc-text">{action.label}</span>
                    <span className="block truncate text-xs text-oc-muted">{action.hint}</span>
                  </span>
                  <PanelTopClose size={14} className="text-oc-muted" />
                </button>
              );
            })}
            {!filtered.length ? <p className="px-3 py-8 text-center text-sm text-oc-muted">No matching commands.</p> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
