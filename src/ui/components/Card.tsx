import type { HTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../utils";

export function Card({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <section className={cn("rounded-lg border border-oc-border/70 bg-oc-surface/88 p-4 shadow-sm shadow-black/10 backdrop-blur", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-oc-text">{title}</h2>
        {subtitle ? <p className="mt-1 max-w-2xl text-xs leading-5 text-oc-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
