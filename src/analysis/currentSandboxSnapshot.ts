import { LIGHT_LABELS, WEATHER_LABELS } from "../data/environment";
import { RISK_LABELS } from "../data/assets";
import type { FootprintKind, RiskTag, SandboxEnvironment, SandboxObject } from "../types";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  GRID_CELLS,
  analyzeScene,
  depthSortObjects,
  getGridCellId,
  isInBoundaryRegion,
  isInCenterRegion,
} from "../utils/analysis";

export const CURRENT_SANDBOX_SNAPSHOT_SCHEMA = "sandbox.current-snapshot.v1";

export interface SnapshotCanvas {
  width: number;
  height: number;
  coordinateSystem: "board-pixel";
  normalizedCoordinateSystem: "0-1";
  guides: string[];
}

export interface SnapshotEnvironment {
  weather: SandboxEnvironment["weather"];
  weatherLabel: string;
  light: SandboxEnvironment["light"];
  lightLabel: string;
}

export interface SnapshotObjectPosition {
  x: number;
  y: number;
  xNorm: number;
  yNorm: number;
  zone: string;
  zoneLabel: string;
  inCenter: boolean;
  inBoundary: boolean;
  depthRank: number;
}

export interface SnapshotObjectTransform {
  rotationDeg: number;
  scale: number;
  width: number;
  height: number;
}

export interface SnapshotObjectFootprint {
  kind: FootprintKind;
  width: number;
  depth: number;
  height: number;
}

export interface SnapshotObject {
  id: string;
  assetId: string;
  name: string;
  category: string;
  riskTag: RiskTag;
  riskLabel: string;
  symbolicCandidates: string[];
  semanticTags: string[];
  position: SnapshotObjectPosition;
  transform: SnapshotObjectTransform;
  footprint: SnapshotObjectFootprint;
  createdOrder: number;
}

export interface SnapshotCountItem {
  id: string;
  label: string;
  count: number;
}

export interface SnapshotAnalysis {
  totalObjects: number;
  centerCount: number;
  boundaryCount: number;
  zoneCounts: SnapshotCountItem[];
  categoryCounts: SnapshotCountItem[];
  riskCounts: SnapshotCountItem[];
  emptyZones: string[];
  depthOrder: string[];
  summaryText: string;
}

export interface CurrentSandboxSnapshot {
  schemaVersion: typeof CURRENT_SANDBOX_SNAPSHOT_SCHEMA;
  snapshotId: string;
  generatedAt: string;
  source: "current_sandbox";
  canvas: SnapshotCanvas;
  environment: SnapshotEnvironment;
  objects: SnapshotObject[];
  analysis: SnapshotAnalysis;
  selectedObjectId?: string | null;
}

export interface BuildCurrentSandboxSnapshotInput {
  objects: SandboxObject[];
  environment: SandboxEnvironment;
  selectedObjectId?: string | null;
  generatedAt?: string;
  snapshotId?: string;
}

const SNAPSHOT_GUIDES = ["nine-grid", "center-region", "boundary-region", "y-depth-sort"];

export function buildCurrentSandboxSnapshot(input: BuildCurrentSandboxSnapshotInput): CurrentSandboxSnapshot {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const depthOrder = depthSortObjects(input.objects).map((object) => object.id);
  const depthRankById = new Map(depthOrder.map((id, index) => [id, index + 1]));
  const createdOrderById = buildCreatedOrderMap(input.objects);
  const analysis = analyzeScene(input.objects);

  return {
    schemaVersion: CURRENT_SANDBOX_SNAPSHOT_SCHEMA,
    snapshotId: input.snapshotId ?? createSnapshotId(generatedAt),
    generatedAt,
    source: "current_sandbox",
    canvas: {
      width: BOARD_WIDTH,
      height: BOARD_HEIGHT,
      coordinateSystem: "board-pixel",
      normalizedCoordinateSystem: "0-1",
      guides: SNAPSHOT_GUIDES,
    },
    environment: {
      weather: input.environment.weather,
      weatherLabel: WEATHER_LABELS[input.environment.weather],
      light: input.environment.light,
      lightLabel: LIGHT_LABELS[input.environment.light],
    },
    objects: input.objects.map((object) =>
      toSnapshotObject(object, {
        depthRank: depthRankById.get(object.id) ?? 0,
        createdOrder: createdOrderById.get(object.id) ?? 0,
      }),
    ),
    analysis: {
      totalObjects: analysis.totalObjects,
      centerCount: analysis.centerObjects.length,
      boundaryCount: analysis.boundaryObjects.length,
      zoneCounts: analysis.grid.map((cell) => ({
        id: cell.id,
        label: cell.label,
        count: cell.count,
      })),
      categoryCounts: countRecordToItems(analysis.categoryCounts),
      riskCounts: riskCountsToItems(analysis.riskCounts),
      emptyZones: analysis.grid.filter((cell) => cell.count === 0).map((cell) => cell.id),
      depthOrder,
      summaryText: buildSummaryText(input.objects, analysis.centerObjects.length, analysis.boundaryObjects.length),
    },
    selectedObjectId: input.selectedObjectId ?? null,
  };
}

