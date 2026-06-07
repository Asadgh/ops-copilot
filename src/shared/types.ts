import { z } from "zod";

export const taskStatusValues = ["pending", "active", "blocked", "completed", "archived"] as const;
export const priorityValues = ["low", "medium", "high", "critical"] as const;
export const aiModeValues = ["off", "assist", "auto"] as const;
export const planModeValues = ["manual", "assisted", "adaptive"] as const;
export const exportFormatValues = ["csv", "xlsx", "markdown", "txt"] as const;

export type TaskStatus = (typeof taskStatusValues)[number];
export type Priority = (typeof priorityValues)[number];
export type AIMode = (typeof aiModeValues)[number];
export type PlanMode = (typeof planModeValues)[number];
export type ExportFormat = (typeof exportFormatValues)[number];
export type ThemeMode = "dark" | "light" | "system";
export type FocusStatus = "active" | "paused" | "completed";
export type ReminderStatus = "scheduled" | "fired" | "snoozed" | "dismissed";
export type ActivityType =
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "task.blocked"
  | "task.captured"
  | "focus.started"
  | "focus.paused"
  | "focus.completed"
  | "reminder.created"
  | "reminder.fired"
  | "plan.generated"
  | "report.generated"
  | "shutdown.completed"
  | "voice.command"
  | "system";

export type TaskMetadata = {
  createdAt: number;
  updatedAt: number;
  sourceUrl?: string;
  sourceTitle?: string;
  pageSummary?: string;
  aiTags?: string[];
  aiSummary?: string;
  reminderAt?: number;
  linkedTasks?: string[];
  activityLog?: ActivityEvent[];
};

export type Task = {
  id: string;
  month: string;
  week: string;
  priority: Priority;
  task: string;
  location: string;
  timeline: number;
  status: TaskStatus;
  completion: number;
  blockers: string;
  improvements: string;
  notes: string;
  dueAt?: number;
  estimatedMinutes?: number;
  tags?: string[];
  metadata: TaskMetadata;
};

export type ActivityEvent = {
  id: string;
  timestamp: number;
  type: ActivityType;
  title: string;
  details?: string;
  taskId?: string;
  source?: "terminal" | "voice" | "launcher" | "browser" | "ui" | "system" | "ai";
};

export type FocusSession = {
  id: string;
  taskId?: string;
  startTime: number;
  endTime?: number;
  durationMinutes: number;
  status: FocusStatus;
  interruptions: number;
  notes?: string;
};

export type Shift = {
  id: string;
  name: string;
  days: string[];
  startHour: string;
  endHour: string;
  timezone: string;
  quietHoursEnabled: boolean;
  autoShutdownPrompt: boolean;
};

export type DailyPlanItem = {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
  taskId?: string;
  reason?: string;
  status: "planned" | "active" | "completed" | "skipped";
};

export type DailyPlan = {
  id: string;
  date: string;
  mode: PlanMode;
  createdAt: number;
  updatedAt: number;
  items: DailyPlanItem[];
  rationale?: string;
};

export type Reminder = {
  id: string;
  taskId?: string;
  title: string;
  dueAt: number;
  status: ReminderStatus;
  createdAt: number;
  snoozedUntil?: number;
};

export type BrowserCapture = {
  id: string;
  taskId?: string;
  url: string;
  title: string;
  selectedText?: string;
  timestamp: number;
  summary?: string;
};

export type ReportType = "daily" | "weekly" | "monthly" | "performance" | "handoff" | "shutdown";

export type Report = {
  id: string;
  type: ReportType;
  title: string;
  createdAt: number;
  periodStart: number;
  periodEnd: number;
  content: string;
  aiGenerated: boolean;
  filters?: ReportFilters;
};

export type ReportFilters = {
  dateFrom?: number;
  dateTo?: number;
  shiftId?: string;
  priority?: Priority | "all";
  status?: TaskStatus | "all";
  tags?: string[];
  includeCompleted?: boolean;
  unresolvedOnly?: boolean;
  fields?: string[];
};

export type LauncherSettings = {
  visible: boolean;
  positionY: number;
  opacity: number;
  compact: boolean;
  showOnlyDuringShift: boolean;
  disabledSites: string[];
};

export type AppSettings = {
  id: "app";
  theme: ThemeMode;
  aiMode: AIMode;
  textModel: string;
  reportModel: string;
  transcriptionModel: string;
  voiceEnabled: boolean;
  planMode: PlanMode;
  launcher: LauncherSettings;
  notificationsEnabled: boolean;
  userName: string;
};

export type CommandAction =
  | "createTask"
  | "addBlocker"
  | "setReminder"
  | "startFocus"
  | "capturePage"
  | "summarize"
  | "generatePlan"
  | "optimizePlan"
  | "shutdown"
  | "exportReport"
  | "unknown";

