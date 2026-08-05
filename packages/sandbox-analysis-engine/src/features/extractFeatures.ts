import {
  EVIDENCE_GRAPH_V1,
  FEATURE_ALGORITHM_V1,
  FEATURE_BUNDLE_V1,
  type DeterministicFeatureRecordV1,
  type EvidenceGraphEdgeV1,
  type EvidenceGraphNodeV1,
  type FeatureBundleV1,
  type JsonValue,
} from "../contracts/features.js";
import type { ReconstructedSceneObjectV1, ReconstructedSceneRelationV1, ReconstructedSceneV1 } from "../contracts/scene.js";
import { compareStrings, deepFreeze, median, PRECISION_DIGITS, roundNumber } from "../internal/deterministic.js";
import { MIDDLE_DISTANCE_THRESHOLD, NEAR_DISTANCE_THRESHOLD } from "../reconstruction/reconstructScene.js";

export const LOCAL_NEIGHBOR_THRESHOLD = NEAR_DISTANCE_THRESHOLD;

export const VISUAL_SALIENCE_WEIGHTS = Object.freeze({
  projectedArea: 0.45,
  centerProximity: 0.35,
  scale: 0.2,
});

const PROCESS_UNAVAILABLE_SIGNALS = ["moveHistory", "deletionHistory", "dwellTime", "hesitation", "undoRedo"] as const;

