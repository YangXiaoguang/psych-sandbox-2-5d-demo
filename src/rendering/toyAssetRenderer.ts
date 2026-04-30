import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { RiskTag } from "../types";

export interface ToyAssetSprite {
  dataUrl: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

interface ToyAssetRenderRequest {
  assetId: string;
  width: number;
  height: number;
  riskTag: RiskTag;
}

interface MeshOptions {
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
}

const SPRITE_VERSION = "toy-render-v3";
const spriteCache = new Map<string, Promise<ToyAssetSprite>>();
let renderQueue: Promise<void> = Promise.resolve();
let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;

export function renderToyAssetSprite({
  assetId,
  width,
  height,
  riskTag,
}: ToyAssetRenderRequest): Promise<ToyAssetSprite> {
  const frameWidth = Math.max(112, Math.round(width * 1.62));
  const frameHeight = Math.max(112, Math.round(height * 1.66));
  const cacheKey = `${SPRITE_VERSION}:${assetId}:${riskTag}:${frameWidth}x${frameHeight}`;
  const cached = spriteCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const rendered = enqueueRender(() => renderSprite({ assetId, width: frameWidth, height: frameHeight, riskTag }));
  spriteCache.set(cacheKey, rendered);
  return rendered;
}

function enqueueRender(task: () => ToyAssetSprite): Promise<ToyAssetSprite> {
  const rendered = renderQueue.then(task);
  renderQueue = rendered.then(
    () => undefined,
    () => undefined,
  );
  return rendered;
}

function renderSprite({
  assetId,
  width,
  height,
  riskTag,
}: {
  assetId: string;
  width: number;
  height: number;
  riskTag: RiskTag;
}): ToyAssetSprite {
  if (typeof document === "undefined") {
    return createEmptySprite(width, height);
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = getSharedRenderer(width, height, pixelRatio);

  const scene = new THREE.Scene();
  const camera = createCamera(width / height, assetId);
  const root = buildToyAsset(assetId, riskTag);
  normalizeModel(root, assetId);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.ShadowMaterial({ color: 0x2a2118, opacity: 0.28 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.012;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.AmbientLight(0xfff3dc, 2.3));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.6);
  keyLight.position.set(-3.8, 6.8, 4.7);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.radius = 4;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 16;
  keyLight.shadow.camera.left = -4;
  keyLight.shadow.camera.right = 4;
  keyLight.shadow.camera.top = 4;
  keyLight.shadow.camera.bottom = -4;
  keyLight.shadow.bias = -0.00018;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xb7e6ff, 1);
  rimLight.position.set(3.5, 3.2, -4.4);
  scene.add(rimLight);

  scene.add(root);
  renderer.render(scene, camera);

  const cropped = cropTransparentPixels(renderer.domElement, pixelRatio, {
    x: width / 2,
    y: height * 0.77,
  });
  disposeScene(scene);

  return {
    dataUrl: cropped.dataUrl,
    width: cropped.width,
    height: cropped.height,
    anchorX: cropped.anchorX,
    anchorY: cropped.anchorY,
  };
}

function cropTransparentPixels(
  source: HTMLCanvasElement,
  pixelRatio: number,
  anchor: { x: number; y: number },
): ToyAssetSprite {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {
      dataUrl: source.toDataURL("image/png"),
      width: source.width / pixelRatio,
      height: source.height / pixelRatio,
      anchorX: anchor.x,
      anchorY: anchor.y,
    };
  }

  const imageData = context.getImageData(0, 0, source.width, source.height);
  const pixels = imageData.data;
  let minX = source.width;
  let minY = source.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const alpha = pixels[(y * source.width + x) * 4 + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return {
      dataUrl: source.toDataURL("image/png"),
      width: source.width / pixelRatio,
      height: source.height / pixelRatio,
      anchorX: anchor.x,
      anchorY: anchor.y,
    };
  }

  const padding = Math.round(8 * pixelRatio);
  const cropX = Math.max(0, minX - padding);
  const cropY = Math.max(0, minY - padding);
  const cropRight = Math.min(source.width, maxX + padding);
  const cropBottom = Math.min(source.height, maxY + padding);
  const cropWidth = Math.max(1, cropRight - cropX);
  const cropHeight = Math.max(1, cropBottom - cropY);
  const target = document.createElement("canvas");

