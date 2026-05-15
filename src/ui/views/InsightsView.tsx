import { BrainCircuit, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { summarizeTasksLocal } from "../../shared/services/localAi";
import { useAppStore } from "../../app/store";
import { sendRuntimeMessage } from "../../shared/chrome";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";

export function InsightsView() {
  const tasks = useAppStore((store) => store.tasks);
  const hasApiKey = useAppStore((store) => store.hasApiKey);
  const settings = useAppStore((store) => store.settings);
  const localSummary = useMemo(() => summarizeTasksLocal(tasks), [tasks]);
  const [summary, setSummary] = useState(localSummary);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const response = await sendRuntimeMessage<{ summary: string }>({ type: "AI_SUMMARIZE", payload: { filters: {} } });
      setSummary(response.ok && response.data?.summary ? response.data.summary : localSummary);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <Card>
        <SectionTitle
          title="AI Insights"
          subtitle={settings?.aiMode === "off" ? "AI mode is off. Showing local operational analysis." : hasApiKey ? "Summaries are routed through the background worker." : "No API key saved. Showing local operational analysis."}
          action={<Button onClick={refresh} disabled={loading}><RefreshCw size={14} /> Refresh</Button>}
        />
        <div className="rounded-lg border border-oc-border bg-oc-elevated/42 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><BrainCircuit size={16} /> Operational Summary</p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-6 text-oc-text">{summary}</pre>
        </div>
      </Card>
    </div>
  );
}
