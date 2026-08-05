export const CURRENT_SANDBOX_SNAPSHOT_V1 = "sandbox.current-snapshot.v1" as const;

export type CurrentSandboxSnapshotVersion = typeof CURRENT_SANDBOX_SNAPSHOT_V1;
export type SnapshotRiskTag = "normal" | "conflict" | "death" | "fantasy" | "unknown";
export type SnapshotLightMode = "day" | "night";
export type SnapshotFootprintKind = "compact" | "wide" | "tall" | "flat";
export type SnapshotZoneId =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface SnapshotCanvasV1 {
  width: number;
  height: number;
  coordinateSystem: "board-pixel";
  normalizedCoordinateSystem: "0-1";
  guides: string[];
}

export interface SnapshotEnvironmentV1 {
  weather: string;
  weatherLabel: string;
  light: SnapshotLightMode;
  lightLabel: string;
}

export interface SnapshotObjectPositionV1 {
  x: number;
  y: number;
  xNorm: number;
  yNorm: number;
  zone: SnapshotZoneId;
  zoneLabel: string;
  inCenter: boolean;
  inBoundary: boolean;
  depthRank: number;
}

export interface SnapshotObjectTransformV1 {
  rotationDeg: number;
  scale: number;
  width: number;
  height: number;
}

export interface SnapshotObjectFootprintV1 {
  kind: SnapshotFootprintKind;
  width: number;
  depth: number;
  height: number;
}

export interface SnapshotObjectV1 {
  id: string;
  assetId: string;
  name: string;
  category: string;
  riskTag: SnapshotRiskTag;
  riskLabel: string;
  symbolicCandidates: string[];
  semanticTags: string[];
  position: SnapshotObjectPositionV1;
  transform: SnapshotObjectTransformV1;
  footprint: SnapshotObjectFootprintV1;
  createdOrder: number;
}

export interface SnapshotCountItemV1 {
  id: string;
  label: string;
  count: number;
}

export interface SnapshotAnalysisV1 {
  totalObjects: number;
  centerCount: number;
  boundaryCount: number;
  zoneCounts: SnapshotCountItemV1[];
  categoryCounts: SnapshotCountItemV1[];
  riskCounts: SnapshotCountItemV1[];
  emptyZones: SnapshotZoneId[];
  depthOrder: string[];
  summaryText: string;
}

export interface CurrentSandboxSnapshotV1 {
  schemaVersion: CurrentSandboxSnapshotVersion;
  snapshotId: string;
  generatedAt: string;
  source: "current_sandbox";
  canvas: SnapshotCanvasV1;
  environment: SnapshotEnvironmentV1;
  objects: SnapshotObjectV1[];
  analysis: SnapshotAnalysisV1;
  selectedObjectId?: string | null;
}

export type CurrentSandboxSnapshot = CurrentSandboxSnapshotV1;
