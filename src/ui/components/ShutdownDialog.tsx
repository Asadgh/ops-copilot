import * as Dialog from "@radix-ui/react-dialog";
import { ClipboardCheck, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAppStore } from "../../app/store";
import { Button } from "./Button";

const prompts = [
  { key: "completed", label: "What got completed?" },
  { key: "blocked", label: "What remains blocked?" },
  { key: "tomorrow", label: "What should tomorrow focus on?" },
  { key: "unresolved", label: "Any unresolved issues?" }
];

export function ShutdownDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const runShutdown = useAppStore((store) => store.runShutdown);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await runShutdown(answers);
      setAnswers({});
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/64" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(720px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md border border-oc-border bg-oc-surface shadow-2xl">
          <form onSubmit={submit}>
            <div className="flex items-start justify-between gap-4 border-b border-oc-border px-4 py-3">
              <div>
                <Dialog.Title className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-oc-text">
                  <ClipboardCheck size={15} /> Shutdown Workflow
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-oc-muted">Generate shift summary, handoff notes, carry-over tasks, and operational report.</Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="Close shutdown workflow"><X size={16} /></Button>
              </Dialog.Close>
            </div>
            <div className="grid gap-3 p-4">
              {prompts.map((prompt) => (
                <label key={prompt.key} className="text-xs font-medium text-oc-muted">
                  <span className="mb-1.5 block">{prompt.label}</span>
                  <textarea
                    className="min-h-20 w-full rounded border border-oc-border bg-oc-bg px-3 py-2 text-sm leading-5 text-oc-text placeholder:text-oc-muted"
                    value={answers[prompt.key] ?? ""}
                    onChange={(event) => setAnswers((current) => ({ ...current, [prompt.key]: event.target.value }))}
                    placeholder="Leave blank to let Ops Copilot infer this from today's work."
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-oc-border px-4 py-3">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </Dialog.Close>
              <Button type="submit" variant="primary" disabled={saving}>{saving ? "Generating..." : "Generate Shutdown"}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
