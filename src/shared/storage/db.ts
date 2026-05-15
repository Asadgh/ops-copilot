import Dexie, { type Table } from "dexie";
import type {
  ActivityEvent,
  AppSettings,
  BrowserCapture,
  DailyPlan,
  FocusSession,
  Reminder,
  Report,
  Shift,
  Task
} from "../types";

export class OpsCopilotDb extends Dexie {
  tasks!: Table<Task, string>;
  activityEvents!: Table<ActivityEvent, string>;
  focusSessions!: Table<FocusSession, string>;
  shifts!: Table<Shift, string>;
  dailyPlans!: Table<DailyPlan, string>;
  reminders!: Table<Reminder, string>;
  captures!: Table<BrowserCapture, string>;
  reports!: Table<Report, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super("ops-copilot");
    this.version(1).stores({
      tasks: "id, status, priority, timeline, dueAt, *tags",
      activityEvents: "id, timestamp, taskId, type, source",
      focusSessions: "id, status, startTime, endTime, taskId",
      shifts: "id, name",
      dailyPlans: "id, date, mode, createdAt",
      reminders: "id, dueAt, status, taskId",
      captures: "id, timestamp, taskId, url",
      reports: "id, type, createdAt, periodStart, periodEnd",
      settings: "id"
    });
  }
}

export const db = new OpsCopilotDb();
