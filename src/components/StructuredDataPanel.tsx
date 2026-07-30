import { Check, ClipboardCopy } from "lucide-react";
import { useMemo, useState } from "react";
import { createCurrentSandboxSnapshotPayload } from "../api/currentSandboxSnapshotApi";
import type { SandboxEnvironment, SandboxObject } from "../types";

interface StructuredDataPanelProps {
  objects: SandboxObject[];
  environment: SandboxEnvironment;
  selectedObject: SandboxObject | null;
}

export function StructuredDataPanel({
  objects,
  environment,
  selectedObject,
}: StructuredDataPanelProps): JSX.Element {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const snapshotPayload = useMemo(
    () =>
      createCurrentSandboxSnapshotPayload({
        objects,
        environment,
        selectedObjectId: selectedObject?.id ?? null,
      }),
    [environment, objects, selectedObject?.id],
  );
  const { snapshot, policy } = snapshotPayload;
  const snapshotJson = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);

  const handleCopySnapshot = async () => {
    const copied = await copyText(snapshotJson);
    setCopyState(copied ? "copied" : "failed");
    window.setTimeout(() => setCopyState("idle"), 1600);
  };

  return (
    <section className="side-section data-panel structured-data-panel" aria-label="当前 LLM Snapshot">
      <div className="data-panel-header">
        <div>
          <h2>LLM Snapshot</h2>
          <p>{policy.note}</p>
        </div>
        <button type="button" onClick={handleCopySnapshot} aria-label="复制当前 LLM Snapshot">
          {copyState === "copied" ? <Check size={14} /> : <ClipboardCopy size={14} />}
          {copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败" : "复制"}
        </button>
      </div>
      <div className="snapshot-summary-row" aria-label="当前 Snapshot 摘要">
        <span>
          <strong>{snapshot.analysis.totalObjects}</strong>
          沙具
        </span>
        <span>
          <strong>{snapshot.analysis.centerCount}</strong>
          中心
        </span>
        <span>
          <strong>{snapshot.environment.weatherLabel}</strong>
          天气
        </span>
        <span>
          <strong>{snapshot.environment.lightLabel}</strong>
          光照
        </span>
      </div>
      <pre>{snapshotJson}</pre>
    </section>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