export function extractFeatures(scene: ReconstructedSceneV1): FeatureBundleV1 {
  const facts = buildFactNodes(scene);
  const features: DeterministicFeatureRecordV1[] = [];
  const allPositionEvidence = scene.objects.map((object) => factId(object.id, "position"));
  const allIdentityEvidence = scene.objects.map((object) => factId(object.id, "identity"));
  const allTransformEvidence = scene.objects.map((object) => factId(object.id, "transform"));
  const objectCount = scene.objects.length;
  const centroid = calculateCentroid(scene.objects);
  const dispersion = calculateDispersion(scene.objects, centroid);
  const projectedAreaSum = scene.objects.reduce((sum, object) => sum + object.transform.projectedAreaRatio, 0);
  const leftCount = scene.objects.filter((object) => object.placement.xNorm < 0.5).length;
  const rightCount = scene.objects.filter((object) => object.placement.xNorm > 0.5).length;
  const topCount = scene.objects.filter((object) => object.placement.yNorm < 0.5).length;
  const bottomCount = scene.objects.filter((object) => object.placement.yNorm > 0.5).length;

  features.push(feature({
    id: "feature:scene:spatial-distribution",
    scope: "scene",
    kind: "spatial.distribution",
    label: "场景空间分布",
    value: {
      objectCount,
      centroidXNorm: centroid?.x ?? null,
      centroidYNorm: centroid?.y ?? null,
      dispersionNorm: dispersion,
      centerRatio: ratio(scene.aggregates.centerCount, objectCount),
      boundaryRatio: ratio(scene.aggregates.boundaryCount, objectCount),
      occupiedZoneRatio: ratio(scene.aggregates.occupiedZones.length, 9),
      horizontalBalanceScore: balanceScore(leftCount, rightCount, objectCount),
      verticalBalanceScore: balanceScore(topCount, bottomCount, objectCount),
    },
    objectIds: scene.objects.map((object) => object.id),
    evidenceIds: ["fact:scene:objects", ...allPositionEvidence],
    method: "对象位置点的算术质心、质心均方根离散度、区域比例与左右/上下数量差。",
    interpretiveLimit: "只描述当前空间构图；不代表人格、情绪、关系质量或临床状态。",
  }));

  features.push(feature({
    id: "feature:scene:projected-area-sum",
    scope: "scene",
    kind: "salience.projected-area-sum",
    label: "投影面积总和",
    value: roundNumber(projectedAreaSum),
    unit: "canvas-ratio-sum",
    objectIds: scene.objects.map((object) => object.id),
    evidenceIds: allTransformEvidence.length > 0 ? allTransformEvidence : ["fact:scene:objects"],
    method: "逐对象计算 width*scale/canvasWidth 与 height*scale/canvasHeight 的乘积后求和；不消除对象重叠。",
    interpretiveLimit: "这是屏幕投影占用的近似总量，不是物理体积、真实占地或心理重要性。",
  }));

  features.push(feature({
    id: "feature:scene:category-distribution",
    scope: "category",
    kind: "category.distribution",
    label: "类别分布",
    value: scene.aggregates.categoryCounts.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count,
      ratio: ratio(item.count, objectCount),
    })),
    objectIds: scene.objects.map((object) => object.id),
    evidenceIds: allIdentityEvidence.length > 0 ? allIdentityEvidence : ["fact:scene:objects"],
    method: "按沙具 category 精确计数并除以当前对象总数。",
    interpretiveLimit: "类别频率是描述性统计，不能直接转换为心理主题。",
  }));

  features.push(feature({
    id: "feature:scene:risk-tag-distribution",
    scope: "risk",
    kind: "risk-tag.distribution",
    label: "风险标签分布",
    value: scene.aggregates.riskCounts.map((item) => ({
      id: item.id,
      label: item.label,
      count: item.count,
      ratio: ratio(item.count, objectCount),
    })),
    objectIds: scene.objects.map((object) => object.id),
    evidenceIds: allIdentityEvidence.length > 0 ? allIdentityEvidence : ["fact:scene:objects"],
    method: "按资产预置 riskTag 精确计数并除以当前对象总数。",
    interpretiveLimit: "资产风险标签不是用户风险评估，不能用于诊断或危机判定。",
  }));

  const maximumArea = Math.max(0, ...scene.objects.map((object) => object.transform.projectedAreaRatio));
  const maximumScale = Math.max(0, ...scene.objects.map((object) => object.transform.scale));
  const medianScale = median(scene.objects.map((object) => object.transform.scale));

  scene.objects.forEach((object) => {
    const encodedObjectId = encodeURIComponent(object.id);
    const objectPositionFact = factId(object.id, "position");
    const objectTransformFact = factId(object.id, "transform");
    const nearest = findNearestRelation(scene.relations, object.id);
    const localRelations = scene.relations.filter((relation) => relationIncludes(relation, object.id) && relation.distanceNorm <= LOCAL_NEIGHBOR_THRESHOLD);
    const centerProximity = roundNumber(1 - Math.min(1, object.placement.distanceFromCenterNorm / Math.SQRT1_2));
    const boundaryProximity = roundNumber(1 - Math.min(1, object.placement.distanceToNearestBoundaryNorm / 0.5));
    const relativeAreaWithinScene = projectedAreaSum > 0 ? roundNumber(object.transform.projectedAreaRatio / projectedAreaSum) : 0;
    const areaProminence = maximumArea > 0 ? object.transform.projectedAreaRatio / maximumArea : 0;
    const scaleProminence = maximumScale > 0 ? object.transform.scale / maximumScale : 0;
    const visualSalienceIndex = roundNumber(
      VISUAL_SALIENCE_WEIGHTS.projectedArea * areaProminence
      + VISUAL_SALIENCE_WEIGHTS.centerProximity * centerProximity
      + VISUAL_SALIENCE_WEIGHTS.scale * scaleProminence,
    );

    features.push(feature({
      id: `feature:object:${encodedObjectId}:spatial-profile`,
      scope: "object",
      kind: "spatial.object-profile",
      label: `${object.name}的空间特征`,
      value: {
        xNorm: object.placement.xNorm,
        yNorm: object.placement.yNorm,
        zone: object.placement.zone,
        centerProximity,
        boundaryProximity,
        nearestObjectId: nearest ? otherObjectId(nearest, object.id) : null,
        nearestDistanceNorm: nearest?.distanceNorm ?? null,
        localNeighborCount: localRelations.length,
        isolationScore: nearest ? roundNumber(nearest.distanceNorm / Math.SQRT2) : null,
      },
      objectIds: [object.id, ...(nearest ? [otherObjectId(nearest, object.id)] : [])],
      evidenceIds: [objectPositionFact, ...(nearest ? [factId(otherObjectId(nearest, object.id), "position")] : [])],
      method: `基于归一化放置点计算中心/边界距离、最近邻及 ${LOCAL_NEIGHBOR_THRESHOLD} 阈值内邻居数。`,
      interpretiveLimit: "邻近与孤立仅描述几何距离，不表示情感亲疏、排斥或支持关系。",
    }));

    features.push(feature({
      id: `feature:object:${encodedObjectId}:visual-salience`,
      scope: "object",
      kind: "salience.visual-composition",
      label: `${object.name}的视觉构图显著度`,
      value: {
        projectedAreaRatio: object.transform.projectedAreaRatio,
        relativeAreaWithinScene,
        scaleRatioToMedian: medianScale > 0 ? roundNumber(object.transform.scale / medianScale) : null,
        centerProximity,
        visualSalienceIndex,
        selectedOperationFocus: scene.selectedObjectId === object.id,
      },
      objectIds: [object.id],
      evidenceIds: [objectPositionFact, objectTransformFact, "fact:scene:selection"],
      method: "显著度指数=0.45*相对最大投影面积+0.35*中心接近度+0.20*相对最大缩放；选中状态单列且不参与指数。",
      interpretiveLimit: "该指数只用于构图排序；它不是心理重要性、偏好强度或临床量表。",
    }));

    const creationIndex = scene.aggregates.creationOrder.indexOf(object.id);
    features.push(feature({
      id: `feature:process:${encodedObjectId}:creation-order`,
      scope: "process",
      kind: "process.creation-order",
      label: `${object.name}的创建顺序`,
      value: {
        createdOrder: object.createdOrder,
        canonicalRank: creationIndex + 1,
        rankPercentile: objectCount > 1 ? roundNumber(creationIndex / (objectCount - 1)) : 0,
      },
      fidelity: "weak",
      objectIds: [object.id],
      evidenceIds: [factId(object.id, "created-order")],
      method: "按 createdOrder 升序、对象 ID 作为并列排序键生成规范顺序。",
      interpretiveLimit: "只知道创建次序；不知道移动、删除、停留、犹豫或撤销过程。",
    }));
  });

  scene.relations.forEach((relation) => {
    features.push(feature({
      id: `feature:${relation.id}`,
      scope: "relation",
      kind: "spatial.pair-relation",
      label: "对象对空间关系",
      value: {
        sourceObjectId: relation.sourceObjectId,
        targetObjectId: relation.targetObjectId,
        distanceNorm: relation.distanceNorm,
        deltaXNorm: relation.deltaXNorm,
        deltaYNorm: relation.deltaYNorm,
        direction: relation.direction,
        proximityBand: relation.proximityBand,
        sameZone: relation.sameZone,
        sameCategory: relation.sameCategory,
      },
      objectIds: [relation.sourceObjectId, relation.targetObjectId],
      evidenceIds: [factId(relation.sourceObjectId, "position"), factId(relation.targetObjectId, "position")],
      method: `两个归一化放置点的欧氏距离、八方向分类和阈值分带（near<=${NEAR_DISTANCE_THRESHOLD}, middle<=${MIDDLE_DISTANCE_THRESHOLD}）。`,
      interpretiveLimit: "对象对关系只说明当前几何构图，不表示现实人物关系或心理因果。",
    }));
  });

  const canonicalFeatures = [...features].sort((left, right) => compareStrings(left.id, right.id));
  const evidenceGraph = buildEvidenceGraph(scene.sourceSnapshotId, facts, canonicalFeatures);
  const warnings = [
    "footprint 的单位未被 Snapshot v1 统一，Phase 2 仅保留原值，不用于空间距离或占地计算。",
    "过程证据仅包含 createdOrder，所有创建顺序特征均为 weak。",
    ...(objectCount === 0 ? ["空场景不生成对象级、关系级、质心或最近邻数值。"] : []),
  ];

  return deepFreeze({
    schemaVersion: FEATURE_BUNDLE_V1,
    sourceSnapshotId: scene.sourceSnapshotId,
    sourceSceneSchemaVersion: scene.schemaVersion,
    algorithmVersion: FEATURE_ALGORITHM_V1,
    algorithmConfig: {
      precisionDigits: PRECISION_DIGITS,
      nearDistanceThreshold: NEAR_DISTANCE_THRESHOLD,
      middleDistanceThreshold: MIDDLE_DISTANCE_THRESHOLD,
      localNeighborThreshold: LOCAL_NEIGHBOR_THRESHOLD,
      visualSalienceWeights: VISUAL_SALIENCE_WEIGHTS,
    },
    processEvidence: {
      fidelity: "weak",
      availableSignals: ["createdOrder"],
      unavailableSignals: PROCESS_UNAVAILABLE_SIGNALS,
    },
    features: canonicalFeatures,
    evidenceGraph,
    warnings,
  });
}

