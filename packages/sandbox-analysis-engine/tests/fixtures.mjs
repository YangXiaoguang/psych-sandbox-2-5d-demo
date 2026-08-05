const ZONES = [
  ["top-left", "左上"],
  ["top-center", "上中"],
  ["top-right", "右上"],
  ["middle-left", "左中"],
  ["middle-center", "中心"],
  ["middle-right", "右中"],
  ["bottom-left", "左下"],
  ["bottom-center", "下中"],
  ["bottom-right", "右下"],
];

export function createObject(overrides = {}) {
  const id = overrides.id ?? "object-a";
  const name = overrides.name ?? id;
  const xNorm = overrides.xNorm ?? 0.5;
  const yNorm = overrides.yNorm ?? 0.5;
  const zone = overrides.zone ?? resolveZone(xNorm, yNorm);
  return {
    id,
    assetId: overrides.assetId ?? `asset-${id}`,
    name,
    category: overrides.category ?? "人物",
    riskTag: overrides.riskTag ?? "normal",
    riskLabel: overrides.riskLabel ?? "常规",
    symbolicCandidates: overrides.symbolicCandidates ?? [],
    semanticTags: overrides.semanticTags ?? [],
    position: {
      x: overrides.x ?? xNorm * 1000,
      y: overrides.y ?? yNorm * 600,
      xNorm,
      yNorm,
      zone,
      zoneLabel: ZONES.find(([id]) => id === zone)?.[1] ?? zone,
      inCenter: overrides.inCenter ?? zone === "middle-center",
      inBoundary: overrides.inBoundary ?? (xNorm <= 0.1 || xNorm >= 0.9 || yNorm <= 0.1 || yNorm >= 0.9),
      depthRank: overrides.depthRank ?? 1,
    },
    transform: {
      rotationDeg: overrides.rotationDeg ?? 0,
      scale: overrides.scale ?? 1,
      width: overrides.width ?? 100,
      height: overrides.height ?? 100,
    },
    footprint: {
      kind: overrides.footprintKind ?? "compact",
      width: overrides.footprintWidth ?? 1,
      depth: overrides.footprintDepth ?? 1,
      height: overrides.footprintHeight ?? 1,
    },
    createdOrder: overrides.createdOrder ?? 1,
  };
}

export function createSnapshot(objects = [], overrides = {}) {
  const zoneCounts = ZONES.map(([id, label]) => ({
    id,
    label,
    count: objects.filter((object) => object.position.zone === id).length,
  }));
  const categoryCounts = countBy(objects, (object) => object.category);
  const riskLabels = new Map(objects.map((object) => [object.riskTag, object.riskLabel]));
  const riskCounts = countBy(objects, (object) => object.riskTag, riskLabels);
  const depthOrder = [...objects]
    .sort((left, right) => left.position.depthRank - right.position.depthRank || compareStrings(left.id, right.id))
    .map((object) => object.id);

  return {
    schemaVersion: "sandbox.current-snapshot.v1",
    snapshotId: overrides.snapshotId ?? "snapshot-phase-2-test",
    generatedAt: overrides.generatedAt ?? "2026-08-05T12:00:00.000Z",
    source: "current_sandbox",
    canvas: {
      width: 1000,
      height: 600,
      coordinateSystem: "board-pixel",
      normalizedCoordinateSystem: "0-1",
      guides: ["nine-grid", "center-region", "boundary-region", "y-depth-sort"],
    },
    environment: {
      weather: overrides.weather ?? "sunny",
      weatherLabel: overrides.weatherLabel ?? "晴天",
      light: overrides.light ?? "day",
      lightLabel: overrides.lightLabel ?? "白天",
    },
    objects,
    analysis: {
      totalObjects: objects.length,
      centerCount: objects.filter((object) => object.position.inCenter).length,
      boundaryCount: objects.filter((object) => object.position.inBoundary).length,
      zoneCounts,
      categoryCounts,
      riskCounts,
      emptyZones: zoneCounts.filter((item) => item.count === 0).map((item) => item.id),
      depthOrder,
      summaryText: `当前共有 ${objects.length} 个沙具。`,
    },
    selectedObjectId: overrides.selectedObjectId ?? null,
  };
}

function resolveZone(xNorm, yNorm) {
  const column = xNorm < 1 / 3 ? "left" : xNorm < 2 / 3 ? "center" : "right";
  const row = yNorm < 1 / 3 ? "top" : yNorm < 2 / 3 ? "middle" : "bottom";
  return `${row}-${column}`;
}

function countBy(objects, selector, labels = new Map()) {
  const counts = new Map();
  objects.forEach((object) => {
    const id = selector(object);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([id, count]) => ({ id, label: labels.get(id) ?? id, count }));
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
