import {
  BarChart3,
  Bell,
  BrainCircuit,
  CalendarDays,
  ClipboardList,
  FilePlus2,
  Focus,
  Home,
  LoaderCircle,
  Monitor,
  Moon,
  Command,
  PanelRightOpen,
  Search,
  Settings,
  Sun,
  TimerReset
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAppStore, type ViewKey } from "../app/store";
import { DEFAULT_SHIFT } from "../shared/constants";
import type { ThemeMode } from "../shared/types";
import { sendRuntimeMessage } from "../shared/chrome";
import { isWithinShift } from "../shared/utils/date";
import { VoiceButton } from "./components/VoiceButton";
import { Button } from "./components/Button";
import { NotificationCenterDialog } from "./components/NotificationCenterDialog";
import { CommandPalette } from "./components/CommandPalette";
import { OverviewView } from "./views/OverviewView";
import { cn } from "./utils";

const TasksView = lazy(() => import("./views/TasksView").then((module) => ({ default: module.TasksView })));
const PlannerView = lazy(() => import("./views/PlannerView").then((module) => ({ default: module.PlannerView })));
const FocusView = lazy(() => import("./views/FocusView").then((module) => ({ default: module.FocusView })));
const TimelineView = lazy(() => import("./views/TimelineView").then((module) => ({ default: module.TimelineView })));
const ReportsView = lazy(() => import("./views/ReportsView").then((module) => ({ default: module.ReportsView })));
const InsightsView = lazy(() => import("./views/InsightsView").then((module) => ({ default: module.InsightsView })));
const SettingsView = lazy(() => import("./views/SettingsView").then((module) => ({ default: module.SettingsView })));
const TerminalConsole = lazy(() => import("./components/TerminalConsole").then((module) => ({ default: module.TerminalConsole })));

const navItems: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Overview", icon: Home },
  { key: "tasks", label: "Tasks", icon: ClipboardList },
  { key: "plan", label: "Daily Plan", icon: CalendarDays },
  { key: "focus", label: "Focus", icon: Focus },
  { key: "timeline", label: "Timeline", icon: TimerReset },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "insights", label: "AI Insights", icon: BrainCircuit },
  { key: "settings", label: "Settings", icon: Settings }
];

const themeCycle: Record<ThemeMode, ThemeMode> = {
  dark: "light",
  light: "system",
  system: "dark"
};

const themeActions: Record<ThemeMode, { icon: LucideIcon; title: string }> = {
  dark: { icon: Moon, title: "Switch to dark theme" },
  light: { icon: Sun, title: "Switch to light theme" },
  system: { icon: Monitor, title: "Use system theme" }
};

type PageTaskStatus = {
  tone: "info" | "success" | "error";
  message: string;
};

type PageTaskResult = {
  task?: { id: string; task: string };
  message?: string;
};

function ViewLoading() {
  return (
    <div className="oc-page">
      <div className="rounded-lg border border-oc-border/65 bg-oc-surface/78 p-4 text-sm text-oc-muted">Loading workspace...</div>
    </div>
  );
}

function ConsoleLoading() {
  return (
    <div className="border-t border-oc-border/55 bg-oc-surface/92 p-3 text-xs font-semibold text-oc-muted backdrop-blur-xl">
      Loading command console...
    </div>
  );
}

function ActiveView() {
  const activeView = useAppStore((store) => store.activeView);
  const view =
    activeView === "tasks" ? <TasksView />
      : activeView === "plan" ? <PlannerView />
        : activeView === "focus" ? <FocusView />
          : activeView === "timeline" ? <TimelineView />
            : activeView === "reports" ? <ReportsView />
              : activeView === "insights" ? <InsightsView />
                : activeView === "settings" ? <SettingsView />
                  : <OverviewView />;
  return <Suspense fallback={<ViewLoading />}>{view}</Suspense>;
}

