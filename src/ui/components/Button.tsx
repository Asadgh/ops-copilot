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
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-9 px-3.5 text-sm",
        size === "icon" && "size-9 p-0",
        variant === "primary" && "border-oc-blue/70 bg-oc-blue text-white shadow-oc-blue/10 hover:bg-oc-blue/90",
        variant === "secondary" && "border-oc-border/80 bg-oc-elevated/78 text-oc-text hover:border-oc-muted/55 hover:bg-oc-elevated",
        variant === "ghost" && "border-transparent bg-transparent text-oc-muted shadow-none hover:bg-oc-elevated/62 hover:text-oc-text",
        variant === "danger" && "border-oc-critical/45 bg-oc-critical/10 text-oc-critical hover:bg-oc-critical/16",
        variant === "success" && "border-oc-success/45 bg-oc-success/12 text-oc-success hover:bg-oc-success/18",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
