import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { SendHorizontal } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAppStore } from "../../app/store";
import { Button } from "./Button";

export function TerminalConsole() {
  const terminalLines = useAppStore((store) => store.terminal);
  const executeCommand = useAppStore((store) => store.executeCommand);
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
      theme: {
        background: "transparent",
        foreground: "#f5f7fa",
        blue: "#4da3ff",
        green: "#22c55e",
        red: "#ef4444",
        yellow: "#f59e0b"
      }
    });
    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    return () => terminal.dispose();
  }, []);

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
    <div className="border-t border-oc-border bg-[#05080c]/95">
      <div className="flex h-7 items-center justify-between border-b border-oc-border px-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-oc-muted">Command Console</span>
        <span className="font-mono text-[10px] text-oc-blue">READY</span>
      </div>
      <div ref={containerRef} className="h-[90px] overflow-hidden" />
      <form className="flex items-center gap-2 border-t border-oc-border px-3 py-2" onSubmit={submit}>
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
          className="min-w-0 flex-1 rounded border border-oc-border bg-oc-bg px-3 py-1.5 font-mono text-xs text-oc-text placeholder:text-oc-muted"
          placeholder="new task investigate routing delay"
        />
        <Button size="icon" variant="primary" aria-label="Run command">
          <SendHorizontal size={15} />
        </Button>
      </form>
    </div>
  );
}
