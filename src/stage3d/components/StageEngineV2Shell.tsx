import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Cuboid, RefreshCcw } from "lucide-react";
import type { SandboxEnvironment, SandboxEventDraft, SandboxObject } from "../../types";
import { downloadDataUrl, safeTimestamp } from "../../utils/download";
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
    <section className="stage-v2-shell" aria-label="Stage Engine v2 真实 3D 沙盘">
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
    </section>
  );
});