  target.width = cropWidth;
  target.height = cropHeight;
  target
    .getContext("2d")
    ?.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  return {
    dataUrl: target.toDataURL("image/png"),
    width: cropWidth / pixelRatio,
    height: cropHeight / pixelRatio,
    anchorX: anchor.x - cropX / pixelRatio,
    anchorY: anchor.y - cropY / pixelRatio,
  };
}

function getSharedRenderer(width: number, height: number, pixelRatio: number): THREE.WebGLRenderer {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
  }

  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: sharedCanvas,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    sharedRenderer.setClearColor(0x000000, 0);
    sharedRenderer.outputColorSpace = THREE.SRGBColorSpace;
    sharedRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    sharedRenderer.toneMappingExposure = 1.18;
    sharedRenderer.shadowMap.enabled = true;
    sharedRenderer.shadowMap.type = THREE.VSMShadowMap;
  }

  sharedRenderer.setPixelRatio(pixelRatio);
  sharedRenderer.setSize(width, height, false);
  return sharedRenderer;
}

function createCamera(aspect: number, assetId: string): THREE.OrthographicCamera {
  const viewHeight = getCameraViewHeight(assetId);
  const camera = new THREE.OrthographicCamera(
    (-viewHeight * aspect) / 2,
    (viewHeight * aspect) / 2,
    viewHeight / 2,
    -viewHeight / 2,
    0.1,
    100,
  );
  camera.position.set(4.2, 3.5, 5.2);
  camera.lookAt(0, 0.72, 0);
  return camera;
}

function getCameraViewHeight(assetId: string): number {
  if (assetId === "env_bridge" || assetId === "env_fence" || assetId === "nature_water") {
    return 2.9;
  }
  if (assetId === "env_tower" || assetId === "nature_tree") {
    return 3.55;
  }
  if (assetId === "nature_sun" || assetId === "symbol_light") {
    return 3.15;
  }
  return 3.05;
}

function buildToyAsset(assetId: string, riskTag: RiskTag): THREE.Group {
  const group = new THREE.Group();

  switch (assetId) {
    case "person_child":
      buildPerson(group, "#5fb4e4", "#f0bd84", 0.88);
      break;
    case "person_adult":
      buildPerson(group, "#3c7296", "#d99a65", 1);
      break;
    case "person_elder":
      buildPerson(group, "#8a7c70", "#ddb487", 0.96, true);
      break;
    case "animal_dog":
      buildDog(group);
      break;
    case "animal_bird":
      buildBird(group);
      break;
    case "animal_fish":
      buildFish(group);
      break;
    case "animal_lion":
      buildLion(group);
      break;
    case "env_house":
      buildHouse(group);
      break;
    case "env_bridge":
      buildBridge(group);
      break;
    case "env_fence":
      buildFence(group);
      break;
    case "env_tower":
      buildTower(group);
      break;
    case "nature_tree":
      buildTree(group);
      break;
    case "nature_water":
      buildWater(group);
      break;
    case "nature_rock":
      buildRock(group);
      break;
    case "nature_sun":
      buildSun(group);
      break;
    case "symbol_monster":
      buildMonster(group);
      break;
    case "symbol_robot":
      buildRobot(group);
      break;
    case "symbol_skull":
      buildSkull(group);
      break;
    case "symbol_light":
      buildLight(group);
      break;
    default:
      buildFallback(group, riskTag);
      break;
  }

  return group;
}

function normalizeModel(group: THREE.Group, assetId: string): void {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const targetWidth = getTargetModelWidth(assetId);
  const targetHeight = getTargetModelHeight(assetId);
  const scale = Math.min(targetWidth / Math.max(size.x, size.z, 0.001), targetHeight / Math.max(size.y, 0.001));

  group.scale.setScalar(scale);
  group.position.x -= center.x * scale;
  group.position.z -= center.z * scale;

  const scaledBox = new THREE.Box3().setFromObject(group);
  group.position.y -= scaledBox.min.y;
  group.rotation.y = -0.22;
}

function getTargetModelWidth(assetId: string): number {
  if (assetId === "env_bridge" || assetId === "env_fence" || assetId === "nature_water") {
    return 2.42;
  }
  if (assetId === "env_house") {
    return 1.72;
  }
  if (assetId === "animal_fish" || assetId === "animal_dog" || assetId === "animal_lion") {
    return 1.78;
  }
  return 1.45;
}

