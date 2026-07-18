import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { getToyAssetSpec } from "../data/toyAssetSpecs";
import type { RiskTag, ToyAssetSpec, ToyModelRecipe } from "../types";

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
  sheen?: number;
  clearcoat?: number;
  transparent?: boolean;
  opacity?: number;
}

const SPRITE_VERSION = "toy-render-v54-borderless-island-premium-toy-sprites";
const SPRITE_LOGICAL_FRAME_FILL = 0.55;
const spriteCache = new Map<string, Promise<ToyAssetSprite>>();
let renderQueue: Promise<void> = Promise.resolve();
let sharedRenderer: THREE.WebGLRenderer | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;
let clayBumpTexture: THREE.CanvasTexture | null = null;
let clayRoughnessTexture: THREE.CanvasTexture | null = null;
let studioEnvironmentTexture: THREE.CanvasTexture | null = null;

export function renderToyAssetSprite({
  assetId,
  width,
  height,
  riskTag,
}: ToyAssetRenderRequest): Promise<ToyAssetSprite> {
  const spec = getToyAssetSpec(assetId, riskTag);
  const frameWidth = Math.max(272, Math.round(width * 3.34));
  const frameHeight = Math.max(272, Math.round(height * 3.4));
  const cacheKey = `${SPRITE_VERSION}:${assetId}:${riskTag}:${frameWidth}x${frameHeight}:${spec.thumbnailScale}`;
  const cached = spriteCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const rendered = enqueueRender(() =>
    renderSprite({
      width: frameWidth,
      height: frameHeight,
      displayWidth: width / SPRITE_LOGICAL_FRAME_FILL,
      displayHeight: height / SPRITE_LOGICAL_FRAME_FILL,
      riskTag,
      spec,
    }),
  );
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
  width,
  height,
  displayWidth,
  displayHeight,
  riskTag,
  spec,
}: {
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  riskTag: RiskTag;
  spec: ToyAssetSpec;
}): ToyAssetSprite {
  if (typeof document === "undefined") {
    return createEmptySprite(width, height);
  }

  const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 2.18), 2.72);
  const renderer = getSharedRenderer(width, height, pixelRatio);
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.environment = getStudioEnvironmentTexture();
  const camera = createCamera(width / height, spec);
  const root = buildToyAsset(spec, riskTag);
  normalizeModel(root, spec);
  applyModelStudioFinish(root);

  scene.add(new THREE.AmbientLight(0xffefd7, 0.15));
  scene.add(new THREE.HemisphereLight(0xfff8e8, 0x72b3b0, 0.5));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.55);
  keyLight.position.set(-4.8, 8.9, 7.8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1536, 1536);
  keyLight.shadow.radius = 5.4;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 16;
  keyLight.shadow.camera.left = -4;
  keyLight.shadow.camera.right = 4;
  keyLight.shadow.camera.top = 4;
  keyLight.shadow.camera.bottom = -4;
  keyLight.shadow.bias = -0.00018;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xd8fbff, 0.92);
  rimLight.position.set(4.2, 3.7, -5.4);
  scene.add(rimLight);

  const warmFill = new THREE.DirectionalLight(0xffd8a6, 0.34);
  warmFill.position.set(2.8, 2.4, 3.4);
  scene.add(warmFill);

  const frontalSpark = new THREE.DirectionalLight(0xffffff, 0.27);
  frontalSpark.position.set(-1.4, 2.8, 7.8);
  scene.add(frontalSpark);

  const studioCatch = new THREE.DirectionalLight(0xfffbef, 0.16);
  studioCatch.position.set(-2.6, 6.2, 7.8);
  scene.add(studioCatch);

  scene.add(root);
  renderer.render(scene, camera);

  const polishedCanvas = addSpriteEdgePolish(renderer.domElement, pixelRatio);
  const cropped = cropTransparentPixels(polishedCanvas, pixelRatio, {
    x: width * spec.anchor.x,
    y: height * spec.anchor.y,
  }, {
    x: displayWidth / width,
    y: displayHeight / height,
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

function addSpriteEdgePolish(source: HTMLCanvasElement, pixelRatio: number): HTMLCanvasElement {
  source = createColorGradedSpriteSource(source);

  const target = document.createElement("canvas");
  const mask = document.createElement("canvas");
  const outlineMask = document.createElement("canvas");
  const warmMask = document.createElement("canvas");
  const highlightMask = document.createElement("canvas");
  const textureMask = document.createElement("canvas");
  const context = target.getContext("2d");
  const maskContext = mask.getContext("2d");
  const outlineContext = outlineMask.getContext("2d");
  const warmContext = warmMask.getContext("2d");
  const highlightContext = highlightMask.getContext("2d");
  const textureContext = textureMask.getContext("2d");

  target.width = source.width;
  target.height = source.height;
  mask.width = source.width;
  mask.height = source.height;
  outlineMask.width = source.width;
  outlineMask.height = source.height;
  warmMask.width = source.width;
  warmMask.height = source.height;
  highlightMask.width = source.width;
  highlightMask.height = source.height;
  textureMask.width = source.width;
  textureMask.height = source.height;

  if (!context || !maskContext || !outlineContext || !warmContext || !highlightContext || !textureContext) {
    return source;
  }

  maskContext.drawImage(source, 0, 0);
  maskContext.globalCompositeOperation = "source-in";
  maskContext.fillStyle = "rgba(42, 31, 22, 0.24)";
  maskContext.fillRect(0, 0, mask.width, mask.height);

  outlineContext.drawImage(source, 0, 0);
  outlineContext.globalCompositeOperation = "source-in";
  outlineContext.fillStyle = "rgba(32, 24, 18, 0.7)";
  outlineContext.fillRect(0, 0, outlineMask.width, outlineMask.height);

  warmContext.drawImage(source, 0, 0);
  warmContext.globalCompositeOperation = "source-in";
  warmContext.fillStyle = "rgba(255, 247, 222, 0.2)";
  warmContext.fillRect(0, 0, warmMask.width, warmMask.height);

  highlightContext.drawImage(source, 0, 0);
  highlightContext.globalCompositeOperation = "source-atop";
  const radialHighlight = highlightContext.createRadialGradient(
    source.width * 0.32,
    source.height * 0.22,
    source.width * 0.02,
    source.width * 0.34,
    source.height * 0.22,
    source.width * 0.54,
  );
  radialHighlight.addColorStop(0, "rgba(255, 255, 248, 0.15)");
  radialHighlight.addColorStop(0.52, "rgba(255, 248, 224, 0.04)");
  radialHighlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  highlightContext.fillStyle = radialHighlight;
  highlightContext.fillRect(0, 0, source.width, source.height);

  textureContext.drawImage(source, 0, 0);
  textureContext.globalCompositeOperation = "source-atop";
  let textureSeed = 911;
  for (let index = 0; index < 920; index += 1) {
    textureSeed = (textureSeed * 1664525 + 1013904223) % 4294967296;
    const x = (textureSeed / 4294967296) * source.width;
    textureSeed = (textureSeed * 1664525 + 1013904223) % 4294967296;
    const y = (textureSeed / 4294967296) * source.height;
    textureSeed = (textureSeed * 1664525 + 1013904223) % 4294967296;
    const light = index % 3 !== 0;
    const alpha = 0.022 + (textureSeed / 4294967296) * 0.04;
    textureContext.fillStyle = light ? `rgba(255, 250, 229, ${alpha})` : `rgba(55, 40, 28, ${alpha * 0.36})`;
    textureContext.fillRect(x, y, 0.9 * pixelRatio, 0.9 * pixelRatio);
  }
  textureContext.globalCompositeOperation = "source-over";

  context.save();
  context.filter = `blur(${4.2 * pixelRatio}px)`;
  context.globalAlpha = 0.04;
  context.fillStyle = "rgba(54, 38, 24, 0.24)";
  context.beginPath();
  context.ellipse(
    source.width * 0.52,
    source.height * 0.835,
    source.width * 0.28,
    source.height * 0.066,
    -0.08,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  const crispOutlineOffsets = [
    [-1.35, 0],
    [1.35, 0],
    [0, -1.15],
    [0, 1.35],
    [-1.05, -0.8],
    [1.05, -0.8],
    [-1.1, 1.05],
    [1.1, 1.05],
  ].map(([x, y]) => [x * pixelRatio, y * pixelRatio]);

  context.save();
  context.globalAlpha = 0.37;
  crispOutlineOffsets.forEach(([x, y]) => {
    context.drawImage(outlineMask, x, y);
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.filter = `blur(${0.8 * pixelRatio}px)`;
  context.globalAlpha = 0.028;
  context.drawImage(warmMask, -1.6 * pixelRatio, -2.4 * pixelRatio);
  context.restore();

  const haloOffsets = [
    [-1.3, -0.4],
    [1.3, -0.4],
    [-1.5, 1.1],
    [1.5, 1.1],
    [0, 1.7],
  ].map(([x, y]) => [x * pixelRatio, y * pixelRatio]);

  context.save();
  context.filter = `blur(${1.25 * pixelRatio}px)`;
  context.globalAlpha = 0.042;
  haloOffsets.forEach(([x, y]) => {
    context.drawImage(mask, x, y);
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  context.filter = `blur(${2.7 * pixelRatio}px)`;
  context.globalAlpha = 0.032;
  context.drawImage(warmMask, -1.9 * pixelRatio, -2.4 * pixelRatio);
  context.restore();

  const offsets = [
    [0, 1.25],
    [1.1, 0.65],
    [-0.8, 0.72],
  ].map(([x, y]) => [x * pixelRatio, y * pixelRatio]);

  context.save();
  context.globalAlpha = 0.23;
  offsets.forEach(([x, y]) => {
    context.drawImage(mask, x, y);
  });
  context.restore();

  const undersideGradient = context.createLinearGradient(0, source.height * 0.4, 0, source.height);
  undersideGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  undersideGradient.addColorStop(0.72, "rgba(44, 30, 18, 0.072)");
  undersideGradient.addColorStop(1, "rgba(34, 24, 15, 0.26)");
  context.save();
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
  context.drawImage(source, 0, 0);
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = undersideGradient;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "soft-light";
  context.globalAlpha = 0.22;
  context.drawImage(textureMask, 0, 0);
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.filter = `blur(${1.6 * pixelRatio}px)`;
  context.globalAlpha = 0.026;
  const footBounce = context.createLinearGradient(0, source.height * 0.5, 0, source.height);
  footBounce.addColorStop(0, "rgba(255, 255, 255, 0)");
  footBounce.addColorStop(0.72, "rgba(255, 240, 196, 0.055)");
  footBounce.addColorStop(1, "rgba(255, 229, 174, 0.26)");
  context.drawImage(warmMask, 0, 0);
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = footBounce;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "destination-over";
  context.shadowColor = "rgba(86, 61, 35, 0.16)";
  context.shadowBlur = 2.1 * pixelRatio;
  context.shadowOffsetX = 0.35 * pixelRatio;
  context.shadowOffsetY = 0.85 * pixelRatio;
  context.globalAlpha = 0.035;
  context.drawImage(mask, 0, 0);
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.052;
  context.drawImage(highlightMask, 0, 0);
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-atop";
  const rimGradient = context.createLinearGradient(0, 0, source.width, source.height);
  rimGradient.addColorStop(0, "rgba(255, 252, 232, 0.08)");
  rimGradient.addColorStop(0.44, "rgba(255, 255, 255, 0)");
  rimGradient.addColorStop(1, "rgba(17, 11, 8, 0.08)");
  context.fillStyle = rimGradient;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  applyDirectionalVolumePass(context, source, pixelRatio);
  applyPremiumSpriteGlaze(context, source, pixelRatio);
  applyPremiumToyCutoutFinish(context, source, pixelRatio);
  applyPremiumToyCavityPass(context, source, pixelRatio);
  applyPremiumToyGroundingPass(context, source, pixelRatio);
  applyPremiumToySpecularPass(context, source, pixelRatio);
  applyPremiumToyCrispStudioPass(context, source, pixelRatio);
  constrainSpriteToExpandedAlpha(context, source, pixelRatio);

  return target;
}

function constrainSpriteToExpandedAlpha(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  pixelRatio: number,
): void {
  const alphaMask = document.createElement("canvas");
  const alphaContext = alphaMask.getContext("2d");

  alphaMask.width = source.width;
  alphaMask.height = source.height;

  if (!alphaContext) {
    return;
  }

  alphaContext.save();
  alphaContext.filter = `blur(${1.35 * pixelRatio}px)`;
  alphaContext.globalAlpha = 0.94;
  alphaContext.drawImage(source, 0, 0);
  alphaContext.restore();

  const offsets = [
    [-1.6, 0],
    [1.6, 0],
    [0, -1.4],
    [0, 1.8],
    [-1.15, -1.15],
    [1.15, -1.15],
    [-1.15, 1.15],
    [1.15, 1.15],
  ].map(([x, y]) => [x * pixelRatio, y * pixelRatio]);

  alphaContext.save();
  alphaContext.globalAlpha = 0.82;
  offsets.forEach(([x, y]) => {
    alphaContext.drawImage(source, x, y);
  });
  alphaContext.restore();

  alphaContext.save();
  alphaContext.globalCompositeOperation = "source-over";
  alphaContext.drawImage(source, 0, 0);
  alphaContext.restore();

  alphaContext.save();
  alphaContext.globalCompositeOperation = "source-over";
  alphaContext.filter = `blur(${2.6 * pixelRatio}px)`;
  const contactAlpha = alphaContext.createRadialGradient(
    source.width * 0.52,
    source.height * 0.835,
    1,
    source.width * 0.52,
    source.height * 0.835,
    source.width * 0.28,
  );
  contactAlpha.addColorStop(0, "rgba(0,0,0,0.3)");
  contactAlpha.addColorStop(0.56, "rgba(0,0,0,0.17)");
  contactAlpha.addColorStop(1, "rgba(0,0,0,0)");
  alphaContext.fillStyle = contactAlpha;
  alphaContext.beginPath();
  alphaContext.ellipse(
    source.width * 0.52,
    source.height * 0.835,
    source.width * 0.31,
    source.height * 0.068,
    -0.08,
    0,
    Math.PI * 2,
  );
  alphaContext.fill();
  alphaContext.restore();

  context.save();
  context.globalCompositeOperation = "destination-in";
  context.drawImage(alphaMask, 0, 0);
  context.restore();
}

function applyDirectionalVolumePass(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  pixelRatio: number,
): void {
  context.save();
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = 0.52;
  const volumeShade = context.createLinearGradient(0, 0, source.width, source.height);
  volumeShade.addColorStop(0, "rgba(255,255,255,0)");
  volumeShade.addColorStop(0.42, "rgba(255,255,255,0)");
  volumeShade.addColorStop(0.62, "rgba(58,38,25,0.14)");
  volumeShade.addColorStop(1, "rgba(30,20,14,0.44)");
  context.fillStyle = volumeShade;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.04;
  context.filter = `blur(${0.72 * pixelRatio}px)`;
  const keyHighlight = context.createRadialGradient(
    source.width * 0.26,
    source.height * 0.2,
    source.width * 0.02,
    source.width * 0.28,
    source.height * 0.2,
    source.width * 0.56,
  );
  keyHighlight.addColorStop(0, "rgba(255,255,250,0.13)");
  keyHighlight.addColorStop(0.42, "rgba(255,247,220,0.035)");
  keyHighlight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = keyHighlight;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = 0.075;
  context.filter = `blur(${0.35 * pixelRatio}px)`;
  const lowerBounce = context.createLinearGradient(0, source.height * 0.6, 0, source.height);
  lowerBounce.addColorStop(0, "rgba(255,255,255,0)");
  lowerBounce.addColorStop(0.78, "rgba(255,232,178,0.08)");
  lowerBounce.addColorStop(1, "rgba(255,222,154,0.18)");
  context.fillStyle = lowerBounce;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();
}

function applyPremiumSpriteGlaze(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  pixelRatio: number,
): void {
  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.028;
  context.filter = `blur(${0.6 * pixelRatio}px)`;
  const topGlaze = context.createRadialGradient(
    source.width * 0.24,
    source.height * 0.18,
    source.width * 0.02,
    source.width * 0.24,
    source.height * 0.18,
    source.width * 0.42,
  );
  topGlaze.addColorStop(0, "rgba(255,255,248,0.1)");
  topGlaze.addColorStop(0.38, "rgba(255,248,218,0.026)");
  topGlaze.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = topGlaze;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.globalAlpha = 0.33;
  const lowerOcclusion = context.createLinearGradient(0, source.height * 0.52, 0, source.height);
  lowerOcclusion.addColorStop(0, "rgba(255,255,255,0)");
  lowerOcclusion.addColorStop(0.62, "rgba(67,44,28,0.15)");
  lowerOcclusion.addColorStop(1, "rgba(35,22,14,0.42)");
  context.fillStyle = lowerOcclusion;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.052;
  context.filter = `blur(${0.12 * pixelRatio}px)`;
  const sparkles: Array<[number, number, number]> = [
    [0.32, 0.2, 1],
    [0.43, 0.28, 0.72],
    [0.25, 0.36, 0.62],
    [0.56, 0.22, 0.5],
  ];
  sparkles.forEach(([x, y, scale]) => {
    context.beginPath();
    context.ellipse(
      source.width * x,
      source.height * y,
      Math.max(1.1, 2.25 * pixelRatio * scale),
      Math.max(0.55, 0.92 * pixelRatio * scale),
      -0.34,
      0,
      Math.PI * 2,
    );
    context.fillStyle = "rgba(255,255,248,0.28)";
    context.fill();
  });
  context.restore();
}

function applyPremiumToyCutoutFinish(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  pixelRatio: number,
): void {
  context.save();
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = 0.34;
  const sculptedLight = context.createLinearGradient(source.width * 0.1, 0, source.width * 0.86, source.height);
  sculptedLight.addColorStop(0, "rgba(255,255,246,0.08)");
  sculptedLight.addColorStop(0.36, "rgba(255,247,222,0.015)");
  sculptedLight.addColorStop(0.68, "rgba(49,34,23,0.12)");
  sculptedLight.addColorStop(1, "rgba(24,17,12,0.34)");
  context.fillStyle = sculptedLight;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.052;
  context.filter = `blur(${0.28 * pixelRatio}px)`;
  const studioSpecular = context.createRadialGradient(
    source.width * 0.28,
    source.height * 0.22,
    source.width * 0.012,
    source.width * 0.28,
    source.height * 0.22,
    source.width * 0.32,
  );
  studioSpecular.addColorStop(0, "rgba(255,255,255,0.16)");
  studioSpecular.addColorStop(0.32, "rgba(255,248,218,0.05)");
  studioSpecular.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = studioSpecular;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "destination-over";
  context.globalAlpha = 0.052;
  context.shadowColor = "rgba(40, 28, 16, 0.16)";
  context.shadowBlur = 2.4 * pixelRatio;
  context.shadowOffsetX = 0.65 * pixelRatio;
  context.shadowOffsetY = 1.4 * pixelRatio;
  context.drawImage(source, 0, 0);
  context.restore();

  context.save();
  context.globalCompositeOperation = "destination-over";
  context.filter = `blur(${3.8 * pixelRatio}px)`;
  context.globalAlpha = 0.044;
  context.fillStyle = "rgba(70, 46, 26, 0.42)";
  context.beginPath();
  context.ellipse(
    source.width * 0.52,
    source.height * 0.84,
    source.width * 0.22,
    source.height * 0.048,
    -0.12,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function applyPremiumToyCavityPass(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  pixelRatio: number,
): void {
  context.save();
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = 0.36;
  context.filter = `blur(${0.18 * pixelRatio}px)`;
  const cavityShade = context.createRadialGradient(
    source.width * 0.72,
    source.height * 0.78,
    source.width * 0.04,
    source.width * 0.74,
    source.height * 0.78,
    source.width * 0.56,
  );
  cavityShade.addColorStop(0, "rgba(54,34,20,0.42)");
  cavityShade.addColorStop(0.48, "rgba(54,34,20,0.16)");
  cavityShade.addColorStop(1, "rgba(54,34,20,0)");
  context.fillStyle = cavityShade;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.052;
  context.filter = `blur(${0.32 * pixelRatio}px)`;
  const cheekLight = context.createRadialGradient(
    source.width * 0.28,
    source.height * 0.24,
    source.width * 0.02,
    source.width * 0.28,
    source.height * 0.24,
    source.width * 0.34,
  );
  cheekLight.addColorStop(0, "rgba(255,255,250,0.14)");
  cheekLight.addColorStop(0.4, "rgba(255,248,224,0.04)");
  cheekLight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = cheekLight;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "destination-over";
  context.globalAlpha = 0.025;
  context.filter = `blur(${0.7 * pixelRatio}px)`;
  context.drawImage(source, 0.45 * pixelRatio, 0.7 * pixelRatio);
  context.restore();
}

function applyPremiumToyGroundingPass(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  pixelRatio: number,
): void {
  context.save();
  context.globalCompositeOperation = "destination-over";
  context.filter = `blur(${5.8 * pixelRatio}px)`;
  context.globalAlpha = 0.25;
  context.fillStyle = "rgba(45, 31, 18, 0.48)";
  context.beginPath();
  context.ellipse(
    source.width * 0.54,
    source.height * 0.84,
    source.width * 0.27,
    source.height * 0.055,
    -0.1,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  context.save();
  context.globalCompositeOperation = "destination-over";
  context.filter = `blur(${1.65 * pixelRatio}px)`;
  context.globalAlpha = 0.31;
  context.fillStyle = "rgba(32, 23, 16, 0.42)";
  context.beginPath();
  context.ellipse(
    source.width * 0.52,
    source.height * 0.828,
    source.width * 0.2,
    source.height * 0.032,
    -0.08,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = 0.23;
  const toyOcclusion = context.createLinearGradient(source.width * 0.28, source.height * 0.24, source.width, source.height);
  toyOcclusion.addColorStop(0, "rgba(255,255,255,0)");
  toyOcclusion.addColorStop(0.58, "rgba(43,30,20,0.08)");
  toyOcclusion.addColorStop(1, "rgba(26,18,12,0.18)");
  context.fillStyle = toyOcclusion;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();
}

function applyPremiumToySpecularPass(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  pixelRatio: number,
): void {
  context.save();
  context.globalCompositeOperation = "screen";
  context.filter = `blur(${0.42 * pixelRatio}px)`;
  context.globalAlpha = 0.066;
  const softStudioHotspot = context.createRadialGradient(
    source.width * 0.3,
    source.height * 0.22,
    source.width * 0.014,
    source.width * 0.3,
    source.height * 0.22,
    source.width * 0.28,
  );
  softStudioHotspot.addColorStop(0, "rgba(255,255,255,0.3)");
  softStudioHotspot.addColorStop(0.34, "rgba(255,248,221,0.08)");
  softStudioHotspot.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = softStudioHotspot;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = 0.18;
  const edgeAir = context.createLinearGradient(0, source.height * 0.12, source.width * 0.72, source.height * 0.72);
  edgeAir.addColorStop(0, "rgba(255,252,232,0.12)");
  edgeAir.addColorStop(0.38, "rgba(255,255,255,0.018)");
  edgeAir.addColorStop(0.72, "rgba(255,255,255,0)");
  edgeAir.addColorStop(1, "rgba(18,12,8,0.16)");
  context.fillStyle = edgeAir;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();
}

function applyPremiumToyCrispStudioPass(
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  pixelRatio: number,
): void {
  const alphaMask = document.createElement("canvas");
  const darkRim = document.createElement("canvas");
  const lightRim = document.createElement("canvas");
  const bevelMask = document.createElement("canvas");
  const alphaContext = alphaMask.getContext("2d");
  const darkContext = darkRim.getContext("2d");
  const lightContext = lightRim.getContext("2d");
  const bevelContext = bevelMask.getContext("2d");

  alphaMask.width = source.width;
  alphaMask.height = source.height;
  darkRim.width = source.width;
  darkRim.height = source.height;
  lightRim.width = source.width;
  lightRim.height = source.height;
  bevelMask.width = source.width;
  bevelMask.height = source.height;

  if (!alphaContext || !darkContext || !lightContext || !bevelContext) {
    return;
  }

  alphaContext.drawImage(source, 0, 0);
  alphaContext.globalCompositeOperation = "source-in";
  alphaContext.fillStyle = "rgba(0,0,0,1)";
  alphaContext.fillRect(0, 0, source.width, source.height);

  darkContext.drawImage(alphaMask, 0, 0);
  darkContext.globalCompositeOperation = "source-in";
  darkContext.fillStyle = "rgba(32,22,14,0.78)";
  darkContext.fillRect(0, 0, source.width, source.height);

  lightContext.drawImage(alphaMask, 0, 0);
  lightContext.globalCompositeOperation = "source-in";
  lightContext.fillStyle = "rgba(255,249,220,0.92)";
  lightContext.fillRect(0, 0, source.width, source.height);

  bevelContext.drawImage(source, 0, 0);
  bevelContext.globalCompositeOperation = "source-atop";
  const bevel = bevelContext.createLinearGradient(0, 0, source.width, source.height);
  bevel.addColorStop(0, "rgba(255,255,255,0.12)");
  bevel.addColorStop(0.32, "rgba(255,246,218,0.03)");
  bevel.addColorStop(0.62, "rgba(48,34,23,0.055)");
  bevel.addColorStop(1, "rgba(30,20,13,0.2)");
  bevelContext.fillStyle = bevel;
  bevelContext.fillRect(0, 0, source.width, source.height);

  context.save();
  context.globalCompositeOperation = "destination-over";
  context.filter = `blur(${0.42 * pixelRatio}px)`;
  context.globalAlpha = 0.36;
  const darkOffsets = [
    [1.15, 1.35],
    [1.7, 0.55],
    [0.55, 1.9],
  ].map(([x, y]) => [x * pixelRatio, y * pixelRatio]);
  darkOffsets.forEach(([x, y]) => {
    context.drawImage(darkRim, x, y);
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.filter = `blur(${0.34 * pixelRatio}px)`;
  context.globalAlpha = 0.13;
  const lightOffsets = [
    [-1.15, -1.05],
    [-1.65, -0.3],
    [-0.38, -1.62],
  ].map(([x, y]) => [x * pixelRatio, y * pixelRatio]);
  lightOffsets.forEach(([x, y]) => {
    context.drawImage(lightRim, x, y);
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = 0.48;
  context.drawImage(bevelMask, 0, 0);
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.globalAlpha = 0.078;
  context.filter = `blur(${0.18 * pixelRatio}px)`;
  const toyHighlight = context.createRadialGradient(
    source.width * 0.28,
    source.height * 0.19,
    source.width * 0.008,
    source.width * 0.28,
    source.height * 0.19,
    source.width * 0.22,
  );
  toyHighlight.addColorStop(0, "rgba(255,255,255,0.42)");
  toyHighlight.addColorStop(0.28, "rgba(255,250,225,0.13)");
  toyHighlight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = toyHighlight;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-atop";
  context.globalAlpha = 0.12;
  const lowerWeight = context.createLinearGradient(0, source.height * 0.52, 0, source.height);
  lowerWeight.addColorStop(0, "rgba(255,255,255,0)");
  lowerWeight.addColorStop(0.76, "rgba(42,28,18,0.12)");
  lowerWeight.addColorStop(1, "rgba(25,18,12,0.3)");
  context.fillStyle = lowerWeight;
  context.fillRect(0, 0, source.width, source.height);
  context.restore();
}

function createColorGradedSpriteSource(source: HTMLCanvasElement): HTMLCanvasElement {
  const target = document.createElement("canvas");
  const context = target.getContext("2d");

  target.width = source.width;
  target.height = source.height;

  if (!context) {
    return source;
  }

  context.filter = "saturate(1.42) contrast(1.32) brightness(1.02)";
  context.drawImage(source, 0, 0);
  context.filter = "none";

  return target;
}

function cropTransparentPixels(
  source: HTMLCanvasElement,
  pixelRatio: number,
  anchor: { x: number; y: number },
  displayScale: { x: number; y: number } = { x: 1, y: 1 },
): ToyAssetSprite {
  const context = source.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {
      dataUrl: source.toDataURL("image/png"),
      width: (source.width / pixelRatio) * displayScale.x,
      height: (source.height / pixelRatio) * displayScale.y,
      anchorX: anchor.x * displayScale.x,
      anchorY: anchor.y * displayScale.y,
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
      width: (source.width / pixelRatio) * displayScale.x,
      height: (source.height / pixelRatio) * displayScale.y,
      anchorX: anchor.x * displayScale.x,
      anchorY: anchor.y * displayScale.y,
    };
  }

  const padding = Math.round(12 * pixelRatio);
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
    width: (cropWidth / pixelRatio) * displayScale.x,
    height: (cropHeight / pixelRatio) * displayScale.y,
    anchorX: (anchor.x - cropX / pixelRatio) * displayScale.x,
    anchorY: (anchor.y - cropY / pixelRatio) * displayScale.y,
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
    sharedRenderer.toneMappingExposure = 0.92;
    sharedRenderer.shadowMap.enabled = true;
    sharedRenderer.shadowMap.type = THREE.VSMShadowMap;
  }

  sharedRenderer.setPixelRatio(pixelRatio);
  sharedRenderer.setSize(width, height, false);
  return sharedRenderer;
}

function createCamera(aspect: number, spec: ToyAssetSpec): THREE.OrthographicCamera {
  const viewHeight = spec.render.viewHeight;
  const camera = new THREE.OrthographicCamera(
    (-viewHeight * aspect) / 2,
    (viewHeight * aspect) / 2,
    viewHeight / 2,
    -viewHeight / 2,
    0.1,
    100,
  );
  camera.position.set(3.45, 1.86, 6.75);
  camera.lookAt(0, 0.72, 0);
  return camera;
}

function buildToyAsset(spec: ToyAssetSpec, riskTag: RiskTag): THREE.Group {
  const group = new THREE.Group();

  buildToyModelFromRecipe(group, spec.modelRecipe, riskTag);
  return group;
}

function buildToyModelFromRecipe(group: THREE.Group, recipe: ToyModelRecipe, riskTag: RiskTag): void {
  switch (recipe.kind) {
    case "person":
      buildPerson(group, recipe.cloth, recipe.skin, recipe.bodyScale, recipe.elder);
      break;
    case "dog":
      buildDog(group);
      break;
    case "bird":
      buildBird(group);
      break;
    case "fish":
      buildFish(group);
      break;
    case "lion":
      buildLion(group);
      break;
    case "house":
      buildHouse(group);
      break;
    case "bridge":
      buildBridge(group);
      break;
    case "fence":
      buildFence(group);
      break;
    case "tower":
      buildTower(group);
      break;
    case "tree":
      buildTree(group);
      break;
    case "water":
      buildWater(group);
      break;
    case "rock":
      buildRock(group);
      break;
    case "sun":
      buildSun(group);
      break;
    case "monster":
      buildMonster(group);
      break;
    case "robot":
      buildRobot(group);
      break;
    case "skull":
      buildSkull(group);
      break;
    case "light":
      buildLight(group);
      break;
    default:
      buildFallback(group, riskTag);
      break;
  }

  addRecipeSignatureDetail(group, recipe.kind);
}

function addRecipeSignatureDetail(group: THREE.Group, kind: ToyModelRecipe["kind"]): void {
  switch (kind) {
    case "person":
      addSphere(group, [-0.22, 1.34, 0.39], [0.034, 0.011, 0.006], "#ffffff", [-0.08, 0, -0.18], false, true);
      addSphere(group, [0.18, 1.32, 0.39], [0.026, 0.009, 0.005], "#ffffff", [-0.08, 0, -0.18], false, true);
      break;
    case "dog":
      addSphere(group, [0.04, 0.69, 0.43], [0.028, 0.028, 0.012], "#fff7d6", [0, 0, 0], true, true);
      addTube(group, [[-0.68, 0.15, 0.25], [-0.48, 0.11, 0.31], [-0.28, 0.14, 0.27]], "#fff1cf", 0.007);
      break;
    case "bird":
      addTube(group, [[-0.32, 0.64, 0.27], [-0.2, 0.58, 0.31], [-0.08, 0.62, 0.28]], "#e8ffff", 0.008);
      addSphere(group, [0.46, 0.73, 0.3], [0.04, 0.012, 0.006], "#fff3c6", [-0.08, 0, -0.16], false, true);
      break;
    case "fish":
      addSphere(group, [0.34, 0.62, 0.34], [0.032, 0.026, 0.008], "#f7ffff", [-0.1, 0, -0.18], false, true);
      addTube(group, [[-0.44, 0.5, 0.32], [-0.12, 0.55, 0.36], [0.24, 0.52, 0.33]], "#ffffff", 0.007);
      break;
    case "lion":
      addSphere(group, [0.36, 0.94, 0.34], [0.07, 0.02, 0.01], "#f8d681", [-0.08, 0, -0.18], false, true);
      addSphere(group, [0.76, 0.9, 0.28], [0.05, 0.018, 0.009], "#ffd98a", [-0.08, 0, -0.16], false, true);
      break;
    case "house":
      addSphere(group, [0.06, 0.34, 0.64], [0.026, 0.026, 0.01], "#ffe7a3", [0, 0, 0], true, true);
      addTube(group, [[-0.6, 1.5, 0.22], [-0.24, 1.6, 0.32], [0.22, 1.56, 0.26], [0.58, 1.48, 0.16]], "#fff0c8", 0.006);
      break;
    case "bridge":
      addSphere(group, [-0.68, 0.5, 0.32], [0.032, 0.014, 0.008], "#fff2c8", [0, 0, -0.14], false, true);
      addSphere(group, [0.64, 0.54, 0.31], [0.028, 0.012, 0.007], "#ffe0a4", [0, 0, -0.14], false, true);
      break;
    case "fence":
      addTube(group, [[-0.9, 0.78, 0.14], [-0.38, 0.82, 0.2], [0.2, 0.78, 0.18], [0.9, 0.82, 0.14]], "#ffe0a5", 0.007);
      break;
    case "tower":
      addSphere(group, [0.08, 1.0, 0.42], [0.035, 0.016, 0.008], "#fff8d8", [-0.08, 0, -0.18], false, true);
      addSphere(group, [0.38, 2.42, 0.12], [0.035, 0.018, 0.008], "#ffd36c", [0, 0, 0], true, true);
      break;
    case "tree":
      addSphere(group, [0.24, 1.46, 0.42], [0.05, 0.018, 0.008], "#fff7ce", [-0.08, 0, -0.18], false, true);
      addTube(group, [[-0.32, 0.22, 0.36], [-0.12, 0.18, 0.42], [0.12, 0.2, 0.38], [0.34, 0.16, 0.34]], "#f4dda6", 0.007);
      break;
    case "water":
      addTube(group, [[-0.78, 0.37, 0.36], [-0.38, 0.4, 0.46], [0.08, 0.37, 0.39], [0.58, 0.4, 0.3]], "#ffffff", 0.008);
      addSphere(group, [0.72, 0.32, 0.22], [0.04, 0.014, 0.008], "#f8ffff", [-0.1, 0, -0.18], false, true);
      break;
    case "rock":
      addSphere(group, [0.18, 0.76, 0.32], [0.12, 0.024, 0.014], "#dde3d4", [-0.1, 0, -0.22], false, true);
      break;
    case "sun":
      addGlowSphere(group, [0, 0.9, 0.1], [0.64, 0.64, 0.08], "#ffd76c", 0.08);
      break;
    case "monster":
      addSphere(group, [-0.36, 0.84, 0.42], [0.05, 0.018, 0.008], "#f0e8ff", [-0.08, 0, -0.18], false, true);
      addSphere(group, [0.22, 0.98, 0.38], [0.042, 0.016, 0.008], "#fff0c2", [-0.08, 0, -0.16], false, true);
      break;
    case "robot":
      addGlowSphere(group, [0, 0.56, 0.46], [0.38, 0.08, 0.018], "#8ffff5", 0.11);
      addSphere(group, [-0.34, 0.92, 0.34], [0.035, 0.014, 0.008], "#ffffff", [-0.08, 0, -0.16], false, true);
      break;
    case "skull":
      addSphere(group, [-0.16, 0.84, 0.38], [0.05, 0.018, 0.008], "#fff6d9", [-0.08, 0, -0.16], false, true);
      addTube(group, [[-0.2, 0.44, 0.4], [-0.04, 0.4, 0.42], [0.12, 0.44, 0.4]], "#d6c6a6", 0.007);
      break;
    case "light":
      addGlowSphere(group, [0, 1.22, 0.18], [0.36, 0.36, 0.1], "#fff1a8", 0.13);
      break;
    default:
      addSoftGlossPatch(group, [-0.16, 0.86, 0.28], [0.16, 0.03, 0.012], 0.28);
      break;
  }
}

function normalizeModel(group: THREE.Group, spec: ToyAssetSpec): void {
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const targetWidth = spec.render.targetWidth;
  const targetHeight = spec.render.targetHeight;
  const presenceScale =
    spec.footprint.kind === "flat" ? 1.03 : spec.footprint.kind === "wide" ? 1.08 : spec.footprint.kind === "tall" ? 1.1 : 1.12;
  const scale =
    Math.min(targetWidth / Math.max(size.x, size.z, 0.001), targetHeight / Math.max(size.y, 0.001)) * presenceScale;

  group.scale.setScalar(scale);
  group.position.x -= center.x * scale;
  group.position.z -= center.z * scale;

  const scaledBox = new THREE.Box3().setFromObject(group);
  group.position.y -= scaledBox.min.y;
  group.rotation.y = spec.render.yaw;
}

function applyModelStudioFinish(group: THREE.Group): void {
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const materials = Array.isArray(object.material) ? object.material : [object.material];

    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshPhysicalMaterial)) {
        return;
      }

      const isTransparent = material.transparent || material.opacity < 1;
      const isMetal = material.metalness > 0.18;
      material.envMapIntensity = isTransparent ? 1.18 : isMetal ? 0.98 : 0.92;
      material.roughness = Math.min(isTransparent ? 0.28 : 0.55, Math.max(0.2, material.roughness * 0.8));
      material.clearcoat = Math.min(0.9, Math.max(isTransparent ? 0.5 : 0.66, material.clearcoat * 0.98));
      material.clearcoatRoughness = Math.min(0.48, Math.max(0.2, material.clearcoatRoughness * 0.9));
      material.specularIntensity = Math.min(0.92, Math.max(0.62, material.specularIntensity * 1.04));
      material.bumpScale = Math.min(isTransparent ? 0.002 : isMetal ? 0.003 : 0.0095, material.bumpScale * 1.08);
      material.needsUpdate = true;
    });
  });
}

function buildPerson(group: THREE.Group, cloth: string, skin: string, scale: number, elder = false): void {
  addToyFootprintPlate(group, [0, 0.08 * scale], [0.48 * scale, 0.32 * scale], elder ? "#cdbb96" : "#dfc893", 0.58);
  const body = addRoundedBox(group, [0.64, 0.82, 0.44], [0, 0.58, 0], cloth, 0.16);
  body.scale.setScalar(scale);
  const hair = elder ? "#efe9d5" : "#4a2f22";
  addRoundedBox(group, [0.5 * scale, 0.42 * scale, 0.055 * scale], [0, 0.63 * scale, 0.245 * scale], elder ? "#6f6259" : "#75c7ef", 0.045 * scale, [0, 0, 0], true);
  addRoundedBox(group, [0.5 * scale, 0.075 * scale, 0.06 * scale], [0, 0.36 * scale, 0.26 * scale], "#5b4032", 0.018 * scale, [0, 0, 0], true);
  addSphere(group, [-0.39 * scale, 1.21 * scale, 0.01], [0.095 * scale, 0.14 * scale, 0.08 * scale], skin);
  addSphere(group, [0.39 * scale, 1.21 * scale, 0.01], [0.095 * scale, 0.14 * scale, 0.08 * scale], skin);
  addCapsule(group, 0.13 * scale, 0.48 * scale, [-0.44 * scale, 0.52 * scale, 0.02], skin, [0.1, 0, -0.55]);
  addCapsule(group, 0.13 * scale, 0.48 * scale, [0.44 * scale, 0.52 * scale, 0.02], skin, [0.1, 0, 0.55]);
  addCapsule(group, 0.12 * scale, 0.28 * scale, [-0.19 * scale, 0.12 * scale, 0], "#594031", [0, 0, 0]);
  addCapsule(group, 0.12 * scale, 0.28 * scale, [0.19 * scale, 0.12 * scale, 0], "#594031", [0, 0, 0]);
  addRoundedBox(group, [0.24 * scale, 0.09 * scale, 0.22 * scale], [-0.2 * scale, 0.02 * scale, 0.06 * scale], "#3f312b", 0.04);
  addRoundedBox(group, [0.24 * scale, 0.09 * scale, 0.22 * scale], [0.2 * scale, 0.02 * scale, 0.06 * scale], "#3f312b", 0.04);
  addSphere(group, [0, 1.22 * scale, 0.02], [0.34 * scale, 0.36 * scale, 0.34 * scale], skin);
  addSphere(group, [-0.08 * scale, 1.42 * scale, 0], [0.29 * scale, 0.13 * scale, 0.3 * scale], hair);
  addSphere(group, [0.08 * scale, 1.37 * scale, 0.1], [0.23 * scale, 0.08 * scale, 0.2 * scale], hair, [0, 0, -0.08]);
  addSphere(group, [-0.28 * scale, 1.3 * scale, 0.09 * scale], [0.09 * scale, 0.14 * scale, 0.09 * scale], hair, [0, 0, 0.1]);
  addSphere(group, [0.25 * scale, 1.31 * scale, 0.11 * scale], [0.08 * scale, 0.12 * scale, 0.08 * scale], hair, [0, 0, -0.1]);
  addSphere(group, [0.03 * scale, 1.16 * scale, 0.36 * scale], [0.045 * scale, 0.038 * scale, 0.025 * scale], skin, [0, 0, 0], false, true);
  addEyes(group, 0, 1.24 * scale, 0.31 * scale, 0.13 * scale, 0.75 * scale);
  addTube(group, [[-0.2 * scale, 1.34 * scale, 0.36 * scale], [-0.12 * scale, 1.37 * scale, 0.37 * scale], [-0.05 * scale, 1.34 * scale, 0.36 * scale]], hair, 0.009 * scale);
  addTube(group, [[0.05 * scale, 1.34 * scale, 0.36 * scale], [0.13 * scale, 1.37 * scale, 0.37 * scale], [0.21 * scale, 1.34 * scale, 0.36 * scale]], hair, 0.009 * scale);
  addBlush(group, 0, 1.16 * scale, 0.34 * scale, 0.16 * scale, 0.78 * scale);
  addMouth(group, 0, 1.07 * scale, 0.36 * scale, 0.018 * scale);
  addRoundedBox(group, [0.28 * scale, 0.08 * scale, 0.055 * scale], [-0.18 * scale, 0.96 * scale, 0.26 * scale], "#fff6e9", 0.018);
  addRoundedBox(group, [0.28 * scale, 0.08 * scale, 0.055 * scale], [0.18 * scale, 0.96 * scale, 0.26 * scale], "#fff6e9", 0.018);
  addSphere(group, [0, 0.78 * scale, 0.29 * scale], [0.028 * scale, 0.028 * scale, 0.014 * scale], "#f4d36a", [0, 0, 0], true, true);
  addSphere(group, [0, 0.58 * scale, 0.29 * scale], [0.024 * scale, 0.024 * scale, 0.012 * scale], "#fff6e9", [0, 0, 0], false, true);
  addSphere(group, [-0.08 * scale, 0.69 * scale, 0.28 * scale], [0.026 * scale, 0.026 * scale, 0.014 * scale], "#fff7df", [0, 0, 0], false, true);
  addSphere(group, [0.08 * scale, 0.69 * scale, 0.28 * scale], [0.026 * scale, 0.026 * scale, 0.014 * scale], "#fff7df", [0, 0, 0], false, true);
  addHighlight(group, [-0.24 * scale, 0.79 * scale, 0.28 * scale], [0.1 * scale, 0.026 * scale, 0.014 * scale]);
  addTube(group, [[-0.23 * scale, 0.9 * scale, 0.3 * scale], [-0.31 * scale, 0.72 * scale, 0.31 * scale], [-0.27 * scale, 0.52 * scale, 0.3 * scale]], "#ffffff", 0.012 * scale);
  addTube(group, [[0.23 * scale, 0.9 * scale, 0.3 * scale], [0.31 * scale, 0.72 * scale, 0.31 * scale], [0.27 * scale, 0.52 * scale, 0.3 * scale]], "#ffffff", 0.012 * scale);
  addSphere(group, [-0.31 * scale, 0.55 * scale, 0.33 * scale], [0.032 * scale, 0.032 * scale, 0.012 * scale], "#f1cf65", [0, 0, 0], true, true);
  addSphere(group, [0.31 * scale, 0.55 * scale, 0.33 * scale], [0.032 * scale, 0.032 * scale, 0.012 * scale], "#f1cf65", [0, 0, 0], true, true);
  addSphere(group, [-0.11 * scale, 1.28 * scale, 0.355 * scale], [0.07 * scale, 0.018 * scale, 0.008 * scale], "#fff7e6", [-0.08, 0, -0.18], false, true);
  addSphere(group, [0.11 * scale, 1.28 * scale, 0.355 * scale], [0.07 * scale, 0.018 * scale, 0.008 * scale], "#fff7e6", [-0.08, 0, -0.18], false, true);
  addSphere(group, [0.0, 1.06 * scale, 0.365 * scale], [0.11 * scale, 0.025 * scale, 0.01 * scale], "#f5a685", [0, 0, -0.08], false, true);
  addRoundedBox(group, [0.34 * scale, 0.05 * scale, 0.035 * scale], [0, 0.82 * scale, 0.31 * scale], "#fff1d5", 0.012 * scale, [0, 0, 0], true);
  addRoundedBox(group, [0.24 * scale, 0.038 * scale, 0.032 * scale], [0, 0.63 * scale, 0.312 * scale], "#2c2521", 0.01 * scale, [0, 0, 0], true);
  addTube(group, [[-0.22 * scale, 1.31 * scale, 0.385 * scale], [-0.12 * scale, 1.34 * scale, 0.402 * scale]], hair, 0.012 * scale);
  addTube(group, [[0.12 * scale, 1.34 * scale, 0.402 * scale], [0.22 * scale, 1.31 * scale, 0.385 * scale]], hair, 0.012 * scale);
  addSphere(group, [-0.02 * scale, 1.17 * scale, 0.39 * scale], [0.034 * scale, 0.048 * scale, 0.01 * scale], "#eaa579", [0, 0, -0.08], false, true);
  addTube(group, [[-0.16 * scale, 0.88 * scale, 0.335 * scale], [0, 0.72 * scale, 0.35 * scale], [0.16 * scale, 0.88 * scale, 0.335 * scale]], "#f8efe1", 0.009 * scale);
  addSphere(group, [0, 0.72 * scale, 0.368 * scale], [0.026 * scale, 0.026 * scale, 0.012 * scale], "#f0c661", [0, 0, 0], true, true);
  addSoftGlossPatch(group, [-0.13 * scale, 1.34 * scale, 0.34 * scale], [0.12 * scale, 0.026 * scale, 0.012 * scale], 0.36);
  addSoftGlossPatch(group, [-0.22 * scale, 0.76 * scale, 0.31 * scale], [0.13 * scale, 0.024 * scale, 0.014 * scale], 0.25);
  addInsetLine(
    group,
    [
      [-0.22 * scale, 0.22 * scale, 0.23 * scale],
      [-0.08 * scale, 0.18 * scale, 0.27 * scale],
      [0.08 * scale, 0.18 * scale, 0.27 * scale],
      [0.22 * scale, 0.22 * scale, 0.23 * scale],
    ],
    "#f7e0b6",
    0.008 * scale,
  );
  addSphere(group, [-0.2 * scale, 0.04 * scale, 0.2 * scale], [0.08 * scale, 0.014 * scale, 0.028 * scale], "#fff3dc", [0, 0, -0.1], false, true);
  addSphere(group, [0.2 * scale, 0.04 * scale, 0.2 * scale], [0.08 * scale, 0.014 * scale, 0.028 * scale], "#fff3dc", [0, 0, -0.1], false, true);

  if (elder) {
    addTube(group, [[-0.22 * scale, 1.25 * scale, 0.36 * scale], [0, 1.2 * scale, 0.38 * scale], [0.22 * scale, 1.25 * scale, 0.36 * scale]], "#7e644c", 0.012 * scale);
    addSphere(group, [0, 1.04 * scale, 0.34 * scale], [0.16 * scale, 0.04 * scale, 0.018 * scale], "#efe9d5", [0, 0, 0], false, true);
    addCylinder(group, 0.028, 0.028, 1, [0.58 * scale, 0.44 * scale, 0.2 * scale], "#6a452d", [0.18, 0, -0.18]);
    addSphere(group, [0.58 * scale, 0.94 * scale, 0.2 * scale], [0.07 * scale, 0.07 * scale, 0.07 * scale], "#6a452d");
  }

  addHighlight(group, [-0.17 * scale, 1.34 * scale, 0.28 * scale], [0.09 * scale, 0.035 * scale, 0.018 * scale]);
}

function buildDog(group: THREE.Group): void {
  addCapsule(group, 0.34, 0.88, [-0.18, 0.48, 0], "#bd7a43", [0, 0, Math.PI / 2]);
  addSphere(group, [-0.22, 0.55, 0.31], [0.28, 0.13, 0.035], "#f4c384", [0, 0, -0.18], false, true);
  addSphere(group, [0.1, 0.55, 0.34], [0.18, 0.06, 0.02], "#fff4d8", [0, 0, -0.1], false, true);
  addSphere(group, [-0.3, 0.68, 0.26], [0.16, 0.07, 0.026], "#ffd7a0", [0, 0, -0.3], false, true);
  addSphere(group, [0.04, 0.38, 0.32], [0.12, 0.045, 0.02], "#8d552f", [0, 0, 0.18], false, true);
  addSphere(group, [0.55, 0.66, 0.09], [0.36, 0.34, 0.32], "#d79858");
  addSphere(group, [0.74, 0.6, 0.31], [0.18, 0.13, 0.08], "#f1c27d", [0, 0, 0], false, true);
  addCapsule(group, 0.115, 0.38, [0.32, 0.9, 0.08], "#765036", [0.5, 0.06, -0.42]);
  addCapsule(group, 0.115, 0.38, [0.75, 0.9, 0.08], "#765036", [0.5, -0.06, 0.42]);
  addSphere(group, [0.32, 0.86, 0.21], [0.055, 0.12, 0.024], "#a96c40", [0.18, 0, -0.28], false, true);
  addSphere(group, [0.77, 0.86, 0.21], [0.052, 0.11, 0.024], "#a96c40", [0.18, 0, 0.28], false, true);
  addSphere(group, [0.5, 0.74, 0.36], [0.16, 0.1, 0.024], "#fff0c6", [0, 0, -0.16], false, true);
  addSphere(group, [0.83, 0.61, 0.14], [0.12, 0.09, 0.1], "#543823");
  addSphere(group, [0.9, 0.62, 0.22], [0.034, 0.022, 0.012], "#fff7df", [0, 0, 0], false, true);
  addEyes(group, 0.58, 0.75, 0.37, 0.11, 0.62);
  addTube(group, [[0.43, 0.9, 0.38], [0.53, 0.94, 0.39], [0.64, 0.9, 0.38]], "#5b3926", 0.011);
  addTube(group, [[0.62, 0.9, 0.38], [0.72, 0.94, 0.39], [0.82, 0.9, 0.38]], "#5b3926", 0.011);
  addBlush(group, 0.58, 0.64, 0.38, 0.13, 0.55);
  addMouth(group, 0.61, 0.39, 0.48, 0.022);
  addSphere(group, [0.64, 0.48, 0.5], [0.05, 0.022, 0.012], "#f58a8f", [0.18, 0, 0], false, true);
  addSphere(group, [-0.2, 0.57, 0.32], [0.16, 0.08, 0.026], "#f1c27d", [0, 0, -0.2], false, true);
  addCapsule(group, 0.035, 0.64, [0.08, 0.66, 0.34], "#63b6b1", [Math.PI / 2, 0, Math.PI / 2]);
  addSphere(group, [0.04, 0.68, 0.39], [0.052, 0.052, 0.022], "#ffd25a", [0, 0, 0], true, true);
  addSphere(group, [-0.38, 0.72, 0.2], [0.14, 0.1, 0.06], "#f0c588");
  addTail(group, [-0.88, 0.75, -0.02], "#765036");
  addSphere(group, [0.36, 0.58, 0.39], [0.06, 0.022, 0.012], "#fff8dc", [-0.04, 0, -0.18], false, true);
  addSphere(group, [0.78, 0.78, 0.18], [0.08, 0.035, 0.014], "#fff0c9", [-0.04, 0, -0.26], false, true);
  addTube(group, [[-0.42, 0.6, 0.3], [-0.3, 0.54, 0.34], [-0.16, 0.58, 0.31]], "#fff0cb", 0.011);
  [-0.52, -0.1, 0.25, 0.55].forEach((x) => {
    addCapsule(group, 0.075, 0.28, [x, 0.16, 0.12], "#8d5b35");
    addSphere(group, [x + 0.02, 0.03, 0.22], [0.09, 0.035, 0.052], "#6f482c", [0, 0, 0], false, true);
    addSphere(group, [x + 0.04, 0.045, 0.27], [0.022, 0.012, 0.01], "#f0c588", [0, 0, 0], false, true);
    addSphere(group, [x - 0.02, 0.052, 0.285], [0.016, 0.009, 0.008], "#f6d7a8", [0, 0, 0], false, true);
  });
}

function buildBird(group: THREE.Group): void {
  addSphere(group, [0, 0.68, 0], [0.52, 0.44, 0.4], "#559bd0");
  addSphere(group, [-0.24, 0.65, 0.12], [0.34, 0.16, 0.08], "#8dd0ef", [0.1, 0.1, -0.35]);
  addSphere(group, [-0.34, 0.58, 0.19], [0.23, 0.075, 0.032], "#caeffa", [0.1, 0.08, -0.38], false, true);
  addSphere(group, [-0.04, 0.92, 0.03], [0.12, 0.18, 0.052], "#6fb8df", [0.2, 0, -0.08], false, true);
  addSphere(group, [-0.18, 0.62, 0.23], [0.18, 0.05, 0.026], "#f7ffff", [-0.12, 0, -0.18], false, true);
  addCone(group, 0.13, 0.28, [0.5, 0.72, 0.18], "#eaa541", [Math.PI / 2, 0, -Math.PI / 2], 24);
  addEyes(group, 0.2, 0.8, 0.35, 0.1, 0.58);
  addBlush(group, 0.2, 0.68, 0.36, 0.12, 0.5);
  addCone(group, 0.16, 0.26, [-0.48, 0.68, -0.04], "#397fae", [0, 0, Math.PI / 2], 3);
  addCone(group, 0.14, 0.22, [-0.54, 0.76, 0.04], "#7cc6eb", [0.06, 0, Math.PI / 2], 3);
  addCone(group, 0.12, 0.2, [-0.53, 0.6, 0.08], "#2e719e", [-0.04, 0, Math.PI / 2], 3);
  addSphere(group, [-0.32, 0.72, 0.28], [0.16, 0.035, 0.012], "#eaffff", [-0.08, 0, -0.22], false, true);
  addSphere(group, [0.24, 0.92, 0.22], [0.06, 0.035, 0.016], "#d7f9ff", [-0.08, 0, -0.18], false, true);
  addTube(group, [[-0.14, 0.16, 0.08], [-0.2, 0.02, 0.18]], "#7a4b2d", 0.025);
  addTube(group, [[0.14, 0.16, 0.08], [0.2, 0.02, 0.18]], "#7a4b2d", 0.025);
  [-0.2, 0.2].forEach((x) => {
    addTube(group, [[x, 0.02, 0.18], [x - 0.06, 0.01, 0.27]], "#d98a39", 0.012);
    addTube(group, [[x, 0.02, 0.18], [x + 0.06, 0.01, 0.27]], "#d98a39", 0.012);
  });
}

function buildFish(group: THREE.Group): void {
  addSphere(group, [0.18, 0.48, 0], [0.66, 0.34, 0.3], "#36a4af");
  addCone(group, 0.34, 0.52, [-0.68, 0.48, 0], "#2b7f88", [0, 0, Math.PI / 2], 3);
  addCone(group, 0.22, 0.38, [-0.54, 0.58, 0.08], "#6ed7dc", [0.16, 0, Math.PI / 2], 3);
  addCone(group, 0.2, 0.34, [-0.52, 0.36, 0.08], "#2c92a8", [-0.12, 0, Math.PI / 2], 3);
  addSphere(group, [0.08, 0.78, 0.02], [0.26, 0.08, 0.18], "#82d8dc", [-0.25, 0, 0.2]);
  addSphere(group, [0.12, 0.24, 0.08], [0.24, 0.08, 0.12], "#238ca5", [0.2, 0, -0.18]);
  [-0.12, 0.08, 0.28].forEach((x) => {
    addSphere(group, [x, 0.5, 0.28], [0.045, 0.065, 0.012], "#8be2df", [0, 0, -0.3], false, true);
  });
  [-0.04, 0.18, 0.38].forEach((x, index) => {
    addSphere(group, [x, 0.59 - index * 0.045, 0.31], [0.032, 0.038, 0.01], "#e0ffff", [0, 0, -0.2], false, true);
  });
  addTube(group, [[-0.42, 0.62, 0.27], [-0.08, 0.72, 0.31], [0.34, 0.64, 0.3]], "#c9fcff", 0.012);
  addTube(group, [[-0.34, 0.37, 0.29], [0.02, 0.3, 0.31], [0.42, 0.38, 0.29]], "#0d6f8c", 0.012);
  [-0.24, -0.04, 0.16, 0.36].forEach((x, index) => {
    addSphere(group, [x, 0.48 - (index % 2) * 0.045, 0.315], [0.035, 0.028, 0.01], index % 2 === 0 ? "#6ed7dc" : "#d6ffff", [0, 0, -0.18], false, true);
  });
  addSphere(group, [-0.1, 0.43, 0.3], [0.24, 0.035, 0.014], "#e8fdff", [0, 0, -0.18], false, true);
  addEyes(group, 0.52, 0.56, 0.3, 0.08, 0.54);
  addSphere(group, [0.72, 0.5, 0.22], [0.056, 0.042, 0.018], "#f6ffff", [0, 0, 0], false, true);
  addSphere(group, [0.76, 0.49, 0.245], [0.022, 0.024, 0.01], "#24303a", [0, 0, 0], false, true);
  addHighlight(group, [0.16, 0.67, 0.25], [0.18, 0.035, 0.018]);
}

function buildLion(group: THREE.Group): void {
  addCapsule(group, 0.3, 0.8, [-0.18, 0.44, 0], "#c5883f", [0, 0, Math.PI / 2]);
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    addSphere(
      group,
      [0.55 + Math.cos(angle) * 0.22, 0.74 + Math.sin(angle) * 0.18, 0.05],
      [0.15, 0.19, 0.08],
      index % 2 === 0 ? "#7b4c28" : "#a06431",
      [0, 0, angle],
    );
  }
  addSphere(group, [0.55, 0.72, 0.04], [0.46, 0.46, 0.36], "#8b582d");
  addSphere(group, [0.59, 0.71, 0.18], [0.31, 0.29, 0.25], "#d4a150");
  addSphere(group, [0.38, 1.02, 0.06], [0.13, 0.16, 0.08], "#8b582d");
  addSphere(group, [0.74, 1.02, 0.06], [0.13, 0.16, 0.08], "#8b582d");
  addEyes(group, 0.58, 0.78, 0.4, 0.1, 0.56);
  addBlush(group, 0.58, 0.67, 0.42, 0.12, 0.54);
  addMouth(group, 0.62, 0.43, 0.5, 0.024);
  addTail(group, [-0.84, 0.62, -0.02], "#8b582d");
  addSphere(group, [-1.06, 0.72, 0.02], [0.11, 0.11, 0.11], "#8b582d");
}

function buildHouse(group: THREE.Group): void {
  addToyFootprintPlate(group, [0, 0.18], [1.05, 0.76], "#c9bc86", 0.48);
  addRoundedBox(group, [1.68, 0.12, 1.28], [0, 0.06, 0], "#6dbf68", 0.08);
  addRoundedBox(group, [1.52, 0.18, 1.18], [0, 0.12, 0], "#a98252", 0.08);
  addRoundedBox(group, [1.38, 0.9, 1.08], [0, 0.48, 0], "#f1bd78", 0.09);
  addRoundedBox(group, [1.46, 0.09, 1.14], [0, 0.18, 0.01], "#e8a96b", 0.035, [0, 0, 0], true);
  addRoundedBox(group, [1.5, 0.12, 1.18], [0, 0.91, 0], "#f8dfb2", 0.04);
  addCone(group, 1.08, 0.7, [0, 1.18, 0], "#e4573d", [0, Math.PI / 4, 0], 4);
  addRoundedBox(group, [1.62, 0.08, 1.22], [0, 0.96, 0.02], "#f46b4f", 0.035, [0, Math.PI / 4, 0], true);
  addRoundedBox(group, [1.22, 0.045, 0.08], [0, 1.52, 0.03], "#ffd3a0", 0.014, [0, Math.PI / 4, 0], true);
  addRoundedBox(group, [1.36, 0.08, 0.12], [0, 0.92, 0.62], "#aa362b", 0.025);
  [-0.42, -0.16, 0.1, 0.36].forEach((x, index) => {
    addRoundedBox(group, [0.18, 0.045, 0.34], [x, 1.24 + index * 0.015, 0.48], index % 2 === 0 ? "#ff8060" : "#cf3e30", 0.018, [0.34, 0, 0.18], true);
  });
  [-0.54, -0.3, -0.06, 0.18, 0.42].forEach((x, index) => {
    addRoundedBox(group, [0.17, 0.032, 0.42], [x, 1.34 + index * 0.008, 0.26], index % 2 === 0 ? "#f56f4e" : "#c94435", 0.012, [0.34, 0, 0.18], true);
  });
  [-0.48, -0.18, 0.12, 0.42].forEach((x, index) => {
    addSphere(group, [x, 1.46 + index * 0.01, 0.4], [0.038, 0.016, 0.012], "#ffd7a8", [0, 0, -0.12], false, true);
  });
  [-0.34, 0.0, 0.34].forEach((x) => {
    addRoundedBox(group, [0.18, 0.035, 0.28], [x, 1.1, 0.52], "#ffbd78", 0.014, [0.3, 0, 0.12], true);
  });
  addCylinder(group, 0.12, 0.14, 0.36, [0.46, 1.44, -0.18], "#8c5a38", [0, 0, 0], 4);
  addRoundedBox(group, [0.26, 0.06, 0.22], [0.46, 1.64, -0.18], "#6e432c", 0.018);
  addRoundedBox(group, [0.28, 0.48, 0.055], [0, 0.31, 0.58], "#73462b", 0.035);
  addRoundedBox(group, [0.34, 0.08, 0.065], [0, 0.55, 0.62], "#8e5a38", 0.022, [0, 0, 0], true);
  addCylinder(group, 0.028, 0.032, 0.48, [-0.2, 0.33, 0.63], "#eac48f", [0, 0, 0], 14);
  addCylinder(group, 0.028, 0.032, 0.48, [0.2, 0.33, 0.63], "#d79e6b", [0, 0, 0], 14);
  addSphere(group, [0.09, 0.32, 0.625], [0.026, 0.026, 0.012], "#f5d170", [0, 0, 0], true, true);
  addWindow(group, [-0.38, 0.55, 0.57]);
  addWindow(group, [0.38, 0.55, 0.57]);
  addRoundedBox(group, [0.24, 0.18, 0.04], [-0.62, 0.58, 0.22], "#9bd8e9", 0.03, [0, Math.PI / 2, 0], true);
  addRoundedBox(group, [0.16, 0.018, 0.045], [-0.64, 0.59, 0.22], "#ffffff", 0.006, [0, Math.PI / 2, 0], true);
  addRoundedBox(group, [0.018, 0.12, 0.045], [-0.64, 0.59, 0.22], "#ffffff", 0.006, [0, Math.PI / 2, 0], true);
  addRoundedBox(group, [0.42, 0.045, 0.2], [0, 0.095, 0.76], "#d9c9aa", 0.018, [0, 0.08, 0], true);
  addRoundedBox(group, [0.62, 0.035, 0.18], [0, 0.06, 0.98], "#bfa987", 0.018, [0, 0.08, 0], true);
  [-0.22, 0, 0.22].forEach((x, index) => {
    addRoundedBox(group, [0.16, 0.026, 0.12], [x, 0.04, 1.18 + index * 0.085], index % 2 === 0 ? "#f1e0bd" : "#c7ad85", 0.012, [0, 0.08, 0], true);
  });
  [-0.48, -0.25, -0.02, 0.21, 0.44].forEach((x) => {
    addRoundedBox(group, [0.055, 0.44, 0.045], [x, 1.17, 0.5], "#fff2cf", 0.012, [0, 0, 0.72], true);
  });
  [-0.3, 0, 0.3].forEach((x, index) => {
    addRoundedBox(group, [0.22, 0.035, 0.28], [x, 0.035, 0.86 + index * 0.08], "#d8c3a0", 0.015, [0, 0.12, 0], true);
  });
  addRoundedBox(group, [1.08, 0.055, 0.08], [0, 1.46, 0.28], "#ffd094", 0.018, [0.34, 0, 0.15], true);
  addSphere(group, [-0.55, 0.24, 0.68], [0.055, 0.055, 0.035], "#f06f73", [0, 0, 0], false, true);
  addSphere(group, [0.55, 0.24, 0.68], [0.055, 0.055, 0.035], "#ffd15f", [0, 0, 0], true, true);
  addBush(group, [-0.58, 0.22, 0.54], 0.18);
  addBush(group, [0.6, 0.22, 0.5], 0.16);
  addGrassTuft(group, -0.74, 0.42, 0.8);
  addGrassTuft(group, 0.76, 0.4, 0.75);
  addMiniFlower(group, -0.72, 0.68, "#f16c7d", 0.82);
  addMiniFlower(group, -0.54, 0.72, "#ffd45f", 0.72);
  addMiniFlower(group, 0.72, 0.63, "#74d9ef", 0.72);
  addMiniFlower(group, 0.54, 0.74, "#f48fb0", 0.62);
  addSphere(group, [-0.78, 0.24, 0.72], [0.05, 0.05, 0.05], "#f5a74f");
  addSphere(group, [0.78, 0.24, 0.66], [0.045, 0.045, 0.045], "#f46f72");
  addRoundedBox(group, [0.34, 0.065, 0.06], [-0.38, 0.72, 0.615], "#fff0d2", 0.012, [0, 0, 0], true);
  addRoundedBox(group, [0.34, 0.065, 0.06], [0.38, 0.72, 0.615], "#fff0d2", 0.012, [0, 0, 0], true);
  addTube(group, [[-0.54, 0.92, 0.67], [-0.38, 0.86, 0.71], [-0.22, 0.92, 0.67]], "#e24d3f", 0.015);
  addTube(group, [[0.22, 0.92, 0.67], [0.38, 0.86, 0.71], [0.54, 0.92, 0.67]], "#e24d3f", 0.015);
  addRoundedBox(group, [0.22, 0.08, 0.04], [0, 0.12, 0.66], "#ffe0a5", 0.014, [0, 0, 0], true);
  addRoundedBox(group, [0.14, 0.022, 0.048], [0.02, 0.38, 0.635], "#2d2019", 0.008, [0, 0, 0], true);
  addTube(group, [[0.44, 1.68, -0.18], [0.5, 1.82, -0.12], [0.43, 1.92, -0.08]], "#f8ead3", 0.035);
  addTube(group, [[0.48, 1.76, -0.12], [0.6, 1.9, -0.02], [0.52, 2.02, 0.04]], "#d8e8e5", 0.022);
  [-0.58, -0.34, -0.1, 0.14, 0.38, 0.62].forEach((x, index) => {
    addRoundedBox(group, [0.11, 0.025, 0.055], [x, 1.5 + (index % 2) * 0.018, 0.18 + index * 0.025], "#ffb46c", 0.01, [0.34, 0, 0.2], true);
  });
  [-0.56, -0.32, -0.08, 0.16, 0.4].forEach((x, index) => {
    addInsetLine(
      group,
      [
        [x, 1.3 + index * 0.012, 0.56],
        [x + 0.08, 1.36 + index * 0.012, 0.42],
        [x + 0.14, 1.42 + index * 0.012, 0.28],
      ],
      index % 2 === 0 ? "#ffd6a0" : "#9d2f29",
      0.006,
    );
  });
  [-0.48, -0.18, 0.12, 0.42].forEach((x, index) => {
    addRoundedBox(group, [0.16, 0.018, 0.06], [x, 1.02 + index * 0.018, 0.64], "#fff4d5", 0.008, [0.18, 0, 0.16], true);
  });
  addRoundedBox(group, [0.54, 0.035, 0.18], [0, 0.12, 0.69], "#f1d09a", 0.018, [0, 0, 0], true);
  addRoundedBox(group, [0.44, 0.025, 0.12], [0, 0.15, 0.77], "#fff0c8", 0.012, [0, 0, 0], true);
  addSphere(group, [-0.34, 0.16, 0.74], [0.05, 0.026, 0.02], "#ffffff", [-0.1, 0, -0.18], false, true);
  addSphere(group, [0.34, 0.16, 0.74], [0.045, 0.024, 0.018], "#ffe7a3", [-0.1, 0, -0.18], true, true);
  addSoftGlossPatch(group, [-0.36, 0.76, 0.6], [0.2, 0.028, 0.012], 0.34, [-0.08, 0, -0.16]);
  addSoftGlossPatch(group, [0.28, 1.4, 0.34], [0.18, 0.026, 0.012], 0.3, [-0.1, 0, -0.2]);
  addInsetLine(
    group,
    [
      [-0.66, 0.18, 0.62],
      [-0.66, 0.84, 0.62],
      [0.66, 0.84, 0.62],
      [0.66, 0.18, 0.62],
    ],
    "#b77a4f",
    0.012,
  );
  addHighlight(group, [-0.36, 1.28, 0.28], [0.24, 0.035, 0.02]);
}

function buildBridge(group: THREE.Group): void {
  addRoundedBox(group, [2.18, 0.12, 0.62], [0, 0.1, 0], "#8a6643", 0.08);
  addRoundedBox(group, [2.1, 0.18, 0.56], [0, 0.25, 0], "#c7975c", 0.08);
  [-0.76, 0, 0.76].forEach((x) => {
    addCylinder(group, 0.07, 0.07, 0.82, [x, 0.67, -0.24], "#7b573a");
    addCylinder(group, 0.07, 0.07, 0.82, [x, 0.67, 0.24], "#7b573a");
    addSphere(group, [x, 1.1, 0.24], [0.09, 0.07, 0.09], "#f0bd78");
    addSphere(group, [x, 1.1, -0.24], [0.09, 0.07, 0.09], "#d8a064");
  });
  addTube(group, [[-0.96, 0.78, 0.3], [-0.48, 1.12, 0.3], [0.48, 1.12, 0.3], [0.96, 0.78, 0.3]], "#b88754", 0.055);
  addTube(group, [[-0.96, 0.78, -0.3], [-0.48, 1.12, -0.3], [0.48, 1.12, -0.3], [0.96, 0.78, -0.3]], "#8e6543", 0.055);
  [-0.72, -0.36, 0, 0.36, 0.72].forEach((x) => {
    addRoundedBox(group, [0.12, 0.08, 0.64], [x, 0.4, 0], "#e3b477", 0.03);
    addSphere(group, [x, 0.46, 0.23], [0.018, 0.018, 0.008], "#785133", [0, 0, 0], false, true);
  });
  addTube(group, [[-0.96, 0.2, -0.16], [-0.48, 0.02, -0.2], [0.32, 0.02, -0.18], [0.96, 0.2, -0.14]], "#6e4a32", 0.035);
}

function buildFence(group: THREE.Group): void {
  [-0.96, -0.48, 0, 0.48, 0.96].forEach((x) => {
    addRoundedBox(group, [0.16, 0.86, 0.16], [x, 0.46, 0], "#c7905e", 0.05);
    addCone(group, 0.13, 0.18, [x, 0.96, 0], "#f0ba77", [0, 0, 0], 4);
    addSphere(group, [x + 0.02, 0.63, 0.095], [0.018, 0.018, 0.008], "#795033", [0, 0, 0], false, true);
  });
  addRoundedBox(group, [2.18, 0.12, 0.18], [0, 0.7, 0.02], "#a46e43", 0.04);
  addRoundedBox(group, [2.18, 0.12, 0.18], [0, 0.35, 0.02], "#d9a066", 0.04);
  addRoundedBox(group, [1.06, 0.1, 0.14], [-0.52, 0.52, 0.08], "#b77b4d", 0.035, [0, 0, 0.34]);
  addRoundedBox(group, [1.06, 0.1, 0.14], [0.52, 0.52, 0.08], "#e0a667", 0.035, [0, 0, -0.34]);
}

function buildTower(group: THREE.Group): void {
  addRoundedBox(group, [0.86, 0.12, 0.86], [0, 0.06, 0], "#7b8588", 0.06);
  addRoundedBox(group, [0.72, 1.72, 0.72], [0, 0.86, 0], "#99a4aa", 0.11);
  addCone(group, 0.58, 0.56, [0, 2.03, 0], "#51687a", [0, Math.PI / 4, 0], 4);
  addRoundedBox(group, [0.24, 0.42, 0.035], [0, 0.35, 0.38], "#4b3931", 0.03);
  addWindow(group, [0, 0.94, 0.39], "#f2ce6d");
  [-0.23, 0.23].forEach((x) => addWindow(group, [x, 1.34, 0.39], "#9bd8e9"));
  [-0.24, 0.2].forEach((x, index) => {
    addRoundedBox(group, [0.18, 0.055, 0.035], [x, 0.65 + index * 0.46, 0.385], "#c3cbc9", 0.012, [0, 0, index === 0 ? 0.05 : -0.08], true);
  });
  [-0.28, 0.28].forEach((x) => {
    addCylinder(group, 0.06, 0.06, 0.28, [x, 1.84, 0.34], "#5f676a");
  });
  addCylinder(group, 0.018, 0.018, 0.52, [0.32, 2.34, 0.05], "#4d5360", [0, 0, 0], 8);
  addCone(group, 0.13, 0.28, [0.44, 2.42, 0.05], "#e66b46", [0, 0, -Math.PI / 2], 3);
  addBush(group, [-0.42, 0.13, 0.28], 0.1);
}

function buildTree(group: THREE.Group): void {
  addToyFootprintPlate(group, [0, 0.1], [0.72, 0.48], "#bfcf82", 0.5);
  addCylinder(group, 0.17, 0.22, 0.78, [0, 0.39, 0], "#8a5a32");
  addCylinder(group, 0.025, 0.025, 0.62, [-0.05, 0.42, 0.17], "#e2b074", [0.08, 0, -0.04], 12, true);
  addRoundedBox(group, [0.46, 0.08, 0.38], [0, 0.05, 0.02], "#6aa766", 0.06);
  addRoundedBox(group, [0.46, 0.05, 0.42], [0, 0.02, 0.18], "#4f8f55", 0.03, [0, 0.05, 0], true);
  addTube(group, [[0, 0.56, 0.02], [-0.26, 0.86, 0.08], [-0.44, 0.96, 0.12]], "#9b6537", 0.045);
  addTube(group, [[0.02, 0.62, 0], [0.25, 0.96, 0.05], [0.46, 1.08, 0.1]], "#774a2c", 0.04);
  addSphere(group, [0, 0.96, 0], [0.72, 0.44, 0.66], "#3f8f56");
  addSphere(group, [-0.23, 1.28, 0.02], [0.58, 0.4, 0.54], "#5fbf70");
  addSphere(group, [0.16, 1.58, 0.02], [0.46, 0.34, 0.42], "#9be98e");
  addSphere(group, [0.0, 1.15, 0.36], [0.52, 0.08, 0.035], "#dbffd0", [-0.08, 0, -0.2], false, true);
  addSphere(group, [-0.34, 1.38, 0.32], [0.22, 0.045, 0.018], "#f1ffcf", [-0.06, 0, -0.3], false, true);
  addSphere(group, [-0.42, 0.8, 0.16], [0.24, 0.2, 0.2], "#63c472");
  addSphere(group, [0.42, 1.08, 0.08], [0.32, 0.28, 0.28], "#50af62");
  addSphere(group, [-0.04, 1.16, -0.36], [0.34, 0.22, 0.28], "#2f7c4b");
  addSphere(group, [-0.5, 1.0, -0.08], [0.2, 0.14, 0.16], "#2f7c4b");
  addSphere(group, [0.5, 1.32, 0.0], [0.18, 0.16, 0.16], "#77d378");
  addSphere(group, [0.05, 1.72, -0.12], [0.2, 0.12, 0.18], "#b8f2a0");
  addSphere(group, [-0.28, 1.32, 0.34], [0.22, 0.045, 0.018], "#f0ffd2", [-0.1, 0, -0.24], false, true);
  addSphere(group, [0.36, 1.05, 0.26], [0.06, 0.06, 0.06], "#e66b46");
  addSphere(group, [-0.12, 1.5, 0.34], [0.045, 0.045, 0.045], "#e98b42");
  addSphere(group, [0.22, 1.28, 0.38], [0.045, 0.045, 0.045], "#f0b34b");
  addSphere(group, [0.46, 1.3, 0.28], [0.044, 0.044, 0.044], "#e65f55");
  addSphere(group, [-0.42, 1.02, 0.3], [0.04, 0.04, 0.04], "#f0b34b");
  addSphere(group, [0.08, 1.38, 0.42], [0.05, 0.05, 0.05], "#ffcf57", [0, 0, 0], true, true);
  addSphere(group, [-0.18, 1.2, 0.42], [0.038, 0.038, 0.038], "#f26958", [0, 0, 0], false, true);
  addTube(group, [[-0.12, 0.28, 0.22], [0.02, 0.34, 0.24], [0.15, 0.28, 0.22]], "#6e4227", 0.018);
  addTube(group, [[-0.14, 0.18, 0.21], [0.0, 0.23, 0.24], [0.16, 0.18, 0.21]], "#b97843", 0.014);
  addTube(group, [[-0.18, 0.62, 0.2], [-0.42, 0.55, 0.24], [-0.56, 0.42, 0.22]], "#6e4227", 0.02);
  addTube(group, [[0.12, 0.68, 0.18], [0.36, 0.6, 0.22], [0.48, 0.46, 0.18]], "#7c4d2f", 0.018);
  addTube(group, [[-0.18, 0.18, -0.06], [-0.36, 0.09, 0.04], [-0.52, 0.04, 0.12]], "#704426", 0.026);
  addTube(group, [[0.16, 0.18, -0.06], [0.34, 0.1, 0.02], [0.5, 0.04, 0.1]], "#8c562f", 0.024);
  addSphere(group, [-0.5, 1.08, 0.28], [0.18, 0.11, 0.04], "#dffff0", [-0.05, 0, -0.28], false, true);
  addSphere(group, [0.2, 1.58, 0.3], [0.13, 0.06, 0.025], "#f4ffe1", [-0.08, 0, -0.24], false, true);
  [
    [-0.38, 1.18, 0.42, 0.18, "#d8ffd6"],
    [0.12, 1.44, 0.42, 0.16, "#eaffc8"],
    [0.44, 1.18, 0.3, 0.13, "#bff6aa"],
    [-0.12, 0.92, 0.43, 0.14, "#a3ee9a"],
  ].forEach(([x, y, z, size, color]) => {
    addSphere(
      group,
      [Number(x), Number(y), Number(z)],
      [Number(size), Number(size) * 0.16, Number(size) * 0.055],
      String(color),
      [-0.08, 0, -0.22],
      false,
      true,
    );
  });
  [-0.035, 0.03, 0.09].forEach((offset, index) => {
    addTube(group, [[offset, 0.2, 0.21], [offset * 0.7, 0.5, 0.25], [offset * 1.2, 0.78, 0.22]], index === 1 ? "#b87a44" : "#6e4227", 0.012);
  });
  [
    [-0.26, 1.58, 0.42, 0.11, "#f7ffe8"],
    [0.32, 1.42, 0.38, 0.1, "#dcffd0"],
    [-0.48, 1.0, 0.36, 0.08, "#caffbb"],
  ].forEach(([x, y, z, size, color]) => {
    addSphere(
      group,
      [Number(x), Number(y), Number(z)],
      [Number(size), Number(size) * 0.12, Number(size) * 0.04],
      String(color),
      [-0.12, 0, -0.2],
      false,
      true,
    );
  });
  [-0.42, -0.22, 0.18, 0.38].forEach((x, index) => {
    addSphere(group, [x, 0.09, 0.34 + index * 0.03], [0.05, 0.018, 0.032], "#d6c491", [0, 0, -0.12], false, true);
  });
  addSoftGlossPatch(group, [-0.18, 1.5, 0.36], [0.24, 0.035, 0.015], 0.38, [-0.12, 0, -0.22]);
  addSoftGlossPatch(group, [-0.38, 1.08, 0.34], [0.18, 0.026, 0.012], 0.3, [-0.1, 0, -0.28]);
  [
    [-0.28, 0.24, 0.42],
    [0.28, 0.22, 0.38],
    [-0.12, 0.16, 0.5],
  ].forEach(([x, y, z]) => {
    addSphere(group, [x, y, z], [0.06, 0.022, 0.032], "#fff0bc", [-0.08, 0, -0.12], false, true);
  });
  addGrassTuft(group, -0.32, 0.16, 0.9);
  addGrassTuft(group, 0.28, 0.12, 0.75);
}

function buildWater(group: THREE.Group): void {
  addToyFootprintPlate(group, [0, 0], [1.36, 0.84], "#c7b985", 0.42);
  addCylinder(group, 1.2, 1.32, 0.09, [0, 0.025, 0], "#9c7448", [0, 0, 0], 80);
  addCylinder(group, 1.08, 1.2, 0.14, [0, 0.09, 0], "#d4b679", [0, 0, 0], 80);
  addStoneRing(group, 0, 0, 1.15, 24);
  addWaterShoreFoam(group);
  addCylinder(group, 0.98, 1.1, 0.13, [0, 0.12, 0], "#087fac", [0, 0, 0], 80, true);
  addCylinder(group, 0.82, 0.92, 0.045, [0.04, 0.215, 0.02], "#24c1dc", [0, 0, 0], 80, true);
  addGlassWaterCap(group);
  const shimmer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.82, 0.018, 80, 1),
    createMaterial({ color: "#eaffff", roughness: 0.16, clearcoat: 0.95, transparent: true, opacity: 0.36 }),
  );
  shimmer.position.set(-0.08, 0.225, 0.08);
  shimmer.scale.set(1, 1, 0.62);
  shimmer.rotation.y = -0.24;
  finishMesh(shimmer, true);
  group.add(shimmer);
  addWaterRipples(group);
  addSphere(group, [-0.4, 0.248, 0.12], [0.5, 0.036, 0.17], "#e9ffff", [0, 0, -0.12], false, true);
  addSphere(group, [0.32, 0.224, -0.02], [0.5, 0.04, 0.18], "#075f8b", [0, 0, 0.08], false, true);
  addSphere(group, [-0.14, 0.246, -0.44], [0.28, 0.024, 0.082], "#b8f5ff", [0, 0, -0.18], false, true);
  addSphere(group, [0.54, 0.252, 0.26], [0.28, 0.022, 0.07], "#f7ffff", [0, 0, -0.24], false, true);
  addWaterBubbles(group);
  addReeds(group, 0.82, 0.42, 1.05);
  addReeds(group, 0.7, 0.64, 0.88);
  addReeds(group, -0.88, -0.18, 0.72);
  addLilyPad(group, -0.42, 0.38, 0.36, -0.24);
  addLilyPad(group, 0.46, -0.28, 0.3, 0.34);
  addGrassTuft(group, -0.84, 0.36, 0.86);
  addGrassTuft(group, -0.68, -0.54, 0.72);
  addSphere(group, [-0.58, 0.31, -0.36], [0.05, 0.018, 0.014], "#ffffff", [0, 0, -0.18], false, true);
  addSphere(group, [0.2, 0.32, 0.42], [0.06, 0.02, 0.014], "#efffff", [0, 0, -0.2], false, true);
  addTube(group, [[-0.72, 0.33, 0.05], [-0.32, 0.36, 0.2], [0.12, 0.335, 0.06], [0.58, 0.36, 0.16]], "#f4ffff", 0.016);
  addTube(group, [[-0.42, 0.322, -0.18], [-0.08, 0.348, -0.34], [0.38, 0.326, -0.22]], "#73e7f5", 0.014);
  addTube(group, [[-0.62, 0.36, 0.3], [-0.28, 0.382, 0.38], [0.1, 0.36, 0.32], [0.48, 0.382, 0.42]], "#ffffff", 0.01);
  addTube(group, [[-0.1, 0.355, -0.5], [0.18, 0.372, -0.58], [0.48, 0.35, -0.42]], "#c8ffff", 0.011);
  addSphere(group, [-0.12, 0.36, 0.18], [0.18, 0.016, 0.045], "#ffffff", [-0.04, 0, -0.24], false, true);
  addSphere(group, [0.4, 0.345, 0.02], [0.13, 0.012, 0.035], "#dffcff", [-0.04, 0, -0.18], false, true);
  addSoftGlossPatch(group, [-0.34, 0.38, 0.26], [0.32, 0.018, 0.064], 0.48, [-0.06, 0, -0.28]);
  addSoftGlossPatch(group, [0.34, 0.36, -0.18], [0.22, 0.014, 0.046], 0.36, [-0.06, 0, -0.18]);
  addInsetLine(
    group,
    [
      [-0.94, 0.245, 0.18],
      [-0.52, 0.275, 0.48],
      [-0.02, 0.248, 0.4],
      [0.52, 0.274, 0.26],
      [0.92, 0.25, 0.04],
    ],
    "#f8ffff",
    0.008,
  );
  addSphere(group, [-0.84, 0.25, 0.22], [0.085, 0.034, 0.055], "#8b8173", [0, 0.2, -0.12]);
  addSphere(group, [0.88, 0.25, -0.18], [0.07, 0.028, 0.05], "#d4bb8f", [0, -0.12, -0.1]);
  addMiniFlower(group, -0.98, 0.34, "#f07a84", 0.68);
  addMiniFlower(group, 0.94, 0.6, "#ffd35e", 0.62);
  addMiniFlower(group, -0.42, 0.38, "#f6b2c8", 0.5);
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
  addBlush(group, 0, 0.82, 0.49, 0.22, 0.72);
  addMouth(group, 0.02, 0.72, 0.48, 0.026);
  addCylinder(group, 0.045, 0.055, 0.72, [0, 0.34, -0.02], "#c48b4c", [0, 0, 0], 18);
  addCylinder(group, 0.18, 0.24, 0.12, [0, 0.06, -0.02], "#9c6e44", [0, 0, 0], 28);
}

function buildMonster(group: THREE.Group): void {
  addSphere(group, [0, 0.58, 0], [0.64, 0.66, 0.52], "#7662b6");
  addSphere(group, [0.02, 0.48, 0.45], [0.3, 0.24, 0.04], "#9a84dc", [0, 0, 0], false, true);
  addSphere(group, [-0.26, 0.36, 0.44], [0.08, 0.08, 0.018], "#bdaeff", [0, 0, 0], false, true);
  addSphere(group, [0.24, 0.36, 0.43], [0.06, 0.06, 0.016], "#5b4a9b", [0, 0, 0], false, true);
  addCone(group, 0.14, 0.4, [-0.35, 1.2, 0.05], "#f2b04c", [0.12, 0, -0.28], 24);
  addCone(group, 0.14, 0.4, [0.35, 1.2, 0.05], "#f2b04c", [0.12, 0, 0.28], 24);
  addCapsule(group, 0.13, 0.34, [-0.55, 0.52, 0.04], "#5e4aa2", [0, 0, 0.65]);
  addCapsule(group, 0.13, 0.34, [0.55, 0.52, 0.04], "#5e4aa2", [0, 0, -0.65]);
  addSphere(group, [-0.24, 0.02, 0.08], [0.18, 0.07, 0.12], "#594897");
  addSphere(group, [0.24, 0.02, 0.08], [0.18, 0.07, 0.12], "#594897");
  addEyes(group, 0, 0.73, 0.5, 0.22, 0.82);
  addBlush(group, 0, 0.56, 0.52, 0.16, 0.62);
  addTube(group, [[-0.22, 0.46, 0.5], [-0.06, 0.36, 0.56], [0.12, 0.38, 0.54], [0.28, 0.48, 0.5]], "#2c2033", 0.035);
  addCone(group, 0.05, 0.12, [-0.02, 0.36, 0.58], "#ffffff", [Math.PI / 2, 0, 0], 16);
  addSphere(group, [0.08, 0.35, 0.57], [0.07, 0.035, 0.016], "#f98c98", [0.14, 0, 0], false, true);
}

function buildRobot(group: THREE.Group): void {
  addToyFootprintPlate(group, [0, 0.06], [0.54, 0.36], "#b7c2bd", 0.52);
  addRoundedBox(group, [0.72, 0.52, 0.52], [0, 1.03, 0], "#a9b4bf", 0.13);
  addRoundedBox(group, [0.86, 0.82, 0.56], [0, 0.43, 0], "#728390", 0.14);
  addRoundedBox(group, [0.66, 0.46, 0.055], [0, 1.03, 0.285], "#d7e0e1", 0.08, [0, 0, 0], true);
  addCylinder(group, 0.035, 0.035, 0.34, [0, 1.43, 0], "#5a6570");
  addSphere(group, [0, 1.64, 0], [0.09, 0.09, 0.09], "#e96d52");
  addGlowSphere(group, [0, 1.64, 0], [0.14, 0.14, 0.14], "#ff8f72", 0.16);
  addEyes(group, 0, 1.08, 0.29, 0.16, 0.6);
  addSphere(group, [-0.16, 1.08, 0.34], [0.038, 0.048, 0.012], "#7ee9e0", [0, 0, 0], true, true);
  addSphere(group, [0.16, 1.08, 0.34], [0.038, 0.048, 0.012], "#7ee9e0", [0, 0, 0], true, true);
  addRoundedBox(group, [0.36, 0.06, 0.035], [0, 0.91, 0.29], "#2d3942", 0.02);
  addRoundedBox(group, [0.56, 0.28, 0.05], [0, 0.53, 0.31], "#24303a", 0.04, [0, 0, 0], true);
  addRoundedBox(group, [0.42, 0.18, 0.055], [0, 0.54, 0.335], "#79d9d4", 0.035, [0, 0, 0], true);
  addRoundedBox(group, [0.34, 0.11, 0.06], [0, 0.54, 0.365], "#1f343d", 0.026, [0, 0, 0], true);
  addRoundedBox(group, [0.26, 0.022, 0.065], [0, 0.61, 0.39], "#bffff9", 0.008, [0, 0, 0], true);
  addRoundedBox(group, [0.16, 0.018, 0.068], [-0.02, 0.49, 0.392], "#52d6d3", 0.008, [0, 0, -0.1], true);
  addTube(group, [[-0.11, 0.54, 0.4], [-0.02, 0.49, 0.41], [0.11, 0.54, 0.4]], "#7ee9e0", 0.01);
  addRoundedBox(group, [0.3, 0.08, 0.06], [-0.3, 0.83, 0.31], "#ecf4ee", 0.025, [0, 0, 0], true);
  addRoundedBox(group, [0.3, 0.08, 0.06], [0.3, 0.83, 0.31], "#c8d6d6", 0.025, [0, 0, 0], true);
  addSphere(group, [-0.22, 0.62, 0.37], [0.04, 0.04, 0.014], "#f6d06d", [0, 0, 0], true, true);
  addSphere(group, [0.22, 0.46, 0.37], [0.032, 0.032, 0.012], "#f08b6b", [0, 0, 0], true, true);
  addTube(group, [[-0.14, 0.56, 0.37], [-0.02, 0.5, 0.39], [0.12, 0.57, 0.37]], "#1d2a31", 0.012);
  [-0.18, 0, 0.18].forEach((x, index) => {
    addSphere(group, [x, 0.48, 0.31], [0.045, 0.045, 0.016], index === 1 ? "#ffe38c" : "#70d7cf", [0, 0, 0], index === 1, true);
  });
  addRoundedBox(group, [0.34, 0.13, 0.035], [0, 0.25, 0.31], "#56646c", 0.025, [0, 0, 0], true);
  addCapsule(group, 0.09, 0.48, [-0.58, 0.55, 0], "#6b7782", [0, 0, -0.38]);
  addCapsule(group, 0.09, 0.48, [0.58, 0.55, 0], "#6b7782", [0, 0, 0.38]);
  addSphere(group, [-0.72, 0.34, 0.12], [0.1, 0.08, 0.07], "#a9b4bf");
  addSphere(group, [0.72, 0.34, 0.12], [0.1, 0.08, 0.07], "#a9b4bf");
  addCapsule(group, 0.1, 0.2, [-0.24, 0.02, 0.02], "#59666f");
  addCapsule(group, 0.1, 0.2, [0.24, 0.02, 0.02], "#59666f");
  addCylinder(group, 0.12, 0.14, 0.08, [-0.24, 0.02, 0.18], "#3c4850", [Math.PI / 2, 0, 0], 18);
  addCylinder(group, 0.12, 0.14, 0.08, [0.24, 0.02, 0.18], "#3c4850", [Math.PI / 2, 0, 0], 18);
  addSphere(group, [-0.48, 0.82, 0.29], [0.035, 0.035, 0.012], "#f7ffff", [0, 0, 0], false, true);
  addSphere(group, [0.48, 0.82, 0.29], [0.035, 0.035, 0.012], "#f7ffff", [0, 0, 0], false, true);
  addRoundedBox(group, [0.5, 0.16, 0.025], [0, 0.56, 0.394], "#bffff8", 0.012, [0, 0, 0], true);
  addRoundedBox(group, [0.42, 0.095, 0.028], [0, 0.55, 0.414], "#10313a", 0.01, [0, 0, 0], true);
  [-0.34, 0.34].forEach((x) => {
    addCylinder(group, 0.052, 0.06, 0.038, [x, 1.2, 0.31], "#dfe7e8", [Math.PI / 2, 0, 0], 18, true);
    addSphere(group, [x, 1.2, 0.342], [0.032, 0.032, 0.012], "#ffffff", [0, 0, 0], false, true);
  });
  addGlowSphere(group, [0, 0.56, 0.43], [0.3, 0.07, 0.018], "#7ff7ef", 0.12);
  addSoftGlossPatch(group, [-0.2, 1.16, 0.33], [0.12, 0.026, 0.012], 0.34);
  addSoftGlossPatch(group, [-0.22, 0.72, 0.31], [0.18, 0.03, 0.014], 0.3);
  addInsetLine(
    group,
    [
      [-0.36, 0.78, 0.33],
      [-0.36, 0.3, 0.35],
      [0.36, 0.3, 0.35],
      [0.36, 0.78, 0.33],
    ],
    "#c4d4d2",
    0.01,
  );
  addSphere(group, [-0.46, 1.02, 0.29], [0.072, 0.072, 0.022], "#e3edf0", [0, 0, 0], false, true);
  addSphere(group, [0.46, 1.02, 0.29], [0.072, 0.072, 0.022], "#d4e0e3", [0, 0, 0], false, true);
  addHighlight(group, [-0.22, 1.17, 0.3], [0.08, 0.02, 0.012]);
}

function buildSkull(group: THREE.Group): void {
  addSphere(group, [0, 0.78, 0], [0.54, 0.5, 0.45], "#ebe6dc");
  addRoundedBox(group, [0.46, 0.4, 0.36], [0, 0.36, 0], "#d8d2c6", 0.09);
  addSphere(group, [-0.36, 0.74, 0.05], [0.11, 0.12, 0.08], "#ebe6dc");
  addSphere(group, [0.36, 0.74, 0.05], [0.11, 0.12, 0.08], "#ebe6dc");
  addSphere(group, [-0.18, 0.82, 0.39], [0.13, 0.16, 0.045], "#30343a", [0, 0, 0], false, true);
  addSphere(group, [0.18, 0.82, 0.39], [0.13, 0.16, 0.045], "#30343a", [0, 0, 0], false, true);
  addCone(group, 0.1, 0.16, [0, 0.65, 0.42], "#34383d", [Math.PI / 2, 0, Math.PI], 3);
  addTube(group, [[-0.1, 1.08, 0.35], [0.02, 0.98, 0.42], [0.14, 1.06, 0.35]], "#b7ada0", 0.018);
  [-0.16, 0, 0.16].forEach((x) => {
    addRoundedBox(group, [0.035, 0.18, 0.028], [x, 0.28, 0.21], "#817a70", 0.01);
  });
}

function buildLight(group: THREE.Group): void {
  addCylinder(group, 0.3, 0.38, 0.18, [0, 0.08, 0], "#6f6657", [0, 0, 0], 32);
  addRoundedBox(group, [0.42, 0.2, 0.3], [0, 0.26, 0], "#77715e", 0.06);
  addSphere(group, [0, 0.72, 0], [0.46, 0.52, 0.46], "#ffdb73", [0, 0, 0], true);
  addSphere(group, [-0.12, 0.9, 0.32], [0.14, 0.055, 0.018], "#fff8d0", [-0.1, 0, -0.12], true, true);
  addGlowSphere(group, [0, 0.72, 0], [0.68, 0.7, 0.68], "#ffe987", 0.18);
  addCylinder(group, 0.06, 0.06, 0.88, [0, 0.5, 0], "#f5c85b", [0, 0, Math.PI / 2], 16, true);
  addCylinder(group, 0.032, 0.032, 0.98, [-0.42, 0.48, 0.02], "#5b5148", [0.06, 0, -0.1], 12);
  addCylinder(group, 0.032, 0.032, 0.98, [0.42, 0.48, 0.02], "#5b5148", [0.06, 0, 0.1], 12);
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

function addToyFootprintPlate(
  group: THREE.Group,
  position: [number, number],
  scale: [number, number],
  color = "#d8c18d",
  opacity = 0.72,
): void {
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.035, 56, 1),
    createMaterial({
      color,
      roughness: 0.64,
      clearcoat: 0.18,
      transparent: opacity < 1,
      opacity,
    }),
  );
  plate.position.set(position[0], 0.022, position[1]);
  plate.scale.set(scale[0], 1, scale[1]);
  plate.rotation.y = -0.14;
  finishMesh(plate, true);
  group.add(plate);
}

function addSoftGlossPatch(
  group: THREE.Group,
  position: [number, number, number],
  scale: [number, number, number],
  opacity = 0.36,
  rotation: [number, number, number] = [-0.08, 0, -0.24],
): void {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 28, 12),
    createMaterial({
      color: "#fff8df",
      roughness: 0.16,
      clearcoat: 0.96,
      transparent: true,
      opacity,
    }),
  );
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  finishMesh(mesh, true);
  group.add(mesh);
}

function addInsetLine(
  group: THREE.Group,
  points: Array<[number, number, number]>,
  color = "#fff0cf",
  radius = 0.01,
): void {
  addTube(group, points, color, radius);
}

function addBush(group: THREE.Group, position: [number, number, number], scale = 0.16): void {
  const [x, y, z] = position;
  addSphere(group, [x, y + scale * 0.45, z], [scale * 1.1, scale * 0.78, scale * 0.95], "#4ba760");
  addSphere(group, [x - scale * 0.68, y + scale * 0.34, z + scale * 0.12], [scale * 0.78, scale * 0.6, scale * 0.72], "#68c674");
  addSphere(group, [x + scale * 0.7, y + scale * 0.36, z + scale * 0.02], [scale * 0.76, scale * 0.58, scale * 0.68], "#37894f");
  addSphere(group, [x - scale * 0.24, y + scale * 0.76, z + scale * 0.08], [scale * 0.6, scale * 0.5, scale * 0.52], "#8fe085");
  addHighlight(group, [x - scale * 0.34, y + scale * 0.82, z + scale * 0.5], [scale * 0.24, scale * 0.045, scale * 0.018]);
}

function addGrassTuft(group: THREE.Group, x: number, z: number, scale = 1): void {
  const blades: Array<[number, number, number, number]> = [
    [-0.05, 0.02, -0.24, 0.22],
    [0, 0.04, 0, 0.28],
    [0.06, -0.02, 0.24, 0.2],
  ];

  blades.forEach(([offsetX, offsetZ, tilt, height]) => {
    addCone(
      group,
      0.025 * scale,
      height * scale,
      [x + offsetX * scale, (height * scale) / 2, z + offsetZ * scale],
      "#58ad62",
      [tilt, 0, offsetX > 0 ? -0.22 : 0.22],
      8,
    );
  });
}

function addMiniFlower(group: THREE.Group, x: number, z: number, color: string, scale = 1): void {
  addCylinder(group, 0.01 * scale, 0.012 * scale, 0.16 * scale, [x, 0.1 * scale, z], "#458a4d", [0.08, 0, 0.1], 8);
  addSphere(group, [x, 0.19 * scale, z], [0.028 * scale, 0.028 * scale, 0.018 * scale], "#f6d95f", [0, 0, 0], true, true);
  [
    [-0.032, 0],
    [0.032, 0],
    [0, -0.032],
    [0, 0.032],
  ].forEach(([ox, oz]) => {
    addSphere(
      group,
      [x + ox * scale, 0.19 * scale, z + oz * scale],
      [0.026 * scale, 0.018 * scale, 0.018 * scale],
      color,
      [0, 0, 0],
      false,
      true,
    );
  });
}

function addStoneRing(group: THREE.Group, centerX: number, centerZ: number, radius: number, count: number): void {
  const colors = ["#b8a88d", "#9d927f", "#d4bc92", "#7e8178", "#c8a981"];

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const wobble = index % 3 === 0 ? 0.08 : index % 3 === 1 ? -0.03 : 0.03;
    const x = centerX + Math.cos(angle) * (radius + wobble);
    const z = centerZ + Math.sin(angle) * (radius * 0.66 + wobble * 0.32);
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.14 + (index % 4) * 0.012, 0),
      createMaterial({ color: colors[index % colors.length], roughness: 0.78, clearcoat: 0.16 }),
    );
    mesh.position.set(x, 0.16 + (index % 2) * 0.012, z);
    mesh.scale.set(1.24, 0.56, 0.9);
    mesh.rotation.set(0.18 + index * 0.03, angle, 0.08);
    finishMesh(mesh);
    group.add(mesh);

    if (index % 3 === 0) {
      addSphere(group, [x - 0.035, 0.245, z + 0.045], [0.045, 0.018, 0.022], "#fff5d7", [0, 0, -0.18], false, true);
    }
  }
}

