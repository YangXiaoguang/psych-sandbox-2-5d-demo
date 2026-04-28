import { FileDown, Grid3X3, ImageDown, Trash2 } from "lucide-react";

interface TopBarProps {
  objectCount: number;
  showGuides: boolean;
  onToggleGuides: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onClearScene: () => void;
}

export function TopBar({
  objectCount,
  showGuides,
  onToggleGuides,
  onExportJson,
  onExportPng,
  onClearScene,
}: TopBarProps): JSX.Element {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <p className="eyebrow">2.5D Sandplay Engine</p>
        <h2>数字心理沙盘编辑器</h2>
      </div>
      <div className="topbar-status" aria-label="作品状态">
        <span>沙具 {objectCount}</span>
        <span>深度排序 y-axis</span>
      </div>
      <div className="topbar-actions">
        <button
          className={`icon-button ${showGuides ? "active" : ""}`}
          type="button"
          onClick={onToggleGuides}
          aria-label="切换辅助区域"
        >
          <Grid3X3 size={17} />
          <span>辅助区域</span>
        </button>
        <button className="icon-button" type="button" onClick={onExportJson} aria-label="导出 JSON 快照">
          <FileDown size={17} />
          <span>JSON</span>
        </button>
        <button className="icon-button" type="button" onClick={onExportPng} aria-label="导出 PNG 截图">
          <ImageDown size={17} />
          <span>PNG</span>
        </button>
        <button className="icon-button danger" type="button" onClick={onClearScene} aria-label="清空当前作品">
          <Trash2 size={17} />
          <span>清空</span>
        </button>
      </div>
    </header>
  );
}
