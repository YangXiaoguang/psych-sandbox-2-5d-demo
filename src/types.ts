export type RiskTag = "normal" | "conflict" | "death" | "fantasy";

export type SandboxEventType =
  | "add"
  | "move"
  | "transform"
  | "delete"
  | "property_change"
  | "export"
  | "clear"
  | "select"
  | "seed";

export interface SandboxAsset {
  assetId: string;
  name: string;
  category: string;
  defaultWidth: number;
  defaultHeight: number;
  symbolicCandidates: string[];
  riskTag: RiskTag;
}

export interface SandboxObject {
  id: string;
  assetId: string;
  name: string;
  category: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  createdAt: number;
  riskTag: RiskTag;
  symbolicCandidates: string[];
}

export interface SandboxEvent {
  id: string;
  type: SandboxEventType;
  timestamp: string;
  objectId?: string;
  assetId?: string;
  label: string;
  payload?: Record<string, unknown>;
}

export interface SandboxEventDraft {
  type: SandboxEventType;
  objectId?: string;
  assetId?: string;
  label: string;
  payload?: Record<string, unknown>;
}

export interface GridCellCount {
  id: string;
  label: string;
  count: number;
  objectIds: string[];
}

export interface SandboxAnalysis {
  totalObjects: number;
  riskCounts: Record<RiskTag, number>;
  categoryCounts: Record<string, number>;
  grid: GridCellCount[];
  centerObjects: string[];
  boundaryObjects: string[];
  depthOrder: string[];
}

export interface SandboxSnapshot {
  version: string;
  exportedAt: string;
  canvas: {
    width: number;
    height: number;
    guides: string[];
  };
  objects: SandboxObject[];
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
}
