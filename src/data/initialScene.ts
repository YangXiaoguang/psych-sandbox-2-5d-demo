import type { SandboxEvent, SandboxObject } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../utils/analysis";
import { createSandboxEvent } from "../utils/events";
import { createSandboxObject } from "../utils/objectFactory";
import { findAsset } from "./assets";

const seedPlacements = [
  { assetId: "env_house", x: BOARD_WIDTH * 0.42, y: BOARD_HEIGHT * 0.34, rotation: -3, scale: 1.35 },
  { assetId: "nature_tree", x: BOARD_WIDTH * 0.18, y: BOARD_HEIGHT * 0.53, rotation: 3, scale: 1.18 },
  { assetId: "nature_tree", x: BOARD_WIDTH * 0.82, y: BOARD_HEIGHT * 0.35, rotation: -5, scale: 1.08 },
  { assetId: "animal_dog", x: BOARD_WIDTH * 0.50, y: BOARD_HEIGHT * 0.56, rotation: 2, scale: 1.05 },
  { assetId: "animal_bird", x: BOARD_WIDTH * 0.33, y: BOARD_HEIGHT * 0.45, rotation: 7, scale: 0.9 },
  { assetId: "nature_water", x: BOARD_WIDTH * 0.67, y: BOARD_HEIGHT * 0.67, rotation: -5, scale: 1.1 },
  { assetId: "env_fence", x: BOARD_WIDTH * 0.79, y: BOARD_HEIGHT * 0.55, rotation: -8, scale: 0.98 },
  { assetId: "symbol_light", x: BOARD_WIDTH * 0.71, y: BOARD_HEIGHT * 0.36, rotation: 0, scale: 0.86 },
  { assetId: "animal_fish", x: BOARD_WIDTH * 0.66, y: BOARD_HEIGHT * 0.73, rotation: 8, scale: 0.78 },
  { assetId: "person_child", x: BOARD_WIDTH * 0.36, y: BOARD_HEIGHT * 0.6, rotation: -4, scale: 1.05 },
  { assetId: "symbol_robot", x: BOARD_WIDTH * 0.58, y: BOARD_HEIGHT * 0.43, rotation: 4, scale: 0.92 },
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