function buildFactNodes(scene: ReconstructedSceneV1): EvidenceGraphNodeV1[] {
  const nodes: EvidenceGraphNodeV1[] = [
    fact({ id: "fact:scene:canvas", kind: "scene.canvas", label: "沙盘画布", value: scene.canvas, sourcePaths: ["/canvas"] }),
    fact({ id: "fact:scene:environment", kind: "scene.environment", label: "当前环境", value: scene.environment, sourcePaths: ["/environment"] }),
    fact({
      id: "fact:scene:objects",
      kind: "scene.object-list",
      label: "当前沙具列表",
      value: scene.objects.map((object) => object.id),
      sourcePaths: ["/objects"],
      objectIds: scene.objects.map((object) => object.id),
    }),
    fact({
      id: "fact:scene:selection",
      kind: "scene.selection",
      label: "当前操作选中项",
      value: scene.selectedObjectId,
      sourcePaths: ["/selectedObjectId"],
      objectIds: scene.selectedObjectId ? [scene.selectedObjectId] : [],
    }),
  ];

  scene.objects.forEach((object) => {
    nodes.push(
      fact({
        id: factId(object.id, "identity"),
        kind: "object.identity",
        label: `${object.name}的身份字段`,
        value: { assetId: object.assetId, name: object.name, category: object.category, riskTag: object.riskTag },
        sourcePaths: [`/objects/${object.sourceIndex}/assetId`, `/objects/${object.sourceIndex}/name`, `/objects/${object.sourceIndex}/category`, `/objects/${object.sourceIndex}/riskTag`],
        objectIds: [object.id],
      }),
      fact({
        id: factId(object.id, "position"),
        kind: "object.position",
        label: `${object.name}的位置`,
        value: object.placement,
        sourcePaths: [`/objects/${object.sourceIndex}/position`],
        objectIds: [object.id],
      }),
      fact({
        id: factId(object.id, "transform"),
        kind: "object.transform",
        label: `${object.name}的变换`,
        value: object.transform,
        sourcePaths: [`/objects/${object.sourceIndex}/transform`],
        objectIds: [object.id],
      }),
      fact({
        id: factId(object.id, "semantics"),
        kind: "object.semantic-metadata",
        label: `${object.name}的资产语义元数据`,
        value: { symbolicCandidates: object.symbolicCandidates, semanticTags: object.semanticTags },
        sourcePaths: [`/objects/${object.sourceIndex}/symbolicCandidates`, `/objects/${object.sourceIndex}/semanticTags`],
        objectIds: [object.id],
      }),
      fact({
        id: factId(object.id, "created-order"),
        kind: "object.created-order",
        label: `${object.name}的创建序号`,
        value: object.createdOrder,
        fidelity: "weak",
        sourcePaths: [`/objects/${object.sourceIndex}/createdOrder`],
        objectIds: [object.id],
      }),
    );
  });
  return nodes.sort((left, right) => compareStrings(left.id, right.id));
}

