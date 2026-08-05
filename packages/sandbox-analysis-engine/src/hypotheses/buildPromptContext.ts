import {
  SANDBOX_HYPOTHESIS_CONTEXT_V1,
  type HypothesisPromptContextV1,
  type HypothesisPromptFeatureV1,
} from "../contracts/hypothesis.js";
import type { DeterministicSnapshotAnalysisV1, DeterministicFeatureRecordV1, JsonValue } from "../contracts/features.js";
import { compareStrings, deepFreeze } from "../internal/deterministic.js";

export const DEFAULT_RELATION_FEATURE_LIMIT = 48;

export function buildHypothesisPromptContext(
  analysis: DeterministicSnapshotAnalysisV1,
  relationFeatureLimit = DEFAULT_RELATION_FEATURE_LIMIT,
): HypothesisPromptContextV1 {
  const limit = Number.isFinite(relationFeatureLimit)
    ? Math.max(0, Math.floor(relationFeatureLimit))
    : DEFAULT_RELATION_FEATURE_LIMIT;
  const nonRelationFeatures = analysis.featureBundle.features.filter((feature) => feature.scope !== "relation");
  const relationFeatures = analysis.featureBundle.features
    .filter((feature) => feature.scope === "relation")
    .sort(compareRelationFeatures);
  const includedRelations = relationFeatures.slice(0, limit);
  const includedFeatures = [...nonRelationFeatures, ...includedRelations].sort((left, right) => compareStrings(left.id, right.id));
  const includedFeatureIds = new Set(includedFeatures.map((feature) => feature.id));
  const evidence = analysis.featureBundle.evidenceGraph.nodes
    .filter((node) => node.layer === "fact" || includedFeatureIds.has(node.id))
    .sort((left, right) => compareStrings(left.id, right.id));

  return deepFreeze({
    schemaVersion: SANDBOX_HYPOTHESIS_CONTEXT_V1,
    sourceSnapshotId: analysis.scene.sourceSnapshotId,
    scene: {
      objectCount: analysis.scene.objects.length,
      selectedObjectId: analysis.scene.selectedObjectId,
      occupiedZones: analysis.scene.aggregates.occupiedZones,
      environment: analysis.scene.environment,
      objects: analysis.scene.objects.map((object) => ({
        id: object.id,
        name: object.name,
        category: object.category,
        riskTag: object.riskTag,
        zone: object.placement.zone,
        selected: analysis.scene.selectedObjectId === object.id,
      })),
    },
    processEvidence: analysis.featureBundle.processEvidence,
    evidence,
    features: includedFeatures.map(toPromptFeature),
    allowedEvidenceIds: evidence.map((node) => node.id),
    contextPolicy: {
      includesRawSnapshot: false,
      includesEvents: false,
      includesPersonalMemory: false,
      includesUserIdentity: false,
      includesImages: false,
      relationFeatureLimit: limit,
      includedRelationFeatures: includedRelations.length,
      omittedRelationFeatures: relationFeatures.length - includedRelations.length,
    },
  });
}

function toPromptFeature(feature: DeterministicFeatureRecordV1): HypothesisPromptFeatureV1 {
  return {
    id: feature.id,
    scope: feature.scope,
    kind: feature.kind,
    label: feature.label,
    value: feature.value,
    fidelity: feature.fidelity,
    objectIds: feature.objectIds,
    evidenceIds: feature.evidenceIds,
    interpretiveLimit: feature.interpretiveLimit,
  };
}

function compareRelationFeatures(left: DeterministicFeatureRecordV1, right: DeterministicFeatureRecordV1): number {
  const leftValue = relationDistance(left.value);
  const rightValue = relationDistance(right.value);
  return leftValue - rightValue || compareStrings(left.id, right.id);
}

function relationDistance(value: JsonValue): number {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const distance = (value as { readonly [key: string]: JsonValue }).distanceNorm;
    return typeof distance === "number" ? distance : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}
