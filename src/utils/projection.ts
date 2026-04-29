import { BOARD_HEIGHT, BOARD_WIDTH, clamp } from "./analysis";

export const VIEW_WIDTH = 1120;
export const VIEW_HEIGHT = 700;
export const STAGE_LEFT = 48;
export const STAGE_TOP = 156;
export const STAGE_PITCH = 0.58;
export const STAGE_SKEW = 0.16;
export const STAGE_THICKNESS = 76;

export interface BoardPoint {
  x: number;
  y: number;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

export function projectPoint(point: BoardPoint): ProjectedPoint {
  return {
    x: STAGE_LEFT + point.x + point.y * STAGE_SKEW,
    y: STAGE_TOP + point.y * STAGE_PITCH,
  };
}

export function unprojectPoint(point: ProjectedPoint): BoardPoint {
  const y = (point.y - STAGE_TOP) / STAGE_PITCH;
  const x = point.x - STAGE_LEFT - y * STAGE_SKEW;

  return {
    x: clamp(x, 24, BOARD_WIDTH - 24),
    y: clamp(y, 24, BOARD_HEIGHT - 24),
  };
}

export function projectRect(x: number, y: number, width: number, height: number): number[] {
  const topLeft = projectPoint({ x, y });
  const topRight = projectPoint({ x: x + width, y });
  const bottomRight = projectPoint({ x: x + width, y: y + height });
  const bottomLeft = projectPoint({ x, y: y + height });
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

export function getProjectedStageCorners(): {
  topLeft: ProjectedPoint;
  topRight: ProjectedPoint;
  bottomRight: ProjectedPoint;
  bottomLeft: ProjectedPoint;
} {
  return {
    topLeft: projectPoint({ x: 0, y: 0 }),
    topRight: projectPoint({ x: BOARD_WIDTH, y: 0 }),
    bottomRight: projectPoint({ x: BOARD_WIDTH, y: BOARD_HEIGHT }),
    bottomLeft: projectPoint({ x: 0, y: BOARD_HEIGHT }),
  };
}

export function getDepthScale(y: number): number {
  return 0.86 + (clamp(y, 0, BOARD_HEIGHT) / BOARD_HEIGHT) * 0.22;
}