function getTargetModelHeight(assetId: string): number {
  if (assetId === "env_tower" || assetId === "nature_tree") {
    return 2.42;
  }
  if (assetId === "symbol_light" || assetId === "nature_sun") {
    return 1.85;
  }
  if (assetId === "env_house") {
    return 1.82;
  }
  return 1.62;
}

function buildPerson(group: THREE.Group, cloth: string, skin: string, scale: number, elder = false): void {
  const body = addRoundedBox(group, [0.64, 0.82, 0.44], [0, 0.58, 0], cloth, 0.16);
  body.scale.setScalar(scale);
  addCapsule(group, 0.13 * scale, 0.48 * scale, [-0.44 * scale, 0.52 * scale, 0.02], skin, [0.1, 0, -0.55]);
  addCapsule(group, 0.13 * scale, 0.48 * scale, [0.44 * scale, 0.52 * scale, 0.02], skin, [0.1, 0, 0.55]);
  addCapsule(group, 0.12 * scale, 0.28 * scale, [-0.19 * scale, 0.12 * scale, 0], "#594031", [0, 0, 0]);
  addCapsule(group, 0.12 * scale, 0.28 * scale, [0.19 * scale, 0.12 * scale, 0], "#594031", [0, 0, 0]);
  addSphere(group, [0, 1.22 * scale, 0.02], [0.34 * scale, 0.36 * scale, 0.34 * scale], skin);
  addSphere(group, [-0.08 * scale, 1.42 * scale, 0], [0.27 * scale, 0.12 * scale, 0.28 * scale], elder ? "#f4f0df" : "#5a3b2a");
  addEyes(group, 0, 1.24 * scale, 0.31 * scale, 0.13 * scale, 0.75 * scale);
  addMouth(group, 1.1 * scale, 0.32 * scale, 0.62 * scale);

  if (elder) {
    addCylinder(group, 0.028, 0.028, 1, [0.58 * scale, 0.44 * scale, 0.2 * scale], "#6a452d", [0.18, 0, -0.18]);
    addSphere(group, [0.58 * scale, 0.94 * scale, 0.2 * scale], [0.07 * scale, 0.07 * scale, 0.07 * scale], "#6a452d");
  }

  addHighlight(group, [-0.17 * scale, 1.34 * scale, 0.28 * scale], [0.09 * scale, 0.035 * scale, 0.018 * scale]);
}

function buildDog(group: THREE.Group): void {
  addCapsule(group, 0.34, 0.88, [-0.18, 0.48, 0], "#bd7a43", [0, 0, Math.PI / 2]);
  addSphere(group, [0.55, 0.66, 0.09], [0.36, 0.34, 0.32], "#d79858");
  addSphere(group, [0.38, 0.86, 0.06], [0.14, 0.22, 0.08], "#765036");
  addSphere(group, [0.68, 0.86, 0.06], [0.14, 0.22, 0.08], "#765036");
  addSphere(group, [0.83, 0.61, 0.14], [0.12, 0.09, 0.1], "#543823");
  addEyes(group, 0.58, 0.75, 0.37, 0.11, 0.62);
  addMouth(group, 0.61, 0.39, 0.48, 0.022);
  addTail(group, [-0.88, 0.75, -0.02], "#765036");
  [-0.52, -0.1, 0.25, 0.55].forEach((x) => {
    addCapsule(group, 0.075, 0.28, [x, 0.16, 0.12], "#8d5b35");
  });
}

function buildBird(group: THREE.Group): void {
  addSphere(group, [0, 0.68, 0], [0.52, 0.44, 0.4], "#559bd0");
  addSphere(group, [-0.24, 0.65, 0.12], [0.34, 0.16, 0.08], "#8dd0ef", [0.1, 0.1, -0.35]);
  addCone(group, 0.13, 0.28, [0.5, 0.72, 0.18], "#eaa541", [Math.PI / 2, 0, -Math.PI / 2], 24);
  addEyes(group, 0.2, 0.8, 0.35, 0.1, 0.58);
  addTube(group, [[-0.14, 0.16, 0.08], [-0.2, 0.02, 0.18]], "#7a4b2d", 0.025);
  addTube(group, [[0.14, 0.16, 0.08], [0.2, 0.02, 0.18]], "#7a4b2d", 0.025);
}

