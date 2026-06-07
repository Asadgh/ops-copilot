import * as Switch from "@radix-ui/react-switch";
import { DatabaseBackup, Download, KeyRound, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../app/store";
import { DEFAULT_SHIFT } from "../../shared/constants";
import type { AIMode, PlanMode, Shift, ThemeMode } from "../../shared/types";
import { backupToSyncStorage, exportFullBackup, getBackupStatus, importFullBackup, restoreFromSyncBackup, type BackupStatus, type RestoreMode } from "../../shared/storage/syncBackup";
import { downloadExport } from "../../shared/chrome";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";

const fallbackTimezones = [
  "Africa/Accra",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC"
];

function timezoneOptions(currentTimezone: string): string[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : fallbackTimezones;
  return zones.includes(currentTimezone) ? zones : [currentTimezone, ...zones];
}

function Toggle({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-oc-border/58 bg-oc-elevated/32 p-3 text-sm">
      <span>{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 rounded-full border border-oc-border/70 bg-oc-bg transition data-[state=checked]:border-oc-blue data-[state=checked]:bg-oc-blue"
      >
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
    </label>
  );
}

function relativeTime(timestamp?: number): string {
  if (!timestamp) return "Never";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SettingsView() {
  const settings = useAppStore((store) => store.settings);
  const hasApiKey = useAppStore((store) => store.hasApiKey);
  const saveSettings = useAppStore((store) => store.saveSettings);
  const saveApiKey = useAppStore((store) => store.saveApiKey);
  const clearApiKey = useAppStore((store) => store.clearApiKey);
  const load = useAppStore((store) => store.load);
  const shifts = useAppStore((store) => store.shifts);
  const saveShift = useAppStore((store) => store.saveShift);
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<"idle" | "saving" | "saved" | "cleared" | "error">("idle");
  const [keyMessage, setKeyMessage] = useState("");
  const [shiftForm, setShiftForm] = useState<Shift>(shifts[0] ?? DEFAULT_SHIFT);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | undefined>();
  const [backupMessage, setBackupMessage] = useState("");
  const [importMode, setImportMode] = useState<RestoreMode>("merge");
  const timezones = useMemo(() => timezoneOptions(shiftForm.timezone), [shiftForm.timezone]);

  useEffect(() => {
    setShiftForm(shifts[0] ?? DEFAULT_SHIFT);
  }, [shifts]);

  useEffect(() => {
    void refreshBackupStatus();
  }, []);

  if (!settings) return null;

  async function submitKey(event: FormEvent) {
    event.preventDefault();
    if (!apiKey.trim()) {
      setKeyStatus("error");
      setKeyMessage("Enter an OpenAI API key before saving.");
      return;
    }
    setKeyStatus("saving");
    setKeyMessage("Saving API key locally...");
    try {
      await saveApiKey(apiKey);
      setApiKey("");
      setKeyStatus("saved");
      setKeyMessage("API key saved locally. AI and voice features can now use it.");
    } catch (error) {
      setKeyStatus("error");
      setKeyMessage(error instanceof Error ? error.message : "Could not save API key.");
    }
  }

  async function handleClearApiKey() {
    try {
      await clearApiKey();
      setApiKey("");
      setKeyStatus("cleared");
      setKeyMessage("API key cleared.");
    } catch (error) {
      setKeyStatus("error");
      setKeyMessage(error instanceof Error ? error.message : "Could not clear API key.");
    }
  }

  async function submitShift(event: FormEvent) {
    event.preventDefault();
    await saveShift(shiftForm);
  }

  async function refreshBackupStatus() {
    setBackupStatus(await getBackupStatus());
  }

  async function handleManualBackup() {
    const backup = await exportFullBackup();
    downloadExport(backup.filename, "application/json", backup.json, "text");
    setBackupMessage(`Exported full backup with ${backup.counts.tasks} tasks.`);
  }

  async function handleSyncNow() {
    const manifest = await backupToSyncStorage();
    await refreshBackupStatus();
    setBackupMessage(manifest ? `Chrome Sync backup updated with ${manifest.counts.tasks} tasks.` : "No task data to sync yet.");
  }

  async function handleImportFile(file?: File | null) {
    if (!file) return;
    if (importMode === "replace" && !window.confirm("Replace local Ops Copilot data with this backup?")) return;
    const result = await importFullBackup(await file.text(), importMode);
    setBackupMessage(result.restored ? `Imported backup with ${result.counts?.tasks ?? 0} tasks.` : result.reason ?? "Could not import backup.");
    await load();
    await refreshBackupStatus();
  }

  async function handleSyncRestore(mode: RestoreMode) {
    if (mode === "replace" && !window.confirm("Replace local Ops Copilot data with the Chrome Sync backup?")) return;
    const result = await restoreFromSyncBackup(mode);
    setBackupMessage(result.restored ? `${mode === "replace" ? "Restored" : "Merged"} Chrome Sync backup with ${result.counts?.tasks ?? 0} tasks.` : result.reason ?? "Could not restore sync backup.");
    await load();
    await refreshBackupStatus();
  }

  function toggleDay(day: string) {
    setShiftForm((current) => ({
      ...current,
      days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day]
    }));
  }

  return (
    <div className="oc-page space-y-4">
      <Card>
        <SectionTitle title="Appearance & Workflow" />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-oc-muted">
            Theme
            <select className="oc-select mt-1 w-full px-3 py-2 text-sm text-oc-text" value={settings.theme} onChange={(event) => saveSettings({ theme: event.target.value as ThemeMode })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="text-xs text-oc-muted">
            Plan Mode
            <select className="oc-select mt-1 w-full px-3 py-2 text-sm text-oc-text" value={settings.planMode} onChange={(event) => saveSettings({ planMode: event.target.value as PlanMode })}>
              <option value="manual">Manual</option>
              <option value="assisted">Assisted</option>
              <option value="adaptive">Adaptive</option>
            </select>
          </label>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Shift Management" subtitle="Controls active-shift visibility, quiet hours, and shutdown prompts." />
        <form className="grid gap-3" onSubmit={submitShift}>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs text-oc-muted md:col-span-2">
              Shift Name
              <input className="oc-input mt-1 w-full px-3 py-2 text-sm text-oc-text" value={shiftForm.name} onChange={(event) => setShiftForm({ ...shiftForm, name: event.target.value })} />
            </label>
            <label className="text-xs text-oc-muted">
              Start
              <input className="oc-input mt-1 w-full px-3 py-2 text-sm text-oc-text" type="time" value={shiftForm.startHour} onChange={(event) => setShiftForm({ ...shiftForm, startHour: event.target.value })} />
            </label>
            <label className="text-xs text-oc-muted">
              End
              <input className="oc-input mt-1 w-full px-3 py-2 text-sm text-oc-text" type="time" value={shiftForm.endHour} onChange={(event) => setShiftForm({ ...shiftForm, endHour: event.target.value })} />
            </label>
          </div>
          <label className="text-xs text-oc-muted">
            Timezone
            <select className="oc-select mt-1 w-full px-3 py-2 text-sm text-oc-text" value={shiftForm.timezone} onChange={(event) => setShiftForm({ ...shiftForm, timezone: event.target.value })}>
              {timezones.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <button
                type="button"
                key={day}
                onClick={() => toggleDay(day)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${shiftForm.days.includes(day) ? "border-oc-blue bg-oc-blue/12 text-oc-blue" : "border-oc-border/70 bg-oc-bg/70 text-oc-muted hover:border-oc-muted/50 hover:text-oc-text"}`}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Toggle checked={shiftForm.quietHoursEnabled} onCheckedChange={(quietHoursEnabled) => setShiftForm({ ...shiftForm, quietHoursEnabled })} label="Quiet hours" />
            <Toggle checked={shiftForm.autoShutdownPrompt} onCheckedChange={(autoShutdownPrompt) => setShiftForm({ ...shiftForm, autoShutdownPrompt })} label="Shutdown prompts" />
          </div>
          <div>
            <Button type="submit"><Save size={14} /> Save Shift</Button>
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle
          title="Data Persistence"
          subtitle="Chrome Sync keeps a compact backup; manual export keeps a full user-controlled backup."
          action={
            <span className="inline-flex items-center gap-1 rounded-full border border-oc-success/45 bg-oc-success/10 px-2.5 py-1 text-[11px] font-semibold text-oc-success">
              <DatabaseBackup size={12} /> Auto backup
            </span>
          }
        />
        <div className="grid gap-3 text-xs text-oc-muted">
          <div className="grid gap-2 rounded-lg border border-oc-border/58 bg-oc-bg/45 p-3 md:grid-cols-3">
            <p><span className="font-semibold text-oc-text">Sync:</span> {backupStatus?.syncAvailable ? "Available" : "Unavailable"}</p>
            <p><span className="font-semibold text-oc-text">Last backed up:</span> {relativeTime(backupStatus?.manifest?.updatedAt)}</p>
            <p><span className="font-semibold text-oc-text">Local records:</span> {backupStatus?.localRecords ?? 0}</p>
          </div>
          {backupStatus?.warning ? <p className="rounded-lg border border-oc-warning/35 bg-oc-warning/10 px-3 py-2 text-oc-warning">{backupStatus.warning}</p> : null}
          {backupStatus?.hasConflict ? (
            <div className="rounded-lg border border-oc-blue/35 bg-oc-blue/10 p-3 text-oc-blue">
              <p className="font-semibold">Local data and a Chrome Sync backup both exist.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" type="button" onClick={() => handleSyncRestore("merge")}>Merge Sync Backup</Button>
                <Button size="sm" type="button" variant="danger" onClick={() => handleSyncRestore("replace")}>Replace Local</Button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={handleManualBackup}><Download size={14} /> Export Full Backup</Button>
            <Button type="button" variant="secondary" onClick={handleSyncNow}><RefreshCw size={14} /> Sync Now</Button>
            <label className="oc-select inline-flex h-9 cursor-pointer items-center gap-2 px-3 text-sm text-oc-text">
              <Upload size={14} /> Import Backup
              <input className="hidden" type="file" accept="application/json,.json" onChange={(event) => void handleImportFile(event.target.files?.[0])} />
            </label>
            <select className="oc-select h-9 px-3 text-sm text-oc-text" value={importMode} onChange={(event) => setImportMode(event.target.value as RestoreMode)}>
              <option value="merge">Merge import</option>
              <option value="replace">Replace local data</option>
            </select>
          </div>
          <p aria-live="polite">{backupMessage || "API keys stay local and are not included in any backup."}</p>
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="AI & Voice"
          subtitle="API key is stored locally and hidden from content scripts."
          action={
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${hasApiKey ? "border-oc-success/45 bg-oc-success/10 text-oc-success" : "border-oc-warning/45 bg-oc-warning/10 text-oc-warning"}`}>
              {hasApiKey ? "Key Saved" : "No Key"}
            </span>
          }
        />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-oc-muted">
            AI Mode
            <select className="oc-select mt-1 w-full px-3 py-2 text-sm text-oc-text" value={settings.aiMode} onChange={(event) => saveSettings({ aiMode: event.target.value as AIMode })}>
              <option value="off">OFF</option>
              <option value="assist">ASSIST</option>
              <option value="auto">AUTO</option>
            </select>
          </label>
          <label className="text-xs text-oc-muted">
            Text Model
            <input className="oc-input mt-1 w-full px-3 py-2 text-sm text-oc-text" value={settings.textModel} onChange={(event) => saveSettings({ textModel: event.target.value })} />
          </label>
          <label className="text-xs text-oc-muted">
            Report Model
            <input className="oc-input mt-1 w-full px-3 py-2 text-sm text-oc-text" value={settings.reportModel} onChange={(event) => saveSettings({ reportModel: event.target.value })} />
          </label>
          <label className="text-xs text-oc-muted">
            Transcription Model
            <input className="oc-input mt-1 w-full px-3 py-2 text-sm text-oc-text" value={settings.transcriptionModel} onChange={(event) => saveSettings({ transcriptionModel: event.target.value })} />
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Toggle checked={settings.voiceEnabled} onCheckedChange={(voiceEnabled) => saveSettings({ voiceEnabled })} label="Voice commands" />
          <Toggle checked={settings.notificationsEnabled} onCheckedChange={(notificationsEnabled) => saveSettings({ notificationsEnabled })} label="Notifications" />
        </div>
        <form onSubmit={submitKey} className="mt-4 flex flex-wrap items-center gap-2">
          <div className="oc-input flex min-w-64 flex-1 items-center gap-2 px-3 py-2">
            <KeyRound size={14} className="text-oc-muted" />
            <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder={hasApiKey ? "API key saved" : "OpenAI API key"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <Button type="submit" disabled={keyStatus === "saving" || !apiKey.trim()}><Save size={14} /> {keyStatus === "saving" ? "Saving..." : "Save Key"}</Button>
          <Button type="button" variant="danger" onClick={handleClearApiKey}><Trash2 size={14} /> Clear</Button>
        </form>
        <p
          aria-live="polite"
          className={`mt-2 text-xs ${
            keyStatus === "saved"
              ? "text-oc-success"
              : keyStatus === "cleared"
                ? "text-oc-warning"
                : keyStatus === "error"
                  ? "text-oc-critical"
                  : "text-oc-muted"
          }`}
        >
          {keyMessage || (hasApiKey ? "A key is saved locally. Paste a new key to replace it." : "No key saved yet. AI features will use local fallbacks.")}
        </p>
      </Card>
    </div>
  );
}
