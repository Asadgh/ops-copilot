import type { LauncherSettings, RuntimeMessage, RuntimeResponse } from "../shared/types";

declare const chrome: typeof globalThis.chrome;

const HOST_ID = "ops-copilot-launcher-host";
const LONG_PRESS_MS = 650;

function runtimeMessage<T = unknown>(message: RuntimeMessage): Promise<RuntimeResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<RuntimeResponse<T>>;
}

function selectedText(): string | undefined {
  const text = window.getSelection()?.toString().trim();
  return text || undefined;
}

function getPageTaskTitle(prefix: string): string {
  const title = document.title?.trim() || location.hostname;
  return `${prefix}: ${title}`.slice(0, 180);
}

async function inject() {
  if (window.top !== window.self) return;
  if (document.getElementById(HOST_ID)) return;
  if (!document.documentElement || !chrome?.runtime?.id) return;

  const response = await runtimeMessage<LauncherSettings>({ type: "GET_LAUNCHER_SETTINGS", hostname: location.hostname });
  const settings = response.ok && response.data ? response.data : undefined;
  if (!settings?.visible) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const compactClass = settings.compact ? " compact" : "";
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        right: 0;
        top: ${Math.round(settings.positionY * 100)}vh;
        transform: translateY(-50%);
        z-index: 2147483647;
        opacity: ${settings.opacity};
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .launcher {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 42px;
        padding: 0 8px 0 12px;
        border: 1px solid rgba(77, 163, 255, .32);
        border-right: 0;
        border-radius: 999px 0 0 999px;
        background: linear-gradient(135deg, rgba(18, 24, 33, .96), rgba(26, 35, 48, .96));
        color: #f5f7fa;
        box-shadow: 0 12px 40px rgba(0, 0, 0, .32);
        cursor: pointer;
        user-select: none;
        transition: width .16s ease, opacity .16s ease, transform .16s ease;
      }
      .launcher:hover { transform: translateX(-2px); }
      .launcher.compact { width: 32px; justify-content: center; padding-left: 8px; }
      .mark { font-size: 12px; font-weight: 800; letter-spacing: .04em; }
      .drag { display: grid; gap: 2px; cursor: ns-resize; opacity: .58; }
      .drag span { width: 3px; height: 3px; border-radius: 50%; background: #9ba7b4; }
      .compact .drag { display: none; }
      .menu {
        position: absolute;
        right: 8px;
        top: 48px;
        min-width: 190px;
        padding: 8px;
        border-radius: 12px;
        border: 1px solid rgba(38, 48, 65, .9);
        background: rgba(11, 15, 20, .98);
        color: #f5f7fa;
        box-shadow: 0 20px 80px rgba(0, 0, 0, .42);
      }
      .menu[hidden] { display: none; }
      button {
        all: unset;
        box-sizing: border-box;
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        padding: 9px 10px;
        border-radius: 8px;
        color: #f5f7fa;
        cursor: pointer;
        font-size: 12px;
      }
      button:hover, button:focus-visible { background: rgba(77, 163, 255, .14); outline: 1px solid rgba(77, 163, 255, .38); }
      .tooltip {
        position: absolute;
        right: 8px;
        bottom: calc(100% + 6px);
        white-space: nowrap;
        border-radius: 8px;
        padding: 6px 8px;
        background: rgba(11, 15, 20, .96);
        color: #9ba7b4;
        font-size: 11px;
        opacity: 0;
        pointer-events: none;
        transition: opacity .14s ease;
      }
      .launcher:hover + .tooltip { opacity: 1; }
    </style>
    <div class="launcher${compactClass}" tabindex="0" role="button" aria-label="Open Ops Copilot">
      <span class="mark">OC</span>
      <span class="drag" aria-hidden="true"><span></span><span></span><span></span></span>
    </div>
    <div class="tooltip">Ops Copilot</div>
    <div class="menu" hidden>
      <button data-action="open">Open side panel <span>Enter</span></button>
      <button data-action="task">Create task</button>
      <button data-action="capture">Capture current page</button>
      <button data-action="voice">Start voice command</button>
      <button data-action="focus">Start focus session</button>
      <button data-action="note">Add quick note</button>
    </div>
  `;
  document.documentElement.append(host);

  const launcher = shadow.querySelector<HTMLElement>(".launcher");
  const menu = shadow.querySelector<HTMLElement>(".menu");
  if (!launcher || !menu) return;
  const menuEl = menu;

  let dragging = false;
  let moved = false;
  let longPressTimer: number | undefined;

  function openMenu() {
    menuEl.hidden = !menuEl.hidden;
  }

  function closeMenu() {
    menuEl.hidden = true;
  }

  async function openSidePanel() {
    await runtimeMessage({ type: "OPEN_SIDE_PANEL" });
  }

  async function quickAction(action: string) {
    closeMenu();
    if (action === "open" || action === "voice") {
      await openSidePanel();
      return;
    }
    if (action === "task") {
      await runtimeMessage({
        type: "CREATE_TASK",
        payload: {
          task: getPageTaskTitle("Follow up"),
          priority: "medium",
          location: document.title,
          metadata: { createdAt: Date.now(), updatedAt: Date.now(), sourceUrl: location.href, sourceTitle: document.title }
        }
      });
      return;
    }
    if (action === "capture") {
      await runtimeMessage({ type: "CAPTURE_PAGE", payload: { selectedText: selectedText() } });
      return;
    }
    if (action === "focus") {
      await runtimeMessage({ type: "START_FOCUS", payload: { durationMinutes: 25 } });
      return;
    }
    if (action === "note") {
      await runtimeMessage({
        type: "CREATE_TASK",
        payload: {
          task: getPageTaskTitle("Quick note"),
          priority: "low",
          notes: selectedText() || `Captured from ${location.href}`,
          location: document.title,
          metadata: { createdAt: Date.now(), updatedAt: Date.now(), sourceUrl: location.href, sourceTitle: document.title }
        }
      });
    }
  }

  launcher.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    launcher.setPointerCapture(event.pointerId);
    longPressTimer = window.setTimeout(openMenu, LONG_PRESS_MS);
  });

  launcher.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const y = Math.min(Math.max(event.clientY / window.innerHeight, 0.08), 0.92);
    host.style.top = `${Math.round(y * 100)}vh`;
    moved = true;
    if (longPressTimer) window.clearTimeout(longPressTimer);
  });

  launcher.addEventListener("pointerup", async (event) => {
    dragging = false;
    launcher.releasePointerCapture(event.pointerId);
    if (longPressTimer) window.clearTimeout(longPressTimer);
    const positionY = Number.parseFloat(host.style.top) / 100;
    if (moved) {
      await runtimeMessage({ type: "UPDATE_LAUNCHER_POSITION", payload: { positionY } });
      return;
    }
    await openSidePanel();
  });

  launcher.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void openSidePanel();
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const delta = event.key === "ArrowUp" ? -0.04 : 0.04;
      const next = Math.min(Math.max((Number.parseFloat(host.style.top) || 42) / 100 + delta, 0.08), 0.92);
      host.style.top = `${Math.round(next * 100)}vh`;
      void runtimeMessage({ type: "UPDATE_LAUNCHER_POSITION", payload: { positionY: next } });
    }
  });

  launcher.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    openMenu();
  });

  menuEl.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLButtonElement>("button")?.dataset.action;
    if (action) void quickAction(action);
  });

  document.addEventListener("click", (event) => {
    if (!host.contains(event.target as Node)) closeMenu();
  });
}

void inject().catch(() => undefined);