function buildFish(group: THREE.Group): void {
  addSphere(group, [0.18, 0.48, 0], [0.66, 0.34, 0.3], "#36a4af");
  addCone(group, 0.34, 0.52, [-0.68, 0.48, 0], "#2b7f88", [0, 0, Math.PI / 2], 3);
  addSphere(group, [0.08, 0.78, 0.02], [0.26, 0.08, 0.18], "#82d8dc", [-0.25, 0, 0.2]);
  addEyes(group, 0.52, 0.56, 0.3, 0.08, 0.54);
  addHighlight(group, [0.16, 0.67, 0.25], [0.18, 0.035, 0.018]);
}

function buildLion(group: THREE.Group): void {
  addCapsule(group, 0.3, 0.8, [-0.18, 0.44, 0], "#c5883f", [0, 0, Math.PI / 2]);
  addSphere(group, [0.55, 0.72, 0.04], [0.46, 0.46, 0.36], "#8b582d");
  addSphere(group, [0.59, 0.71, 0.18], [0.31, 0.29, 0.25], "#d4a150");
  addSphere(group, [0.38, 1.02, 0.06], [0.13, 0.16, 0.08], "#8b582d");
  addSphere(group, [0.74, 1.02, 0.06], [0.13, 0.16, 0.08], "#8b582d");
  addEyes(group, 0.58, 0.78, 0.4, 0.1, 0.56);
  addMouth(group, 0.62, 0.43, 0.5, 0.024);
  addTail(group, [-0.84, 0.62, -0.02], "#8b582d");
  addSphere(group, [-1.06, 0.72, 0.02], [0.11, 0.11, 0.11], "#8b582d");
}

function buildHouse(group: THREE.Group): void {
  addRoundedBox(group, [1.38, 0.9, 1.08], [0, 0.45, 0], "#e7b777", 0.09);
  addCone(group, 1.05, 0.68, [0, 1.12, 0], "#d9513d", [0, Math.PI / 4, 0], 4);
  addRoundedBox(group, [0.24, 0.46, 0.04], [0, 0.28, 0.56], "#73462b", 0.03);
  addWindow(group, [-0.38, 0.55, 0.57]);
  addWindow(group, [0.38, 0.55, 0.57]);
  addHighlight(group, [-0.36, 1.28, 0.28], [0.24, 0.035, 0.02]);
}

function buildBridge(group: THREE.Group): void {
  addRoundedBox(group, [2.1, 0.18, 0.56], [0, 0.22, 0], "#c7975c", 0.08);
  [-0.76, 0, 0.76].forEach((x) => {
    addCylinder(group, 0.07, 0.07, 0.82, [x, 0.67, -0.24], "#7b573a");
    addCylinder(group, 0.07, 0.07, 0.82, [x, 0.67, 0.24], "#7b573a");
  });
  addTube(group, [[-0.96, 0.78, 0.3], [-0.48, 1.12, 0.3], [0.48, 1.12, 0.3], [0.96, 0.78, 0.3]], "#b88754", 0.055);
  addTube(group, [[-0.96, 0.78, -0.3], [-0.48, 1.12, -0.3], [0.48, 1.12, -0.3], [0.96, 0.78, -0.3]], "#8e6543", 0.055);
  [-0.72, -0.36, 0, 0.36, 0.72].forEach((x) => {
    addRoundedBox(group, [0.12, 0.08, 0.62], [x, 0.38, 0], "#e3b477", 0.03);
  });
}

function buildFence(group: THREE.Group): void {
  [-0.96, -0.48, 0, 0.48, 0.96].forEach((x) => {
    addRoundedBox(group, [0.16, 0.86, 0.16], [x, 0.46, 0], "#c7905e", 0.05);
    addCone(group, 0.13, 0.18, [x, 0.96, 0], "#f0ba77", [0, 0, 0], 4);
  });
  addRoundedBox(group, [2.18, 0.12, 0.18], [0, 0.7, 0.02], "#a46e43", 0.04);
  addRoundedBox(group, [2.18, 0.12, 0.18], [0, 0.35, 0.02], "#d9a066", 0.04);
}

function buildTower(group: THREE.Group): void {
  addRoundedBox(group, [0.72, 1.72, 0.72], [0, 0.86, 0], "#99a4aa", 0.11);
  addCone(group, 0.58, 0.56, [0, 2.03, 0], "#51687a", [0, Math.PI / 4, 0], 4);
  addRoundedBox(group, [0.24, 0.42, 0.035], [0, 0.35, 0.38], "#4b3931", 0.03);
  addWindow(group, [0, 0.94, 0.39], "#f2ce6d");
  [-0.28, 0.28].forEach((x) => {
    addCylinder(group, 0.06, 0.06, 0.28, [x, 1.84, 0.34], "#5f676a");
  });
}

