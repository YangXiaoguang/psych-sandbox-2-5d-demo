import { BOARD_HEIGHT, BOARD_WIDTH, clamp } from "./analysis";
import type { SandboxCameraState } from "../types";

export const VIEW_WIDTH = 1120;
export const VIEW_HEIGHT = 640;
export const STAGE_LEFT = 48;
export const STAGE_TOP = 156;
export const STAGE_PITCH = 0.64;
export const STAGE_SKEW = 0.13;
export const STAGE_THICKNESS = 82;
export const DEFAULT_SANDBOX_CAMERA: SandboxCameraState = {
  panX: -2,
  panY: -4,
  zoom: 1.13,
  yaw: 0,
  pitch: 0.68,
};

export const SANDBOX_CAMERA_LIMITS = {
  panX: { min: -220, max: 220 },
  panY: { min: -150, max: 150 },
  zoom: { min: 0.7, max: 1.48 },
  yaw: { min: -32, max: 32 },
  pitch: { min: 0.48, max: 0.74 },
};

const CAMERA_VIEW_MARGIN = 34;

export type SandboxCameraPresetId = "standard" | "showcase" | "overview" | "close";

export const SANDBOX_CAMERA_PRESETS: Array<{
  id: SandboxCameraPresetId;
  label: string;
  description: string;
  camera: SandboxCameraState;
}> = [
  {
    id: "standard",
    label: "标准",
    description: "稳定 2.5D 编辑视角",
    camera: DEFAULT_SANDBOX_CAMERA,
  },
  {
    id: "showcase",
    label: "展示",
    description: "轻微转台感，适合观察作品",
    camera: { panX: -6, panY: -6, zoom: 1.15, yaw: -7, pitch: 0.68 },
  },
  {
    id: "overview",
    label: "俯视",
    description: "更接近作品分析视角",
    camera: { panX: 0, panY: -10, zoom: 0.76, yaw: 0, pitch: 0.72 },
  },
  {
    id: "close",
    label: "近景",
    description: "突出沙具和沙面细节",
    camera: { panX: -14, panY: -16, zoom: 1.28, yaw: 7, pitch: 0.64 },
  },
];

export interface BoardPoint {
  x: number;
  y: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

export function normalizeSandboxCamera(camera: SandboxCameraState): SandboxCameraState {
  const zoom = clampFinite(camera.zoom, SANDBOX_CAMERA_LIMITS.zoom.min, SANDBOX_CAMERA_LIMITS.zoom.max, DEFAULT_SANDBOX_CAMERA.zoom);
  const yaw = clampFinite(camera.yaw, SANDBOX_CAMERA_LIMITS.yaw.min, SANDBOX_CAMERA_LIMITS.yaw.max, DEFAULT_SANDBOX_CAMERA.yaw);
  const pitch = clampFinite(camera.pitch, SANDBOX_CAMERA_LIMITS.pitch.min, SANDBOX_CAMERA_LIMITS.pitch.max, DEFAULT_SANDBOX_CAMERA.pitch);
  const panLimits = getDynamicPanLimits({ zoom, yaw, pitch });

  return {
    panX: clampFinite(camera.panX, panLimits.panX.min, panLimits.panX.max, DEFAULT_SANDBOX_CAMERA.panX),
    panY: clampFinite(camera.panY, panLimits.panY.min, panLimits.panY.max, DEFAULT_SANDBOX_CAMERA.panY),
    zoom,
    yaw,
    pitch,
  };
}

function getDynamicPanLimits(camera: Pick<SandboxCameraState, "zoom" | "yaw" | "pitch">): {
  panX: { min: number; max: number };
  panY: { min: number; max: number };
} {
  const points = [
    { x: 0, y: 0 },
    { x: BOARD_WIDTH, y: 0 },
    { x: BOARD_WIDTH, y: BOARD_HEIGHT },
    { x: 0, y: BOARD_HEIGHT },
  ].map((point) => {
    const rotated = rotateBoardPoint(point, camera.yaw);
    return {
      x: VIEW_WIDTH / 2 + (rotated.x + rotated.y * STAGE_SKEW) * camera.zoom,
      y: VIEW_HEIGHT / 2 + rotated.y * camera.pitch * camera.zoom,
    };
  });

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y)) + STAGE_THICKNESS;

  return {
    panX: clampPanAxis(minX, maxX, VIEW_WIDTH, SANDBOX_CAMERA_LIMITS.panX),
    panY: clampPanAxis(minY, maxY, VIEW_HEIGHT, SANDBOX_CAMERA_LIMITS.panY),
  };
}

