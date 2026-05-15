import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../utils";

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <section className={cn("rounded-md border border-oc-border/90 bg-oc-surface/92 p-4", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-oc-text">{title}</h2>
        {subtitle ? <p className="mt-1 max-w-2xl text-xs leading-5 text-oc-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
