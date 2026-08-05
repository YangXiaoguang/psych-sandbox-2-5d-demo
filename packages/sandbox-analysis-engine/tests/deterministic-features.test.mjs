import assert from "node:assert/strict";
import test from "node:test";
import {
  EVIDENCE_GRAPH_V1,
  FEATURE_ALGORITHM_V1,
  FEATURE_BUNDLE_V1,
  RECONSTRUCTED_SCENE_V1,
  createSandboxAnalysisEngine,
  extractFeatures,
  reconstructScene,
} from "../dist/index.js";
import { createObject, createSnapshot } from "./fixtures.mjs";

test("reconstructs a canonical immutable scene", () => {
  const right = createObject({ id: "object-b", xNorm: 0.75, yNorm: 0.5, depthRank: 2, createdOrder: 1, rotationDeg: -30 });
  const left = createObject({ id: "object-a", xNorm: 0.25, yNorm: 0.5, depthRank: 1, createdOrder: 2, rotationDeg: 390 });
  const scene = reconstructScene(createSnapshot([right, left], { selectedObjectId: "object-b" }));

  assert.equal(scene.schemaVersion, RECONSTRUCTED_SCENE_V1);
  assert.deepEqual(scene.objects.map((object) => object.id), ["object-a", "object-b"]);
  assert.deepEqual(scene.aggregates.depthOrder, ["object-a", "object-b"]);
  assert.deepEqual(scene.aggregates.creationOrder, ["object-b", "object-a"]);
  assert.equal(scene.objects[0].transform.normalizedRotationDeg, 30);
  assert.equal(scene.objects[1].transform.normalizedRotationDeg, 330);
  assert.equal(scene.relations.length, 1);
  assert.equal(scene.relations[0].distanceNorm, 0.5);
  assert.equal(scene.relations[0].direction, "east");
  assert.equal(scene.relations[0].proximityBand, "far");
  assert.equal(scene.objects[0].footprint.measurementPolicy, "preserved-only");
  assert.equal(Object.isFrozen(scene), true);
  assert.equal(Object.isFrozen(scene.objects[0].placement), true);
});

test("calculates reproducible scene and object features", () => {
  const left = createObject({ id: "left", name: "左侧对象", xNorm: 0.25, yNorm: 0.5, createdOrder: 1 });
  const right = createObject({ id: "right", name: "右侧对象", xNorm: 0.75, yNorm: 0.5, createdOrder: 2 });
  const bundle = extractFeatures(reconstructScene(createSnapshot([left, right])));

  assert.equal(bundle.schemaVersion, FEATURE_BUNDLE_V1);
  assert.equal(bundle.algorithmVersion, FEATURE_ALGORITHM_V1);
  assert.equal(bundle.evidenceGraph.schemaVersion, EVIDENCE_GRAPH_V1);
  const distribution = getFeature(bundle, "feature:scene:spatial-distribution");
  assert.deepEqual(distribution.value, {
    objectCount: 2,
    centroidXNorm: 0.5,
    centroidYNorm: 0.5,
    dispersionNorm: 0.176777,
    centerRatio: 0,
    boundaryRatio: 0,
    occupiedZoneRatio: 0.222222,
    horizontalBalanceScore: 1,
    verticalBalanceScore: 1,
  });
  const leftProfile = getFeature(bundle, "feature:object:left:spatial-profile");
  assert.equal(leftProfile.value.nearestObjectId, "right");
  assert.equal(leftProfile.value.nearestDistanceNorm, 0.5);
  assert.equal(leftProfile.value.isolationScore, 0.353553);
  assert.equal(leftProfile.value.localNeighborCount, 0);
});

test("classifies near relations and local neighbors by the frozen threshold", () => {
  const first = createObject({ id: "first", xNorm: 0.2, yNorm: 0.2 });
  const second = createObject({ id: "second", xNorm: 0.3, yNorm: 0.2, createdOrder: 2 });
  const result = createSandboxAnalysisEngine().analyzeDeterministically(createSnapshot([first, second]));

  assert.equal(result.ok, true);
  assert.equal(result.value.scene.relations[0].proximityBand, "near");
  assert.equal(getFeature(result.value.featureBundle, "feature:object:first:spatial-profile").value.localNeighborCount, 1);
});

test("keeps visual salience descriptive and excludes selection from its index", () => {
  const selected = createObject({ id: "selected", xNorm: 0.5, yNorm: 0.5, width: 200, height: 200, scale: 2 });
  const other = createObject({ id: "other", xNorm: 0.1, yNorm: 0.1, width: 100, height: 100, scale: 1, createdOrder: 2 });
  const sceneSelected = reconstructScene(createSnapshot([selected, other], { selectedObjectId: "selected" }));
  const sceneOtherSelected = reconstructScene(createSnapshot([selected, other], { selectedObjectId: "other" }));
  const selectedBundle = extractFeatures(sceneSelected);
  const otherSelectedBundle = extractFeatures(sceneOtherSelected);
  const first = getFeature(selectedBundle, "feature:object:selected:visual-salience").value;
  const second = getFeature(otherSelectedBundle, "feature:object:selected:visual-salience").value;

  assert.equal(first.selectedOperationFocus, true);
  assert.equal(second.selectedOperationFocus, false);
  assert.equal(first.visualSalienceIndex, second.visualSalienceIndex);
  assert.match(getFeature(selectedBundle, "feature:object:selected:visual-salience").interpretiveLimit, /不是心理重要性/);
});

