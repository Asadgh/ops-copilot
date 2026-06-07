import { APP_SETTINGS_ID } from "../constants";
import type { ActivityEvent, AppSettings, BrowserCapture, DailyPlan, FocusSession, Reminder, Report, Shift, Task } from "../types";
import { db } from "./db";

const BACKUP_VERSION = 1;
const BACKUP_PREFIX = "opsCopilot.syncBackup.v1";
const MANIFEST_KEY = `${BACKUP_PREFIX}.manifest`;
const CHUNK_KEY_PREFIX = `${BACKUP_PREFIX}.chunk.`;
const CHUNK_BYTES = 6500;
const MAX_BACKUP_BYTES = 92_000;

export type BackupPayload = {
  version: typeof BACKUP_VERSION;
  updatedAt: number;
  truncated: boolean;
  source: "sync" | "manual";
  settings?: AppSettings;
  tasks: Task[];
  activityEvents: ActivityEvent[];
  focusSessions: FocusSession[];
  shifts: Shift[];
  dailyPlans: DailyPlan[];
  reminders: Reminder[];
  captures: BrowserCapture[];
  reports: Report[];
};

export type BackupManifest = {
  version: typeof BACKUP_VERSION;
  updatedAt: number;
  chunks: number;
  bytes: number;
  truncated: boolean;
  counts: Record<string, number>;
};

type BackupLimits = {
  taskLimit?: number;
  activityLimit: number;
  focusLimit: number;
  planLimit: number;
  reminderLimit?: number;
  captureLimit: number;
  reportLimit: number;
  reportContentLimit: number;
};

type BackupSource = Omit<BackupPayload, "version" | "updatedAt" | "truncated">;

export type BackupStatus = {
  syncAvailable: boolean;
  manifest?: BackupManifest;
  localRecords: number;
  hasSyncBackup: boolean;
  hasLocalData: boolean;
  hasConflict: boolean;
  warning?: string;
};

export type RestoreMode = "merge" | "replace";

const backupTiers: BackupLimits[] = [
  { activityLimit: 200, focusLimit: 160, planLimit: 40, captureLimit: 120, reportLimit: 24, reportContentLimit: 2400 },
  { activityLimit: 120, focusLimit: 100, planLimit: 24, captureLimit: 80, reportLimit: 12, reportContentLimit: 1200 },
  { activityLimit: 80, focusLimit: 60, planLimit: 14, captureLimit: 40, reportLimit: 4, reportContentLimit: 800 },
  { activityLimit: 40, focusLimit: 30, planLimit: 7, captureLimit: 16, reportLimit: 0, reportContentLimit: 0 },
  { activityLimit: 0, focusLimit: 0, planLimit: 0, captureLimit: 0, reportLimit: 0, reportContentLimit: 0 }
];

function hasSyncStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.sync);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function newestFirst<T>(items: T[], getTime: (item: T) => number | undefined): T[] {
  return [...items].sort((a, b) => (getTime(b) ?? 0) - (getTime(a) ?? 0));
}

function trimReport(report: Report, contentLimit: number): Report {
  if (!contentLimit || report.content.length <= contentLimit) return report;
  return { ...report, content: `${report.content.slice(0, contentLimit).trim()}\n\n[Report content trimmed in sync backup.]` };
}

function preparePayload(source: BackupSource, limits: BackupLimits, truncated: boolean): BackupPayload {
  const tasks = newestFirst(source.tasks, (task) => task.metadata?.updatedAt ?? task.timeline).slice(0, limits.taskLimit);
  const reminders = newestFirst(source.reminders, (reminder) => reminder.createdAt ?? reminder.dueAt).slice(0, limits.reminderLimit);
  const reports = newestFirst(source.reports, (report) => report.createdAt)
    .slice(0, limits.reportLimit)
    .map((report) => trimReport(report, limits.reportContentLimit));

  return {
    version: BACKUP_VERSION,
    updatedAt: Date.now(),
    truncated,
    source: "sync",
    settings: source.settings,
    tasks,
    activityEvents: newestFirst(source.activityEvents, (event) => event.timestamp).slice(0, limits.activityLimit),
    focusSessions: newestFirst(source.focusSessions, (session) => session.endTime ?? session.startTime).slice(0, limits.focusLimit),
    shifts: source.shifts,
    dailyPlans: newestFirst(source.dailyPlans, (plan) => plan.updatedAt ?? plan.createdAt).slice(0, limits.planLimit),
    reminders,
    captures: newestFirst(source.captures, (capture) => capture.timestamp).slice(0, limits.captureLimit),
    reports
  };
}

function serializeWithinQuota(source: BackupSource): { payload: BackupPayload; json: string } {
  for (const limits of backupTiers) {
    const payload = preparePayload(source, limits, false);
    const json = JSON.stringify(payload);
    if (byteLength(json) <= MAX_BACKUP_BYTES) return { payload, json };
  }

  let low = 0;
  let high = source.tasks.length;
  let best = preparePayload(source, { ...backupTiers[backupTiers.length - 1], taskLimit: 0 }, true);
  let bestJson = JSON.stringify(best);

  while (low <= high) {
    const taskLimit = Math.floor((low + high) / 2);
    const payload = preparePayload(source, { ...backupTiers[backupTiers.length - 1], taskLimit }, true);
    const json = JSON.stringify(payload);
    if (byteLength(json) <= MAX_BACKUP_BYTES) {
      best = payload;
      bestJson = json;
      low = taskLimit + 1;
    } else {
      high = taskLimit - 1;
    }
  }

  return { payload: best, json: bestJson };
}