function buildTree(group: THREE.Group): void {
  addCylinder(group, 0.16, 0.2, 0.72, [0, 0.36, 0], "#8a5a32");
  addSphere(group, [0, 0.96, 0], [0.72, 0.44, 0.66], "#3f8f56");
  addSphere(group, [-0.23, 1.28, 0.02], [0.58, 0.4, 0.54], "#5fbf70");
  addSphere(group, [0.16, 1.58, 0.02], [0.46, 0.34, 0.42], "#9be98e");
  addSphere(group, [-0.42, 0.8, 0.16], [0.24, 0.2, 0.2], "#63c472");
  addSphere(group, [0.36, 1.05, 0.26], [0.06, 0.06, 0.06], "#e66b46");
}

function buildWater(group: THREE.Group): void {
  addCylinder(group, 0.96, 1.08, 0.14, [0, 0.08, 0], "#54b7d0", [0, 0, 0], 56, true);
  addSphere(group, [-0.36, 0.16, 0.08], [0.48, 0.045, 0.18], "#dffbff", [0, 0, 0], false, true);
  addSphere(group, [0.28, 0.15, -0.02], [0.42, 0.04, 0.16], "#238ca5", [0, 0, 0], false, true);
  addTube(group, [[-0.76, 0.18, 0.2], [-0.36, 0.2, 0.02], [0.08, 0.18, 0.18], [0.58, 0.2, -0.02]], "#e8fdff", 0.035);
}

function buildRock(group: THREE.Group): void {
  const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.72, 0), createMaterial({ color: "#8d9492", roughness: 0.82 }));
  mesh.position.set(0, 0.48, 0);
  mesh.scale.set(1.1, 0.7, 0.86);
  mesh.rotation.set(0.24, 0.48, 0.1);
  finishMesh(mesh);
  group.add(mesh);
  addSphere(group, [-0.22, 0.75, 0.3], [0.18, 0.05, 0.025], "#ffffff", [0, 0, -0.3], false, true);
}

function buildSun(group: THREE.Group): void {
  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const x = Math.cos(angle) * 0.62;
    const z = Math.sin(angle) * 0.62;
    addCone(group, 0.12, 0.38, [x, 0.9 + Math.sin(angle) * 0.05, z], "#f0a830", [0, -angle, Math.PI / 2], 20);
  }
  addSphere(group, [0, 0.9, 0], [0.52, 0.52, 0.52], "#ffd25a", [0, 0, 0], true);
  addEyes(group, 0, 0.96, 0.45, 0.16, 0.7);
  addMouth(group, 0.02, 0.72, 0.48, 0.026);
}

function buildMonster(group: THREE.Group): void {
  addSphere(group, [0, 0.58, 0], [0.64, 0.66, 0.52], "#7662b6");
  addCone(group, 0.14, 0.4, [-0.35, 1.2, 0.05], "#f2b04c", [0.12, 0, -0.28], 24);
  addCone(group, 0.14, 0.4, [0.35, 1.2, 0.05], "#f2b04c", [0.12, 0, 0.28], 24);
  addCapsule(group, 0.13, 0.34, [-0.55, 0.52, 0.04], "#5e4aa2", [0, 0, 0.65]);
  addCapsule(group, 0.13, 0.34, [0.55, 0.52, 0.04], "#5e4aa2", [0, 0, -0.65]);
  addEyes(group, 0, 0.73, 0.5, 0.22, 0.82);
  addTube(group, [[-0.22, 0.46, 0.5], [-0.06, 0.36, 0.56], [0.12, 0.38, 0.54], [0.28, 0.48, 0.5]], "#2c2033", 0.035);
  addCone(group, 0.05, 0.12, [-0.02, 0.36, 0.58], "#ffffff", [Math.PI / 2, 0, 0], 16);
}