function buildEvidenceGraph(
  sourceSnapshotId: string,
  facts: readonly EvidenceGraphNodeV1[],
  features: readonly DeterministicFeatureRecordV1[],
) {
  const featureNodes = features.map<EvidenceGraphNodeV1>((current) => ({
    id: current.id,
    layer: "feature",
    kind: current.kind,
    label: current.label,
    value: current.value,
    fidelity: current.fidelity,
    sourcePaths: [],
    objectIds: current.objectIds,
  }));
  const availableNodeIds = new Set(facts.map((node) => node.id));
  const edges: EvidenceGraphEdgeV1[] = [];
  features.forEach((current) => {
    current.evidenceIds.forEach((evidenceId) => {
      if (!availableNodeIds.has(evidenceId)) {
        throw new Error(`Feature ${current.id} references missing evidence node ${evidenceId}.`);
      }
      edges.push({
        id: `edge:${encodeURIComponent(current.id)}:derived-from:${encodeURIComponent(evidenceId)}`,
        type: "derived_from",
        fromNodeId: current.id,
        toNodeId: evidenceId,
      });
    });
  });
  return {
    schemaVersion: EVIDENCE_GRAPH_V1,
    sourceSnapshotId,
    nodes: [...facts, ...featureNodes].sort((left, right) => compareStrings(left.id, right.id)),
    edges: edges.sort((left, right) => compareStrings(left.id, right.id)),
  };
}