test("marks all process features weak and declares unavailable history", () => {
  const object = createObject({ id: "process-object", createdOrder: 7 });
  const bundle = extractFeatures(reconstructScene(createSnapshot([object])));
  const processFeature = getFeature(bundle, "feature:process:process-object:creation-order");

  assert.equal(processFeature.fidelity, "weak");
  assert.deepEqual(bundle.processEvidence.availableSignals, ["createdOrder"]);
  assert.deepEqual(bundle.processEvidence.unavailableSignals, ["moveHistory", "deletionHistory", "dwellTime", "hesitation", "undoRedo"]);
  assert.match(processFeature.interpretiveLimit, /不知道移动、删除、停留、犹豫或撤销/);
});

test("builds a complete fact-to-feature evidence graph", () => {
  const first = createObject({ id: "graph-a", xNorm: 0.4, yNorm: 0.4 });
  const second = createObject({ id: "graph-b", xNorm: 0.6, yNorm: 0.6, createdOrder: 2 });
  const bundle = extractFeatures(reconstructScene(createSnapshot([first, second])));
  const graph = bundle.evidenceGraph;
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));

  assert.equal(new Set(graph.nodes.map((node) => node.id)).size, graph.nodes.length);
  graph.edges.forEach((edge) => {
    assert.equal(nodes.get(edge.fromNodeId)?.layer, "feature");
    assert.equal(nodes.get(edge.toNodeId)?.layer, "fact");
    assert.equal(edge.type, "derived_from");
  });
  bundle.features.forEach((feature) => {
    assert.equal(nodes.get(feature.id)?.layer, "feature");
    feature.evidenceIds.forEach((evidenceId) => assert.equal(nodes.get(evidenceId)?.layer, "fact"));
  });
});

test("keeps derived graph identifiers unique for object IDs with delimiters", () => {
  const first = createObject({ id: "object:a", xNorm: 0.3, yNorm: 0.3 });
  const second = createObject({ id: "object/a", xNorm: 0.7, yNorm: 0.7, createdOrder: 2 });
  const bundle = extractFeatures(reconstructScene(createSnapshot([first, second])));
  const nodeIds = bundle.evidenceGraph.nodes.map((node) => node.id);
  const edgeIds = bundle.evidenceGraph.edges.map((edge) => edge.id);

  assert.equal(new Set(nodeIds).size, nodeIds.length);
  assert.equal(new Set(edgeIds).size, edgeIds.length);
  assert.equal(nodeIds.some((id) => id.includes("object%3Aa")), true);
  assert.equal(nodeIds.some((id) => id.includes("object%2Fa")), true);
});

test("does not treat footprint values as spatial measurement units", () => {
  const compact = createObject({ id: "compact", xNorm: 0.2, yNorm: 0.2, footprintWidth: 1, footprintDepth: 1 });
  const largeUnits = createObject({ id: "large-units", xNorm: 0.4, yNorm: 0.2, createdOrder: 2, footprintWidth: 180, footprintDepth: 90 });
  const scene = reconstructScene(createSnapshot([compact, largeUnits]));
  const bundle = extractFeatures(scene);

  assert.equal(scene.relations[0].distanceNorm, 0.2);
  assert.equal(scene.objects.find((object) => object.id === "large-units").footprint.width, 180);
  assert.equal(getFeature(bundle, "feature:object:compact:spatial-profile").value.nearestDistanceNorm, 0.2);
  assert.equal(bundle.warnings.some((warning) => warning.includes("footprint")), true);
});

test("produces byte-stable output for the same snapshot", () => {
  const objects = [
    createObject({ id: "stable-b", xNorm: 0.8, yNorm: 0.7, createdOrder: 2 }),
    createObject({ id: "stable-a", xNorm: 0.2, yNorm: 0.3, createdOrder: 1 }),
  ];
  const snapshot = createSnapshot(objects, { snapshotId: "stable-snapshot" });
  const engine = createSandboxAnalysisEngine();
  const first = engine.analyzeDeterministically(snapshot);
  const second = engine.analyzeDeterministically(structuredClone(snapshot));

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(JSON.stringify(first.value), JSON.stringify(second.value));
  assert.equal(Object.isFrozen(first.value.scene), true);
  assert.equal(Object.isFrozen(first.value.featureBundle), true);
});

test("handles an empty scene without fabricated object features", () => {
  const result = createSandboxAnalysisEngine().analyzeDeterministically(createSnapshot([]));

  assert.equal(result.ok, true);
  assert.equal(result.value.scene.objects.length, 0);
  assert.equal(result.value.scene.relations.length, 0);
  assert.equal(result.value.featureBundle.features.some((feature) => feature.scope === "object"), false);
  assert.equal(getFeature(result.value.featureBundle, "feature:scene:spatial-distribution").value.centroidXNorm, null);
  assert.equal(result.value.featureBundle.warnings.some((warning) => warning.includes("空场景")), true);
});

test("does not bypass Phase 1 validation", () => {
  const invalid = createSnapshot([createObject({ id: "known" })], { selectedObjectId: "missing" });
  const result = createSandboxAnalysisEngine().analyzeDeterministically(invalid);

  assert.equal(result.ok, false);
  assert.equal(result.migration.issues.some((issue) => issue.code === "REFERENCE_NOT_FOUND"), true);
});

function getFeature(bundle, id) {
  const feature = bundle.features.find((current) => current.id === id);
  assert.ok(feature, `Missing feature ${id}`);
  return feature;
}
