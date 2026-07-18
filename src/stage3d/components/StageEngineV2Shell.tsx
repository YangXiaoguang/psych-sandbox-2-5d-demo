import { forwardRef, useImperativeHandle, useRef } from "react";
import { Boxes, Cuboid, MousePointer2 } from "lucide-react";
import type { SandboxEnvironment } from "../../types";
import { downloadDataUrl, safeTimestamp } from "../../utils/download";
import { StageCanvas3D } from "./StageCanvas3D";

export interface StageEngineV2Handle {
  exportPng: () => void;
}

interface StageEngineV2ShellProps {
  environment: SandboxEnvironment;
  objectCount: number;
}

export const StageEngineV2Shell = forwardRef<StageEngineV2Handle, StageEngineV2ShellProps>(function StageEngineV2Shell(
  { environment, objectCount },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
        <StageCanvas3D environment={environment} onCanvasReady={(canvas) => {
          canvasRef.current = canvas;
        }} />
      </div>

      <div className="stage-v2-panel stage-v2-panel-top">
        <div>
          <p className="eyebrow">Stage Engine v2</p>
          <h3>
            <Cuboid size={18} />
            真实 3D 沙盘技术切片
          </h3>
        </div>
        <span>{objectCount} 个当前作品对象待桥接</span>
      </div>

      <div className="stage-v2-panel stage-v2-panel-bottom">
        <span>
          <MousePointer2 size={15} />
          鼠标拖动画面可转动，滚轮缩放，右键/中键平移
        </span>
        <span>
          <Boxes size={15} />
          当前仅验证 3D 沙盘、相机、灯光与 PNG 导出
        </span>
      </div>
    </section>
  );
});

