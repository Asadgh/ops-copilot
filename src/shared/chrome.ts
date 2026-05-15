import type { RuntimeMessage, RuntimeResponse } from "./types";

export function hasRuntime(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.runtime?.sendMessage);
}

export async function sendRuntimeMessage<T = unknown>(message: RuntimeMessage): Promise<RuntimeResponse<T>> {
  if (!hasRuntime()) {
    return { ok: false, error: "Chrome runtime is not available in this context." };
  }
  return chrome.runtime.sendMessage(message) as Promise<RuntimeResponse<T>>;
}

export function downloadExport(filename: string, mimeType: string, content: string, encoding: "text" | "base64"): void {
  const bytes =
    encoding === "base64"
      ? Uint8Array.from(atob(content), (char) => char.charCodeAt(0))
      : new TextEncoder().encode(content);
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
