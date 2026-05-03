import {
  Cloud,
  CloudRain,
  FileDown,
  Grid3X3,
  ImageDown,
  Maximize2,
  Minimize2,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Sun,
  Trash2,
} from "lucide-react";
import {
  getEnvironmentLabel,
  LIGHT_LABELS,
  LIGHT_OPTIONS,
  WEATHER_LABELS,
  WEATHER_OPTIONS,
} from "../data/environment";
import type { SandboxEnvironment, SandboxLightMode, SandboxWeather } from "../types";

interface TopBarProps {
  objectCount: number;
  environment: SandboxEnvironment;
  focusMode: boolean;
  rightPanelCollapsed: boolean;
  showRightPanelToggle: boolean;
  showGuides: boolean;
  onEnvironmentChange: (patch: Partial<SandboxEnvironment>) => void;
  onToggleFocusMode: () => void;
  onToggleRightPanel: () => void;
  onToggleGuides: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onClearScene: () => void;
}

export function TopBar({
  objectCount,
  environment,
  focusMode,
  rightPanelCollapsed,
  showRightPanelToggle,
  showGuides,
  onEnvironmentChange,
  onToggleFocusMode,
  onToggleRightPanel,
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
        <span>{getEnvironmentLabel(environment)}</span>
      </div>
      <div className="environment-controls" aria-label="沙盘环境">
        <label>
          <WeatherIcon weather={environment.weather} />
          <span>天气</span>
          <select
            value={environment.weather}
            onChange={(event) => onEnvironmentChange({ weather: event.target.value as SandboxWeather })}
            aria-label="选择天气"
          >
            {WEATHER_OPTIONS.map((weather) => (
              <option key={weather} value={weather}>
                {WEATHER_LABELS[weather]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {environment.light === "night" ? <Moon size={15} /> : <Sun size={15} />}
          <span>光照</span>
          <select
            value={environment.light}
            onChange={(event) => onEnvironmentChange({ light: event.target.value as SandboxLightMode })}
            aria-label="选择光照"
          >
            {LIGHT_OPTIONS.map((light) => (
              <option key={light} value={light}>
                {LIGHT_LABELS[light]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="topbar-actions">
        <button
          className="icon-button"
          type="button"
          onClick={onToggleFocusMode}
          aria-label={focusMode ? "退出沙盘全屏模式" : "进入沙盘全屏模式"}
        >
          {focusMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          <span>{focusMode ? "退出全屏" : "全屏"}</span>
        </button>
        {showRightPanelToggle ? (
          <button
            className={`icon-button ${rightPanelCollapsed ? "active" : ""}`}
            type="button"
            onClick={onToggleRightPanel}
            aria-label={rightPanelCollapsed ? "展开右侧作品面板" : "隐藏右侧作品面板"}
          >
            {rightPanelCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
            <span>{rightPanelCollapsed ? "展开面板" : "隐藏面板"}</span>
          </button>
        ) : null}
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

function WeatherIcon({ weather }: { weather: SandboxWeather }): JSX.Element {
  if (weather === "rainy") {
    return <CloudRain size={15} />;
  }
  if (weather === "cloudy") {
    return <Cloud size={15} />;
  }
  return <Sun size={15} />;
}
