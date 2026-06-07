import { toTimeLabel } from "../../shared/utils/date";
import { useAppStore } from "../../app/store";
import { Card, SectionTitle } from "../components/Card";
import { EmptyState } from "../components/EmptyState";

export function TimelineView() {
  const events = useAppStore((store) => store.events);
  return (
    <div className="oc-page space-y-4">
      <Card>
        <SectionTitle title="Operational Timeline" subtitle="Chronological memory feed for tasks, focus, captures, reminders, reports, and shutdowns." />
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="grid grid-cols-[56px_1fr] gap-3 rounded-lg border border-oc-border/58 bg-oc-elevated/32 p-3 text-xs">
              <span className="font-mono text-oc-blue">{toTimeLabel(event.timestamp)}</span>
              <div>
                <p className="font-medium text-oc-text">{event.title}</p>
                {event.details ? <p className="mt-1 text-oc-muted">{event.details}</p> : null}
              </div>
            </div>
          ))}
          {!events.length ? <EmptyState title="No timeline events captured" /> : null}
        </div>
      </Card>
    </div>
  );
}
