import type { SandboxAsset, SandboxObject } from "../types";
import { createId } from "./id";

export interface ObjectPosition {
  x: number;
  y: number;
}

export function createSandboxObject(
  asset: SandboxAsset,
  position: ObjectPosition,
): SandboxObject {
  return {
    id: createId("obj"),
    assetId: asset.assetId,
    name: asset.name,
    category: asset.category,
    x: position.x,
    y: position.y,
    width: asset.defaultWidth,
    height: asset.defaultHeight,
    rotation: 0,
    scale: 1,
    createdAt: Date.now(),
    riskTag: asset.riskTag,
    symbolicCandidates: asset.symbolicCandidates,
    anchor: asset.anchor,
    footprint: asset.footprint,
    thumbnailScale: asset.thumbnailScale,
    semanticTags: asset.semanticTags,
    modelRecipe: asset.modelRecipe,
  };
}
