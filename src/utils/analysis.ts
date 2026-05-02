import type {
  GridCellCount,
  RiskTag,
  SandboxAnalysis,
  SandboxEnvironment,
  SandboxEvent,
  SandboxObject,
  SandboxSnapshot,
} from "../types";

export const BOARD_WIDTH = 960;
export const BOARD_HEIGHT = 640;
export const BOUNDARY_MARGIN = 96;

export const GRID_CELLS = [
  { id: "top-left", label: "左上" },
  { id: "top-center", label: "上中" },
  { id: "top-right", label: "右上" },
  { id: "middle-left", label: "左中" },
  { id: "middle-center", label: "中心" },
  { id: "middle-right", label: "右中" },
  { id: "bottom-left", label: "左下" },
  { id: "bottom-center", label: "下中" },
  { id: "bottom-right", label: "右下" },
];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function depthSortObjects(objects: SandboxObject[]): SandboxObject[] {
  return [...objects].sort((a, b) => a.y - b.y || a.createdAt - b.createdAt);
}

export function getGridCellId(object: SandboxObject): string {
  const col = object.x < BOARD_WIDTH / 3 ? "left" : object.x < (BOARD_WIDTH * 2) / 3 ? "center" : "right";
  const row = object.y < BOARD_HEIGHT / 3 ? "top" : object.y < (BOARD_HEIGHT * 2) / 3 ? "middle" : "bottom";
  return `${row}-${col}`;
}

export function isInCenterRegion(object: SandboxObject): boolean {
  return (
    object.x >= BOARD_WIDTH / 3 &&
    object.x <= (BOARD_WIDTH * 2) / 3 &&
    object.y >= BOARD_HEIGHT / 3 &&
    object.y <= (BOARD_HEIGHT * 2) / 3
  );
}

export function isInBoundaryRegion(object: SandboxObject): boolean {
  return (
    object.x <= BOUNDARY_MARGIN ||
    object.x >= BOARD_WIDTH - BOUNDARY_MARGIN ||
    object.y <= BOUNDARY_MARGIN ||
    object.y >= BOARD_HEIGHT - BOUNDARY_MARGIN
  );
}

export function analyzeScene(objects: SandboxObject[]): SandboxAnalysis {
  const riskCounts: Record<RiskTag, number> = {
    normal: 0,
    conflict: 0,
    death: 0,
    fantasy: 0,
  };
  const categoryCounts: Record<string, number> = {};
  const grid: GridCellCount[] = GRID_CELLS.map((cell) => ({
    ...cell,
    count: 0,
    objectIds: [],
  }));
  const centerObjects: string[] = [];
  const boundaryObjects: string[] = [];

  for (const object of objects) {
    riskCounts[object.riskTag] += 1;
    categoryCounts[object.category] = (categoryCounts[object.category] ?? 0) + 1;

    const cell = grid.find((item) => item.id === getGridCellId(object));
    if (cell) {
      cell.count += 1;
      cell.objectIds.push(object.id);
    }

    if (isInCenterRegion(object)) {
      centerObjects.push(object.id);
    }

    if (isInBoundaryRegion(object)) {
      boundaryObjects.push(object.id);
    }
  }

  return {
    totalObjects: objects.length,
    riskCounts,
    categoryCounts,
    grid,
    centerObjects,
    boundaryObjects,
    depthOrder: depthSortObjects(objects).map((object) => object.id),
  };
}

export function buildSnapshot(
  objects: SandboxObject[],
  events: SandboxEvent[],
  analysis: SandboxAnalysis,
  environment: SandboxEnvironment,
): SandboxSnapshot {
  return {
    version: "0.1.0",
    exportedAt: new Date().toISOString(),
    environment,
    canvas: {
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      guides: ["nine-grid", "center-region", "boundary-region", "y-depth-sort"],
    },
    objects,
    events,
    analysis,
  };
}
