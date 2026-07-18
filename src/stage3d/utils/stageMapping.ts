import * as THREE from "three";
import { BOARD_HEIGHT, BOARD_WIDTH, clamp } from "../../utils/analysis";

export const STAGE_TRAY = {
  outerWidth: 7.8,
  outerDepth: 5.1,
  innerWidth: 7.18,
  innerDepth: 4.48,
  sandY: 0.285,
  objectY: 0.33,
  boardPadding: 24,
} as const;

export interface StagePoint {
  x: number;
  z: number;
}

export function boardToStage(point: { x: number; y: number }): StagePoint {
  return {
    x: (point.x / BOARD_WIDTH - 0.5) * STAGE_TRAY.innerWidth,
    z: (point.y / BOARD_HEIGHT - 0.5) * STAGE_TRAY.innerDepth,
  };
}

export function stageToBoard(point: StagePoint): { x: number; y: number } {
  return {
    x: clamp((point.x / STAGE_TRAY.innerWidth + 0.5) * BOARD_WIDTH, STAGE_TRAY.boardPadding, BOARD_WIDTH - STAGE_TRAY.boardPadding),
    y: clamp((point.z / STAGE_TRAY.innerDepth + 0.5) * BOARD_HEIGHT, STAGE_TRAY.boardPadding, BOARD_HEIGHT - STAGE_TRAY.boardPadding),
  };
}

export function intersectSandPlane(
  client: { x: number; y: number },
  domElement: HTMLCanvasElement,
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
): StagePoint | null {
  const bounds = domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((client.x - bounds.left) / bounds.width) * 2 - 1,
    -((client.y - bounds.top) / bounds.height) * 2 + 1,
  );
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -STAGE_TRAY.sandY);
  const target = new THREE.Vector3();

  raycaster.setFromCamera(pointer, camera);
  const intersection = raycaster.ray.intersectPlane(plane, target);
  if (!intersection) {
    return null;
  }

  return {
    x: clamp(intersection.x, -STAGE_TRAY.innerWidth / 2, STAGE_TRAY.innerWidth / 2),
    z: clamp(intersection.z, -STAGE_TRAY.innerDepth / 2, STAGE_TRAY.innerDepth / 2),
  };
}

export function getObjectStageScale(object: { footprint: { width: number; depth: number; height: number }; scale: number }): number {
  const footprintExtent = Math.max(object.footprint.width, object.footprint.depth, object.footprint.height * 0.72);
  return clamp((footprintExtent / 100) * object.scale, 0.36, 1.58);
}
