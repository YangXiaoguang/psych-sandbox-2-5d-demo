import type { AnalysisEvidenceLayer } from "./analysis.js";
import type { ReconstructedSceneV1 } from "./scene.js";

export const FEATURE_ALGORITHM_V1 = "sandbox.feature-algorithm.v1" as const;
export const FEATURE_BUNDLE_V1 = "sandbox.feature-bundle.v1" as const;
export const EVIDENCE_GRAPH_V1 = "sandbox.evidence-graph.v1" as const;

export type DeterministicFeatureScope = "scene" | "object" | "relation" | "category" | "risk" | "process";
export type DeterministicFeatureFidelity = "deterministic" | "weak";
export type EvidenceGraphEdgeType = "derived_from";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export interface DeterministicFeatureRecordV1 {
  readonly id: string;
  readonly scope: DeterministicFeatureScope;
  readonly kind: string;
  readonly label: string;
  readonly value: JsonValue;
  readonly unit?: string;
  readonly fidelity: DeterministicFeatureFidelity;
  readonly objectIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly method: string;
  readonly interpretiveLimit: string;
}

export interface EvidenceGraphNodeV1 {
  readonly id: string;
  readonly layer: AnalysisEvidenceLayer;
  readonly kind: string;
  readonly label: string;
  readonly value: JsonValue;
  readonly fidelity: DeterministicFeatureFidelity;
  readonly sourcePaths: readonly string[];
  readonly objectIds: readonly string[];
}

export interface EvidenceGraphEdgeV1 {
  readonly id: string;
  readonly type: EvidenceGraphEdgeType;
  readonly fromNodeId: string;
  readonly toNodeId: string;
}

export interface EvidenceGraphV1 {
  readonly schemaVersion: typeof EVIDENCE_GRAPH_V1;
  readonly sourceSnapshotId: string;
  readonly nodes: readonly EvidenceGraphNodeV1[];
  readonly edges: readonly EvidenceGraphEdgeV1[];
}

export interface FeatureBundleV1 {
  readonly schemaVersion: typeof FEATURE_BUNDLE_V1;
  readonly sourceSnapshotId: string;
  readonly sourceSceneSchemaVersion: ReconstructedSceneV1["schemaVersion"];
  readonly algorithmVersion: typeof FEATURE_ALGORITHM_V1;
  readonly algorithmConfig: {
    readonly precisionDigits: number;
    readonly nearDistanceThreshold: number;
    readonly middleDistanceThreshold: number;
    readonly localNeighborThreshold: number;
    readonly visualSalienceWeights: {
      readonly projectedArea: number;
      readonly centerProximity: number;
      readonly scale: number;
    };
  };
  readonly processEvidence: {
    readonly fidelity: "weak";
    readonly availableSignals: readonly ["createdOrder"];
    readonly unavailableSignals: readonly ["moveHistory", "deletionHistory", "dwellTime", "hesitation", "undoRedo"];
  };
  readonly features: readonly DeterministicFeatureRecordV1[];
  readonly evidenceGraph: EvidenceGraphV1;
  readonly warnings: readonly string[];
}

export interface DeterministicSnapshotAnalysisV1 {
  readonly scene: ReconstructedSceneV1;
  readonly featureBundle: FeatureBundleV1;
}
