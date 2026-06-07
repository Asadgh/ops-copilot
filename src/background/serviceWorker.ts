import { RuntimeMessageSchema, type ExportPayload, type RuntimeMessage, type RuntimeResponse, type VoiceResult } from "../shared/types";
import { createId } from "../shared/utils/id";
import { db } from "../shared/storage/db";
import { ensureDefaultShift, getAppSettings, initTrustedStorageAccess } from "../shared/storage/settings";
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
import { backupToSyncStorageQuietly, restoreFromSyncBackupIfEmpty } from "../shared/storage/syncBackup";

const REMINDER_ALARM_PREFIX = "reminder:";
const FOCUS_ALARM_PREFIX = "focus:";
let storageReady: Promise<void> | undefined;

function respond<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data };
}

function errorResponse(error: unknown): RuntimeResponse {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function prepareStorage(): Promise<void> {
  await initTrustedStorageAccess();
  await restoreFromSyncBackupIfEmpty();
  await ensureDefaultShift();
}

async function ensureStorageReady(): Promise<void> {
  storageReady ??= prepareStorage().catch((error) => {
    storageReady = undefined;
    throw error;
  });
  await storageReady;
}

async function openSidePanel(tabId?: number, windowId?: number): Promise<{ mode: "sidePanel" | "tab"; message: string }> {
  if (chrome.sidePanel?.open) {
    try {
      if (tabId) {
        await chrome.sidePanel.open({ tabId });
        return { mode: "sidePanel", message: "Side panel opened" };
      }
      if (windowId) {
        await chrome.sidePanel.open({ windowId });
        return { mode: "sidePanel", message: "Side panel opened" };
      }
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active?.id) {
        await chrome.sidePanel.open({ tabId: active.id });
        return { mode: "sidePanel", message: "Side panel opened" };
      }
    } catch {
      // Fall through to the tab fallback when Chrome rejects sidePanel.open,
      // which can happen when user activation is not propagated from a page.
    }
  }

  const tab = await chrome.tabs.create({ active: true, url: chrome.runtime.getURL("sidepanel.html") });
  return { mode: "tab", message: tab.id ? "Opened Ops Copilot in a tab" : "Opened Ops Copilot" };
}

async function currentTab(sender?: chrome.runtime.MessageSender): Promise<chrome.tabs.Tab | undefined> {
  if (sender?.tab) return sender.tab;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

type PageContext = {
  title: string;
  url: string;
  selectedText?: string;
  description?: string;
  headings: string[];
  excerpt?: string;
};

function canInspectPage(url?: string): boolean {
  return Boolean(url && /^https?:\/\//.test(url));
}

function compactText(value?: string, maxLength = 6000): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : undefined;
}

async function readPageContext(tab?: chrome.tabs.Tab, selectedText?: string): Promise<PageContext> {
  if (!tab?.id || !canInspectPage(tab.url)) {
    throw new Error("Open a regular webpage first. Chrome pages and extension pages cannot be inspected for task creation.");
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const metaDescription =
          document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ||
          document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ||
          "";
        const headings = Array.from(document.querySelectorAll("h1,h2,h3"))
          .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
          .filter((text): text is string => Boolean(text))
          .slice(0, 10);
        const root = document.querySelector("main, article") ?? document.body;
        const excerpt = (root?.textContent || document.body?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 5000);
        return {
          title: document.title,
          url: location.href,
          selectedText: window.getSelection()?.toString().trim() || "",
          description: metaDescription.trim(),
          headings,
          excerpt
        };
      }
    });
    const page = result?.result as PageContext | undefined;
    return {
      title: compactText(page?.title, 180) || tab.title || "Current page",
      url: page?.url || tab.url || "",
      selectedText: compactText(selectedText || page?.selectedText, 3000),
      description: compactText(page?.description, 1000),
      headings: page?.headings ?? [],
      excerpt: compactText(page?.excerpt, 5000)
    };
  } catch (error) {
    return {
      title: tab.title || "Current page",
      url: tab.url || "",
      selectedText: compactText(selectedText, 3000),
      headings: [],
      excerpt: error instanceof Error ? `Could not read page text: ${error.message}` : undefined
    };
  }
}

