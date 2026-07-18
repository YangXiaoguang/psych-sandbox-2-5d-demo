import { forwardRef, useImperativeHandle, useRef } from "react";
import { Boxes, Cuboid, MousePointer2, Trash2 } from "lucide-react";
import type { SandboxEnvironment, SandboxEventDraft, SandboxObject } from "../../types";
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
  onPatchObject: (objectId: string, patch: Partial<SandboxObject>) => void;
  onRecordEvent: (draft: SandboxEventDraft) => void;
  onSelectObject: (objectId: string | null) => void;
  selectedId: string | null;
}

export const StageEngineV2Shell = forwardRef<StageEngineV2Handle, StageEngineV2ShellProps>(function StageEngineV2Shell(
  { environment, objectCount, objects, onDeleteSelected, onPatchObject, onRecordEvent, onSelectObject, selectedId },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selectedObject = objects.find((object) => object.id === selectedId) ?? null;

  useImperativeHandle(ref, () => ({
    exportPng: () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      downloadDataUrl(`stage-engine-v2-${safeTimestamp()}.png`, canvas.toDataURL("image/png"));
    },
  }));

  return (
    <section className="stage-v2-shell" aria-label="Stage Engine v2 真实 3D 沙盘技术预览">
      <div className="stage-v2-canvas-wrap">
        <StageCanvas3D
          environment={environment}
          objects={objects}
          selectedId={selectedId}
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
            真实 3D 沙盘技术切片
          </h3>
        </div>
        <span>{objectCount} 个作品对象已桥接</span>
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
          <button type="button" onClick={onDeleteSelected} aria-label={`删除 ${selectedObject.name}`}>
            <Trash2 size={17} />
          </button>
        </div>
      ) : null}

      <div className="stage-v2-panel stage-v2-panel-bottom">
        <span>
          <MousePointer2 size={15} />
          拖动沙具可移动；拖动空白处可转动，滚轮缩放
        </span>
        <span>
          <Boxes size={15} />
          选择、移动、删除与 PNG 导出已接入主状态
        </span>
      </div>
    </section>
  );
});
