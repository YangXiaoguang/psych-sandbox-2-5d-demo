import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Boxes, Copy, Cuboid, MousePointer2, RefreshCcw, RotateCcw, RotateCw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import type { SandboxEnvironment, SandboxEventDraft, SandboxObject } from "../../types";
import { clamp } from "../../utils/analysis";
import { downloadDataUrl, safeTimestamp } from "../../utils/download";
import { StageCanvas3D } from "./StageCanvas3D";

export interface StageEngineV2Handle {
  exportPng: () => void;
}

interface StageEngineV2ShellProps {
  environment: SandboxEnvironment;
  objectCount: number;
  objects: SandboxObject[];
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  onPatchObject: (objectId: string, patch: Partial<SandboxObject>) => void;
  onPatchSelected: (patch: Partial<SandboxObject>, label: string) => void;
  onRecordEvent: (draft: SandboxEventDraft) => void;
  onSelectObject: (objectId: string | null) => void;
  selectedId: string | null;
}

export const StageEngineV2Shell = forwardRef<StageEngineV2Handle, StageEngineV2ShellProps>(function StageEngineV2Shell(
  {
    environment,
    objectCount,
    objects,
    onDeleteSelected,
    onDuplicateSelected,
    onPatchObject,
    onPatchSelected,
    onRecordEvent,
    onSelectObject,
    selectedId,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraResetSignal, setCameraResetSignal] = useState(0);
  const selectedObject = objects.find((object) => object.id === selectedId) ?? null;

  const patchSelectedTransform = useCallback(
    (patch: Partial<SandboxObject>, label: string) => {
      if (!selectedObject) {
        return;
      }
      onPatchSelected(patch, label);
    },
    [onPatchSelected, selectedObject],
  );

  const rotateSelected = useCallback(
    (delta: number) => {
      if (!selectedObject) {
        return;
      }

      patchSelectedTransform(
        { rotation: normalizeRotation(selectedObject.rotation + delta) },
        `Stage v2 旋转沙具: ${selectedObject.name}`,
      );
    },
    [patchSelectedTransform, selectedObject],
  );

  const scaleSelected = useCallback(
    (delta: number) => {
      if (!selectedObject) {
        return;
      }

      patchSelectedTransform(
        { scale: Number(clamp(selectedObject.scale + delta, 0.35, 2.4).toFixed(2)) },
        `Stage v2 缩放沙具: ${selectedObject.name}`,
      );
    },
    [patchSelectedTransform, selectedObject],
  );

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      downloadDataUrl(canvas.toDataURL("image/png"), `stage-engine-v2-${safeTimestamp()}.png`);
    },
  }));

  return (
    <section className={`stage-v2-shell${selectedObject ? " has-stage-selection" : ""}`} aria-label="Stage Engine v2 真实 3D 沙盘">
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

      {selectedObject ? (
        <div className="stage-v2-panel stage-v2-panel-selection">
          <div>
            <p className="eyebrow">Selected Toy</p>
            <strong>{selectedObject.name}</strong>
            <span>
              X {Math.round(selectedObject.x)} / Y {Math.round(selectedObject.y)}
            </span>
          </div>
          <div className="stage-v2-transform-strip" aria-label={`${selectedObject.name} 操作工具栏`}>
            <button type="button" onClick={() => rotateSelected(-15)} aria-label={`向左旋转 ${selectedObject.name} 15 度`}>
              <RotateCcw size={17} />
            </button>
            <button type="button" onClick={() => rotateSelected(15)} aria-label={`向右旋转 ${selectedObject.name} 15 度`}>
              <RotateCw size={17} />
            </button>
            <button type="button" onClick={() => scaleSelected(-0.1)} aria-label={`缩小 ${selectedObject.name}`}>
              <ZoomOut size={17} />
            </button>
            <button type="button" onClick={() => scaleSelected(0.1)} aria-label={`放大 ${selectedObject.name}`}>
              <ZoomIn size={17} />
            </button>
            <button type="button" onClick={onDuplicateSelected} aria-label={`复制 ${selectedObject.name}`}>
              <Copy size={17} />
            </button>
            <button className="danger" type="button" onClick={onDeleteSelected} aria-label={`删除 ${selectedObject.name}`}>
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="stage-v2-panel stage-v2-panel-bottom">
        <span>
          <MousePointer2 size={15} />
          拖动沙具可移动；拖动空白处平移沙盘，右键转动，滚轮缩放
        </span>
        <span>
          <Boxes size={15} />
          选择、移动、删除与 PNG 导出已接入主状态
        </span>
      </div>
    </section>
  );
});

function normalizeRotation(rotation: number): number {
  return ((rotation % 360) + 360) % 360;
}
