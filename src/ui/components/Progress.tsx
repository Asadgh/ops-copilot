export function Progress({ value, tone = "blue" }: { value: number; tone?: "blue" | "success" | "warning" | "critical" }) {
  const color =
    tone === "success"
      ? "bg-oc-success"
      : tone === "warning"
        ? "bg-oc-warning"
        : tone === "critical"
          ? "bg-oc-critical"
          : "bg-oc-blue";
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-oc-elevated">
      <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}
