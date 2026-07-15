import { useState } from "react";
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
  RotateCcw,
  SlidersHorizontal,
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
import type { SandboxCameraState, SandboxEnvironment, SandboxWeather } from "../types";
import { SANDBOX_CAMERA_PRESETS } from "../utils/projection";

interface TopBarProps {
  objectCount: number;
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
  focusMode: boolean;
  rightPanelCollapsed: boolean;
  showRightPanelToggle: boolean;
  showGuides: boolean;
  onEnvironmentChange: (patch: Partial<SandboxEnvironment>) => void;
  onCameraChange: (patch: Partial<SandboxCameraState>) => void;
  onCameraReset: () => void;
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
  camera,
  focusMode,
  rightPanelCollapsed,
  showRightPanelToggle,
  showGuides,
  onEnvironmentChange,
  onCameraChange,
  onCameraReset,
  onToggleFocusMode,
  onToggleRightPanel,
  onToggleGuides,
  onExportJson,
  onExportPng,
  onClearScene,
}: TopBarProps): JSX.Element {
  const [cameraPanelOpen, setCameraPanelOpen] = useState(false);
  const currentCameraPreset = SANDBOX_CAMERA_PRESETS.find((preset) => isCameraPresetActive(camera, preset.camera));
  const cameraAdjustPanel = cameraPanelOpen ? (
    <div className="camera-adjust-panel" role="group" aria-label="沙盘视角高级调节">
      <div className="camera-panel-presets" role="group" aria-label="选择沙盘视角预设">
        {SANDBOX_CAMERA_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={isCameraPresetActive(camera, preset.camera) ? "active" : ""}
            onClick={() => onCameraChange(preset.camera)}
            title={preset.description}
          >
            <span>{preset.label}</span>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>
      <CameraSlider label="转动" value={camera.yaw} min={-32} max={32} step={1} unit="°" onChange={(yaw) => onCameraChange({ yaw })} />
      <CameraSlider label="俯仰" value={camera.pitch} min={0.48} max={0.74} step={0.01} onChange={(pitch) => onCameraChange({ pitch })} />
      <CameraSlider label="缩放" value={camera.zoom} min={0.7} max={1.48} step={0.01} onChange={(zoom) => onCameraChange({ zoom })} />
      <CameraSlider label="横移" value={camera.panX} min={-260} max={260} step={4} onChange={(panX) => onCameraChange({ panX })} />
      <CameraSlider label="纵移" value={camera.panY} min={-190} max={190} step={4} onChange={(panY) => onCameraChange({ panY })} />
    </div>
  ) : null;

  return (
    <header className={cameraPanelOpen ? "topbar camera-panel-open" : "topbar"}>
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
                aria-label={`切换天气：${WEATHER_LABELS[weather]}`}
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
                aria-label={`切换光照：${LIGHT_LABELS[light]}`}
                title={LIGHT_LABELS[light]}
              >
                {light === "night" ? <Moon size={15} /> : <Sun size={15} />}
                <span>{light === "night" ? "夜" : "日"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="hud-cluster camera-hud" aria-label="沙盘视角">
          <p>视角</p>
          <div className="camera-current-pill" aria-label="当前沙盘视角">
            <span>{currentCameraPreset?.label ?? "自定"}</span>
            <small>
              {Math.round(camera.yaw)}° / {camera.zoom.toFixed(2)}x
            </small>
          </div>
          <button
            className={`icon-button ${cameraPanelOpen ? "active" : ""}`}
            type="button"
            onClick={() => setCameraPanelOpen((current) => !current)}
            aria-expanded={cameraPanelOpen}
            aria-label="打开视角微调"
            title="视角微调"
          >
            <SlidersHorizontal size={16} />
          </button>
          <button className="icon-button" type="button" onClick={onCameraReset} aria-label="重置沙盘视角" title="重置视角">
            <RotateCcw size={16} />
          </button>
        </section>

        <section className="hud-cluster action-hud view-hud" aria-label="视图控制">
          <p>视图</p>
          <button
            className="icon-button"
            type="button"
            onClick={onToggleFocusMode}
            aria-label={focusMode ? "退出沙盘全屏模式" : "进入沙盘全屏模式"}
            title={focusMode ? "退出全屏" : "全屏"}
          >
            {focusMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          {showRightPanelToggle ? (
            <button
              className={`icon-button ${rightPanelCollapsed ? "active" : ""}`}
              type="button"
              onClick={onToggleRightPanel}
              aria-label={rightPanelCollapsed ? "展开右侧作品面板" : "隐藏右侧作品面板"}
              aria-pressed={rightPanelCollapsed}
              title={rightPanelCollapsed ? "展开作品面板" : "隐藏作品面板"}
            >
              {rightPanelCollapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
            </button>
          ) : null}
          <button
            className={`icon-button ${showGuides ? "active" : ""}`}
            type="button"
            onClick={onToggleGuides}
            aria-label="切换辅助区域"
            aria-pressed={showGuides}
            title="辅助区域"
          >
            <Grid3X3 size={17} />
          </button>
        </section>

        <section className="hud-cluster action-hud export-hud" aria-label="作品操作">
          <p>输出</p>
          <button className="icon-button" type="button" onClick={onExportJson} aria-label="导出 JSON 快照" title="导出 JSON">
            <FileDown size={17} />
          </button>
          <button className="icon-button" type="button" onClick={onExportPng} aria-label="导出 PNG 截图" title="导出 PNG">
            <ImageDown size={17} />
          </button>
          <button className="icon-button danger" type="button" onClick={onClearScene} aria-label="清空当前作品" title="清空作品">
            <Trash2 size={17} />
          </button>
        </section>
      </div>
      {cameraAdjustPanel}
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

function CameraSlider({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}): JSX.Element {
  const displayValue = Math.abs(step) < 1 ? value.toFixed(2) : Math.round(value).toString();

  return (
    <label className="camera-slider">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong>
        {displayValue}
        {unit}
      </strong>
    </label>
  );
}

function isCameraPresetActive(current: SandboxCameraState, preset: SandboxCameraState): boolean {
  return (
    Math.abs(current.yaw - preset.yaw) < 0.6 &&
    Math.abs(current.pitch - preset.pitch) < 0.012 &&
    Math.abs(current.zoom - preset.zoom) < 0.012 &&
    Math.abs(current.panX - preset.panX) < 3 &&
    Math.abs(current.panY - preset.panY) < 3
  );
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
