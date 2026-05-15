import { Download, FileSpreadsheet, FileText, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAppStore } from "../../app/store";
import { formatDuration } from "../../shared/utils/date";
import { Button } from "../components/Button";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";

export function ReportsView() {
  const stats = useAppStore((store) => store.stats);
  const tasks = useAppStore((store) => store.tasks);
  const reports = useAppStore((store) => store.reports);
  const exportData = useAppStore((store) => store.exportData);
  const generateReport = useAppStore((store) => store.generateReport);
  const chart = [
    { name: "Active", value: stats.active },
    { name: "Blocked", value: stats.blocked },
    { name: "Completed", value: stats.completed }
  ];
  const topBlockers = tasks.filter((task) => task.blockers).slice(0, 5);

  return (
    <div className="space-y-4 p-4">
      <Card>
        <SectionTitle
          title="Reports & Analytics"
          subtitle="Export operational activity or generate performance-ready summaries."
          action={<Button variant="primary" onClick={() => generateReport(true)}><Sparkles size={14} /> Generate AI Report</Button>}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-oc-border bg-oc-elevated/42 p-3">
            <p className="text-xs text-oc-muted">Total Focus Time</p>
            <p className="mt-1 text-xl font-semibold">{formatDuration(stats.focusMinutes)}</p>
          </div>
          <div className="rounded-md border border-oc-border bg-oc-elevated/42 p-3">
            <p className="text-xs text-oc-muted">Completed Tasks</p>
            <p className="mt-1 text-xl font-semibold text-oc-success">{stats.completed}</p>
          </div>
          <div className="rounded-md border border-oc-border bg-oc-elevated/42 p-3">
            <p className="text-xs text-oc-muted">Blocked Tasks</p>
            <p className="mt-1 text-xl font-semibold text-oc-warning">{stats.blocked}</p>
          </div>
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid stroke="rgba(155,167,180,.14)" vertical={false} />
              <XAxis dataKey="name" stroke="rgb(var(--oc-muted))" fontSize={12} />
              <YAxis stroke="rgb(var(--oc-muted))" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "rgb(var(--oc-surface))", border: "1px solid rgb(var(--oc-border))", color: "rgb(var(--oc-text))" }} />
              <Bar dataKey="value" fill="rgb(var(--oc-blue))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => exportData("csv")}><Download size={14} /> CSV</Button>
          <Button size="sm" onClick={() => exportData("xlsx")}><FileSpreadsheet size={14} /> Excel</Button>
          <Button size="sm" onClick={() => exportData("markdown")}><FileText size={14} /> Markdown</Button>
          <Button size="sm" onClick={() => exportData("txt")}><FileText size={14} /> TXT</Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle title="Top Blockers" />
          <div className="space-y-2">
            {topBlockers.map((task) => (
              <div key={task.id} className="rounded-md border border-oc-border bg-oc-elevated/40 p-3 text-xs">
                <p className="font-medium text-oc-text">{task.task}</p>
                <p className="mt-1 text-oc-warning">{task.blockers}</p>
              </div>
            ))}
            {!topBlockers.length ? <EmptyState title="No blockers captured" /> : null}
          </div>
        </Card>
        <Card>
          <SectionTitle title="Saved Reports" />
          <div className="space-y-2">
            {reports.slice(0, 5).map((report) => (
              <article key={report.id} className="rounded-md border border-oc-border bg-oc-elevated/40 p-3 text-xs">
                <p className="font-medium text-oc-text">{report.title}</p>
                <p className="mt-1 text-oc-muted">{report.aiGenerated ? "AI generated" : "Local"} | {report.type}</p>
              </article>
            ))}
            {!reports.length ? <EmptyState title="No reports saved yet" /> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
