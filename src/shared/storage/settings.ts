import { APP_SETTINGS_ID, DEFAULT_SETTINGS, DEFAULT_SHIFT, OPENAI_API_KEY_STORAGE_KEY } from "../constants";
import type { AppSettings, LauncherSettings, Shift } from "../types";
import { db } from "./db";

function mergeSettings(settings?: Partial<AppSettings>): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    launcher: {
      ...DEFAULT_SETTINGS.launcher,
      ...(settings?.launcher ?? {})
    }
  };
}

export async function getAppSettings(): Promise<AppSettings> {
  const settings = await db.settings.get(APP_SETTINGS_ID);
  if (!settings) {
    await db.settings.put(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return mergeSettings(settings);
}

export async function updateAppSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = mergeSettings({
    ...current,
    ...patch,
    launcher: {
      ...current.launcher,
      ...(patch.launcher ?? {})
    }
  });
  await db.settings.put(next);
  return next;
}

export async function updateLauncherSettings(patch: Partial<LauncherSettings>): Promise<LauncherSettings> {
  const current = await getAppSettings();
  const next = await updateAppSettings({ launcher: { ...current.launcher, ...patch } });
  return next.launcher;
}

export async function ensureDefaultShift(): Promise<Shift> {
  const existing = await db.shifts.get(DEFAULT_SHIFT.id);
  if (existing) return existing;
  await db.shifts.put(DEFAULT_SHIFT);
  return DEFAULT_SHIFT;
}

function hasChromeStorage(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.storage?.local);
}

export async function initTrustedStorageAccess(): Promise<void> {
  if (!hasChromeStorage() || !chrome.storage.local.setAccessLevel) return;
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
}

export async function getOpenAIApiKey(): Promise<string | undefined> {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(OPENAI_API_KEY_STORAGE_KEY);
    return result[OPENAI_API_KEY_STORAGE_KEY] || undefined;
  }
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || undefined;
  }
  return undefined;
}

export async function setOpenAIApiKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("OpenAI API key cannot be empty.");
  }
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [OPENAI_API_KEY_STORAGE_KEY]: trimmed });
    return;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, trimmed);
    return;
  }
  throw new Error("No local storage backend is available for the API key.");
}

export async function clearOpenAIApiKey(): Promise<void> {
  if (hasChromeStorage()) {
    await chrome.storage.local.remove(OPENAI_API_KEY_STORAGE_KEY);
    return;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
  }
}

export async function hasOpenAIApiKey(): Promise<boolean> {
  return Boolean(await getOpenAIApiKey());
}