function addGlassWaterCap(group: THREE.Group): void {
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.84, 0.98, 0.018, 80, 1),
    createMaterial({
      color: "#75e9f3",
      roughness: 0.12,
      clearcoat: 1,
      transparent: true,
      opacity: 0.38,
    }),
  );
  cap.position.set(0.02, 0.252, 0.02);
  cap.scale.set(1, 1, 0.66);
  cap.rotation.y = -0.1;
  finishMesh(cap, true);
  group.add(cap);

  const deepGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.74, 0.016, 72, 1),
    createMaterial({
      color: "#0a5e93",
      roughness: 0.24,
      clearcoat: 0.74,
      transparent: true,
      opacity: 0.5,
    }),
  );
  deepGlow.position.set(0.16, 0.238, -0.08);
  deepGlow.scale.set(1, 1, 0.6);
  deepGlow.rotation.y = 0.16;
  finishMesh(deepGlow, true);
  group.add(deepGlow);
}

function addWaterShoreFoam(group: THREE.Group): void {
  [
    { x: -0.78, z: -0.12, sx: 0.28, sz: 0.04, color: "#fff8dc", opacity: 0.62 },
    { x: -0.46, z: 0.58, sx: 0.22, sz: 0.036, color: "#f7e5b4", opacity: 0.5 },
    { x: 0.5, z: -0.54, sx: 0.24, sz: 0.036, color: "#fff2c4", opacity: 0.5 },
    { x: 0.78, z: 0.18, sx: 0.2, sz: 0.032, color: "#f4e0ad", opacity: 0.44 },
  ].forEach((foam, index) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 12),
      createMaterial({ color: foam.color, roughness: 0.5, clearcoat: 0.22, transparent: true, opacity: foam.opacity }),
    );
    mesh.position.set(foam.x, 0.235, foam.z);
    mesh.scale.set(foam.sx, 0.012, foam.sz);
    mesh.rotation.set(0, index * 0.42, -0.18 + index * 0.12);
    finishMesh(mesh, true);
    group.add(mesh);
  });
}

