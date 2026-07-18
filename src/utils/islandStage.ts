import type { SandboxCameraState } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH } from "./analysis";
import { projectPoint, type BoardPoint, type ProjectedPoint } from "./projection";

export const SAND_ISLAND_RECT = {
  x: 42,
  y: 34,
  width: BOARD_WIDTH - 84,
  height: BOARD_HEIGHT - 72,
};

export const ISLAND_EDGE_POINT_COUNT = 112;

export function getIslandBoardPoints(count = ISLAND_EDGE_POINT_COUNT): BoardPoint[] {
  const centerX = SAND_ISLAND_RECT.x + SAND_ISLAND_RECT.width / 2;
  const centerY = SAND_ISLAND_RECT.y + SAND_ISLAND_RECT.height / 2;
  const radiusX = SAND_ISLAND_RECT.width / 2;
  const radiusY = SAND_ISLAND_RECT.height / 2;

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const superEllipse = Math.pow(
      Math.pow(Math.abs(cos), 2.85) + Math.pow(Math.abs(sin), 2.85),
      -1 / 2.85,
    );
    const organicEdge =
      1 +
      Math.sin(angle * 2.7 + 0.38) * 0.018 +
      Math.sin(angle * 5.6 + 1.26) * 0.026 +
      Math.sin(angle * 11.9 + 0.14) * 0.012;
    const frontLift = 1 + Math.max(0, sin) * 0.026;
    const sideSoftness = 1 - Math.abs(cos) * 0.018;

    return {
      x: centerX + cos * radiusX * superEllipse * organicEdge,
      y: centerY + sin * radiusY * superEllipse * organicEdge * frontLift * sideSoftness,
    };
  });
}

export function getProjectedIslandPoints(camera: SandboxCameraState): ProjectedPoint[] {
  return getIslandBoardPoints().map((point) => projectPoint(point, camera));
}

export function flattenProjectedPoints(points: ProjectedPoint[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

export function getPointBounds(points: ProjectedPoint[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

export function clipProjectedPolygon(
  ctx: {
    beginPath: () => void;
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    closePath: () => void;
  },
  points: ProjectedPoint[],
): void {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
      return;
    }
    ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
}

export function clipIsland(
  ctx: {
    beginPath: () => void;
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    closePath: () => void;
  },
  camera: SandboxCameraState,
): void {
  clipProjectedPolygon(ctx, getProjectedIslandPoints(camera));
}

export function isInsideIslandRectPoint(point: BoardPoint): boolean {
  const centerX = SAND_ISLAND_RECT.x + SAND_ISLAND_RECT.width / 2;
  const centerY = SAND_ISLAND_RECT.y + SAND_ISLAND_RECT.height / 2;
  const normalizedX = (point.x - centerX) / (SAND_ISLAND_RECT.width / 2);
  const normalizedY = (point.y - centerY) / (SAND_ISLAND_RECT.height / 2);
  return Math.pow(Math.abs(normalizedX), 2.55) + Math.pow(Math.abs(normalizedY), 2.55) <= 1.08;
}

export function random(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