function toSnapshotObject(
  object: SandboxObject,
  meta: {
    depthRank: number;
    createdOrder: number;
  },
): SnapshotObject {
  const zone = getGridCellId(object);

  return {
    id: object.id,
    assetId: object.assetId,
    name: object.name,
    category: object.category,
    riskTag: object.riskTag,
    riskLabel: RISK_LABELS[object.riskTag],
    symbolicCandidates: [...object.symbolicCandidates],
    semanticTags: [...object.semanticTags],
    position: {
      x: roundNumber(object.x),
      y: roundNumber(object.y),
      xNorm: normalizeCoordinate(object.x, BOARD_WIDTH),
      yNorm: normalizeCoordinate(object.y, BOARD_HEIGHT),
      zone,
      zoneLabel: getZoneLabel(zone),
      inCenter: isInCenterRegion(object),
      inBoundary: isInBoundaryRegion(object),
      depthRank: meta.depthRank,
    },
    transform: {
      rotationDeg: roundNumber(object.rotation),
      scale: roundNumber(object.scale),
      width: roundNumber(object.width),
      height: roundNumber(object.height),
    },
    footprint: {
      kind: object.footprint.kind,
      width: roundNumber(object.footprint.width),
      depth: roundNumber(object.footprint.depth),
      height: roundNumber(object.footprint.height),
    },
    createdOrder: meta.createdOrder,
  };
}

function buildCreatedOrderMap(objects: SandboxObject[]): Map<string, number> {
  return new Map(
    [...objects]
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      .map((object, index) => [object.id, index + 1]),
  );
}

function countRecordToItems(record: Record<string, number>): SnapshotCountItem[] {
  return Object.entries(record)
    .map(([id, count]) => ({
      id,
      label: id,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

function riskCountsToItems(record: Record<RiskTag, number>): SnapshotCountItem[] {
  const riskOrder: RiskTag[] = ["normal", "conflict", "death", "fantasy"];

  return riskOrder.map((riskTag) => ({
    id: riskTag,
    label: RISK_LABELS[riskTag],
    count: record[riskTag],
  }));
}

function buildSummaryText(objects: SandboxObject[], centerCount: number, boundaryCount: number): string {
  if (objects.length === 0) {
    return "当前沙盘还没有放置沙具。";
  }

  const objectNames = objects
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, 5)
    .map((object) => object.name)
    .join("、");
  const categoryItems = countRecordToItems(
    objects.reduce<Record<string, number>>((result, object) => {
      result[object.category] = (result[object.category] ?? 0) + 1;
      return result;
    }, {}),
  )
    .slice(0, 3)
    .map((item) => `${item.label}${item.count}`)
    .join("、");

  return `当前沙盘共有 ${objects.length} 个沙具，中心区域 ${centerCount} 个，边界区域 ${boundaryCount} 个。主要类别：${categoryItems || "暂无"}。较早放置的沙具包括：${objectNames}。`;
}

function getZoneLabel(zone: string): string {
  return GRID_CELLS.find((cell) => cell.id === zone)?.label ?? zone;
}

function normalizeCoordinate(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }

  return roundNumber(Math.min(1, Math.max(0, value / max)), 3);
}

function roundNumber(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function createSnapshotId(generatedAt: string): string {
  const safeTime = generatedAt.replace(/[^0-9]/g, "").slice(0, 14);
  const randomSuffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().split("-")[0]
      : Math.random().toString(36).slice(2, 10);

  return `snapshot_${safeTime}_${randomSuffix}`;
}