export function App({ mode }: { mode: "sidepanel" | "dashboard" }) {
  const load = useAppStore((store) => store.load);
  const setMode = useAppStore((store) => store.setMode);
  const activeView = useAppStore((store) => store.activeView);
  const setActiveView = useAppStore((store) => store.setActiveView);
  const settings = useAppStore((store) => store.settings);
  const saveSettings = useAppStore((store) => store.saveSettings);
  const searchQuery = useAppStore((store) => store.searchQuery);
  const setSearchQuery = useAppStore((store) => store.setSearchQuery);
  const stats = useAppStore((store) => store.stats);
  const tasks = useAppStore((store) => store.tasks);
  const captures = useAppStore((store) => store.captures);
  const reports = useAppStore((store) => store.reports);
  const events = useAppStore((store) => store.events);
  const reminders = useAppStore((store) => store.reminders);
  const shifts = useAppStore((store) => store.shifts);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [pageTaskStatus, setPageTaskStatus] = useState<PageTaskStatus | null>(null);
  const [creatingPageTask, setCreatingPageTask] = useState(false);
  const activeReminderCount = reminders.filter((reminder) => reminder.status !== "dismissed").length;
  const shift = shifts[0] ?? DEFAULT_SHIFT;
  const liveShift = isWithinShift(shift);
  const nextTheme = themeCycle[settings?.theme ?? "dark"];
  const ThemeIcon = themeActions[nextTheme].icon;

  useEffect(() => {
    setMode(mode);
    void load();
  }, [load, mode, setMode]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return [
      ...tasks.map((task) => ({ id: task.id, view: "tasks" as ViewKey, title: task.task, detail: [task.status, task.priority, task.blockers, task.notes, task.tags?.join(" ")].filter(Boolean).join(" ") })),
      ...captures.map((capture) => ({ id: capture.id, view: "timeline" as ViewKey, title: capture.title, detail: [capture.url, capture.summary, capture.selectedText].filter(Boolean).join(" ") })),
      ...reports.map((report) => ({ id: report.id, view: "reports" as ViewKey, title: report.title, detail: report.content })),
      ...events.map((event) => ({ id: event.id, view: "timeline" as ViewKey, title: event.title, detail: event.details ?? "" }))
    ]
      .filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [captures, events, reports, searchQuery, tasks]);

  async function createTaskFromCurrentPage() {
    setCreatingPageTask(true);
    setPageTaskStatus({ tone: "info", message: "Reading the current page..." });
    const response = await sendRuntimeMessage<PageTaskResult>({ type: "CAPTURE_PAGE", payload: {} });
    if (response.ok) {
      await load();
      setActiveView("tasks");
      setPageTaskStatus({ tone: "success", message: response.data?.message || "Task created from current page" });
    } else {
      setPageTaskStatus({ tone: "error", message: response.error || "Could not create a task from this page." });
    }
    setCreatingPageTask(false);
    window.setTimeout(() => setPageTaskStatus(null), 5200);
  }

  return (
    <div className={cn("app-shell", mode)}>
      <header className="flex items-center gap-3 border-b border-oc-border/55 bg-oc-bg/92 px-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <img className="size-9 rounded-lg shadow-sm shadow-oc-blue/25" src="icons/icon48.png" alt="Ops Copilot" />
          {mode === "dashboard" ? (
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold leading-none text-oc-text">Ops Copilot</h1>
              <p className="mt-1 text-[11px] text-oc-muted">Local ops workspace</p>
            </div>
          ) : null}
        </div>
        <div className="relative ml-auto hidden min-w-0 max-w-xl flex-1 md:block">
          <label className="flex h-9 items-center gap-2 rounded-lg border border-oc-border/70 bg-oc-surface/78 px-3 text-xs text-oc-muted shadow-sm">
            <Search size={14} />
            <input className="min-w-0 flex-1 bg-transparent text-oc-text outline-none placeholder:text-oc-muted/70" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search operational memory" />
            <span className="rounded border border-oc-border/70 px-1.5 py-0.5 text-[10px] text-oc-muted">Ctrl K</span>
          </label>
          {searchResults.length ? (
            <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-oc-border/70 bg-oc-surface shadow-xl shadow-black/20">
              {searchResults.map((item) => (
                <button
                  key={`${item.view}-${item.id}`}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-oc-elevated/70"
                  onClick={() => {
                    setActiveView(item.view);
                    setSearchQuery("");
                  }}
                >
                  <span className="block font-semibold text-oc-text">{item.title}</span>
                  <span className="block truncate text-oc-muted">{item.detail || item.view}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="oc-pill hidden lg:inline-flex" title={liveShift ? "Live shift" : "Off shift"}>
            <span className={cn("size-1.5 rounded-full", liveShift ? "bg-oc-success" : "bg-oc-muted")} /> {shift.startHour}-{shift.endHour}
          </span>
          <span className="oc-pill hidden lg:inline-flex">{stats.active} active</span>
          <span className="oc-pill font-semibold text-oc-cyan">{settings?.aiMode.toUpperCase() ?? "AI"}</span>
          <Button size="icon" variant="ghost" title="Command palette" aria-label="Command palette" onClick={() => setCommandOpen(true)}>
            <Command size={16} />
          </Button>
          {mode === "sidepanel" ? (
            <Button
              size="icon"
              variant={creatingPageTask ? "secondary" : "ghost"}
              title="Create task from current page"
              aria-label="Create task from current page"
              disabled={creatingPageTask}
              onClick={() => void createTaskFromCurrentPage()}
            >
              {creatingPageTask ? <LoaderCircle className="animate-spin" size={16} /> : <FilePlus2 size={16} />}
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            title={themeActions[nextTheme].title}
            aria-label={themeActions[nextTheme].title}
            disabled={!settings}
            onClick={() => void saveSettings({ theme: nextTheme })}
          >
            <ThemeIcon size={16} />
          </Button>
          <VoiceButton />
          <Button size="icon" variant={activeReminderCount ? "secondary" : "ghost"} title="Notifications" aria-label="Notifications" onClick={() => setNotificationsOpen(true)}>
            <Bell size={16} />
          </Button>
        </div>
      </header>

      {pageTaskStatus ? (
        <div
          className={cn(
            "pointer-events-none fixed right-3 top-14 z-50 max-w-[min(320px,calc(100vw-1.5rem))] rounded-lg border px-3 py-2 text-xs font-medium shadow-lg shadow-black/15",
            pageTaskStatus.tone === "error"
              ? "border-oc-warning/35 bg-oc-warning/12 text-oc-warning"
              : pageTaskStatus.tone === "success"
                ? "border-oc-success/35 bg-oc-success/12 text-oc-success"
                : "border-oc-blue/35 bg-oc-blue/12 text-oc-blue"
          )}
          role="status"
          aria-live="polite"
        >
          {pageTaskStatus.message}
        </div>
      ) : null}

      <div className="workspace">
        <aside className="min-h-0 overflow-y-auto border-r border-oc-border/55 bg-oc-surface/68 p-3 backdrop-blur">
          {mode === "dashboard" ? <p className="mb-2 px-3 pt-1 text-[11px] font-semibold text-oc-muted">Workspace</p> : null}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveView(item.key)}
                  className={cn(
                    "relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition",
                    active ? "bg-oc-blue text-white shadow-sm shadow-oc-blue/20" : "text-oc-muted hover:bg-oc-elevated/72 hover:text-oc-text",
                    mode === "sidepanel" && "justify-center px-0"
                  )}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} />
                  {mode === "dashboard" ? <span>{item.label}</span> : null}
                </button>
              );
            })}
          </nav>
        </aside>
        <main className="main-scroll">
          <ActiveView />
        </main>
      </div>

      <Suspense fallback={<ConsoleLoading />}>
        <TerminalConsole />
      </Suspense>

      {mode === "dashboard" ? (
        <a
          href="sidepanel.html"
          className="fixed bottom-[calc(max(148px,21vh)+1rem)] right-4 inline-flex items-center gap-2 rounded-lg border border-oc-border/75 bg-oc-elevated/90 px-3 py-2 text-xs font-medium text-oc-muted shadow-lg shadow-black/20 transition hover:text-oc-text"
        >
          <PanelRightOpen size={14} />
          Side panel
        </a>
      ) : null}
      <NotificationCenterDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
