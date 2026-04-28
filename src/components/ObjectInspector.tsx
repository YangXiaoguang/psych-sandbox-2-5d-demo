import { Trash2 } from "lucide-react";
import type { SandboxObject } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../utils/analysis";
import { RiskTagBadge } from "./RiskTagBadge";

interface ObjectInspectorProps {
  selectedObject: SandboxObject | null;
  onPatchSelected: (patch: Partial<SandboxObject>, label: string) => void;
  onDeleteSelected: () => void;
}

export function ObjectInspector({
  selectedObject,
  onPatchSelected,
  onDeleteSelected,
}: ObjectInspectorProps): JSX.Element {
  if (!selectedObject) {
    return (
      <section className="side-section empty-inspector" aria-label="对象属性">
        <h2>对象属性</h2>
        <p>未选择沙具</p>
      </section>
    );
  }

  const patchNumber = (
    patch: Partial<Pick<SandboxObject, "x" | "y" | "rotation" | "scale">>,
    label: string,
  ) => {
    onPatchSelected(patch, label);
  };

  return (
    <section className="side-section object-inspector" aria-label="对象属性">
      <div className="section-title-row">
        <h2>对象属性</h2>
        <RiskTagBadge riskTag={selectedObject.riskTag} />
      </div>

      <div className="selected-object-card">
        <div>
          <strong>{selectedObject.name}</strong>
          <span>{selectedObject.category}</span>
        </div>
        <button className="small-icon-button danger" type="button" onClick={onDeleteSelected} aria-label="删除选中沙具">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="property-grid">
        <label>
          X
          <input
            type="number"
            min={0}
            max={BOARD_WIDTH}
            value={Math.round(selectedObject.x)}
            onChange={(event) => patchNumber({ x: Number(event.target.value) }, "调整 X 坐标")}
          />
        </label>
        <label>
          Y
          <input
            type="number"
            min={0}
            max={BOARD_HEIGHT}
            value={Math.round(selectedObject.y)}
            onChange={(event) => patchNumber({ y: Number(event.target.value) }, "调整 Y 坐标")}
          />
        </label>
      </div>

      <label className="range-row">
        <span>旋转</span>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={selectedObject.rotation}
          onChange={(event) => patchNumber({ rotation: Number(event.target.value) }, "调整旋转角度")}
        />
        <output>{Math.round(selectedObject.rotation)}°</output>
      </label>

      <label className="range-row">
        <span>缩放</span>
        <input
          type="range"
          min={0.35}
          max={2.4}
          step={0.05}
          value={selectedObject.scale}
          onChange={(event) => patchNumber({ scale: Number(event.target.value) }, "调整缩放比例")}
        />
        <output>{selectedObject.scale.toFixed(2)}</output>
      </label>

      <div className="symbolic-list">
        {selectedObject.symbolicCandidates.map((candidate) => (
          <span key={candidate}>{candidate}</span>
        ))}
      </div>
    </section>
  );
}
