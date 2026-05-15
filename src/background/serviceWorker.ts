import { RuntimeMessageSchema, type ExportPayload, type RuntimeMessage, type RuntimeResponse, type VoiceResult } from "../shared/types";
import { isWithinShift } from "../shared/utils/date";
import { createId } from "../shared/utils/id";
import { db } from "../shared/storage/db";
import { ensureDefaultShift, getAppSettings, initTrustedStorageAccess, updateLauncherSettings } from "../shared/storage/settings";
import {
  completeFocusSession,
  createCapture,
  createReminder,
  createTask,
  listTasks,
  saveReport,
  startFocusSession
} from "../shared/storage/repositories";
import { executeParsedCommand } from "../shared/services/commandExecutor";
import { parseCommandWithAI, summarizePageWithAI, summarizeTasksWithAI, transcribeAudio, generateAIReport } from "../shared/services/ai";
import { parseCommand } from "../shared/services/commandParser";
import { exportTasks, reportStats } from "../shared/services/reports";

const REMINDER_ALARM_PREFIX = "reminder:";
const FOCUS_ALARM_PREFIX = "focus:";

function respond<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data };
}

function errorResponse(error: unknown): RuntimeResponse {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

async function openSidePanel(tabId?: number, windowId?: number): Promise<void> {
  if (!chrome.sidePanel?.open) return;
  if (tabId) {
    await chrome.sidePanel.open({ tabId });
    return;
  }
  if (windowId) {
    await chrome.sidePanel.open({ windowId });
    return;
  }
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id) {
    await chrome.sidePanel.open({ tabId: active.id });
  }
}

async function currentTab(sender?: chrome.runtime.MessageSender): Promise<chrome.tabs.Tab | undefined> {
  if (sender?.tab) return sender.tab;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function siteDisabled(disabledSites: string[], hostname?: string): boolean {
  if (!hostname) return false;
  return disabledSites.some((site) => {
    const normalized = site.trim().replace(/^https?:\/\//, "").replace(/^www\./, "");
    if (!normalized) return false;
    return hostname.replace(/^www\./, "") === normalized || hostname.endsWith(`.${normalized}`);
  });
}

async function handleLauncherSettings(hostname?: string) {
  const [settings, shift] = await Promise.all([getAppSettings(), ensureDefaultShift()]);
  const launcher = { ...settings.launcher };
  if (siteDisabled(launcher.disabledSites, hostname)) launcher.visible = false;
  if (launcher.showOnlyDuringShift && !isWithinShift(shift)) launcher.visible = false;
  return launcher;
}

async function createNotification(id: string, options: chrome.notifications.NotificationOptions<true>): Promise<void> {
  const settings = await getAppSettings();
  if (!settings.notificationsEnabled || !chrome.notifications) return;
  await chrome.notifications.create(id, options);
}

async function scheduleReminderAlarm(reminderId: string, dueAt: number): Promise<void> {
  await chrome.alarms.create(`${REMINDER_ALARM_PREFIX}${reminderId}`, { when: dueAt });
}

async function scheduleFocusAlarm(sessionId: string, startTime: number, durationMinutes: number): Promise<void> {
  await chrome.alarms.create(`${FOCUS_ALARM_PREFIX}${sessionId}`, { when: startTime + durationMinutes * 60_000 });
}

async function scheduleFromRuntimeData(data: unknown): Promise<void> {
  const payload = data as {
    reminder?: { id: string; dueAt: number };
    session?: { id: string; startTime: number; durationMinutes: number };
  };
  if (payload.reminder) await scheduleReminderAlarm(payload.reminder.id, payload.reminder.dueAt);
  if (payload.session) await scheduleFocusAlarm(payload.session.id, payload.session.startTime, payload.session.durationMinutes);
}

async function handleCapture(message: Extract<RuntimeMessage, { type: "CAPTURE_PAGE" }>, sender?: chrome.runtime.MessageSender) {
  const tab = await currentTab(sender);
  const title = tab?.title || "Captured browser page";
  const url = tab?.url || "";
  const selectedText = message.payload?.selectedText;
  const summary = await summarizePageWithAI({ title, url, selectedText });
  let taskId = message.payload?.taskId;
  if (!taskId) {
    const task = await createTask(
      {
        task: `Review: ${title}`,
        priority: "medium",
        location: title,
        notes: selectedText || "",
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), sourceUrl: url, sourceTitle: title, pageSummary: summary }
      },
      "browser"
    );
    taskId = task.id;
  }
  const capture = await createCapture({ taskId, title, url, selectedText, summary });
  return respond({ capture, message: "Page captured" });
}

async function handleAiReport(payload: unknown) {
  const filters = (payload as { filters?: Record<string, unknown> })?.filters ?? {};
  const type = ((payload as { type?: string })?.type ?? "performance") as "performance";
  const title = (payload as { title?: string })?.title ?? "Performance Review";
  const stats = await reportStats(filters);
  let content: string;
  let aiGenerated = true;
  try {
    content = await generateAIReport({ title, tasks: stats.tasks, focusMinutes: stats.focusMinutes, filters });
  } catch {
    aiGenerated = false;
    content = await summarizeTasksWithAI(stats.tasks, "performance report");
  }
  const report = await saveReport({
    id: createId("report"),
    type,
    title,
    createdAt: Date.now(),
    periodStart: typeof filters.dateFrom === "number" ? filters.dateFrom : 0,
    periodEnd: typeof filters.dateTo === "number" ? filters.dateTo : Date.now(),
    content,
    aiGenerated,
    filters
  });
  return report;
}