function buildRobot(group: THREE.Group): void {
  addRoundedBox(group, [0.72, 0.52, 0.52], [0, 1.03, 0], "#a9b4bf", 0.13);
  addRoundedBox(group, [0.86, 0.82, 0.56], [0, 0.43, 0], "#728390", 0.14);
  addCylinder(group, 0.035, 0.035, 0.34, [0, 1.43, 0], "#5a6570");
  addSphere(group, [0, 1.64, 0], [0.09, 0.09, 0.09], "#e96d52");
  addEyes(group, 0, 1.08, 0.29, 0.16, 0.6);
  addRoundedBox(group, [0.36, 0.06, 0.035], [0, 0.91, 0.29], "#2d3942", 0.02);
  addCapsule(group, 0.09, 0.48, [-0.58, 0.55, 0], "#6b7782", [0, 0, -0.38]);
  addCapsule(group, 0.09, 0.48, [0.58, 0.55, 0], "#6b7782", [0, 0, 0.38]);
  addCapsule(group, 0.1, 0.2, [-0.24, 0.02, 0.02], "#59666f");
  addCapsule(group, 0.1, 0.2, [0.24, 0.02, 0.02], "#59666f");
}

function buildSkull(group: THREE.Group): void {
  addSphere(group, [0, 0.78, 0], [0.54, 0.5, 0.45], "#ebe6dc");
  addRoundedBox(group, [0.46, 0.4, 0.36], [0, 0.36, 0], "#d8d2c6", 0.09);
  addSphere(group, [-0.18, 0.82, 0.39], [0.13, 0.16, 0.045], "#30343a", [0, 0, 0], false, true);
  addSphere(group, [0.18, 0.82, 0.39], [0.13, 0.16, 0.045], "#30343a", [0, 0, 0], false, true);
  addCone(group, 0.1, 0.16, [0, 0.65, 0.42], "#34383d", [Math.PI / 2, 0, Math.PI], 3);
  [-0.16, 0, 0.16].forEach((x) => {
    addRoundedBox(group, [0.035, 0.18, 0.028], [x, 0.28, 0.21], "#817a70", 0.01);
  });
}

function buildLight(group: THREE.Group): void {
  addCylinder(group, 0.25, 0.32, 0.18, [0, 0.08, 0], "#6f6657", [0, 0, 0], 32);
  addRoundedBox(group, [0.36, 0.2, 0.28], [0, 0.26, 0], "#77715e", 0.06);
  addSphere(group, [0, 0.72, 0], [0.46, 0.52, 0.46], "#ffdb73", [0, 0, 0], true);
  addCylinder(group, 0.06, 0.06, 0.88, [0, 0.5, 0], "#f5c85b", [0, 0, Math.PI / 2], 16, true);
  addEyes(group, 0, 0.8, 0.43, 0.14, 0.58);
  addMouth(group, 0, 0.6, 0.47, 0.022);
}

function buildFallback(group: THREE.Group, riskTag: RiskTag): void {
  const colorByRisk: Record<RiskTag, string> = {
    normal: "#70b8a8",
    conflict: "#d7904c",
    death: "#9ba1aa",
    fantasy: "#8d76cf",
  };
  addSphere(group, [0, 0.58, 0], [0.62, 0.62, 0.52], colorByRisk[riskTag]);
  addEyes(group, 0, 0.68, 0.48, 0.16, 0.66);
}

function addWindow(group: THREE.Group, position: [number, number, number], color = "#9bd8e9"): void {
  addRoundedBox(group, [0.22, 0.22, 0.035], position, color, 0.035, [0, 0, 0], true);
  addRoundedBox(group, [0.12, 0.02, 0.04], [position[0], position[1], position[2] + 0.012], "#ffffff", 0.006, [0, 0, 0], true);
  addRoundedBox(group, [0.02, 0.12, 0.04], [position[0], position[1], position[2] + 0.012], "#ffffff", 0.006, [0, 0, 0], true);
}

function addEyes(
  group: THREE.Group,
  centerX: number,
  centerY: number,
  z: number,
  spread: number,
  scale = 1,
): void {
  [-spread, spread].forEach((x) => {
    addSphere(group, [centerX + x, centerY, z], [0.074 * scale, 0.09 * scale, 0.025 * scale], "#fff7df", [0, 0, 0], false, true);
    addSphere(group, [centerX + x + 0.012 * scale, centerY - 0.006 * scale, z + 0.028 * scale], [0.031 * scale, 0.04 * scale, 0.014 * scale], "#25201d", [0, 0, 0], false, true);
  });
}

