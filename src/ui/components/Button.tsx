import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "icon";

export function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded border font-medium transition disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" && "h-7 px-2.5 text-xs",
        size === "md" && "h-8 px-3 text-sm",
        size === "icon" && "size-8 p-0",
        variant === "primary" && "border-oc-blue/70 bg-oc-blue/90 text-white hover:bg-oc-blue",
        variant === "secondary" && "border-oc-border bg-oc-elevated/72 text-oc-text hover:border-oc-muted/60 hover:bg-oc-elevated",
        variant === "ghost" && "border-transparent bg-transparent text-oc-muted hover:bg-oc-elevated/60 hover:text-oc-text",
        variant === "danger" && "border-oc-critical/45 bg-oc-critical/10 text-oc-critical hover:bg-oc-critical/16",
        variant === "success" && "border-oc-success/45 bg-oc-success/10 text-oc-success hover:bg-oc-success/16",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
