import type { SandboxEvent, SandboxObject } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../utils/analysis";
import { createSandboxEvent } from "../utils/events";
import { createSandboxObject } from "../utils/objectFactory";
import { findAsset } from "./assets";

const seedPlacements = [
  { assetId: "env_house", x: BOARD_WIDTH * 0.31, y: BOARD_HEIGHT * 0.36, rotation: -2, scale: 1.06 },
  { assetId: "nature_tree", x: BOARD_WIDTH * 0.22, y: BOARD_HEIGHT * 0.58, rotation: 4, scale: 0.92 },
  { assetId: "nature_water", x: BOARD_WIDTH * 0.62, y: BOARD_HEIGHT * 0.68, rotation: -7, scale: 1.05 },
  { assetId: "animal_dog", x: BOARD_WIDTH * 0.47, y: BOARD_HEIGHT * 0.55, rotation: 2, scale: 0.86 },
  { assetId: "symbol_light", x: BOARD_WIDTH * 0.72, y: BOARD_HEIGHT * 0.32, rotation: 0, scale: 0.9 },
];

export function createInitialScene(): {
  objects: SandboxObject[];
  events: SandboxEvent[];
} {
  const objects = seedPlacements.flatMap((placement) => {
    const asset = findAsset(placement.assetId);
    if (!asset) {
      return [];
    }

    return {
      ...createSandboxObject(asset, { x: placement.x, y: placement.y }),
      rotation: placement.rotation,
      scale: placement.scale,
    };
  });

  return {
    objects,
    events: [
      createSandboxEvent({
        type: "seed",
        label: "初始化示例沙盘",
        payload: {
          objectCount: objects.length,
        },
      }),
    ],
  };
}