export type ParsedCommand = {
  action: CommandAction;
  raw: string;
  confidence: number;
  source: "local" | "ai";
  payload: Record<string, unknown>;
  feedback: string;
};

export type VoiceResult = {
  transcript: string;
  command: ParsedCommand;
  execution?: RuntimeResponse;
};

export type PageTaskSuggestion = {
  task: string;
  priority: Priority;
  dueAt?: number;
  tags: string[];
  summary: string;
  nextAction: string;
  confidence: number;
};

export type TaskCleanupSuggestion = {
  taskId: string;
  task?: string;
  notes?: string;
  tags?: string[];
  status?: TaskStatus;
  reason: string;
};

export type ExportPayload = {
  filename: string;
  mimeType: string;
  format: ExportFormat;
  content: string;
  encoding: "text" | "base64";
};

export type RuntimeResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export type RuntimeMessage =
  | { type: "OPEN_SIDE_PANEL"; tabId?: number; windowId?: number }
  | { type: "CREATE_TASK"; payload: Partial<Task> }
  | { type: "CAPTURE_PAGE"; payload?: { taskId?: string; selectedText?: string } }
  | { type: "START_FOCUS"; payload: { taskId?: string; durationMinutes: number } }
  | { type: "SCHEDULE_REMINDER"; payload: { taskId?: string; title: string; dueAt: number } }
  | { type: "VOICE_TRANSCRIBE"; payload: { audioBase64: string; mimeType: string } }
  | { type: "VOICE_PREVIEW_TRANSCRIBE"; payload: { audioBase64: string; mimeType: string } }
  | { type: "AI_CLEANUP_TASKS"; payload: { tasks: Task[] } }
  | { type: "AI_DAILY_BRIEFING"; payload: { tasks: Task[]; reminders: Reminder[]; shifts: Shift[] } }
  | { type: "AI_PARSE_COMMAND" | "AI_SUMMARIZE" | "AI_REPORT"; payload: unknown }
  | { type: "EXECUTE_COMMAND"; payload: { command: string; source?: "terminal" | "voice" | "launcher" | "ui" } }
  | { type: "EXPORT_REPORT"; payload: { format: ExportFormat; filters: ReportFilters } };

export const TaskStatusSchema = z.enum(taskStatusValues);
export const PrioritySchema = z.enum(priorityValues);
export const ExportFormatSchema = z.enum(exportFormatValues);

export const RuntimeMessageSchema: z.ZodType<RuntimeMessage> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("OPEN_SIDE_PANEL"), tabId: z.number().optional(), windowId: z.number().optional() }),
  z.object({ type: z.literal("CREATE_TASK"), payload: z.record(z.unknown()) }),
  z.object({
    type: z.literal("CAPTURE_PAGE"),
    payload: z.object({ taskId: z.string().optional(), selectedText: z.string().optional() }).optional()
  }),
  z.object({ type: z.literal("START_FOCUS"), payload: z.object({ taskId: z.string().optional(), durationMinutes: z.number().min(1) }) }),
  z.object({ type: z.literal("SCHEDULE_REMINDER"), payload: z.object({ taskId: z.string().optional(), title: z.string(), dueAt: z.number() }) }),
  z.object({ type: z.literal("VOICE_TRANSCRIBE"), payload: z.object({ audioBase64: z.string().min(1), mimeType: z.string() }) }),
  z.object({ type: z.literal("VOICE_PREVIEW_TRANSCRIBE"), payload: z.object({ audioBase64: z.string().min(1), mimeType: z.string() }) }),
  z.object({ type: z.literal("AI_CLEANUP_TASKS"), payload: z.object({ tasks: z.array(z.record(z.unknown())) }) }),
  z.object({ type: z.literal("AI_DAILY_BRIEFING"), payload: z.object({ tasks: z.array(z.record(z.unknown())), reminders: z.array(z.record(z.unknown())), shifts: z.array(z.record(z.unknown())) }) }),
  z.object({ type: z.literal("AI_PARSE_COMMAND"), payload: z.unknown() }),
  z.object({ type: z.literal("AI_SUMMARIZE"), payload: z.unknown() }),
  z.object({ type: z.literal("AI_REPORT"), payload: z.unknown() }),
  z.object({ type: z.literal("EXECUTE_COMMAND"), payload: z.object({ command: z.string(), source: z.enum(["terminal", "voice", "launcher", "ui"]).optional() }) }),
  z.object({ type: z.literal("EXPORT_REPORT"), payload: z.object({ format: ExportFormatSchema, filters: z.record(z.unknown()) }) })
]) as z.ZodType<RuntimeMessage>;
