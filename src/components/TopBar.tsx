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
import type { SandboxEnvironment, SandboxWeather } from "../types";

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
      <div className="topbar-primary">
        <div className="topbar-title">
          <p className="eyebrow">2.5D Sandplay Engine</p>
          <h2>数字心理沙盘编辑器</h2>
        </div>
        <div className="topbar-status" aria-label="作品状态">
          <span className="status-emphasis">沙具 {objectCount}</span>
          <span>y-axis 深度</span>
          <span>{getEnvironmentLabel(environment)}</span>
        </div>
      </div>
      <div className="topbar-hud" aria-label="沙盘控制台">
        <section className="hud-cluster environment-hud" aria-label="沙盘环境">
          <p>环境</p>
          <div className="hud-segment" role="group" aria-label="选择天气">
            {WEATHER_OPTIONS.map((weather) => (
              <button
                key={weather}
                type="button"
                className={environment.weather === weather ? "active" : ""}
                onClick={() => onEnvironmentChange({ weather })}
                aria-pressed={environment.weather === weather}
                title={WEATHER_LABELS[weather]}
              >
                <WeatherIcon weather={weather} />
                <span>{getWeatherShortLabel(weather)}</span>
              </button>
            ))}
          </div>
          <div className="hud-segment compact" role="group" aria-label="选择光照">
            {LIGHT_OPTIONS.map((light) => (
              <button
                key={light}
                type="button"
                className={environment.light === light ? "active" : ""}
                onClick={() => onEnvironmentChange({ light })}
                aria-pressed={environment.light === light}
                title={LIGHT_LABELS[light]}
              >
                {light === "night" ? <Moon size={15} /> : <Sun size={15} />}
                <span>{light === "night" ? "夜" : "日"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="hud-cluster action-hud view-hud" aria-label="视图控制">
          <p>视图</p>
          <button
            className="icon-button"
            type="button"
            onClick={onToggleFocusMode}
            aria-label={focusMode ? "退出沙盘全屏模式" : "进入沙盘全屏模式"}
          >
            {focusMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            <span>{focusMode ? "退出" : "全屏"}</span>
          </button>
          {showRightPanelToggle ? (
            <button
              className={`icon-button ${rightPanelCollapsed ? "active" : ""}`}
              type="button"
              onClick={onToggleRightPanel}
              aria-label={rightPanelCollapsed ? "展开右侧作品面板" : "隐藏右侧作品面板"}
              aria-pressed={rightPanelCollapsed}
            >
              {rightPanelCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
              <span>{rightPanelCollapsed ? "面板" : "隐藏"}</span>
            </button>
          ) : null}
          <button
            className={`icon-button ${showGuides ? "active" : ""}`}
            type="button"
            onClick={onToggleGuides}
            aria-label="切换辅助区域"
            aria-pressed={showGuides}
          >
            <Grid3X3 size={17} />
            <span>九宫格</span>
          </button>
        </section>

        <section className="hud-cluster action-hud export-hud" aria-label="作品操作">
          <p>输出</p>
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
        </section>
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

function getWeatherShortLabel(weather: SandboxWeather): string {
  if (weather === "rainy") {
    return "雨";
  }
  if (weather === "cloudy") {
    return "阴";
  }
  return "晴";
}