function pageContextForSummary(page: PageContext): string {
  return [
    page.selectedText ? `Selected text: ${page.selectedText}` : "",
    page.description ? `Description: ${page.description}` : "",
    page.headings.length ? `Headings: ${page.headings.join(" | ")}` : "",
    page.excerpt ? `Visible page text: ${page.excerpt}` : ""
  ].filter(Boolean).join("\n\n").slice(0, 7000);
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
  const page = await readPageContext(tab, message.payload?.selectedText);
  const title = page.title || "Captured browser page";
  const url = page.url || "";
  const selectedText = page.selectedText;
  const summaryInput = pageContextForSummary(page);
  const summary = await summarizePageWithAI({ title, url, selectedText: summaryInput || selectedText });
  let taskId = message.payload?.taskId;
  let task: Awaited<ReturnType<typeof createTask>> | undefined;
  if (!taskId) {
    const seedTitle = compactText(selectedText?.split(/[.!?]/)[0], 90);
    task = await createTask(
      {
        task: seedTitle ? `Follow up: ${seedTitle}` : `Review: ${title}`,
        priority: "medium",
        location: title,
        notes: [
          summary,
          page.description ? `Description: ${page.description}` : "",
          page.headings.length ? `Page sections: ${page.headings.join(" | ")}` : "",
          page.excerpt ? `Excerpt: ${page.excerpt.slice(0, 1200)}` : ""
        ].filter(Boolean).join("\n\n"),
        tags: ["page", "capture"],
        metadata: { createdAt: Date.now(), updatedAt: Date.now(), sourceUrl: url, sourceTitle: title, pageSummary: summary }
      },
      "browser"
    );
    taskId = task.id;
  }
  const capture = await createCapture({ taskId, title, url, selectedText, summary });
  return respond({ task, capture, message: task ? "Task created from current page" : "Page captured" });
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
  await ensureStorageReady();

  if (message.type === "OPEN_SIDE_PANEL") {
    return respond(await openSidePanel(message.tabId ?? sender?.tab?.id, message.windowId ?? sender?.tab?.windowId));
  }

  if (message.type === "CREATE_TASK") {
    return respond({ task: await createTask(message.payload, "ui"), message: "Task created" });
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
    const transcript = await transcribeAudio(base64ToArrayBuffer(message.payload.audioBase64), message.payload.mimeType);
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
  void ensureStorageReady().catch(() => undefined);
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
  void ensureStorageReady().catch(() => undefined);
});

chrome.action.onClicked.addListener((tab) => {
  void openSidePanel(tab.id, tab.windowId).catch(() => undefined);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void (async () => {
    await ensureStorageReady();
    await handleCapture(
      {
        type: "CAPTURE_PAGE",
        payload: {
          selectedText: info.selectionText,
          taskId: undefined
        }
      },
      { tab }
    );
  })().catch(() => undefined);
});

chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
  void handleRuntimeMessage(raw, sender).then(sendResponse).catch((error) => sendResponse(errorResponse(error)));
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  void (async () => {
    if (alarm.name.startsWith(REMINDER_ALARM_PREFIX)) {
      await ensureStorageReady();
      const id = alarm.name.slice(REMINDER_ALARM_PREFIX.length);
      const reminder = await db.reminders.get(id);
      if (!reminder) return;
      await db.reminders.put({ ...reminder, status: "fired" });
      await backupToSyncStorageQuietly();
      await createNotification(`reminder:${id}`, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: reminder.title,
        message: "Reminder due",
        buttons: [{ title: "Resume" }, { title: "Snooze" }]
      });
    }

    if (alarm.name.startsWith(FOCUS_ALARM_PREFIX)) {
      await ensureStorageReady();
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
    await ensureStorageReady();
    if (notificationId.startsWith("reminder:") && buttonIndex === 1) {
      const id = notificationId.slice("reminder:".length);
      const reminder = await db.reminders.get(id);
      if (!reminder) return;
      const snoozedUntil = Date.now() + 10 * 60_000;
      await db.reminders.put({ ...reminder, status: "snoozed", snoozedUntil });
      await backupToSyncStorageQuietly();
      await scheduleReminderAlarm(id, snoozedUntil);
      return;
    }
    await openSidePanel();
  })();
});
