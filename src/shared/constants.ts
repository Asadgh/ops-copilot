import type { AppSettings, Shift } from "./types";

export const APP_SETTINGS_ID = "app";
export const OPENAI_API_KEY_STORAGE_KEY = "opsCopilot.openaiApiKey";

export const DEFAULT_SETTINGS: AppSettings = {
  id: APP_SETTINGS_ID,
  theme: "dark",
  aiMode: "assist",
  textModel: "gpt-5.4-mini",
  reportModel: "gpt-5.5",
  transcriptionModel: "gpt-4o-mini-transcribe",
  voiceEnabled: true,
  planMode: "assisted",
  notificationsEnabled: true,
  userName: "Sadick",
  launcher: {
    visible: true,
    positionY: 0.42,
    opacity: 0.92,
    compact: false,
    showOnlyDuringShift: false,
    disabledSites: []
  }
};

export const DEFAULT_SHIFT: Shift = {
  id: "default-shift",
  name: "Primary Shift",
  days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  startHour: "07:00",
  endHour: "19:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Accra",
  quietHoursEnabled: true,
  autoShutdownPrompt: true
};

export const FIELD_LABELS = {
  month: "Month",
  week: "Week",
  priority: "Priority",
  task: "Task",
  location: "Location",
  timeline: "Timeline",
  status: "Status",
  completion: "% Completion",
  blockers: "Blockers",
  improvements: "Improvements",
  notes: "Notes",
  focusTime: "Focus Time",
  aiTags: "AI Tags",
  aiSummary: "AI Summary",
  sourceUrl: "Source URL"
} as const;

export const SUPPORTED_EXPORT_FIELDS = Object.keys(FIELD_LABELS);