function chunkString(value: string): string[] {
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const character of value) {
    const characterBytes = byteLength(character);
    if (current && currentBytes + characterBytes > CHUNK_BYTES) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += characterBytes;
  }

  if (current) chunks.push(current);
  return chunks;
}

async function loadSource(): Promise<BackupSource> {
  const [settings, tasks, activityEvents, focusSessions, shifts, dailyPlans, reminders, captures, reports] = await Promise.all([
    db.settings.get(APP_SETTINGS_ID),
    db.tasks.toArray(),
    db.activityEvents.toArray(),
    db.focusSessions.toArray(),
    db.shifts.toArray(),
    db.dailyPlans.toArray(),
    db.reminders.toArray(),
    db.captures.toArray(),
    db.reports.toArray()
  ]);

  return {
    source: "manual",
    settings,
    tasks,
    activityEvents,
    focusSessions,
    shifts,
    dailyPlans,
    reminders,
    captures,
    reports
  };
}

function manifestFor(payload: BackupPayload, chunks: string[], bytes: number): BackupManifest {
  return {
    version: BACKUP_VERSION,
    updatedAt: payload.updatedAt,
    chunks: chunks.length,
    bytes,
    truncated: payload.truncated,
    counts: {
      tasks: payload.tasks.length,
      activityEvents: payload.activityEvents.length,
      focusSessions: payload.focusSessions.length,
      shifts: payload.shifts.length,
      dailyPlans: payload.dailyPlans.length,
      reminders: payload.reminders.length,
      captures: payload.captures.length,
      reports: payload.reports.length
    }
  };
}

async function existingChunkCount(): Promise<number> {
  const result = await chrome.storage.sync.get(MANIFEST_KEY);
  const manifest = result[MANIFEST_KEY] as Partial<BackupManifest> | undefined;
  return typeof manifest?.chunks === "number" ? manifest.chunks : 0;
}

export async function backupToSyncStorage(): Promise<BackupManifest | undefined> {
  if (!hasSyncStorage()) return undefined;

  const source = await loadSource();
  if (!source.tasks.length && !source.activityEvents.length && !source.reminders.length) return undefined;

  const { payload, json } = serializeWithinQuota(source);
  const chunks = chunkString(json);
  const previousChunks = await existingChunkCount();
  const entries: Record<string, unknown> = {};
  const bytes = byteLength(json);
  const manifest = manifestFor(payload, chunks, bytes);

  chunks.forEach((chunk, index) => {
    entries[`${CHUNK_KEY_PREFIX}${index}`] = chunk;
  });
  entries[MANIFEST_KEY] = manifest;

  await chrome.storage.sync.set(entries);

  if (previousChunks > chunks.length) {
    const staleKeys = Array.from({ length: previousChunks - chunks.length }, (_, index) => `${CHUNK_KEY_PREFIX}${chunks.length + index}`);
    await chrome.storage.sync.remove(staleKeys);
  }

  return manifest;
}

export async function backupToSyncStorageQuietly(): Promise<void> {
  try {
    await backupToSyncStorage();
  } catch {
    // Sync backup is best-effort. Local IndexedDB remains the source of truth during normal use.
  }
}

async function readBackup(): Promise<BackupPayload | undefined> {
  if (!hasSyncStorage()) return undefined;

  const manifestResult = await chrome.storage.sync.get(MANIFEST_KEY);
  const manifest = manifestResult[MANIFEST_KEY] as BackupManifest | undefined;
  if (!manifest || manifest.version !== BACKUP_VERSION || !manifest.chunks) return undefined;

  const chunkKeys = Array.from({ length: manifest.chunks }, (_, index) => `${CHUNK_KEY_PREFIX}${index}`);
  const chunkResult = await chrome.storage.sync.get(chunkKeys);
  const json = chunkKeys.map((key) => chunkResult[key]).join("");
  if (!json) return undefined;

  try {
    const payload = JSON.parse(json) as BackupPayload;
    return payload.version === BACKUP_VERSION ? payload : undefined;
  } catch {
    return undefined;
  }
}

async function localRecordCount(): Promise<number> {
  const counts = await Promise.all([
    db.tasks.count(),
    db.activityEvents.count(),
    db.focusSessions.count(),
    db.shifts.count(),
    db.dailyPlans.count(),
    db.reminders.count(),
    db.captures.count(),
    db.reports.count(),
    db.settings.count()
  ]);
  return counts.reduce((sum, count) => sum + count, 0);
}

function allTables() {
  return [db.settings, db.tasks, db.activityEvents, db.focusSessions, db.shifts, db.dailyPlans, db.reminders, db.captures, db.reports] as const;
}