function addWaterRipples(group: THREE.Group): void {
  [
    {
      points: [
        [-0.76, 0.265, 0.2],
        [-0.36, 0.29, 0.02],
        [0.08, 0.268, 0.18],
        [0.58, 0.286, -0.02],
      ] as Array<[number, number, number]>,
      color: "#d9fbff",
      radius: 0.026,
    },
    {
      points: [
        [-0.38, 0.272, -0.32],
        [-0.08, 0.258, -0.42],
        [0.28, 0.276, -0.28],
      ] as Array<[number, number, number]>,
      color: "#98ecff",
      radius: 0.021,
    },
    {
      points: [
        [-0.52, 0.258, 0.02],
        [-0.2, 0.268, 0.18],
        [0.18, 0.26, 0.08],
        [0.48, 0.27, 0.2],
      ] as Array<[number, number, number]>,
      color: "#0e7fa1",
      radius: 0.018,
    },
  ].forEach((ripple) => addTube(group, ripple.points, ripple.color, ripple.radius));
}

function addWaterBubbles(group: THREE.Group): void {
  [
    [-0.28, 0.315, 0.38, 0.045],
    [0.34, 0.31, 0.24, 0.035],
    [0.1, 0.305, -0.48, 0.03],
    [-0.02, 0.315, 0.02, 0.026],
    [0.55, 0.306, -0.16, 0.022],
  ].forEach(([x, y, z, size], index) => {
    addSphere(
      group,
      [x, y, z],
      [size, size * 0.42, size],
      index % 2 === 0 ? "#ffffff" : "#d7fbff",
      [0, 0, 0],
      false,
      true,
    );
  });
}

