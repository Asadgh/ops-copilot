import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { SendHorizontal } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../app/store";
import { Button } from "./Button";

function cssColor(variable: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  if (!raw) return fallback;
  return `rgb(${raw.split(/\s+/).join(", ")})`;
}

function terminalTheme() {
  return {
    background: "transparent",
    foreground: cssColor("--oc-text", "#f5f7fa"),
    blue: cssColor("--oc-blue", "#5d8bf4"),
    green: cssColor("--oc-success", "#22c55e"),
    red: cssColor("--oc-critical", "#ef4444"),
    yellow: cssColor("--oc-warning", "#f59e0b"),
    brightBlack: cssColor("--oc-muted", "#9ba7b4")
  };
}

export function TerminalConsole() {
  const terminalLines = useAppStore((store) => store.terminal);
  const executeCommand = useAppStore((store) => store.executeCommand);
  const theme = useAppStore((store) => store.settings?.theme);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;
    const terminal = new Terminal({
      convertEol: true,
      cursorBlink: false,
      disableStdin: true,
      fontFamily: "JetBrains Mono, Fira Code, monospace",
      fontSize: 11,
      rows: 5,
      theme: terminalTheme()
    });
    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    return () => terminal.dispose();
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = terminalTheme();
    }
  }, [theme]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.clear();
    terminal.writeln("\x1b[34mOps Copilot >\x1b[0m");
    terminalLines.slice(-8).forEach((line) => {
      const color = line.role === "error" ? "\x1b[31m" : line.role === "success" ? "\x1b[32m" : line.role === "input" ? "\x1b[36m" : "\x1b[90m";
      terminal.writeln(`${color}${line.text}\x1b[0m`);
    });
  }, [terminalLines]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = command.trim();
    if (!next) return;
    setCommand("");
    setHistory((items) => [next, ...items.filter((item) => item !== next)].slice(0, 30));
    setHistoryIndex(-1);
    await executeCommand(next);
  }

  return (
    <div className="border-t border-oc-border/55 bg-oc-surface/92 backdrop-blur-xl">
      <div className="flex h-8 items-center justify-between border-b border-oc-border/55 px-3">
        <span className="text-xs font-semibold text-oc-muted">Command console</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-oc-success/10 px-2 py-1 text-[11px] font-semibold text-oc-success">
          <span className="size-1.5 rounded-full bg-oc-success" /> Ready
        </span>
      </div>
      <div ref={containerRef} className="h-[90px] overflow-hidden" />
      <form className="flex items-center gap-2 border-t border-oc-border/55 px-3 py-2" onSubmit={submit}>
        <span className="font-mono text-xs text-oc-cyan">&gt;</span>
        <input
          value={command}
          onChange={(event) => setCommand(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              const next = Math.min(historyIndex + 1, history.length - 1);
              setHistoryIndex(next);
              setCommand(history[next] ?? command);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              const next = Math.max(historyIndex - 1, -1);
              setHistoryIndex(next);
              setCommand(next === -1 ? "" : history[next] ?? "");
            }
          }}
          className="oc-input min-w-0 flex-1 px-3 py-2 font-mono text-xs placeholder:text-oc-muted"
          placeholder="new task investigate routing delay"
        />
        <Button size="icon" variant="primary" aria-label="Run command">
          <SendHorizontal size={15} />
        </Button>
      </form>
    </div>
  );
}
