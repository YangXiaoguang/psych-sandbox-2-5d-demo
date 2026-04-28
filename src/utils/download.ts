import type { SandboxSnapshot } from "../types";

export function downloadSnapshot(snapshot: SandboxSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `psych-sandbox-snapshot-${safeTimestamp()}.json`);
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  triggerDownload(dataUrl, filename);
}

function triggerDownload(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function safeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
