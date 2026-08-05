import { RECONSTRUCTED_SCENE_V1, type ReconstructedSceneRelationV1, type ReconstructedSceneV1, type SceneDirection8, type SceneProximityBand } from "../contracts/scene.js";
import { type CurrentSandboxSnapshotV1, type SnapshotObjectV1, type SnapshotZoneId } from "../contracts/snapshot.js";
import { compareStrings, deepFreeze, normalizeRotation, PRECISION_DIGITS, roundNumber } from "../internal/deterministic.js";

export const NEAR_DISTANCE_THRESHOLD = 0.18;
export const MIDDLE_DISTANCE_THRESHOLD = 0.38;

const ZONE_ORDER: readonly SnapshotZoneId[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export function reconstructScene(snapshot: CurrentSandboxSnapshotV1): ReconstructedSceneV1 {
  const indexedObjects = snapshot.objects
    .map((object, sourceIndex) => reconstructObject(snapshot, object, sourceIndex))
    .sort((left, right) => compareStrings(left.id, right.id));
  const relations = buildRelations(indexedObjects);
  const zoneCounts = buildCounts(indexedObjects.map((object) => [object.placement.zone, object.placement.zoneLabel] as const), ZONE_ORDER);
  const categoryCounts = buildCounts(indexedObjects.map((object) => [object.category, object.category] as const));
  const riskCounts = buildCounts(indexedObjects.map((object) => [object.riskTag, object.riskLabel] as const));
  const occupiedZones = ZONE_ORDER.filter((zone) => zoneCounts.some((item) => item.id === zone && item.count > 0));
  const emptyZones = ZONE_ORDER.filter((zone) => !occupiedZones.includes(zone));
  const depthOrder = [...indexedObjects]
    .sort((left, right) => left.placement.depthRank - right.placement.depthRank || compareStrings(left.id, right.id))
    .map((object) => object.id);
  const creationOrder = [...indexedObjects]
    .sort((left, right) => left.createdOrder - right.createdOrder || compareStrings(left.id, right.id))
    .map((object) => object.id);

  return deepFreeze({
    schemaVersion: RECONSTRUCTED_SCENE_V1,
    sourceSnapshotId: snapshot.snapshotId,
    sourceSnapshotSchemaVersion: snapshot.schemaVersion,
    canvas: {
      width: snapshot.canvas.width,
      height: snapshot.canvas.height,
      coordinateSystem: snapshot.canvas.coordinateSystem,
      normalizedCoordinateSystem: snapshot.canvas.normalizedCoordinateSystem,
    },
    environment: { ...snapshot.environment },
    objects: indexedObjects,
    relations,
    selectedObjectId: snapshot.selectedObjectId ?? null,
    aggregates: {
      totalObjects: indexedObjects.length,
      centerCount: indexedObjects.filter((object) => object.placement.inCenter).length,
      boundaryCount: indexedObjects.filter((object) => object.placement.inBoundary).length,
      occupiedZones,
      emptyZones,
      zoneCounts,
      categoryCounts,
      riskCounts,
      depthOrder,
      creationOrder,
    },
    reconstructionPolicy: {
      objectOrder: "object-id-ascending",
      relationOrder: "canonical-object-pair",
      spatialBasis: "normalized-placement-point",
      footprintPolicy: "preserved-not-measured",
      precisionDigits: PRECISION_DIGITS,
    },
  });
}

function reconstructObject(snapshot: CurrentSandboxSnapshotV1, object: SnapshotObjectV1, sourceIndex: number) {
  const distanceFromCenterNorm = Math.hypot(object.position.xNorm - 0.5, object.position.yNorm - 0.5);
  const boundaryDistance = Math.min(
    object.position.xNorm,
    object.position.yNorm,
    1 - object.position.xNorm,
    1 - object.position.yNorm,
  );
  const projectedWidthNorm = (object.transform.width * object.transform.scale) / snapshot.canvas.width;
  const projectedHeightNorm = (object.transform.height * object.transform.scale) / snapshot.canvas.height;

  return {
    id: object.id,
    sourceIndex,
    assetId: object.assetId,
    name: object.name,
    category: object.category,
    riskTag: object.riskTag,
    riskLabel: object.riskLabel,
    symbolicCandidates: [...object.symbolicCandidates].sort(compareStrings),
    semanticTags: [...object.semanticTags].sort(compareStrings),
    placement: {
      x: object.position.x,
      y: object.position.y,
      xNorm: roundNumber(object.position.xNorm),
      yNorm: roundNumber(object.position.yNorm),
      zone: object.position.zone,
      zoneLabel: object.position.zoneLabel,
      inCenter: object.position.inCenter,
      inBoundary: object.position.inBoundary,
      depthRank: object.position.depthRank,
      distanceFromCenterNorm: roundNumber(distanceFromCenterNorm),
      distanceToNearestBoundaryNorm: roundNumber(boundaryDistance),
    },
    transform: {
      rotationDeg: roundNumber(object.transform.rotationDeg),
      normalizedRotationDeg: normalizeRotation(object.transform.rotationDeg),
      scale: roundNumber(object.transform.scale),
      width: roundNumber(object.transform.width),
      height: roundNumber(object.transform.height),
      projectedWidthNorm: roundNumber(projectedWidthNorm),
      projectedHeightNorm: roundNumber(projectedHeightNorm),
      projectedAreaRatio: roundNumber(projectedWidthNorm * projectedHeightNorm),
    },
    footprint: {
      ...object.footprint,
      measurementPolicy: "preserved-only" as const,
    },
    createdOrder: object.createdOrder,
    sourcePaths: [
      `/objects/${sourceIndex}`,
      `/objects/${sourceIndex}/position`,
      `/objects/${sourceIndex}/transform`,
      `/objects/${sourceIndex}/footprint`,
    ],
  };
}

function buildRelations(objects: ReconstructedSceneV1["objects"]): ReconstructedSceneRelationV1[] {
  const relations: ReconstructedSceneRelationV1[] = [];
  for (let sourceIndex = 0; sourceIndex < objects.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < objects.length; targetIndex += 1) {
      const source = objects[sourceIndex];
      const target = objects[targetIndex];
      const deltaXNorm = target.placement.xNorm - source.placement.xNorm;
      const deltaYNorm = target.placement.yNorm - source.placement.yNorm;
      const distanceNorm = Math.hypot(deltaXNorm, deltaYNorm);
      relations.push({
        id: `relation:${encodeURIComponent(source.id)}:${encodeURIComponent(target.id)}`,
        sourceObjectId: source.id,
        targetObjectId: target.id,
        deltaXNorm: roundNumber(deltaXNorm),
        deltaYNorm: roundNumber(deltaYNorm),
        distanceNorm: roundNumber(distanceNorm),
        direction: resolveDirection(deltaXNorm, deltaYNorm, distanceNorm),
        proximityBand: resolveProximityBand(distanceNorm),
        sameZone: source.placement.zone === target.placement.zone,
        sameCategory: source.category === target.category,
        sourcePaths: [
          `/objects/${source.sourceIndex}/position`,
          `/objects/${target.sourceIndex}/position`,
        ],
      });
    }
  }
  return relations;
}

function resolveDirection(deltaX: number, deltaY: number, distance: number): SceneDirection8 {
  if (distance <= 1e-9) {
    return "same-position";
  }
  const directions: readonly SceneDirection8[] = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
  const angle = (Math.atan2(deltaY, deltaX) + Math.PI * 2) % (Math.PI * 2);
  return directions[Math.round(angle / (Math.PI / 4)) % 8];
}

function resolveProximityBand(distance: number): SceneProximityBand {
  if (distance <= NEAR_DISTANCE_THRESHOLD) {
    return "near";
  }
  return distance <= MIDDLE_DISTANCE_THRESHOLD ? "middle" : "far";
}

function buildCounts(
  values: ReadonlyArray<readonly [string, string]>,
  fixedOrder?: readonly string[],
): Array<{ id: string; label: string; count: number }> {
  const labels = new Map<string, string>();
  const counts = new Map<string, number>();
  values.forEach(([id, label]) => {
    labels.set(id, label);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  const ids = fixedOrder ? [...fixedOrder] : [...counts.keys()].sort(compareStrings);
  return ids.map((id) => ({ id, label: labels.get(id) ?? id, count: counts.get(id) ?? 0 }));
}