function addLilyPad(group: THREE.Group, x: number, z: number, scale = 0.32, rotation = 0): void {
  addSphere(
    group,
    [x, 0.305, z],
    [scale, 0.026, scale * 0.62],
    "#58bb72",
    [0, rotation, -0.08],
    false,
    true,
  );
  addSphere(
    group,
    [x - scale * 0.16, 0.322, z + scale * 0.06],
    [scale * 0.22, 0.012, scale * 0.08],
    "#d8ffe3",
    [0, rotation, -0.18],
    false,
    true,
  );
  addCone(
    group,
    scale * 0.2,
    scale * 0.22,
    [x + scale * 0.42, 0.326, z + scale * 0.1],
    "#1f8f5a",
    [Math.PI / 2, rotation, -Math.PI / 2],
    3,
  );
  addMiniFlower(group, x - scale * 0.08, z + scale * 0.08, "#f6b2c8", scale * 1.18);
}

function addReeds(group: THREE.Group, x: number, z: number, scale = 1): void {
  addGrassTuft(group, x, z, scale);
  [
    { ox: -0.035, oz: 0.02, h: 0.42, tilt: -0.18 },
    { ox: 0.035, oz: -0.02, h: 0.36, tilt: 0.2 },
    { ox: 0.085, oz: 0.03, h: 0.3, tilt: 0.3 },
  ].forEach((reed, index) => {
    addCylinder(
      group,
      0.012 * scale,
      0.016 * scale,
      reed.h * scale,
      [x + reed.ox * scale, (reed.h * scale) / 2 + 0.06, z + reed.oz * scale],
      index === 0 ? "#6aa35e" : "#4f8d55",
      [reed.tilt, 0, reed.ox > 0 ? -0.12 : 0.12],
      8,
    );
    addSphere(
      group,
      [x + reed.ox * scale + reed.tilt * 0.05, reed.h * scale + 0.1, z + reed.oz * scale],
      [0.025 * scale, 0.07 * scale, 0.018 * scale],
      index === 1 ? "#d9a65d" : "#7b5b3f",
      [0.1, 0, reed.tilt],
    );
  });
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
    addSphere(group, [centerX + x - 0.008 * scale, centerY + 0.02 * scale, z + 0.038 * scale], [0.012 * scale, 0.014 * scale, 0.006 * scale], "#ffffff", [0, 0, 0], false, true);
  });
}

