import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Cuboid, RefreshCcw } from "lucide-react";
import type { SandboxEnvironment, SandboxEventDraft, SandboxObject } from "../../types";
import { downloadDataUrl, safeTimestamp } from "../../utils/download";
import type { StageInteractionMode } from "../types";
import { StageCanvas3D } from "./StageCanvas3D";

export interface StageEngineV2Handle {
  exportPng: () => void;
  resetView: () => void;
}

interface StageEngineV2ShellProps {
  environment: SandboxEnvironment;
  objectCount: number;
  objects: SandboxObject[];
  onPatchObject: (objectId: string, patch: Partial<SandboxObject>) => void;
  onRecordEvent: (draft: SandboxEventDraft) => void;
  onSelectObject: (objectId: string | null) => void;
  selectedId: string | null;
}

export const StageEngineV2Shell = forwardRef<StageEngineV2Handle, StageEngineV2ShellProps>(function StageEngineV2Shell(
  {
    environment,
    objectCount,
    objects,
    onPatchObject,
    onRecordEvent,
    onSelectObject,
    selectedId,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraResetSignal, setCameraResetSignal] = useState(0);
  const [interactionMode, setInteractionMode] = useState<StageInteractionMode>("idle");
  const [draggingToyName, setDraggingToyName] = useState<string | null>(null);
  const selectedObject = objects.find((object) => object.id === selectedId) ?? null;
  const interactionCopy = getStageInteractionCopy(interactionMode, selectedObject?.name ?? draggingToyName ?? null);
  const shellClassName = [
    "stage-v2-shell",
    selectedObject ? "has-stage-selection" : "",
    `is-stage-${interactionMode}`,
  ]
    .filter(Boolean)
    .join(" ");

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      downloadDataUrl(canvas.toDataURL("image/png"), `stage-engine-v2-${safeTimestamp()}.png`);
    },
    resetView: () => {
      setCameraResetSignal((current) => current + 1);
    },
  }));

  return (
    <section className={shellClassName} aria-label="Stage Engine v2 真实 3D 沙盘">
      <div className="stage-v2-canvas-wrap">
        <StageCanvas3D
          environment={environment}
          objects={objects}
          selectedId={selectedId}
          cameraResetSignal={cameraResetSignal}
          onCanvasReady={(canvas) => {
            canvasRef.current = canvas;
          }}
          onPatchObject={onPatchObject}
          onRecordEvent={onRecordEvent}
          onSelectObject={onSelectObject}
          onInteractionModeChange={setInteractionMode}
          onToyDragLabelChange={setDraggingToyName}
        />
      </div>

      <div className="stage-v2-panel stage-v2-panel-top">
        <div>
          <p className="eyebrow">Stage Engine v2</p>
          <h3>
            <Cuboid size={18} />
            3D 沙盘舞台
          </h3>
        </div>
        <span>{objectCount} 个对象</span>
        <button
          className="stage-v2-view-reset"
          type="button"
          onClick={() => setCameraResetSignal((current) => current + 1)}
          aria-label="重置 3D 沙盘视角"
        >
          <RefreshCcw size={16} />
          视角
        </button>
      </div>

      <div className="stage-v2-panel stage-v2-interaction-hud" data-mode={interactionMode} aria-live="polite">
        <span className="stage-v2-interaction-orb" aria-hidden="true" />
        <div>
          <strong>{interactionCopy.title}</strong>
          <span>{interactionCopy.hint}</span>
        </div>
      </div>
    </section>
  );
});

function getStageInteractionCopy(mode: StageInteractionMode, toyName: string | null): { title: string; hint: string } {
  switch (mode) {
    case "pan":
      return {
        title: "正在平移沙盘视角",
        hint: "松开鼠标后停在当前构图，也可以滚轮继续靠近观察。",
      };
    case "rotate":
      return {
        title: "正在转动沙盘角度",
        hint: "右键拖动会改变观察角度，沙具位置保持不变。",
      };
    case "zoom":
      return {
        title: "正在缩放沙盘",
        hint: "滚轮靠近细节或拉远看整体，不影响沙具摆放。",
      };
    case "drag-toy":
      return {
        title: `正在移动${toyName ? `：${toyName}` : "沙具"}`,
        hint: "拖到合适位置后松开鼠标，系统会记录这次移动。",
      };
    case "idle":
    default:
      if (toyName) {
        return {
          title: `已选中：${toyName}`,
          hint: "拖动沙具可移动；底部工具条可旋转、缩放、复制或删除。",
        };
      }
      return {
        title: "移动沙盘视角",
        hint: "左键拖空白处平移，右键转动角度，滚轮缩放查看细节。",
      };
  }
}
