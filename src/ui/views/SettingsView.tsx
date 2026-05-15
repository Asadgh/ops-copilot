import * as Switch from "@radix-ui/react-switch";
import { KeyRound, Save, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAppStore } from "../../app/store";
import type { AIMode, PlanMode, ThemeMode } from "../../shared/types";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";

function Toggle({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-oc-border bg-oc-elevated/38 p-3 text-sm">
      <span>{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="relative h-6 w-11 rounded-full border border-oc-border bg-oc-bg data-[state=checked]:bg-oc-blue"
      >
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white transition data-[state=checked]:translate-x-[22px]" />
      </Switch.Root>
    </label>
  );
}

export function SettingsView() {
  const settings = useAppStore((store) => store.settings);
  const hasApiKey = useAppStore((store) => store.hasApiKey);
  const saveSettings = useAppStore((store) => store.saveSettings);
  const saveApiKey = useAppStore((store) => store.saveApiKey);
  const clearApiKey = useAppStore((store) => store.clearApiKey);
  const [apiKey, setApiKey] = useState("");

  if (!settings) return null;

  async function submitKey(event: FormEvent) {
    event.preventDefault();
    if (!apiKey.trim()) return;
    await saveApiKey(apiKey);
    setApiKey("");
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <SectionTitle title="Appearance & Workflow" />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-oc-muted">
            Theme
            <select className="mt-1 w-full rounded-md border border-oc-border bg-oc-bg px-3 py-2 text-sm text-oc-text" value={settings.theme} onChange={(event) => saveSettings({ theme: event.target.value as ThemeMode })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
          <label className="text-xs text-oc-muted">
            Plan Mode
            <select className="mt-1 w-full rounded-md border border-oc-border bg-oc-bg px-3 py-2 text-sm text-oc-text" value={settings.planMode} onChange={(event) => saveSettings({ planMode: event.target.value as PlanMode })}>
              <option value="manual">Manual</option>
              <option value="assisted">Assisted</option>
              <option value="adaptive">Adaptive</option>
            </select>
          </label>
        </div>
      </Card>

      <Card>
        <SectionTitle title="AI & Voice" subtitle="API key is stored in chrome.storage.local and hidden from content scripts." />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-oc-muted">
            AI Mode
            <select className="mt-1 w-full rounded-md border border-oc-border bg-oc-bg px-3 py-2 text-sm text-oc-text" value={settings.aiMode} onChange={(event) => saveSettings({ aiMode: event.target.value as AIMode })}>
              <option value="off">OFF</option>
              <option value="assist">ASSIST</option>
              <option value="auto">AUTO</option>
            </select>
          </label>
          <label className="text-xs text-oc-muted">
            Text Model
            <input className="mt-1 w-full rounded-md border border-oc-border bg-oc-bg px-3 py-2 text-sm text-oc-text" value={settings.textModel} onChange={(event) => saveSettings({ textModel: event.target.value })} />
          </label>
          <label className="text-xs text-oc-muted">
            Report Model
            <input className="mt-1 w-full rounded-md border border-oc-border bg-oc-bg px-3 py-2 text-sm text-oc-text" value={settings.reportModel} onChange={(event) => saveSettings({ reportModel: event.target.value })} />
          </label>
          <label className="text-xs text-oc-muted">
            Transcription Model
            <input className="mt-1 w-full rounded-md border border-oc-border bg-oc-bg px-3 py-2 text-sm text-oc-text" value={settings.transcriptionModel} onChange={(event) => saveSettings({ transcriptionModel: event.target.value })} />
          </label>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Toggle checked={settings.voiceEnabled} onCheckedChange={(voiceEnabled) => saveSettings({ voiceEnabled })} label="Voice commands" />
          <Toggle checked={settings.notificationsEnabled} onCheckedChange={(notificationsEnabled) => saveSettings({ notificationsEnabled })} label="Notifications" />
        </div>
        <form onSubmit={submitKey} className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex min-w-64 flex-1 items-center gap-2 rounded-md border border-oc-border bg-oc-bg px-3 py-2">
            <KeyRound size={14} className="text-oc-muted" />
            <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} type="password" placeholder={hasApiKey ? "API key saved" : "OpenAI API key"} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </div>
          <Button type="submit"><Save size={14} /> Save Key</Button>
          <Button type="button" variant="danger" onClick={clearApiKey}><Trash2 size={14} /> Clear</Button>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Floating Launcher" />
        <div className="grid gap-3 md:grid-cols-2">
          <Toggle checked={settings.launcher.visible} onCheckedChange={(visible) => saveSettings({ launcher: { ...settings.launcher, visible } })} label="Show launcher" />
          <Toggle checked={settings.launcher.compact} onCheckedChange={(compact) => saveSettings({ launcher: { ...settings.launcher, compact } })} label="Compact mode" />
          <Toggle checked={settings.launcher.showOnlyDuringShift} onCheckedChange={(showOnlyDuringShift) => saveSettings({ launcher: { ...settings.launcher, showOnlyDuringShift } })} label="Show only during shift" />
          <label className="rounded-md border border-oc-border bg-oc-elevated/38 p-3 text-sm">
            Opacity
            <input className="mt-2 w-full" type="range" min="0.35" max="1" step="0.05" value={settings.launcher.opacity} onChange={(event) => saveSettings({ launcher: { ...settings.launcher, opacity: Number(event.target.value) } })} />
          </label>
        </div>
        <label className="mt-3 block text-xs text-oc-muted">
          Disabled sites
          <textarea
            className="mt-1 min-h-20 w-full rounded-md border border-oc-border bg-oc-bg px-3 py-2 text-sm text-oc-text"
            value={settings.launcher.disabledSites.join("\n")}
            onChange={(event) => saveSettings({ launcher: { ...settings.launcher, disabledSites: event.target.value.split(/\n|,/).map((site) => site.trim()).filter(Boolean) } })}
            placeholder="example.com"
          />
        </label>
      </Card>
    </div>
  );
}