async function writeBackupPayload(backup: BackupPayload, mode: RestoreMode): Promise<void> {
  await db.transaction("rw", allTables(), async () => {
    if (mode === "replace") {
      await Promise.all(allTables().map((table) => table.clear()));
    }
    if (backup.settings) await db.settings.put(backup.settings);
    if (backup.tasks.length) await db.tasks.bulkPut(backup.tasks);
    if (backup.activityEvents.length) await db.activityEvents.bulkPut(backup.activityEvents);
    if (backup.focusSessions.length) await db.focusSessions.bulkPut(backup.focusSessions);
    if (backup.shifts.length) await db.shifts.bulkPut(backup.shifts);
    if (backup.dailyPlans.length) await db.dailyPlans.bulkPut(backup.dailyPlans);
    if (backup.reminders.length) await db.reminders.bulkPut(backup.reminders);
    if (backup.captures.length) await db.captures.bulkPut(backup.captures);
    if (backup.reports.length) await db.reports.bulkPut(backup.reports);
  });
}

function backupCounts(backup: BackupPayload): BackupManifest["counts"] {
  return {
    tasks: backup.tasks.length,
    activityEvents: backup.activityEvents.length,
    focusSessions: backup.focusSessions.length,
    shifts: backup.shifts.length,
    dailyPlans: backup.dailyPlans.length,
    reminders: backup.reminders.length,
    captures: backup.captures.length,
    reports: backup.reports.length
  };
}

export async function getBackupStatus(): Promise<BackupStatus> {
  const localRecords = await localRecordCount();
  if (!hasSyncStorage()) {
    return {
      syncAvailable: false,
      localRecords,
      hasSyncBackup: false,
      hasLocalData: localRecords > 0,
      hasConflict: false,
      warning: "Chrome Sync storage is not available in this context."
    };
  }

  try {
    const result = await chrome.storage.sync.get(MANIFEST_KEY);
    const manifest = result[MANIFEST_KEY] as BackupManifest | undefined;
    const hasSyncBackup = Boolean(manifest?.chunks);
    return {
      syncAvailable: true,
      manifest,
      localRecords,
      hasSyncBackup,
      hasLocalData: localRecords > 0,
      hasConflict: localRecords > 0 && hasSyncBackup,
      warning: manifest?.truncated
        ? "Chrome Sync backup was trimmed to fit storage limits. Use manual export for a full backup."
        : manifest && manifest.bytes > MAX_BACKUP_BYTES * 0.85
          ? "Chrome Sync backup is close to storage limits. Manual export is recommended."
          : undefined
    };
  } catch (error) {
    return {
      syncAvailable: false,
      localRecords,
      hasSyncBackup: false,
      hasLocalData: localRecords > 0,
      hasConflict: false,
      warning: error instanceof Error ? error.message : "Could not read Chrome Sync backup status."
    };
  }
}

export async function exportFullBackup(): Promise<{ filename: string; json: string; counts: BackupManifest["counts"] }> {
  const source = await loadSource();
  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    updatedAt: Date.now(),
    truncated: false,
    ...source
  };
  return {
    filename: `ops-copilot-backup-${new Date(payload.updatedAt).toISOString().slice(0, 10)}.json`,
    json: JSON.stringify(payload, null, 2),
    counts: backupCounts(payload)
  };
}

export async function importFullBackup(json: string, mode: RestoreMode = "merge"): Promise<{ restored: boolean; counts?: BackupManifest["counts"]; reason?: string }> {
  try {
    const backup = JSON.parse(json) as BackupPayload;
    if (backup.version !== BACKUP_VERSION || !Array.isArray(backup.tasks)) {
      return { restored: false, reason: "Unsupported backup file." };
    }
    await writeBackupPayload(backup, mode);
    await backupToSyncStorageQuietly();
    return { restored: true, counts: backupCounts(backup) };
  } catch (error) {
    return { restored: false, reason: error instanceof Error ? error.message : "Could not import backup." };
  }
}

export async function restoreFromSyncBackup(mode: RestoreMode = "merge"): Promise<{ restored: boolean; reason?: string; counts?: BackupManifest["counts"] }> {
  try {
    const backup = await readBackup();
    if (!backup) return { restored: false, reason: "backup-missing" };
    await writeBackupPayload(backup, mode);
    await backupToSyncStorageQuietly();
    return { restored: true, counts: backupCounts(backup) };
  } catch {
    return { restored: false, reason: "restore-failed" };
  }
}

export async function restoreFromSyncBackupIfEmpty(): Promise<{ restored: boolean; reason?: string; counts?: BackupManifest["counts"] }> {
  try {
    if (!hasSyncStorage()) return { restored: false, reason: "sync-storage-unavailable" };
    if (await localRecordCount()) return { restored: false, reason: "local-data-present" };

    const backup = await readBackup();
    if (!backup) return { restored: false, reason: "backup-missing" };

    await writeBackupPayload(backup, "merge");

    return {
      restored: true,
      counts: backupCounts(backup)
    };
  } catch {
    return { restored: false, reason: "restore-failed" };
  }
}