function addBlush(
  group: THREE.Group,
  centerX: number,
  centerY: number,
  z: number,
  spread: number,
  scale = 1,
): void {
  [-spread, spread].forEach((x) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 12),
      createMaterial({ color: "#f29b83", roughness: 0.64, transparent: true, opacity: 0.34 }),
    );
    mesh.position.set(centerX + x, centerY, z);
    mesh.scale.set(0.052 * scale, 0.025 * scale, 0.01 * scale);
    finishMesh(mesh, true);
    group.add(mesh);
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

function addGlowSphere(
  group: THREE.Group,
  position: [number, number, number],
  scale: [number, number, number],
  color: string,
  opacity: number,
): void {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 36, 22),
    createMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.5,
      roughness: 0.34,
      transparent: true,
      opacity,
      clearcoat: 0.18,
    }),
  );
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  finishMesh(mesh, true);
  group.add(mesh);
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
  roughness = 0.54,
  metalness = 0.03,
  emissive,
  emissiveIntensity = 0,
  sheen = 0.3,
  clearcoat = 0.46,
  transparent = false,
  opacity = 1,
}: MeshOptions): THREE.MeshPhysicalMaterial {
  const clayBump = getClayBumpTexture();
  const clayRoughness = getClayRoughnessTexture();
  const materialColor = new THREE.Color(color);
  const isMetal = metalness > 0.18;
  const softenedColor = isMetal ? materialColor : materialColor.lerp(new THREE.Color("#fff8e8"), 0.012);
  const resolvedRoughness = Math.min(0.62, Math.max(0.2, isMetal ? roughness * 0.68 : roughness * 0.74));
  const resolvedClearcoat = transparent ? clearcoat * 0.52 : Math.min(0.88, Math.max(0.56, clearcoat + 0.14));

  return new THREE.MeshPhysicalMaterial({
    alphaTest: transparent ? 0.02 : 0,
    bumpMap: clayBump,
    bumpScale: transparent ? 0.0018 : isMetal ? 0.0025 : 0.008,
    clearcoat: resolvedClearcoat,
    clearcoatRoughness: isMetal ? 0.22 : 0.27,
    color: softenedColor,
    emissive: emissive ?? "#000000",
    emissiveIntensity,
    envMapIntensity: transparent ? 1.12 : isMetal ? 0.94 : 0.86,
    ior: 1.42,
    metalness,
    opacity,
    reflectivity: isMetal ? 0.72 : 0.62,
    roughness: resolvedRoughness,
    roughnessMap: clayRoughness,
    sheen: isMetal ? sheen * 0.28 : Math.min(0.68, sheen + 0.18),
    sheenColor: new THREE.Color("#fff2d8"),
    sheenRoughness: 0.7,
    specularColor: new THREE.Color("#fff8e5"),
    specularIntensity: isMetal ? 0.78 : 0.74,
    transparent,
  });
}