async function handleRuntimeMessage(raw: unknown, sender?: chrome.runtime.MessageSender): Promise<RuntimeResponse> {
  const result = RuntimeMessageSchema.safeParse(raw);
  if (!result.success) return { ok: false, error: result.error.message };
  const message = result.data;

  if (message.type === "OPEN_SIDE_PANEL") {
    await openSidePanel(message.tabId ?? sender?.tab?.id, message.windowId);
    return respond({ message: "Side panel opened" });
  }

  if (message.type === "GET_LAUNCHER_SETTINGS") {
    return respond(await handleLauncherSettings(message.hostname));
  }

  if (message.type === "UPDATE_LAUNCHER_POSITION") {
    return respond(await updateLauncherSettings({ positionY: message.payload.positionY }));
  }

  if (message.type === "CREATE_TASK") {
    return respond({ task: await createTask(message.payload, "launcher"), message: "Task created" });
  }

  if (message.type === "CAPTURE_PAGE") {
    return handleCapture(message, sender);
  }

  if (message.type === "START_FOCUS") {
    const session = await startFocusSession({ ...message.payload, source: "launcher" });
    await scheduleFocusAlarm(session.id, session.startTime, session.durationMinutes);
    return respond({ session, message: "Focus session started" });
  }

  if (message.type === "SCHEDULE_REMINDER") {
    const reminder = await createReminder(message.payload);
    await scheduleReminderAlarm(reminder.id, reminder.dueAt);
    return respond({ reminder, message: "Reminder scheduled" });
  }

  if (message.type === "VOICE_TRANSCRIBE") {
    const transcript = await transcribeAudio(message.payload.audio, message.payload.mimeType);
    const command = await parseCommandWithAI(transcript);
    const execution = await executeParsedCommand(command, "voice");
    await scheduleFromRuntimeData(execution.data);
    const voiceResult: VoiceResult = { transcript, command, execution };
    return respond(voiceResult);
  }

  if (message.type === "AI_PARSE_COMMAND") {
    const command = String((message.payload as { command?: string })?.command ?? "");
    return respond(await parseCommandWithAI(command));
  }

  if (message.type === "AI_SUMMARIZE") {
    const tasks = await listTasks((message.payload as { filters?: Record<string, unknown> })?.filters ?? {});
    return respond({ summary: await summarizeTasksWithAI(tasks, "selected period") });
  }

  if (message.type === "AI_REPORT") {
    return respond({ report: await handleAiReport(message.payload) });
  }

  if (message.type === "EXECUTE_COMMAND") {
    const local = parseCommand(message.payload.command);
    const parsed = local.confidence < 0.7 ? await parseCommandWithAI(message.payload.command) : local;
    if (parsed.action === "capturePage") return handleCapture({ type: "CAPTURE_PAGE", payload: undefined }, sender);
    const execution = await executeParsedCommand(parsed, message.payload.source ?? "terminal");
    await scheduleFromRuntimeData(execution.data);
    return execution;
  }

  if (message.type === "EXPORT_REPORT") {
    const payload: ExportPayload = await exportTasks(message.payload.format, message.payload.filters);
    return respond(payload);
  }

  return { ok: false, error: "Unsupported runtime message." };
}

chrome.runtime.onInstalled.addListener(() => {
  void initTrustedStorageAccess();
  void ensureDefaultShift();
  void chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "ops-copilot-capture",
      title: "Add to Ops Copilot",
      contexts: ["page", "selection", "link"]
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  void initTrustedStorageAccess();
  void ensureDefaultShift();
});

chrome.action.onClicked.addListener((tab) => {
  void openSidePanel(tab.id, tab.windowId).catch(() => undefined);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleCapture(
    {
      type: "CAPTURE_PAGE",
      payload: {
        selectedText: info.selectionText,
        taskId: undefined
      }
    },
    { tab }
  ).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
  void handleRuntimeMessage(raw, sender).then(sendResponse).catch((error) => sendResponse(errorResponse(error)));
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    if (alarm.name.startsWith(REMINDER_ALARM_PREFIX)) {
      const id = alarm.name.slice(REMINDER_ALARM_PREFIX.length);
      const reminder = await db.reminders.get(id);
      if (!reminder) return;
      await db.reminders.put({ ...reminder, status: "fired" });
      await createNotification(`reminder:${id}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: reminder.title,
        message: "Reminder due",
        buttons: [{ title: "Resume" }, { title: "Snooze" }]
      });
    }

    if (alarm.name.startsWith(FOCUS_ALARM_PREFIX)) {
      const id = alarm.name.slice(FOCUS_ALARM_PREFIX.length);
      const session = await completeFocusSession(id);
      await createNotification(`focus:${id}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: "Focus complete",
        message: `${session.durationMinutes} minute focus session completed`,
        buttons: [{ title: "Open Ops Copilot" }]
      });
    }
  })();
});

chrome.notifications?.onButtonClicked.addListener((notificationId, buttonIndex) => {
  void (async () => {
    if (notificationId.startsWith("reminder:") && buttonIndex === 1) {
      const id = notificationId.slice("reminder:".length);
      const reminder = await db.reminders.get(id);
      if (!reminder) return;
      const snoozedUntil = Date.now() + 10 * 60_000;
      await db.reminders.put({ ...reminder, status: "snoozed", snoozedUntil });
      await scheduleReminderAlarm(id, snoozedUntil);
      return;
    }
    await openSidePanel();
  })();
});