function addMouth(
  group: THREE.Group,
  centerX: number,
  y: number,
  z: number,
  scale = 0.03,
): void {
  addTube(
    group,
    [
      [centerX - 0.14, y + 0.02, z],
      [centerX - 0.04, y - 0.04, z + 0.015],
      [centerX + 0.12, y + 0.02, z],
    ],
    "#38251f",
    scale,
  );
}

function addTail(group: THREE.Group, start: [number, number, number], color: string): void {
  addTube(
    group,
    [
      start,
      [start[0] - 0.24, start[1] + 0.13, start[2] + 0.02],
      [start[0] - 0.1, start[1] + 0.27, start[2] + 0.04],
    ],
    color,
    0.045,
  );
}

function addRoundedBox(
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  radius = 0.08,
  rotation: [number, number, number] = [0, 0, 0],
  noShadow = false,
): THREE.Mesh {
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 5, Math.min(radius, size[0] / 2, size[1] / 2, size[2] / 2));
  const mesh = new THREE.Mesh(geometry, createMaterial({ color }));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  finishMesh(mesh, noShadow);
  group.add(mesh);
  return mesh;
}

function addSphere(
  group: THREE.Group,
  position: [number, number, number],
  scale: [number, number, number],
  color: string,
  rotation: [number, number, number] = [0, 0, 0],
  emissive = false,
  noShadow = false,
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(1, 36, 22);
  const mesh = new THREE.Mesh(
    geometry,
    createMaterial({
      color,
      roughness: emissive ? 0.38 : 0.56,
      emissive: emissive ? color : undefined,
      emissiveIntensity: emissive ? 0.32 : 0,
      transparent: noShadow && color === "#ffffff",
      opacity: noShadow && color === "#ffffff" ? 0.42 : 1,
    }),
  );
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  finishMesh(mesh, noShadow);
  group.add(mesh);
  return mesh;
}

function addCapsule(
  group: THREE.Group,
  radius: number,
  length: number,
  position: [number, number, number],
  color: string,
  rotation: [number, number, number] = [0, 0, 0],
): void {
  const geometry = new THREE.CapsuleGeometry(radius, length, 8, 24);
  const mesh = new THREE.Mesh(geometry, createMaterial({ color }));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  finishMesh(mesh);
  group.add(mesh);
}

function addCylinder(
  group: THREE.Group,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: [number, number, number],
  color: string,
  rotation: [number, number, number] = [0, 0, 0],
  radialSegments = 32,
  noShadow = false,
): void {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1);
  const mesh = new THREE.Mesh(geometry, createMaterial({ color }));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  finishMesh(mesh, noShadow);
  group.add(mesh);
}

function addCone(
  group: THREE.Group,
  radius: number,
  height: number,
  position: [number, number, number],
  color: string,
  rotation: [number, number, number] = [0, 0, 0],
  radialSegments = 32,
): void {
  const geometry = new THREE.ConeGeometry(radius, height, radialSegments);
  const mesh = new THREE.Mesh(geometry, createMaterial({ color }));
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  finishMesh(mesh);
  group.add(mesh);
}

function addTube(
  group: THREE.Group,
  points: Array<[number, number, number]>,
  color: string,
  radius: number,
): void {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const geometry = new THREE.TubeGeometry(curve, 20, radius, 9, false);
  const mesh = new THREE.Mesh(geometry, createMaterial({ color, roughness: 0.5 }));
  finishMesh(mesh);
  group.add(mesh);
}

function addHighlight(
  group: THREE.Group,
  position: [number, number, number],
  scale: [number, number, number],
): void {
  addSphere(group, position, scale, "#ffffff", [0, 0, -0.2], false, true);
}

function createMaterial({
  color,
  roughness = 0.58,
  metalness = 0.03,
  emissive,
  emissiveIntensity = 0,
  transparent = false,
  opacity = 1,
}: MeshOptions): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: emissive ?? "#000000",
    emissiveIntensity,
    metalness,
    opacity,
    roughness,
    transparent,
  });
}

function finishMesh(mesh: THREE.Mesh, noShadow = false): void {
  mesh.castShadow = !noShadow;
  mesh.receiveShadow = !noShadow;
}

function disposeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    object.geometry.dispose();
    const material = object.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material.dispose();
    }
  });
}

function createEmptySprite(width: number, height: number): ToyAssetSprite {
  return {
    dataUrl:
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" />`),
    width,
    height,
    anchorX: width / 2,
    anchorY: height * 0.77,
  };
}