function getStudioEnvironmentTexture(): THREE.CanvasTexture {
  if (studioEnvironmentTexture) {
    return studioEnvironmentTexture;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (context) {
    const skyGradient = context.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, "#dff6ff");
    skyGradient.addColorStop(0.36, "#fff7e6");
    skyGradient.addColorStop(0.64, "#ffd9a5");
    skyGradient.addColorStop(1, "#6c8c8b");
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const windowGlow = context.createRadialGradient(122, 58, 8, 122, 58, 118);
    windowGlow.addColorStop(0, "rgba(255,255,255,0.98)");
    windowGlow.addColorStop(0.42, "rgba(255,250,223,0.48)");
    windowGlow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = windowGlow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const coolRim = context.createRadialGradient(420, 86, 4, 420, 86, 138);
    coolRim.addColorStop(0, "rgba(190,242,255,0.62)");
    coolRim.addColorStop(1, "rgba(190,242,255,0)");
    context.fillStyle = coolRim;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.globalAlpha = 0.12;
    context.fillStyle = "#ffffff";
    for (let index = 0; index < 18; index += 1) {
      const x = 24 + index * 28;
      context.fillRect(x, 18 + (index % 4) * 9, 18, 2);
    }
  }

  studioEnvironmentTexture = new THREE.CanvasTexture(canvas);
  studioEnvironmentTexture.mapping = THREE.EquirectangularReflectionMapping;
  studioEnvironmentTexture.colorSpace = THREE.SRGBColorSpace;
  studioEnvironmentTexture.needsUpdate = true;
  return studioEnvironmentTexture;
}

