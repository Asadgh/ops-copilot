import {
  BarChart3,
  Bell,
  BrainCircuit,
  CalendarDays,
  ClipboardList,
  Focus,
  Home,
  PanelRightOpen,
  Search,
  Settings,
  TimerReset
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppStore, type ViewKey } from "../app/store";
import { TerminalConsole } from "./components/TerminalConsole";
import { VoiceButton } from "./components/VoiceButton";
import { Button } from "./components/Button";
import { NotificationCenterDialog } from "./components/NotificationCenterDialog";
import { OverviewView } from "./views/OverviewView";
import { TasksView } from "./views/TasksView";
import { PlannerView } from "./views/PlannerView";
import { FocusView } from "./views/FocusView";
import { TimelineView } from "./views/TimelineView";
import { ReportsView } from "./views/ReportsView";
import { InsightsView } from "./views/InsightsView";
import { SettingsView } from "./views/SettingsView";
import { cn } from "./utils";

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

function ActiveView() {
  const activeView = useAppStore((store) => store.activeView);
  if (activeView === "tasks") return <TasksView />;
  if (activeView === "plan") return <PlannerView />;
  if (activeView === "focus") return <FocusView />;
  if (activeView === "timeline") return <TimelineView />;
  if (activeView === "reports") return <ReportsView />;
  if (activeView === "insights") return <InsightsView />;
  if (activeView === "settings") return <SettingsView />;
  return <OverviewView />;
}

export function App({ mode }: { mode: "sidepanel" | "dashboard" }) {
  const load = useAppStore((store) => store.load);
  const setMode = useAppStore((store) => store.setMode);
  const activeView = useAppStore((store) => store.activeView);
  const setActiveView = useAppStore((store) => store.setActiveView);
  const settings = useAppStore((store) => store.settings);
  const stats = useAppStore((store) => store.stats);
  const reminders = useAppStore((store) => store.reminders);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const activeReminderCount = reminders.filter((reminder) => reminder.status !== "dismissed").length;

  useEffect(() => {
    setMode(mode);
    void load();
  }, [load, mode, setMode]);

  return (
    <div className={cn("app-shell", mode)}>
      <header className="flex items-center gap-3 border-b border-oc-border bg-[#070a0e]/95 px-3">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded border border-oc-blue/50 bg-oc-blue/10 font-mono text-[11px] font-black text-oc-blue">OC</div>
          {mode === "dashboard" ? (
            <div className="hidden sm:block">
              <h1 className="text-[13px] font-semibold leading-none text-oc-text">Ops Copilot</h1>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-oc-muted">Local Ops Memory</p>
            </div>
          ) : null}
        </div>
        <label className="ml-auto hidden min-w-0 flex-1 max-w-xl items-center gap-2 rounded border border-oc-border bg-oc-surface px-3 py-1.5 text-xs text-oc-muted md:flex">
          <Search size={14} />
          <input className="min-w-0 flex-1 bg-transparent text-oc-text outline-none" placeholder="Search operational memory" />
        </label>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded border border-oc-border bg-oc-surface px-2 py-1 text-xs text-oc-muted lg:inline-flex">
            <span className="size-1.5 rounded-full bg-oc-success" /> 07:00-19:00
          </span>
          <span className="hidden rounded border border-oc-border bg-oc-surface px-2 py-1 text-xs text-oc-muted lg:inline">{stats.active} active</span>
          <span className="rounded border border-oc-border bg-oc-surface px-2 py-1 font-mono text-[10px] text-oc-cyan">{settings?.aiMode.toUpperCase() ?? "AI"}</span>
          <VoiceButton />
          <Button size="icon" variant={activeReminderCount ? "secondary" : "ghost"} title="Notifications" aria-label="Notifications" onClick={() => setNotificationsOpen(true)}>
            <Bell size={16} />
          </Button>
        </div>
      </header>

      <div className="workspace">
        <aside className="min-h-0 overflow-y-auto border-r border-oc-border bg-[#05080c]/86 p-2">
          {mode === "dashboard" ? <p className="mb-2 px-3 pt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-oc-muted">Workspace</p> : null}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeView === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveView(item.key)}
                  className={cn(
                    "relative flex h-9 w-full items-center gap-3 rounded px-3 text-left text-xs font-medium transition",
                    active ? "bg-oc-elevated text-oc-text" : "text-oc-muted hover:bg-oc-elevated/58 hover:text-oc-text",
                    mode === "sidepanel" && "justify-center px-0"
                  )}
                  title={item.label}
                >
                  {active ? <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-oc-blue" /> : null}
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

      <TerminalConsole />

      {mode === "dashboard" ? (
        <a
          href="sidepanel.html"
          className="fixed bottom-4 right-4 inline-flex items-center gap-2 rounded border border-oc-border bg-oc-elevated px-3 py-2 text-xs text-oc-muted hover:text-oc-text"
        >
          <PanelRightOpen size={14} />
          Side panel
        </a>
      ) : null}
      <NotificationCenterDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} />
    </div>
  );
}
