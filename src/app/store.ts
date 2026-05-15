import { create } from "zustand";
import { endOfToday, startOfToday } from "../shared/utils/date";
import type {
  ActivityEvent,
  AppSettings,
  BrowserCapture,
  DailyPlan,
  ExportFormat,
  ExportPayload,
  FocusSession,
  Report,
  RuntimeResponse,
  Shift,
  Task
} from "../shared/types";
import { db } from "../shared/storage/db";
import { clearOpenAIApiKey, ensureDefaultShift, getAppSettings, hasOpenAIApiKey, setOpenAIApiKey, updateAppSettings } from "../shared/storage/settings";
import { createTask, listTasks, saveDailyPlan, startFocusSession, taskStats, updateTask } from "../shared/storage/repositories";
import { executeCommand as executeLocalCommand } from "../shared/services/commandExecutor";
import { generateDailyPlan } from "../shared/services/planner";
import { createLocalReport, exportTasks } from "../shared/services/reports";
import { downloadExport, hasRuntime, sendRuntimeMessage } from "../shared/chrome";

export type ViewKey = "overview" | "tasks" | "plan" | "focus" | "timeline" | "reports" | "insights" | "settings";

type TerminalLine = {
  id: string;
  role: "input" | "success" | "error" | "info";
  text: string;
};

type AppStore = {
  mode: "sidepanel" | "dashboard";
  activeView: ViewKey;
  loading: boolean;
  tasks: Task[];
  events: ActivityEvent[];
  sessions: FocusSession[];
  plans: DailyPlan[];
  reports: Report[];
  captures: BrowserCapture[];
  shifts: Shift[];
  settings?: AppSettings;
  hasApiKey: boolean;
  stats: { total: number; active: number; blocked: number; completed: number; focusMinutes: number };
  terminal: TerminalLine[];
  setMode: (mode: "sidepanel" | "dashboard") => void;
  setActiveView: (view: ViewKey) => void;
  load: () => Promise<void>;
  createTask: (input: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<Task>;
  startFocus: (taskId?: string, durationMinutes?: number) => Promise<void>;
  generatePlan: (adaptive?: boolean) => Promise<void>;
  generateReport: (ai?: boolean) => Promise<void>;
  exportData: (format: ExportFormat) => Promise<void>;
  executeCommand: (command: string) => Promise<RuntimeResponse>;
  capturePage: (taskId?: string) => Promise<void>;
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>;
  saveApiKey: (value: string) => Promise<void>;
  clearApiKey: () => Promise<void>;
};

const emptyStats = { total: 0, active: 0, blocked: 0, completed: 0, focusMinutes: 0 };

function terminalLine(role: TerminalLine["role"], text: string): TerminalLine {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, role, text };
}

function applyTheme(settings: AppSettings) {
  const root = document.documentElement;
  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  root.classList.toggle("light", settings.theme === "light" || (settings.theme === "system" && prefersLight));
}

function extractMessage(response: RuntimeResponse): string {
  if (!response.ok) return response.error ?? "Command failed";
  const data = response.data as { message?: string; export?: ExportPayload } | undefined;
  return data?.message ?? "Command completed";
}

export const useAppStore = create<AppStore>((set, get) => ({
  mode: "sidepanel",
  activeView: "overview",
  loading: true,
  tasks: [],
  events: [],
  sessions: [],
  plans: [],
  reports: [],
  captures: [],
  shifts: [],
  settings: undefined,
  hasApiKey: false,
  stats: emptyStats,
  terminal: [terminalLine("info", "Ops Copilot ready.")],

  setMode: (mode) => set({ mode }),
  setActiveView: (activeView) => set({ activeView }),

  load: async () => {
    set({ loading: true });
    await ensureDefaultShift();
    const [settings, hasKey, tasks, events, sessions, plans, reports, captures, shifts, stats] = await Promise.all([
      getAppSettings(),
      hasOpenAIApiKey(),
      listTasks(),
      db.activityEvents.orderBy("timestamp").reverse().limit(80).toArray(),
      db.focusSessions.orderBy("startTime").reverse().limit(40).toArray(),
      db.dailyPlans.orderBy("createdAt").reverse().limit(20).toArray(),
      db.reports.orderBy("createdAt").reverse().limit(20).toArray(),
      db.captures.orderBy("timestamp").reverse().limit(30).toArray(),
      db.shifts.toArray(),
      taskStats()
    ]);
    applyTheme(settings);
    set({ settings, hasApiKey: hasKey, tasks, events, sessions, plans, reports, captures, shifts, stats, loading: false });
  },

  createTask: async (input) => {
    const task = await createTask(input, "ui");
    await get().load();
    return task;
  },

  updateTask: async (id, patch) => {
    const task = await updateTask(id, patch, "ui");
    await get().load();
    return task;
  },

  startFocus: async (taskId, durationMinutes = 25) => {
    if (hasRuntime()) {
      await sendRuntimeMessage({ type: "START_FOCUS", payload: { taskId, durationMinutes } });
    } else {
      await startFocusSession({ taskId, durationMinutes, source: "ui" });
    }
    await get().load();
  },

  generatePlan: async (adaptive = false) => {
    const { tasks, shifts, settings } = get();
    const plan = generateDailyPlan(tasks, shifts, adaptive ? "adaptive" : settings?.planMode ?? "assisted");
    await saveDailyPlan(plan);
    await get().load();
  },

  generateReport: async (ai = true) => {
    if (ai && hasRuntime()) {
      await sendRuntimeMessage({ type: "AI_REPORT", payload: { title: "Performance Review", filters: { dateFrom: startOfToday(), dateTo: endOfToday() } } });
    } else {
      await createLocalReport("performance", { dateFrom: startOfToday(), dateTo: endOfToday() });
    }
    await get().load();
  },

  exportData: async (format) => {
    const response = hasRuntime()
      ? await sendRuntimeMessage<ExportPayload>({ type: "EXPORT_REPORT", payload: { format, filters: {} } })
      : { ok: true, data: await exportTasks(format, {}) };
    if (response.ok && response.data) {
      downloadExport(response.data.filename, response.data.mimeType, response.data.content, response.data.encoding);
    }
  },

  executeCommand: async (command) => {
    const trimmed = command.trim();
    if (!trimmed) return { ok: false, error: "Empty command" };
    set((state) => ({ terminal: [...state.terminal, terminalLine("input", `> ${trimmed}`)].slice(-80) }));
    const response = hasRuntime()
      ? await sendRuntimeMessage({ type: "EXECUTE_COMMAND", payload: { command: trimmed, source: "terminal" } })
      : await executeLocalCommand(trimmed, "terminal");
    const role = response.ok ? "success" : "error";
    set((state) => ({ terminal: [...state.terminal, terminalLine(role, extractMessage(response))].slice(-80) }));
    const maybeExport = (response.data as { export?: ExportPayload } | undefined)?.export;
    if (maybeExport) downloadExport(maybeExport.filename, maybeExport.mimeType, maybeExport.content, maybeExport.encoding);
    await get().load();
    return response;
  },

  capturePage: async (taskId) => {
    if (hasRuntime()) {
      await sendRuntimeMessage({ type: "CAPTURE_PAGE", payload: { taskId } });
    }
    await get().load();
  },

  saveSettings: async (patch) => {
    const settings = await updateAppSettings(patch);
    applyTheme(settings);
    await get().load();
  },

  saveApiKey: async (value) => {
    await setOpenAIApiKey(value);
    await get().load();
  },

  clearApiKey: async () => {
    await clearOpenAIApiKey();
    await get().load();
  }
}));