function getClayBumpTexture(): THREE.CanvasTexture {
  if (clayBumpTexture) {
    return clayBumpTexture;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "#808080";
    context.fillRect(0, 0, canvas.width, canvas.height);
    let seed = 137;
    for (let index = 0; index < 1850; index += 1) {
      seed = (seed * 9301 + 49297) % 233280;
      const x = (seed / 233280) * canvas.width;
      seed = (seed * 9301 + 49297) % 233280;
      const y = (seed / 233280) * canvas.height;
      seed = (seed * 9301 + 49297) % 233280;
      const value = 104 + Math.round((seed / 233280) * 48);
      context.fillStyle = `rgba(${value}, ${value}, ${value}, ${0.12 + (index % 5) * 0.025})`;
      context.fillRect(x, y, 1, 1);
    }
    context.globalAlpha = 0.24;
    context.strokeStyle = "#9a9a9a";
    for (let line = 0; line < 12; line += 1) {
      context.beginPath();
      context.moveTo(-8, line * 12 + 3);
      context.quadraticCurveTo(42, line * 12 - 5, 136, line * 12 + 8);
      context.stroke();
    }
  }

  clayBumpTexture = new THREE.CanvasTexture(canvas);
  clayBumpTexture.wrapS = THREE.RepeatWrapping;
  clayBumpTexture.wrapT = THREE.RepeatWrapping;
  clayBumpTexture.repeat.set(2.8, 2.8);
  clayBumpTexture.colorSpace = THREE.NoColorSpace;
  clayBumpTexture.needsUpdate = true;
  return clayBumpTexture;
}

function getClayRoughnessTexture(): THREE.CanvasTexture {
  if (clayRoughnessTexture) {
    return clayRoughnessTexture;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");

  if (context) {
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#c5c5c5");
    gradient.addColorStop(0.5, "#ededed");
    gradient.addColorStop(1, "#b8b8b8");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    let seed = 719;
    for (let index = 0; index < 900; index += 1) {
      seed = (seed * 9301 + 49297) % 233280;
      const x = (seed / 233280) * canvas.width;
      seed = (seed * 9301 + 49297) % 233280;
      const y = (seed / 233280) * canvas.height;
      const alpha = 0.05 + (index % 7) * 0.012;
      context.fillStyle = index % 2 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(90,90,90,${alpha})`;
      context.fillRect(x, y, 1.2, 1.2);
    }
  }

  clayRoughnessTexture = new THREE.CanvasTexture(canvas);
  clayRoughnessTexture.wrapS = THREE.RepeatWrapping;
  clayRoughnessTexture.wrapT = THREE.RepeatWrapping;
  clayRoughnessTexture.repeat.set(1.8, 1.8);
  clayRoughnessTexture.colorSpace = THREE.NoColorSpace;
  clayRoughnessTexture.needsUpdate = true;
  return clayRoughnessTexture;
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
