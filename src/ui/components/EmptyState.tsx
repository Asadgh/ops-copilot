export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-oc-border/75 bg-oc-elevated/28 p-6 text-center">
      <p className="text-sm font-medium text-oc-text">{title}</p>
      {detail ? <p className="mt-1 text-xs text-oc-muted">{detail}</p> : null}
    </div>
  );
}
