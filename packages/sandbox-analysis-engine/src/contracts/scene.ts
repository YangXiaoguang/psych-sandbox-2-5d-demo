import type {
  CurrentSandboxSnapshotVersion,
  SnapshotFootprintKind,
  SnapshotLightMode,
  SnapshotRiskTag,
  SnapshotZoneId,
} from "./snapshot.js";

export const RECONSTRUCTED_SCENE_V1 = "sandbox.reconstructed-scene.v1" as const;

export type SceneDirection8 =
  | "same-position"
  | "north"
  | "north-east"
  | "east"
  | "south-east"
  | "south"
  | "south-west"
  | "west"
  | "north-west";

export type SceneProximityBand = "near" | "middle" | "far";

export interface ReconstructedSceneObjectV1 {
  readonly id: string;
  readonly sourceIndex: number;
  readonly assetId: string;
  readonly name: string;
  readonly category: string;
  readonly riskTag: SnapshotRiskTag;
  readonly riskLabel: string;
  readonly symbolicCandidates: readonly string[];
  readonly semanticTags: readonly string[];
  readonly placement: {
    readonly x: number;
    readonly y: number;
    readonly xNorm: number;
    readonly yNorm: number;
    readonly zone: SnapshotZoneId;
    readonly zoneLabel: string;
    readonly inCenter: boolean;
    readonly inBoundary: boolean;
    readonly depthRank: number;
    readonly distanceFromCenterNorm: number;
    readonly distanceToNearestBoundaryNorm: number;
  };
  readonly transform: {
    readonly rotationDeg: number;
    readonly normalizedRotationDeg: number;
    readonly scale: number;
    readonly width: number;
    readonly height: number;
    readonly projectedWidthNorm: number;
    readonly projectedHeightNorm: number;
    readonly projectedAreaRatio: number;
  };
  readonly footprint: {
    readonly kind: SnapshotFootprintKind;
    readonly width: number;
    readonly depth: number;
    readonly height: number;
    readonly measurementPolicy: "preserved-only";
  };
  readonly createdOrder: number;
  readonly sourcePaths: readonly string[];
}

export interface ReconstructedSceneRelationV1 {
  readonly id: string;
  readonly sourceObjectId: string;
  readonly targetObjectId: string;
  readonly deltaXNorm: number;
  readonly deltaYNorm: number;
  readonly distanceNorm: number;
  readonly direction: SceneDirection8;
  readonly proximityBand: SceneProximityBand;
  readonly sameZone: boolean;
  readonly sameCategory: boolean;
  readonly sourcePaths: readonly string[];
}

export interface ReconstructedSceneCountV1 {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

export interface ReconstructedSceneV1 {
  readonly schemaVersion: typeof RECONSTRUCTED_SCENE_V1;
  readonly sourceSnapshotId: string;
  readonly sourceSnapshotSchemaVersion: CurrentSandboxSnapshotVersion;
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly coordinateSystem: "board-pixel";
    readonly normalizedCoordinateSystem: "0-1";
  };
  readonly environment: {
    readonly weather: string;
    readonly weatherLabel: string;
    readonly light: SnapshotLightMode;
    readonly lightLabel: string;
  };
  readonly objects: readonly ReconstructedSceneObjectV1[];
  readonly relations: readonly ReconstructedSceneRelationV1[];
  readonly selectedObjectId: string | null;
  readonly aggregates: {
    readonly totalObjects: number;
    readonly centerCount: number;
    readonly boundaryCount: number;
    readonly occupiedZones: readonly SnapshotZoneId[];
    readonly emptyZones: readonly SnapshotZoneId[];
    readonly zoneCounts: readonly ReconstructedSceneCountV1[];
    readonly categoryCounts: readonly ReconstructedSceneCountV1[];
    readonly riskCounts: readonly ReconstructedSceneCountV1[];
    readonly depthOrder: readonly string[];
    readonly creationOrder: readonly string[];
  };
  readonly reconstructionPolicy: {
    readonly objectOrder: "object-id-ascending";
    readonly relationOrder: "canonical-object-pair";
    readonly spatialBasis: "normalized-placement-point";
    readonly footprintPolicy: "preserved-not-measured";
    readonly precisionDigits: number;
  };
}