function feature(
  input: Omit<DeterministicFeatureRecordV1, "fidelity" | "unit"> & Partial<Pick<DeterministicFeatureRecordV1, "fidelity" | "unit">>,
): DeterministicFeatureRecordV1 {
  return {
    ...input,
    fidelity: input.fidelity ?? "deterministic",
  };
}

function fact(input: {
  id: string;
  kind: string;
  label: string;
  value: JsonValue;
  fidelity?: "deterministic" | "weak";
  sourcePaths: readonly string[];
  objectIds?: readonly string[];
}): EvidenceGraphNodeV1 {
  return {
    layer: "fact",
    fidelity: "deterministic",
    objectIds: [],
    ...input,
  };
}

function calculateCentroid(objects: readonly ReconstructedSceneObjectV1[]): { x: number; y: number } | null {
  if (objects.length === 0) {
    return null;
  }
  return {
    x: roundNumber(objects.reduce((sum, object) => sum + object.placement.xNorm, 0) / objects.length),
    y: roundNumber(objects.reduce((sum, object) => sum + object.placement.yNorm, 0) / objects.length),
  };
}

function calculateDispersion(objects: readonly ReconstructedSceneObjectV1[], centroid: { x: number; y: number } | null): number | null {
  if (!centroid || objects.length === 0) {
    return null;
  }
  const meanSquaredDistance = objects.reduce((sum, object) => {
    const distance = Math.hypot(object.placement.xNorm - centroid.x, object.placement.yNorm - centroid.y);
    return sum + distance ** 2;
  }, 0) / objects.length;
  return roundNumber(Math.sqrt(meanSquaredDistance) / Math.SQRT2);
}

function balanceScore(firstCount: number, secondCount: number, totalCount: number): number | null {
  return totalCount === 0 ? null : roundNumber(1 - Math.abs(firstCount - secondCount) / totalCount);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : roundNumber(numerator / denominator);
}

function findNearestRelation(relations: readonly ReconstructedSceneRelationV1[], objectId: string): ReconstructedSceneRelationV1 | undefined {
  return relations
    .filter((relation) => relationIncludes(relation, objectId))
    .sort((left, right) => left.distanceNorm - right.distanceNorm || compareStrings(left.id, right.id))[0];
}

function relationIncludes(relation: ReconstructedSceneRelationV1, objectId: string): boolean {
  return relation.sourceObjectId === objectId || relation.targetObjectId === objectId;
}

function otherObjectId(relation: ReconstructedSceneRelationV1, objectId: string): string {
  return relation.sourceObjectId === objectId ? relation.targetObjectId : relation.sourceObjectId;
}

function factId(objectId: string, kind: string): string {
  return `fact:object:${encodeURIComponent(objectId)}:${kind}`;
}