function clampPanAxis(
  min: number,
  max: number,
  viewSize: number,
  hardLimit: { min: number; max: number },
): { min: number; max: number } {
  const extent = max - min;
  const available = viewSize - CAMERA_VIEW_MARGIN * 2;
  const viewMin = extent <= available ? CAMERA_VIEW_MARGIN - min : viewSize - CAMERA_VIEW_MARGIN - max;
  const viewMax = extent <= available ? viewSize - CAMERA_VIEW_MARGIN - max : CAMERA_VIEW_MARGIN - min;

  return {
    min: Math.max(hardLimit.min, Math.min(viewMin, viewMax)),
    max: Math.min(hardLimit.max, Math.max(viewMin, viewMax)),
  };
}

export function projectPoint(
  point: BoardPoint,
  camera: SandboxCameraState = DEFAULT_SANDBOX_CAMERA,
): ProjectedPoint {
  const normalized = normalizeSandboxCamera(camera);
  const rotated = rotateBoardPoint(point, normalized.yaw);

  return {
    x: VIEW_WIDTH / 2 + normalized.panX + (rotated.x + rotated.y * STAGE_SKEW) * normalized.zoom,
    y: VIEW_HEIGHT / 2 + normalized.panY + rotated.y * normalized.pitch * normalized.zoom,
  };
}

export function unprojectPoint(
  point: ProjectedPoint,
  camera: SandboxCameraState = DEFAULT_SANDBOX_CAMERA,
): BoardPoint {
  const normalized = normalizeSandboxCamera(camera);
  const localX = (point.x - VIEW_WIDTH / 2 - normalized.panX) / normalized.zoom;
  const localY = (point.y - VIEW_HEIGHT / 2 - normalized.panY) / normalized.zoom;
  const rotatedY = localY / normalized.pitch;
  const rotatedX = localX - rotatedY * STAGE_SKEW;
  const boardPoint = unrotateBoardPoint({ x: rotatedX, y: rotatedY }, normalized.yaw);

  return {
    x: clamp(boardPoint.x, 24, BOARD_WIDTH - 24),
    y: clamp(boardPoint.y, 24, BOARD_HEIGHT - 24),
  };
}

export function projectRect(
  x: number,
  y: number,
  width: number,
  height: number,
  camera: SandboxCameraState = DEFAULT_SANDBOX_CAMERA,
): number[] {
  const topLeft = projectPoint({ x, y }, camera);
  const topRight = projectPoint({ x: x + width, y }, camera);
  const bottomRight = projectPoint({ x: x + width, y: y + height }, camera);
  const bottomLeft = projectPoint({ x, y: y + height }, camera);
  return [
    topLeft.x,
    topLeft.y,
    topRight.x,
    topRight.y,
    bottomRight.x,
    bottomRight.y,
    bottomLeft.x,
    bottomLeft.y,
  ];
}

export function getProjectedStageCorners(camera: SandboxCameraState = DEFAULT_SANDBOX_CAMERA): {
  topLeft: ProjectedPoint;
  topRight: ProjectedPoint;
  bottomRight: ProjectedPoint;
  bottomLeft: ProjectedPoint;
} {
  return {
    topLeft: projectPoint({ x: 0, y: 0 }, camera),
    topRight: projectPoint({ x: BOARD_WIDTH, y: 0 }, camera),
    bottomRight: projectPoint({ x: BOARD_WIDTH, y: BOARD_HEIGHT }, camera),
    bottomLeft: projectPoint({ x: 0, y: BOARD_HEIGHT }, camera),
  };
}

export function getViewDepth(point: BoardPoint, camera: SandboxCameraState = DEFAULT_SANDBOX_CAMERA): number {
  const normalized = normalizeSandboxCamera(camera);
  return rotateBoardPoint(point, normalized.yaw).y + BOARD_HEIGHT / 2;
}

export function getDepthScale(pointOrY: BoardPoint | number, camera: SandboxCameraState = DEFAULT_SANDBOX_CAMERA): number {
  const depth = typeof pointOrY === "number" ? pointOrY : getViewDepth(pointOrY, camera);
  return 0.86 + (clamp(depth, 0, BOARD_HEIGHT) / BOARD_HEIGHT) * 0.22;
}

function rotateBoardPoint(point: BoardPoint, yaw: number): BoardPoint {
  const radians = (yaw * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centeredX = point.x - BOARD_WIDTH / 2;
  const centeredY = point.y - BOARD_HEIGHT / 2;

  return {
    x: centeredX * cos - centeredY * sin,
    y: centeredX * sin + centeredY * cos,
  };
}

function unrotateBoardPoint(point: BoardPoint, yaw: number): BoardPoint {
  const radians = (yaw * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos + point.y * sin + BOARD_WIDTH / 2,
    y: -point.x * sin + point.y * cos + BOARD_HEIGHT / 2,
  };
}

function clampFinite(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}
