import Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image as KonvaImage, Rect } from "react-konva";
import * as THREE from "three";
import type { SandboxCameraState, SandboxEnvironment } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../utils/analysis";
import {
  getDepthScale,
  getProjectedStageCorners,
  projectPoint,
  projectRect,
  STAGE_THICKNESS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "../utils/projection";

interface ThreeSandboxStageLayerProps {
  camera: SandboxCameraState;
  environment: SandboxEnvironment;
}

interface AnimatedMesh {
  mesh: THREE.Object3D;
  baseX: number;
  baseY: number;
  amplitude: number;
  speed: number;
  phase: number;
}

interface StageSceneBundle {
  scene: THREE.Scene;
  animated: AnimatedMesh[];
  dispose: () => void;
}

const THREE_STAGE_PIXEL_RATIO = 2.05;

export function ThreeSandboxStageLayer({ camera, environment }: ThreeSandboxStageLayerProps): JSX.Element {
  const imageRef = useRef<Konva.Image | null>(null);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const cameraKey = useMemo(
    () =>
      [
        Math.round(camera.panX),
        Math.round(camera.panY),
        camera.zoom.toFixed(3),
        camera.yaw.toFixed(1),
        camera.pitch.toFixed(3),
        environment.weather,
        environment.light,
      ].join(":"),
    [camera, environment],
  );

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const renderCanvas = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: renderCanvas,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    const pixelRatio = Math.min(window.devicePixelRatio || 1, THREE_STAGE_PIXEL_RATIO);

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(VIEW_WIDTH, VIEW_HEIGHT, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const stageCamera = new THREE.OrthographicCamera(0, VIEW_WIDTH, 0, VIEW_HEIGHT, -1000, 1000);
    stageCamera.position.set(0, 0, 100);
    stageCamera.lookAt(0, 0, 0);

    const bundle = createStageScene(camera, environment);
    let raf = 0;
    setCanvas(renderCanvas);

    const render = (time: number) => {
      const seconds = time / 1000;
      bundle.animated.forEach((item) => {
        item.mesh.position.x = item.baseX + Math.sin(seconds * item.speed + item.phase) * item.amplitude;
        item.mesh.position.y = item.baseY + Math.cos(seconds * item.speed * 0.72 + item.phase) * item.amplitude * 0.28;
      });
      renderer.render(bundle.scene, stageCamera);
      imageRef.current?.getLayer()?.batchDraw();
      raf = window.requestAnimationFrame(render);
    };

    renderer.render(bundle.scene, stageCamera);
    imageRef.current?.getLayer()?.batchDraw();
    raf = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(raf);
      bundle.dispose();
      renderer.dispose();
      setCanvas((current) => (current === renderCanvas ? null : current));
    };
  }, [cameraKey]);

  if (!canvas) {
    return (
      <Rect
        x={0}
        y={0}
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        fill={environment.light === "night" ? "#0b1821" : "#f4ead4"}
        listening={false}
      />
    );
  }

  return <KonvaImage ref={imageRef} image={canvas} x={0} y={0} width={VIEW_WIDTH} height={VIEW_HEIGHT} listening={false} />;
}

function createStageScene(camera: SandboxCameraState, environment: SandboxEnvironment): StageSceneBundle {
  const scene = new THREE.Scene();
  const disposables: Array<{ dispose: () => void }> = [];
  const animated: AnimatedMesh[] = [];
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const corners = getProjectedStageCorners(camera);
  const outer = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];
  const innerWood = pointsFromRect(projectRect(28, 26, BOARD_WIDTH - 56, BOARD_HEIGHT - 52, camera));
  const linerOuter = pointsFromRect(projectRect(44, 42, BOARD_WIDTH - 88, BOARD_HEIGHT - 84, camera));
  const sand = pointsFromRect(projectRect(64, 62, BOARD_WIDTH - 128, BOARD_HEIGHT - 124, camera));
  const frontFace = [
    corners.bottomLeft,
    corners.bottomRight,
    { x: corners.bottomRight.x, y: corners.bottomRight.y + STAGE_THICKNESS },
    { x: corners.bottomLeft.x, y: corners.bottomLeft.y + STAGE_THICKNESS },
  ];
  const leftFace = [
    corners.topLeft,
    corners.bottomLeft,
    { x: corners.bottomLeft.x, y: corners.bottomLeft.y + STAGE_THICKNESS },
    { x: corners.topLeft.x, y: corners.topLeft.y + STAGE_THICKNESS * 0.72 },
  ];
  const rightFace = [
    corners.topRight,
    corners.bottomRight,
    { x: corners.bottomRight.x, y: corners.bottomRight.y + STAGE_THICKNESS },
    { x: corners.topRight.x, y: corners.topRight.y + STAGE_THICKNESS * 0.72 },
  ];

  const addMaterial = (material: THREE.Material) => {
    if ("side" in material) {
      (material as THREE.Material & { side: THREE.Side }).side = THREE.DoubleSide;
    }
    disposables.push(material);
    return material;
  };
  const addTexture = (texture: THREE.Texture) => {
    disposables.push(texture);
    return texture;
  };

  const backgroundTexture = addTexture(createBackdropTexture(environment));
  const tableTexture = addTexture(createTableTexture(environment));
  const sandTexture = addTexture(createSandTexture(environment));
  const woodTexture = addTexture(createWoodTexture(environment));
  const blueTexture = addTexture(createBlueLinerTexture(environment));
  const compositeTexture = addTexture(createStageCompositeTexture(camera, environment));

  addPlane(
    scene,
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.5,
    VIEW_WIDTH,
    VIEW_HEIGHT,
    addMaterial(new THREE.MeshBasicMaterial({ map: backgroundTexture, transparent: true, depthTest: false, depthWrite: false })),
    -40,
  );

  addPlane(
    scene,
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.74,
    VIEW_WIDTH * 1.05,
    VIEW_HEIGHT * 0.42,
    addMaterial(new THREE.MeshBasicMaterial({ map: tableTexture, transparent: true, opacity: night ? 0.78 : 0.88, depthTest: false, depthWrite: false })),
    -32,
  );

  const broadShadow = createEllipseMesh(
    (corners.bottomLeft.x + corners.bottomRight.x) * 0.5,
    corners.bottomLeft.y + STAGE_THICKNESS * 0.82,
    Math.max(430, Math.abs(corners.bottomRight.x - corners.bottomLeft.x) * 0.54),
    night ? 76 : 90,
    night ? 0x02090d : 0x715128,
    night ? 0.36 : 0.16,
    -30,
  );
  scene.add(broadShadow);
  disposables.push((broadShadow as THREE.Mesh).geometry, (broadShadow as THREE.Mesh).material as THREE.Material);

  const leftFaceMesh = addPolygon(scene, leftFace, addMaterial(material({ color: night ? "#5f4d36" : "#a67b4a", opacity: 0.96 })), -18);
  const rightFaceMesh = addPolygon(scene, rightFace, addMaterial(material({ color: night ? "#765633" : "#8d6238", opacity: 0.98 })), -17);
  const frontFaceMesh = addPolygon(scene, frontFace, addMaterial(new THREE.MeshBasicMaterial({ map: woodTexture, transparent: true, opacity: night ? 0.86 : 1, depthTest: false, depthWrite: false })), -16);
  disposables.push(leftFaceMesh.geometry, rightFaceMesh.geometry, frontFaceMesh.geometry);

  const topFrame = addRing(scene, outer, innerWood, addMaterial(new THREE.MeshBasicMaterial({ map: woodTexture, transparent: true, opacity: night ? 0.94 : 1, depthTest: false, depthWrite: false })), -12);
  disposables.push(topFrame.geometry);

  const liner = addRing(
    scene,
    innerWood,
    linerOuter,
    addMaterial(new THREE.MeshBasicMaterial({ map: blueTexture, transparent: true, opacity: night ? 0.92 : 0.96, depthTest: false, depthWrite: false })),
    -10,
  );
  disposables.push(liner.geometry);

  const sandMesh = addPolygon(
    scene,
    sand,
    addMaterial(new THREE.MeshBasicMaterial({ map: sandTexture, transparent: true, opacity: 1, depthTest: false, depthWrite: false })),
    -8,
  );
  disposables.push(sandMesh.geometry);

  addSandRelief(scene, camera, environment, disposables);
  addFrameHighlights(scene, outer, innerWood, environment, disposables);
  addAtmosphereOverlays(scene, environment, animated, disposables);

  const compositeStage = addPlane(
    scene,
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.5,
    VIEW_WIDTH,
    VIEW_HEIGHT,
    addMaterial(new THREE.MeshBasicMaterial({
      map: compositeTexture,
      transparent: false,
      depthTest: false,
      depthWrite: false,
    })),
    -1,
  );
  disposables.push(compositeStage.geometry);

  return {
    scene,
    animated,
    dispose: () => {
      disposables.forEach((item) => item.dispose());
      scene.clear();
    },
  };
}

function pointsFromRect(points: number[]): Array<{ x: number; y: number }> {
  return [
    { x: points[0], y: points[1] },
    { x: points[2], y: points[3] },
    { x: points[4], y: points[5] },
    { x: points[6], y: points[7] },
  ];
}

function material({ color, opacity = 1 }: { color: string; opacity?: number }): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
}

function addPlane(
  scene: THREE.Scene,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  material: THREE.Material,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(centerX, centerY, z);
  mesh.renderOrder = z + 1000;
  scene.add(mesh);
  return mesh;
}

function addPolygon(
  scene: THREE.Scene,
  points: Array<{ x: number; y: number }>,
  material: THREE.Material,
  z: number,
): THREE.Mesh<THREE.ShapeGeometry, THREE.Material> {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) {
      shape.moveTo(point.x, point.y);
    } else {
      shape.lineTo(point.x, point.y);
    }
  });
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = z;
  mesh.renderOrder = z + 1000;
  scene.add(mesh);
  return mesh;
}

function addRing(
  scene: THREE.Scene,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  material: THREE.Material,
  z: number,
): THREE.Mesh<THREE.ShapeGeometry, THREE.Material> {
  const shape = new THREE.Shape();
  outer.forEach((point, index) => {
    if (index === 0) {
      shape.moveTo(point.x, point.y);
    } else {
      shape.lineTo(point.x, point.y);
    }
  });
  shape.closePath();

  const hole = new THREE.Path();
  [...inner].reverse().forEach((point, index) => {
    if (index === 0) {
      hole.moveTo(point.x, point.y);
    } else {
      hole.lineTo(point.x, point.y);
    }
  });
  hole.closePath();
  shape.holes.push(hole);

  const geometry = new THREE.ShapeGeometry(shape);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = z;
  mesh.renderOrder = z + 1000;
  scene.add(mesh);
  return mesh;
}

function addSandRelief(
  scene: THREE.Scene,
  camera: SandboxCameraState,
  environment: SandboxEnvironment,
  disposables: Array<{ dispose: () => void }>,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const seeds = [41, 173, 307, 601, 811, 941, 1201, 1571, 1811, 2143, 2671, 3251];

  seeds.forEach((seed, index) => {
    const x = 84 + random(seed) * (BOARD_WIDTH - 168);
    const y = 72 + random(seed + 9) * (BOARD_HEIGHT - 144);
    const p = projectPoint({ x, y }, camera);
    const mesh = createEllipseMesh(
      p.x,
      p.y,
      28 + random(seed + 13) * 48,
      5 + random(seed + 21) * 10,
      index % 2 === 0 ? (night ? 0xc9d4bf : 0xffefbc) : (night ? 0x4b493e : 0x8b7048),
      index % 2 === 0 ? (night ? 0.035 : 0.07) : (night ? 0.04 : 0.055),
      -4,
      -0.08 + random(seed + 31) * 0.16,
    );
    scene.add(mesh);
    disposables.push(mesh.geometry, mesh.material as THREE.Material);
  });

  for (let index = 0; index < 54; index += 1) {
    const x = 92 + random(index * 59 + 101) * (BOARD_WIDTH - 184);
    const y = 76 + random(index * 67 + 113) * (BOARD_HEIGHT - 152);
    const p = projectPoint({ x, y }, camera);
    const ridge = createEllipseMesh(
      p.x,
      p.y,
      10 + random(index * 71 + 127) * 34,
      0.42 + random(index * 79 + 131) * 1.25,
      index % 3 === 0 ? (night ? 0xd9eee4 : 0xfff5c4) : night ? 0x2d403e : rainy ? 0x715f4b : 0x9a7447,
      index % 3 === 0 ? (night ? 0.07 : 0.105) : rainy ? 0.045 : night ? 0.05 : 0.06,
      -2.7,
      -0.17 + camera.yaw * 0.006 + random(index * 83 + 137) * 0.34,
    );
    scene.add(ridge);
    disposables.push(ridge.geometry, ridge.material as THREE.Material);
  }

  for (let index = 0; index < 180; index += 1) {
    const x = 72 + random(index * 31 + 17) * (BOARD_WIDTH - 144);
    const y = 64 + random(index * 43 + 29) * (BOARD_HEIGHT - 128);
    const p = projectPoint({ x, y }, camera);
    const dot = createEllipseMesh(
      p.x,
      p.y,
      0.8 + random(index + 3) * 2.4,
      0.4 + random(index + 7) * 0.9,
      index % 4 === 0 ? 0xffffff : 0x8f744c,
      index % 4 === 0 ? 0.16 : 0.08,
      -2,
      random(index + 11) * Math.PI,
    );
    scene.add(dot);
    disposables.push(dot.geometry, dot.material as THREE.Material);
  }
}

function addFrameHighlights(
  scene: THREE.Scene,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  disposables: Array<{ dispose: () => void }>,
): void {
  const night = environment.light === "night";
  const topEdge = addLineMesh(
    [outer[0], outer[1], inner[1], inner[0]],
    night ? 0xa7fff5 : 0xffe6af,
    night ? 0.16 : 0.28,
  );
  const frontEdge = addLineMesh(
    [inner[3], inner[2], outer[2], outer[3]],
    night ? 0x24180f : 0x57371d,
    night ? 0.26 : 0.22,
  );
  [topEdge, frontEdge].forEach((mesh) => {
    scene.add(mesh);
    disposables.push(mesh.geometry, mesh.material as THREE.Material);
  });
}

function addAtmosphereOverlays(
  scene: THREE.Scene,
  environment: SandboxEnvironment,
  animated: AnimatedMesh[],
  disposables: Array<{ dispose: () => void }>,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const opacity = night ? 0.055 : rainy ? 0.07 : cloudy ? 0.05 : 0.04;
  const color = night ? 0x7ccfd8 : rainy ? 0x8fb4bd : 0xffffff;

  [
    { x: VIEW_WIDTH * 0.22, y: VIEW_HEIGHT * 0.22, rx: 190, ry: 46, phase: 0.4 },
    { x: VIEW_WIDTH * 0.72, y: VIEW_HEIGHT * 0.24, rx: 230, ry: 58, phase: 1.8 },
    { x: VIEW_WIDTH * 0.56, y: VIEW_HEIGHT * 0.58, rx: 340, ry: 64, phase: 2.7 },
  ].forEach((cloud) => {
    const mesh = createEllipseMesh(cloud.x, cloud.y, cloud.rx, cloud.ry, color, opacity, -31, -0.08);
    scene.add(mesh);
    disposables.push(mesh.geometry, mesh.material as THREE.Material);
    animated.push({ mesh, baseX: cloud.x, baseY: cloud.y, amplitude: rainy ? 7 : 4, speed: rainy ? 0.14 : 0.08, phase: cloud.phase });
  });
}

function addLineMesh(
  points: Array<{ x: number; y: number }>,
  color: number,
  opacity: number,
): THREE.Mesh<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  const vertices: number[] = [];
  points.forEach((point) => {
    vertices.push(point.x, point.y, 0);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
  const line = new THREE.LineLoop(geometry, material);
  line.renderOrder = 1005;
  return line as unknown as THREE.Mesh<THREE.BufferGeometry, THREE.LineBasicMaterial>;
}

function createEllipseMesh(
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  color: number,
  opacity: number,
  z: number,
  rotation = 0,
): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
  const geometry = new THREE.CircleGeometry(1, 48);
  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(radiusX, radiusY, 1);
  mesh.rotation.z = rotation;
  mesh.renderOrder = z + 1000;
  return mesh;
}

function createBackdropTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  return createTexture(1024, 640, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, night ? "#102532" : rainy ? "#dde5d8" : cloudy ? "#e8ecd8" : "#fffdf1");
    gradient.addColorStop(0.45, night ? "#0f202c" : rainy ? "#cdd9ce" : cloudy ? "#eef2df" : "#eef5e4");
    gradient.addColorStop(1, night ? "#07141d" : rainy ? "#c7bca4" : cloudy ? "#e1ccb1" : "#e8c99a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    drawSoftEllipse(context, width * 0.28, height * 0.15, 180, 40, night ? "rgba(115,210,216,0.08)" : "rgba(255,255,255,0.58)");
    drawSoftEllipse(context, width * 0.7, height * 0.18, 230, 52, night ? "rgba(92,166,187,0.08)" : "rgba(255,252,220,0.52)");
    drawWindowSlats(context, width, height, night);

    if (!night) {
      const sunWash = context.createRadialGradient(width * 0.46, height * 0.02, 20, width * 0.46, height * 0.12, width * 0.62);
      sunWash.addColorStop(0, "rgba(255,255,248,0.78)");
      sunWash.addColorStop(0.42, rainy ? "rgba(226,235,221,0.22)" : "rgba(255,229,165,0.28)");
      sunWash.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = sunWash;
      context.fillRect(0, 0, width, height * 0.7);

      context.save();
      context.filter = "blur(16px)";
      context.globalAlpha = rainy ? 0.18 : cloudy ? 0.22 : 0.32;
      const plantPalette = rainy
        ? ["#7e9878", "#6c876e", "#a48c62"]
        : cloudy
          ? ["#8aa678", "#9bb578", "#b99b62"]
          : ["#74a669", "#8cc274", "#c8a15f"];
      [
        { x: width * 0.08, y: height * 0.35, side: -1 },
        { x: width * 0.92, y: height * 0.34, side: 1 },
      ].forEach((plant, plantIndex) => {
        for (let leaf = 0; leaf < 11; leaf += 1) {
          context.fillStyle = plantPalette[(leaf + plantIndex) % plantPalette.length];
          context.beginPath();
          context.ellipse(
            plant.x + plant.side * (10 + random(plantIndex * 97 + leaf * 23) * 70),
            plant.y + random(plantIndex * 109 + leaf * 29) * 130,
            26 + random(plantIndex * 127 + leaf * 31) * 44,
            70 + random(plantIndex * 139 + leaf * 37) * 70,
            plant.side * (-0.68 + random(plantIndex * 149 + leaf * 41) * 0.78),
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      });
      context.restore();
    }

    if (night) {
      for (let index = 0; index < 78; index += 1) {
        const x = random(index * 19 + 5) * width;
        const y = random(index * 23 + 9) * height * 0.62;
        context.fillStyle = `rgba(235,255,245,${0.1 + random(index) * 0.22})`;
        context.fillRect(x, y, 1.2, 1.2);
      }
      drawSoftEllipse(context, width * 0.78, height * 0.2, 44, 44, "rgba(246,240,198,0.42)");
      drawSoftEllipse(context, width * 0.795, height * 0.19, 42, 42, "rgba(16,37,50,0.5)");
    }
  });
}

function createTableTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const night = environment.light === "night";
  return createTexture(1024, 256, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, night ? "rgba(26,53,62,0)" : "rgba(255,246,218,0)");
    gradient.addColorStop(0.32, night ? "rgba(20,39,46,0.56)" : "rgba(202,164,107,0.32)");
    gradient.addColorStop(1, night ? "rgba(6,14,19,0.72)" : "rgba(154,111,60,0.42)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 12; index += 1) {
      context.strokeStyle = night ? "rgba(129,184,184,0.08)" : "rgba(111,80,43,0.12)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, 24 + index * 18 + random(index) * 6);
      context.bezierCurveTo(width * 0.28, 10 + index * 19, width * 0.72, 38 + index * 15, width, 20 + index * 18);
      context.stroke();
    }
  });
}

function createSandTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  return createTexture(1280, 800, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, night ? "#d4c498" : rainy ? "#ecd6a6" : "#f4dca8");
    gradient.addColorStop(0.42, night ? "#bfaa7c" : rainy ? "#d2b789" : "#e3bd80");
    gradient.addColorStop(0.72, night ? "#a4885c" : rainy ? "#ba9368" : "#c9965d");
    gradient.addColorStop(1, night ? "#7b6041" : rainy ? "#9a7350" : "#ad7442");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const warmSpot = context.createRadialGradient(width * 0.38, height * 0.26, 20, width * 0.38, height * 0.26, width * 0.58);
    warmSpot.addColorStop(0, night ? "rgba(235,238,190,0.1)" : rainy ? "rgba(255,240,198,0.13)" : "rgba(255,244,205,0.2)");
    warmSpot.addColorStop(0.5, night ? "rgba(210,192,139,0.055)" : cloudy ? "rgba(244,232,190,0.09)" : "rgba(255,214,142,0.07)");
    warmSpot.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = warmSpot;
    context.fillRect(0, 0, width, height);

    const coolCompression = context.createRadialGradient(width * 0.78, height * 0.82, 12, width * 0.78, height * 0.82, width * 0.72);
    coolCompression.addColorStop(0, night ? "rgba(38,48,52,0.13)" : rainy ? "rgba(83,84,76,0.09)" : "rgba(132,94,45,0.07)");
    coolCompression.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = coolCompression;
    context.fillRect(0, 0, width, height);

    for (let index = 0; index < 3800; index += 1) {
      const x = random(index * 7 + 11) * width;
      const y = random(index * 13 + 17) * height;
      const alpha = 0.025 + random(index * 17 + 29) * 0.095;
      context.fillStyle = index % 4 === 0 ? `rgba(255,251,225,${alpha * 1.25})` : `rgba(112,82,48,${alpha * 0.48})`;
      context.fillRect(x, y, 0.62 + random(index) * 1.38, 0.55 + random(index + 3) * 1.05);
    }

    context.lineCap = "round";
    for (let index = 0; index < 260; index += 1) {
      const x = 36 + random(index * 31 + 5) * (width - 72);
      const y = 34 + random(index * 37 + 9) * (height - 68);
      const length = 12 + random(index * 41 + 13) * 30;
      context.strokeStyle = index % 2 === 0 ? "rgba(255,244,195,0.055)" : "rgba(100,76,48,0.045)";
      context.lineWidth = 0.7 + random(index) * 0.9;
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(
        x + length * 0.42,
        y - 3 + random(index + 1) * 6,
        x + length,
        y + random(index + 3) * 7 - 3.5,
      );
      context.stroke();
    }

    for (let group = 0; group < 22; group += 1) {
      const startX = 64 + random(group * 97 + 19) * (width - 180);
      const startY = 58 + random(group * 103 + 23) * (height - 150);
      const length = 64 + random(group * 109 + 29) * 130;
      const curve = -10 + random(group * 113 + 31) * 20;
      for (let line = 0; line < 4; line += 1) {
        const y = startY + line * (4.2 + random(group * 127 + line) * 2.4);
      context.strokeStyle = line % 2 === 0 ? "rgba(255,244,198,0.095)" : "rgba(84,58,31,0.058)";
        context.lineWidth = 0.75 + random(group * 131 + line) * 0.9;
        context.beginPath();
        context.moveTo(startX, y);
        context.bezierCurveTo(startX + length * 0.3, y + curve, startX + length * 0.68, y - curve * 0.48, startX + length, y + curve * 0.24);
        context.stroke();
      }
    }

    for (let index = 0; index < 36; index += 1) {
      const x = 48 + random(index * 149 + 41) * (width - 96);
      const y = 46 + random(index * 157 + 47) * (height - 92);
      drawSoftEllipse(
        context,
        x,
        y,
        18 + random(index * 163 + 53) * 60,
        4 + random(index * 167 + 59) * 13,
        index % 2 === 0 ? (night ? "rgba(230,243,220,0.055)" : "rgba(255,245,201,0.08)") : "rgba(77,57,38,0.05)",
      );
    }
  });
}

function createWoodTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const night = environment.light === "night";
  return createTexture(1024, 256, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, night ? "#9c7548" : "#f0c889");
    gradient.addColorStop(0.45, night ? "#775532" : "#c99155");
    gradient.addColorStop(1, night ? "#4d3421" : "#8b5d34");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const topBevel = context.createLinearGradient(0, 0, 0, 34);
    topBevel.addColorStop(0, night ? "rgba(255,226,166,0.18)" : "rgba(255,242,192,0.36)");
    topBevel.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = topBevel;
    context.fillRect(0, 0, width, 34);

    const bottomBevel = context.createLinearGradient(0, height - 42, 0, height);
    bottomBevel.addColorStop(0, "rgba(255,255,255,0)");
    bottomBevel.addColorStop(1, night ? "rgba(28,17,10,0.42)" : "rgba(71,37,15,0.34)");
    context.fillStyle = bottomBevel;
    context.fillRect(0, height - 42, width, 42);

    for (let index = 0; index < 44; index += 1) {
      context.strokeStyle = index % 3 === 0 ? "rgba(255,238,188,0.28)" : "rgba(88,49,22,0.16)";
      context.lineWidth = 1 + random(index) * 2.2;
      const y = random(index * 23 + 5) * height;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(width * 0.28, y + random(index + 1) * 20 - 10, width * 0.72, y + random(index + 2) * 30 - 15, width, y + random(index + 3) * 22 - 11);
      context.stroke();
    }

    for (let index = 0; index < 18; index += 1) {
      const x = random(index * 41 + 7) * width;
      const y = random(index * 53 + 13) * height;
      const rx = 16 + random(index) * 38;
      const ry = 4 + random(index + 2) * 12;
      drawSoftEllipse(
        context,
        x,
        y,
        rx,
        ry,
        "rgba(92,54,24,0.13)",
      );
      context.strokeStyle = night ? "rgba(255,221,160,0.08)" : "rgba(255,236,184,0.16)";
      context.lineWidth = 0.8;
      context.beginPath();
      context.ellipse(x, y, rx * 0.44, Math.max(1.5, ry * 0.42), random(index * 61 + 17) * Math.PI, 0, Math.PI * 2);
      context.stroke();
    }
  });
}

function createBlueLinerTexture(environment: SandboxEnvironment): THREE.CanvasTexture {
  const night = environment.light === "night";
  return createTexture(512, 256, (context, width, height) => {
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, night ? "#0e7fa1" : "#28aede");
    gradient.addColorStop(0.52, night ? "#075e7d" : "#0f83b8");
    gradient.addColorStop(1, night ? "#0a3b52" : "#08699a");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 8; index += 1) {
      context.strokeStyle = index % 2 === 0 ? "rgba(219,255,255,0.24)" : "rgba(0,53,91,0.22)";
      context.lineWidth = 5 + index * 1.4;
      context.strokeRect(18 + index * 18, 18 + index * 8, width - 36 - index * 36, height - 36 - index * 16);
    }
  });
}

function createStageCompositeTexture(
  camera: SandboxCameraState,
  environment: SandboxEnvironment,
): THREE.CanvasTexture {
  const textureScale = 2.65;
  return createTexture(Math.round(VIEW_WIDTH * textureScale), Math.round(VIEW_HEIGHT * textureScale), (context, width, height) => {
    context.save();
    context.scale(width / VIEW_WIDTH, height / VIEW_HEIGHT);
    paintCompositeStage(context, camera, environment);
    context.restore();
  });
}

function paintCompositeStage(
  context: CanvasRenderingContext2D,
  camera: SandboxCameraState,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const corners = getProjectedStageCorners(camera);
  const outer = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft];
  const rimInner = pointsFromRect(projectRect(36, 30, BOARD_WIDTH - 72, BOARD_HEIGHT - 60, camera));
  const linerInner = pointsFromRect(projectRect(54, 48, BOARD_WIDTH - 108, BOARD_HEIGHT - 96, camera));
  const sand = pointsFromRect(projectRect(72, 64, BOARD_WIDTH - 144, BOARD_HEIGHT - 128, camera));
  const frontFace = [
    corners.bottomLeft,
    corners.bottomRight,
    { x: corners.bottomRight.x + 15, y: corners.bottomRight.y + STAGE_THICKNESS },
    { x: corners.bottomLeft.x - 17, y: corners.bottomLeft.y + STAGE_THICKNESS },
  ];
  const leftFace = [
    corners.topLeft,
    corners.bottomLeft,
    { x: corners.bottomLeft.x - 17, y: corners.bottomLeft.y + STAGE_THICKNESS },
    { x: corners.topLeft.x - 10, y: corners.topLeft.y + STAGE_THICKNESS * 0.7 },
  ];
  const rightFace = [
    corners.topRight,
    corners.bottomRight,
    { x: corners.bottomRight.x + 15, y: corners.bottomRight.y + STAGE_THICKNESS },
    { x: corners.topRight.x + 10, y: corners.topRight.y + STAGE_THICKNESS * 0.7 },
  ];

  paintRoomBackdrop(context, environment);
  paintCinematicRoomSet(context, environment);
  paintPremiumStudioDepth(context, environment);
  paintHeroWorkspaceBackdrop(context, environment);
  paintPremiumWorkbenchSetDressing(context, environment, corners);
  paintDeskSurface(context, environment, corners);
  paintWorkbenchDepthCues(context, environment, corners);
  paintTrayShadow(context, environment, corners);

  paintWoodFace(context, leftFace, environment, "left");
  paintWoodFace(context, rightFace, environment, "right");
  paintWoodFace(context, frontFace, environment, "front");

  paintWoodRim(context, outer, rimInner, environment);
  paintWoodCornerMiterDetails(context, outer, rimInner, environment);
  paintWoodEndGrainCaps(context, outer, rimInner, environment);
  paintReferenceWoodOilLustre(context, outer, rimInner, environment);
  paintBlueLiner(context, rimInner, linerInner, environment);
  paintTrayInnerDepthRim(context, linerInner, sand, environment);
  paintSandBed(context, sand, environment, camera);
  paintPremiumSandLightField(context, sand, environment, camera);
  paintSandMicroRelief(context, sand, environment, camera);
  paintPremiumSandDuneFields(context, sand, environment, camera);
  paintSandOrganicMicroBlend(context, sand, environment, camera);
  paintSandDirectionalSculptedRidges(context, sand, environment, camera);
  paintSandPhotographicFinish(context, sand, environment, camera);
  paintSandSpecularMicroTopology(context, sand, environment, camera);
  paintReferenceSandMiniatureFinish(context, sand, environment, camera);
  paintPremiumSandTactileDepth(context, sand, environment, camera);
  paintPremiumSandGranularClusters(context, sand, environment, camera);
  paintRakedSandGardenMarks(context, sand, environment, camera);
  paintReferenceSandColorGrade(context, sand, environment, camera);
  paintReferenceStudioSandPolish(context, sand, environment, camera);
  paintReferenceHeroSandRelief(context, sand, environment, camera);
  paintSandStudioColorLift(context, sand, environment);
  paintReferenceSandboxFinalGrade(context, sand, environment, camera);
  paintSandEdgePile(context, sand, environment);
  paintPremiumSandEdgeCrumble(context, sand, environment);
  paintSandFootprints(context, sand, environment, camera);
  paintSandEdgeCompression(context, sand, environment);
  paintSandInsetAmbientOcclusion(context, sand, environment);
  paintInnerWallShade(context, linerInner, sand, environment);
  paintTrayBevels(context, outer, rimInner, linerInner, sand, environment);
  paintPremiumWoodBevel(context, outer, rimInner, environment);
  paintWoodSpecularEdges(context, outer, rimInner, environment);
  paintWoodStudioFinish(context, outer, rimInner, environment);
  paintPremiumWoodEdgeDepth(context, outer, rimInner, environment);
  paintReferenceWoodFrameFinish(context, outer, rimInner, environment);
  paintGallerySandTrayPolish(context, environment, outer, rimInner, linerInner, sand, camera);
  paintReferenceDaylightHeroGrade(context, environment, outer, rimInner, linerInner, sand, camera);
  paintReferencePhotographicDepthPass(context, environment, outer, rimInner, linerInner, sand, camera);
  paintHighDefinitionSandHeightMap(context, environment, sand);
  paintFinalVisibleSandPolish(context, environment, sand, camera);
  // Keep the final passes last so the tray edge and sand surface stay crisp after all atmospheric grading.
  paintTrayCrispMaterialEdges(context, environment, outer, rimInner, sand);
  paintPremiumStagePresentationGrade(context, environment, outer, rimInner, linerInner, sand);
  paintDesignTargetShowcasePass(context, environment, outer, rimInner, linerInner, sand, camera);
  paintReferenceMockupSandTrayPass(context, environment, outer, rimInner, linerInner, sand, camera);
}

function paintRoomBackdrop(context: CanvasRenderingContext2D, environment: SandboxEnvironment): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const gradient = context.createLinearGradient(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  gradient.addColorStop(0, night ? "#102633" : rainy ? "#e5eadf" : cloudy ? "#edf1e2" : "#fffdf1");
  gradient.addColorStop(0.38, night ? "#10232f" : rainy ? "#d7e2d8" : cloudy ? "#f2f0df" : "#f8f2df");
  gradient.addColorStop(0.64, night ? "#0b1a24" : rainy ? "#d1cbb9" : cloudy ? "#e7dcc3" : "#ead5b4");
  gradient.addColorStop(1, night ? "#050f17" : rainy ? "#c4ae8d" : cloudy ? "#cbb38e" : "#d3a36a");
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  context.save();
  context.globalAlpha = night ? 0.09 : rainy ? 0.16 : 0.22;
  context.fillStyle = night ? "#8ee9df" : "#79a98d";
  for (let index = 0; index < 5; index += 1) {
    const x = 154 + index * 166;
    context.fillRect(x, 0, 6, VIEW_HEIGHT * 0.78);
    context.fillRect(x + 88, 0, 5, VIEW_HEIGHT * 0.66);
  }
  context.restore();

  context.save();
  context.globalAlpha = night ? 0.28 : rainy ? 0.4 : cloudy ? 0.46 : 0.58;
  const windowGlow = context.createRadialGradient(VIEW_WIDTH * 0.52, 46, 24, VIEW_WIDTH * 0.52, 94, 420);
  windowGlow.addColorStop(0, night ? "rgba(104,178,194,0.24)" : "rgba(255,255,248,0.82)");
  windowGlow.addColorStop(0.38, night ? "rgba(61,112,130,0.12)" : "rgba(255,238,184,0.34)");
  windowGlow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = windowGlow;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT * 0.58);
  context.restore();

  drawDistantStudioProps(context, environment);
  drawBackdropDust(context, environment);

  if (night) {
    for (let index = 0; index < 76; index += 1) {
      const x = random(index * 17 + 3) * VIEW_WIDTH;
      const y = 38 + random(index * 31 + 7) * 220;
      context.fillStyle = `rgba(236,255,243,${0.14 + random(index + 11) * 0.22})`;
      context.beginPath();
      context.arc(x, y, 0.9 + random(index + 13) * 1.6, 0, Math.PI * 2);
      context.fill();
    }
    drawCalendarMoon(context, VIEW_WIDTH * 0.78, 112, 34, environment);
    return;
  }

  if (cloudy || rainy) {
    drawSoftEllipse(context, VIEW_WIDTH * 0.24, 82, 130, 34, rainy ? "rgba(93,113,118,0.22)" : "rgba(180,190,182,0.36)");
    drawSoftEllipse(context, VIEW_WIDTH * 0.72, 90, 190, 46, rainy ? "rgba(82,105,113,0.24)" : "rgba(199,207,197,0.38)");
    drawSoftEllipse(context, VIEW_WIDTH * 0.54, 64, 120, 30, rainy ? "rgba(86,111,118,0.18)" : "rgba(206,211,199,0.28)");
  } else {
    drawSoftEllipse(context, VIEW_WIDTH * 0.77, 86, 58, 58, "rgba(255,220,119,0.42)");
    drawSoftEllipse(context, VIEW_WIDTH * 0.24, 74, 146, 34, "rgba(255,255,255,0.5)");
    drawSoftEllipse(context, VIEW_WIDTH * 0.36, 52, 84, 22, "rgba(255,255,255,0.32)");
  }
}

function paintHeroWorkspaceBackdrop(context: CanvasRenderingContext2D, environment: SandboxEnvironment): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";

  context.save();

  const wallGlow = context.createRadialGradient(
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.15,
    24,
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.18,
    VIEW_WIDTH * 0.68,
  );
  wallGlow.addColorStop(0, night ? "rgba(115,188,196,0.11)" : rainy ? "rgba(234,244,231,0.35)" : "rgba(255,255,245,0.58)");
  wallGlow.addColorStop(0.46, night ? "rgba(54,99,114,0.06)" : cloudy ? "rgba(244,236,207,0.22)" : "rgba(255,226,168,0.2)");
  wallGlow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = wallGlow;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT * 0.72);

  context.save();
  context.filter = "blur(18px)";
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  context.globalAlpha = night ? 0.38 : rainy ? 0.42 : cloudy ? 0.5 : 0.72;
  const windowBeam = context.createLinearGradient(VIEW_WIDTH * 0.16, 0, VIEW_WIDTH * 0.68, VIEW_HEIGHT * 0.7);
  windowBeam.addColorStop(0, night ? "rgba(110,187,205,0.28)" : "rgba(255,255,248,0.72)");
  windowBeam.addColorStop(0.45, night ? "rgba(74,132,155,0.1)" : rainy ? "rgba(225,238,229,0.2)" : "rgba(255,229,166,0.24)");
  windowBeam.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = windowBeam;
  context.beginPath();
  context.moveTo(VIEW_WIDTH * 0.2, -20);
  context.lineTo(VIEW_WIDTH * 0.48, -20);
  context.lineTo(VIEW_WIDTH * 0.73, VIEW_HEIGHT * 0.68);
  context.lineTo(VIEW_WIDTH * 0.48, VIEW_HEIGHT * 0.72);
  context.closePath();
  context.fill();
  context.restore();

  context.save();
  context.filter = "blur(10px)";
  context.globalAlpha = night ? 0.18 : rainy ? 0.24 : 0.33;
  const propColors = night
    ? ["#285e64", "#1a4852", "#6a5535"]
    : rainy
      ? ["#7c9678", "#769288", "#b5905d"]
      : cloudy
        ? ["#91a878", "#94ad8b", "#c39d62"]
        : ["#76aa68", "#9ac980", "#d0a260"];

  [
    { x: -8, y: 190, mirror: 1 },
    { x: VIEW_WIDTH + 10, y: 184, mirror: -1 },
  ].forEach((prop, propIndex) => {
    context.save();
    context.translate(prop.x, prop.y);
    context.scale(prop.mirror, 1);
    for (let leaf = 0; leaf < 9; leaf += 1) {
      context.fillStyle = propColors[(leaf + propIndex) % propColors.length];
      context.beginPath();
      context.ellipse(
        58 + random(propIndex * 181 + leaf * 37) * 52,
        12 + random(propIndex * 191 + leaf * 41) * 104,
        28 + random(propIndex * 197 + leaf * 43) * 46,
        76 + random(propIndex * 199 + leaf * 47) * 82,
        -0.54 + random(propIndex * 211 + leaf * 53) * 0.86,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.fillStyle = night ? "#6a5438" : "#b9844e";
    context.fillRect(54, 150, 58, 82);
    context.restore();
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "source-over";
  context.globalAlpha = night ? 0.4 : rainy ? 0.34 : cloudy ? 0.42 : 0.58;
  if (night) {
    for (let star = 0; star < 26; star += 1) {
      const x = 90 + random(12000 + star * 31) * (VIEW_WIDTH - 180);
      const y = 34 + random(12100 + star * 37) * 210;
      const radius = 0.7 + random(12200 + star * 41) * 1.5;
      context.fillStyle = `rgba(237,255,244,${0.18 + random(12300 + star) * 0.28})`;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  } else if (rainy || cloudy) {
    const cloudTone = rainy ? "rgba(100,118,122,0.24)" : "rgba(190,198,187,0.34)";
    drawSoftEllipse(context, VIEW_WIDTH * 0.2, 86, 190, 42, cloudTone);
    drawSoftEllipse(context, VIEW_WIDTH * 0.53, 62, 220, 48, rainy ? "rgba(96,116,123,0.18)" : "rgba(210,213,200,0.26)");
    drawSoftEllipse(context, VIEW_WIDTH * 0.84, 95, 210, 46, cloudTone);
    if (rainy) {
      context.strokeStyle = "rgba(225,239,236,0.16)";
      context.lineWidth = 1.1;
      for (let streak = 0; streak < 20; streak += 1) {
        const x = 80 + random(13000 + streak * 17) * (VIEW_WIDTH - 160);
        const y = 30 + random(13100 + streak * 19) * 230;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + 12, y + 44);
        context.stroke();
      }
    }
  } else {
    drawSoftEllipse(context, VIEW_WIDTH * 0.82, 84, 54, 54, "rgba(255,218,112,0.46)");
    drawSoftEllipse(context, VIEW_WIDTH * 0.23, 78, 166, 36, "rgba(255,255,255,0.58)");
    drawSoftEllipse(context, VIEW_WIDTH * 0.38, 55, 112, 24, "rgba(255,255,255,0.34)");
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const floorDepth = context.createLinearGradient(0, VIEW_HEIGHT * 0.52, 0, VIEW_HEIGHT);
  floorDepth.addColorStop(0, "rgba(255,255,255,0)");
  floorDepth.addColorStop(0.62, night ? "rgba(0,8,14,0.1)" : rainy ? "rgba(81,76,61,0.08)" : "rgba(120,79,34,0.07)");
  floorDepth.addColorStop(1, night ? "rgba(0,8,14,0.3)" : "rgba(103,62,24,0.18)");
  context.fillStyle = floorDepth;
  context.fillRect(0, VIEW_HEIGHT * 0.48, VIEW_WIDTH, VIEW_HEIGHT * 0.52);
  context.restore();

  context.restore();
}

function paintPremiumWorkbenchSetDressing(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  corners: ReturnType<typeof getProjectedStageCorners>,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const trayTop = Math.min(corners.topLeft.y, corners.topRight.y, corners.bottomLeft.y, corners.bottomRight.y);
  const trayFront = Math.max(corners.bottomLeft.y, corners.bottomRight.y) + STAGE_THICKNESS * 0.5;
  const windowBottom = Math.max(150, Math.min(248, trayTop + 20));
  const deskStart = Math.max(VIEW_HEIGHT * 0.56, Math.min(VIEW_HEIGHT - 142, trayFront - 36));

  context.save();
  const windowX = VIEW_WIDTH * 0.18;
  const windowWidth = VIEW_WIDTH * 0.64;
  const windowGradient = context.createLinearGradient(0, 0, 0, windowBottom);
  windowGradient.addColorStop(0, night ? "rgba(24,58,72,0.38)" : rainy ? "rgba(226,236,229,0.5)" : "rgba(255,253,236,0.74)");
  windowGradient.addColorStop(0.58, night ? "rgba(14,39,54,0.22)" : cloudy ? "rgba(234,230,204,0.24)" : "rgba(255,231,172,0.3)");
  windowGradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = windowGradient;
  context.fillRect(windowX, 0, windowWidth, windowBottom);

  context.globalAlpha = night ? 0.17 : rainy ? 0.22 : 0.3;
  context.strokeStyle = night ? "rgba(150,225,226,0.34)" : "rgba(148,177,151,0.34)";
  context.lineWidth = 2;
  for (let pane = 0; pane <= 5; pane += 1) {
    const x = windowX + (windowWidth / 5) * pane;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, windowBottom * (0.72 + (pane % 2) * 0.08));
    context.stroke();
  }
  context.beginPath();
  context.moveTo(windowX, windowBottom * 0.48);
  context.lineTo(windowX + windowWidth, windowBottom * 0.42);
  context.stroke();
  context.restore();

  context.save();
  context.filter = "blur(12px)";
  context.globalAlpha = night ? 0.22 : rainy ? 0.24 : cloudy ? 0.28 : 0.38;
  const leafPalette = night
    ? ["#2d6a66", "#1d5359", "#61734e"]
    : rainy
      ? ["#748f77", "#607e70", "#b19a66"]
      : cloudy
        ? ["#849a70", "#8ba980", "#c4a26c"]
        : ["#6aa665", "#8bc776", "#cfaa65"];
  [
    { x: VIEW_WIDTH * 0.08, y: windowBottom * 0.66, side: -1, scale: 1.12 },
    { x: VIEW_WIDTH * 0.91, y: windowBottom * 0.62, side: 1, scale: 1.22 },
  ].forEach((plant, plantIndex) => {
    for (let leaf = 0; leaf < 16; leaf += 1) {
      context.fillStyle = leafPalette[(leaf + plantIndex) % leafPalette.length];
      context.beginPath();
      context.ellipse(
        plant.x + plant.side * (18 + random(22000 + plantIndex * 181 + leaf * 17) * 96),
        plant.y + random(22100 + plantIndex * 191 + leaf * 19) * 190,
        (20 + random(22200 + plantIndex * 197 + leaf * 23) * 42) * plant.scale,
        (56 + random(22300 + plantIndex * 199 + leaf * 29) * 78) * plant.scale,
        plant.side * (-0.62 + random(22400 + plantIndex * 211 + leaf * 31) * 0.88),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    const potGradient = context.createLinearGradient(plant.x - 52, deskStart - 92, plant.x + 52, deskStart + 24);
    potGradient.addColorStop(0, night ? "rgba(119,92,58,0.34)" : "rgba(198,142,78,0.48)");
    potGradient.addColorStop(1, night ? "rgba(54,38,28,0.32)" : "rgba(121,76,38,0.4)");
    context.fillStyle = potGradient;
    context.fillRect(plant.x - 42, deskStart - 64, 84, 112);
  });
  context.restore();

  context.save();
  const deskGradient = context.createLinearGradient(0, deskStart - 56, VIEW_WIDTH, VIEW_HEIGHT);
  deskGradient.addColorStop(0, night ? "rgba(22,51,60,0.08)" : "rgba(255,244,205,0.14)");
  deskGradient.addColorStop(0.35, night ? "rgba(26,48,51,0.3)" : rainy ? "rgba(178,151,105,0.2)" : "rgba(224,166,86,0.27)");
  deskGradient.addColorStop(1, night ? "rgba(5,13,18,0.52)" : "rgba(124,77,34,0.32)");
  context.fillStyle = deskGradient;
  context.fillRect(0, deskStart - 70, VIEW_WIDTH, VIEW_HEIGHT - deskStart + 70);

  context.globalAlpha = night ? 0.16 : 0.22;
  context.strokeStyle = night ? "rgba(151,211,204,0.28)" : "rgba(109,68,31,0.26)";
  context.lineCap = "round";
  for (let plank = 0; plank < 15; plank += 1) {
    const y = deskStart - 42 + plank * 28 + random(23000 + plank * 37) * 9;
    context.lineWidth = 0.8 + random(23100 + plank * 41) * 1.5;
    context.beginPath();
    context.moveTo(-40, y);
    context.bezierCurveTo(VIEW_WIDTH * 0.26, y - 18, VIEW_WIDTH * 0.72, y + 22, VIEW_WIDTH + 40, y - 8);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  const focusGlow = context.createRadialGradient(
    VIEW_WIDTH * 0.48,
    Math.max(130, trayTop + 40),
    60,
    VIEW_WIDTH * 0.48,
    Math.max(180, trayTop + 80),
    VIEW_WIDTH * 0.62,
  );
  focusGlow.addColorStop(0, night ? "rgba(104,204,204,0.13)" : rainy ? "rgba(239,246,229,0.24)" : "rgba(255,246,213,0.34)");
  focusGlow.addColorStop(0.52, night ? "rgba(73,144,154,0.04)" : "rgba(255,216,150,0.09)");
  focusGlow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = focusGlow;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const vignette = context.createRadialGradient(VIEW_WIDTH * 0.5, VIEW_HEIGHT * 0.5, VIEW_WIDTH * 0.34, VIEW_WIDTH * 0.5, VIEW_HEIGHT * 0.52, VIEW_WIDTH * 0.84);
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(0.72, night ? "rgba(0,8,13,0.05)" : "rgba(97,67,33,0.03)");
  vignette.addColorStop(1, night ? "rgba(0,8,13,0.2)" : "rgba(93,59,27,0.1)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();
}

function paintCinematicRoomSet(context: CanvasRenderingContext2D, environment: SandboxEnvironment): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  const windowWash = context.createRadialGradient(
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.04,
    20,
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.1,
    VIEW_WIDTH * 0.56,
  );
  windowWash.addColorStop(0, night ? "rgba(126,204,222,0.22)" : rainy ? "rgba(235,246,236,0.54)" : "rgba(255,252,231,0.78)");
  windowWash.addColorStop(0.44, night ? "rgba(68,132,152,0.08)" : cloudy ? "rgba(246,238,209,0.22)" : "rgba(255,225,160,0.28)");
  windowWash.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = windowWash;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT * 0.62);
  context.restore();

  context.save();
  context.filter = "blur(18px)";
  context.globalAlpha = night ? 0.18 : rainy ? 0.2 : cloudy ? 0.24 : 0.34;
  const skyBand = context.createLinearGradient(0, 30, VIEW_WIDTH, 160);
  skyBand.addColorStop(0, night ? "rgba(46,86,104,0.18)" : rainy ? "rgba(179,194,188,0.22)" : "rgba(181,217,207,0.34)");
  skyBand.addColorStop(0.5, night ? "rgba(20,50,68,0.24)" : cloudy ? "rgba(213,213,191,0.22)" : "rgba(255,235,166,0.28)");
  skyBand.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = skyBand;
  context.fillRect(-30, 18, VIEW_WIDTH + 60, 190);

  const plantColors = night
    ? ["rgba(62,117,108,0.42)", "rgba(30,78,86,0.34)", "rgba(31,56,62,0.38)"]
    : rainy
      ? ["rgba(111,137,118,0.36)", "rgba(89,116,103,0.3)", "rgba(158,143,102,0.22)"]
      : ["rgba(96,148,105,0.38)", "rgba(129,174,103,0.36)", "rgba(193,158,88,0.24)"];

  [
    { x: 66, y: 246, scale: 1.16, side: -1 },
    { x: VIEW_WIDTH - 78, y: 238, scale: 1.22, side: 1 },
  ].forEach((plant, plantIndex) => {
    for (let leaf = 0; leaf < 13; leaf += 1) {
      context.fillStyle = plantColors[(leaf + plantIndex) % plantColors.length];
      context.beginPath();
      context.ellipse(
        plant.x + plant.side * (6 + random(plantIndex * 101 + leaf * 17) * 78),
        plant.y + random(plantIndex * 107 + leaf * 19) * 116,
        (22 + random(plantIndex * 113 + leaf * 23) * 42) * plant.scale,
        (64 + random(plantIndex * 127 + leaf * 29) * 64) * plant.scale,
        plant.side * (-0.7 + random(plantIndex * 131 + leaf * 31) * 0.76),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "source-over";
  context.filter = "blur(8px)";
  [
    { x: VIEW_WIDTH * 0.22, y: 58, rx: 96, ry: 22, seed: 401 },
    { x: VIEW_WIDTH * 0.76, y: 84, rx: 130, ry: 28, seed: 811 },
    { x: VIEW_WIDTH * 0.46, y: 38, rx: 74, ry: 18, seed: 1201 },
  ].forEach((cloud, cloudIndex) => {
    const tone = night
      ? `rgba(116,188,205,${0.06 + cloudIndex * 0.012})`
      : rainy
        ? `rgba(106,126,132,${0.13 + cloudIndex * 0.025})`
        : cloudy
          ? `rgba(178,187,178,${0.16 + cloudIndex * 0.025})`
          : `rgba(255,255,255,${0.26 + cloudIndex * 0.035})`;
    drawSoftEllipse(
      context,
      cloud.x + (random(cloud.seed) - 0.5) * 16,
      cloud.y + (random(cloud.seed + 7) - 0.5) * 10,
      cloud.rx,
      cloud.ry,
      tone,
    );
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  for (let index = 0; index < (night ? 96 : 54); index += 1) {
    const x = random(index * 73 + 9) * VIEW_WIDTH;
    const y = 24 + random(index * 79 + 17) * (night ? 260 : 210);
    const radius = 0.8 + random(index * 83 + 19) * (night ? 1.7 : 2.4);
    context.fillStyle = night
      ? `rgba(230,255,236,${0.06 + random(index * 89 + 23) * 0.18})`
      : `rgba(255,248,212,${0.035 + random(index * 89 + 23) * 0.08})`;
    context.beginPath();
    context.ellipse(x, y, radius, radius * 0.72, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function paintPremiumStudioDepth(context: CanvasRenderingContext2D, environment: SandboxEnvironment): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  const keyLight = context.createRadialGradient(
    VIEW_WIDTH * 0.44,
    VIEW_HEIGHT * 0.04,
    18,
    VIEW_WIDTH * 0.44,
    VIEW_HEIGHT * 0.13,
    VIEW_WIDTH * 0.62,
  );
  keyLight.addColorStop(0, night ? "rgba(130,218,230,0.18)" : "rgba(255,255,246,0.66)");
  keyLight.addColorStop(0.42, night ? "rgba(93,164,181,0.08)" : "rgba(255,235,177,0.22)");
  keyLight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = keyLight;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT * 0.72);
  context.restore();

  context.save();
  context.filter = "blur(18px)";
  context.globalAlpha = night ? 0.18 : rainy || cloudy ? 0.28 : 0.36;
  const leafPalette = night ? ["#447c78", "#2d5e64", "#24444b"] : rainy ? ["#789579", "#6e8368", "#a3895c"] : ["#77a871", "#8cbf78", "#c3a06a"];
  [
    { x: 88, y: 202, scale: 1.05, side: -1 },
    { x: VIEW_WIDTH - 94, y: 194, scale: 1.16, side: 1 },
  ].forEach((plant, plantIndex) => {
    for (let leaf = 0; leaf < 9; leaf += 1) {
      context.fillStyle = leafPalette[(leaf + plantIndex) % leafPalette.length];
      context.beginPath();
      context.ellipse(
        plant.x + plant.side * (12 + random(leaf * 31 + plantIndex) * 54),
        plant.y + random(leaf * 37 + 3) * 92,
        (18 + random(leaf * 41 + 7) * 34) * plant.scale,
        (52 + random(leaf * 43 + 9) * 54) * plant.scale,
        plant.side * (-0.46 + random(leaf * 47 + 11) * 0.54),
        0,
        Math.PI * 2,
      );
      context.fill();
    }
    context.fillStyle = night ? "#4c3326" : "#b5834d";
    context.fillRect(plant.x - 34, 320, 68, 112);
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "source-over";
  for (let beam = 0; beam < 4; beam += 1) {
    const x = VIEW_WIDTH * (0.2 + beam * 0.18);
    const beamGradient = context.createLinearGradient(x - 70, 0, x + 140, VIEW_HEIGHT * 0.78);
    beamGradient.addColorStop(0, night ? "rgba(132,218,222,0.05)" : "rgba(255,252,224,0.2)");
    beamGradient.addColorStop(0.5, night ? "rgba(132,218,222,0.018)" : "rgba(255,231,172,0.06)");
    beamGradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = beamGradient;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 118, 0);
    context.lineTo(x + 260, VIEW_HEIGHT * 0.82);
    context.lineTo(x - 80, VIEW_HEIGHT * 0.82);
    context.closePath();
    context.fill();
  }
  context.restore();

  context.save();
  const edgeVignette = context.createRadialGradient(VIEW_WIDTH * 0.5, VIEW_HEIGHT * 0.48, VIEW_WIDTH * 0.36, VIEW_WIDTH * 0.5, VIEW_HEIGHT * 0.5, VIEW_WIDTH * 0.84);
  edgeVignette.addColorStop(0, "rgba(255,255,255,0)");
  edgeVignette.addColorStop(0.66, night ? "rgba(0,7,12,0.02)" : "rgba(94,65,31,0.02)");
  edgeVignette.addColorStop(1, night ? "rgba(0,8,14,0.36)" : "rgba(111,72,31,0.14)");
  context.fillStyle = edgeVignette;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();
}

function paintDeskSurface(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  corners: ReturnType<typeof getProjectedStageCorners>,
): void {
  const night = environment.light === "night";
  const y = corners.bottomLeft.y + STAGE_THICKNESS * 0.45;
  const gradient = context.createLinearGradient(0, y - 120, 0, VIEW_HEIGHT);
  gradient.addColorStop(0, night ? "rgba(18,42,52,0)" : "rgba(255,247,222,0)");
  gradient.addColorStop(0.42, night ? "rgba(15,35,44,0.7)" : "rgba(213,171,105,0.32)");
  gradient.addColorStop(1, night ? "rgba(5,12,18,0.92)" : "rgba(142,101,55,0.48)");
  context.fillStyle = gradient;
  context.fillRect(0, y - 160, VIEW_WIDTH, VIEW_HEIGHT - y + 160);

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  const lightPatch = context.createRadialGradient(VIEW_WIDTH * 0.42, y + 18, 10, VIEW_WIDTH * 0.42, y + 42, 430);
  lightPatch.addColorStop(0, night ? "rgba(92,168,179,0.16)" : "rgba(255,236,180,0.54)");
  lightPatch.addColorStop(0.54, night ? "rgba(73,135,151,0.05)" : "rgba(244,194,114,0.16)");
  lightPatch.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = lightPatch;
  context.fillRect(0, Math.max(0, y - 120), VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();

  context.save();
  context.globalAlpha = night ? 0.1 : 0.15;
  context.strokeStyle = night ? "#8ddad6" : "#7b4f25";
  context.lineWidth = 1.2;
  for (let index = 0; index < 13; index += 1) {
    const lineY = y + index * 27 + random(index + 5) * 8;
    context.beginPath();
    context.moveTo(VIEW_WIDTH * 0.08, lineY);
    context.bezierCurveTo(VIEW_WIDTH * 0.34, lineY - 16, VIEW_WIDTH * 0.7, lineY + 20, VIEW_WIDTH * 0.94, lineY - 6);
    context.stroke();
  }
  context.restore();
}

function paintWorkbenchDepthCues(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  corners: ReturnType<typeof getProjectedStageCorners>,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const tableTop = corners.bottomLeft.y + STAGE_THICKNESS * 0.18;

  context.save();
  const matGradient = context.createLinearGradient(0, tableTop - 120, VIEW_WIDTH, VIEW_HEIGHT);
  matGradient.addColorStop(0, "rgba(255,255,255,0)");
  matGradient.addColorStop(0.42, night ? "rgba(44,82,87,0.16)" : rainy ? "rgba(183,178,151,0.14)" : "rgba(255,234,180,0.2)");
  matGradient.addColorStop(1, night ? "rgba(0,8,13,0.36)" : "rgba(99,64,28,0.2)");
  context.fillStyle = matGradient;
  context.fillRect(0, Math.max(0, tableTop - 110), VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  context.filter = "blur(10px)";
  const reflectedLight = context.createRadialGradient(
    (corners.bottomLeft.x + corners.bottomRight.x) * 0.5,
    corners.bottomLeft.y + STAGE_THICKNESS * 0.84,
    20,
    (corners.bottomLeft.x + corners.bottomRight.x) * 0.5,
    corners.bottomLeft.y + STAGE_THICKNESS * 0.9,
    Math.abs(corners.bottomRight.x - corners.bottomLeft.x) * 0.72,
  );
  reflectedLight.addColorStop(0, night ? "rgba(107,196,190,0.1)" : "rgba(255,228,162,0.22)");
  reflectedLight.addColorStop(0.48, night ? "rgba(68,124,138,0.04)" : "rgba(217,154,75,0.08)");
  reflectedLight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = reflectedLight;
  context.fillRect(0, tableTop - 40, VIEW_WIDTH, VIEW_HEIGHT - tableTop + 40);
  context.restore();

  context.save();
  context.globalAlpha = night ? 0.1 : 0.16;
  context.strokeStyle = night ? "#9de7dc" : "#6b431f";
  context.lineCap = "round";
  for (let index = 0; index < 9; index += 1) {
    const y = tableTop + 26 + index * 31 + random(index * 67 + 4) * 8;
    context.lineWidth = 0.9 + random(index * 71 + 8) * 1.6;
    context.beginPath();
    context.moveTo(VIEW_WIDTH * 0.03, y);
    context.bezierCurveTo(VIEW_WIDTH * 0.28, y - 14, VIEW_WIDTH * 0.68, y + 18, VIEW_WIDTH * 0.98, y - 5);
    context.stroke();
  }
  context.restore();
}

function paintTrayShadow(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  corners: ReturnType<typeof getProjectedStageCorners>,
): void {
  const night = environment.light === "night";
  const centerX = (corners.bottomLeft.x + corners.bottomRight.x) * 0.5;
  const centerY = corners.bottomLeft.y + STAGE_THICKNESS * 0.72;
  context.save();
  context.filter = "blur(16px)";
  context.fillStyle = night ? "rgba(0,5,10,0.58)" : "rgba(95,60,25,0.28)";
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    Math.abs(corners.bottomRight.x - corners.bottomLeft.x) * 0.58,
    night ? 66 : 84,
    -0.02,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = "blur(18px)";
  context.fillStyle = night ? "rgba(0,10,18,0.34)" : "rgba(101,65,28,0.12)";
  context.beginPath();
  context.ellipse(
    centerX - 18,
    centerY + 34,
    Math.abs(corners.bottomRight.x - corners.bottomLeft.x) * 0.48,
    night ? 46 : 58,
    -0.03,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = "blur(6px)";
  context.fillStyle = night ? "rgba(0,5,9,0.38)" : "rgba(69,42,17,0.18)";
  context.beginPath();
  context.ellipse(
    centerX + 2,
    centerY - 10,
    Math.abs(corners.bottomRight.x - corners.bottomLeft.x) * 0.5,
    night ? 28 : 34,
    -0.015,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function paintWoodFace(
  context: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  side: "front" | "left" | "right",
): void {
  const night = environment.light === "night";
  const bounds = getPointBounds(points);
  const gradient = side === "front"
    ? context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
    : context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.minY);
  gradient.addColorStop(0, night ? "#9b764a" : "#f0c98b");
  gradient.addColorStop(0.5, night ? "#735330" : "#c28a50");
  gradient.addColorStop(1, night ? "#3e2818" : "#81542f");

  context.save();
  polygonPath(context, points);
  context.fillStyle = gradient;
  context.fill();
  context.clip();
  for (let index = 0; index < 28; index += 1) {
    context.strokeStyle = index % 3 === 0 ? "rgba(255,238,188,0.3)" : "rgba(80,43,19,0.14)";
    context.lineWidth = 1 + random(index * 11 + side.length) * 2.2;
    const y = bounds.minY + random(index * 17 + side.length) * (bounds.maxY - bounds.minY);
    context.beginPath();
    context.moveTo(bounds.minX - 30, y);
    context.bezierCurveTo(
      bounds.minX + (bounds.maxX - bounds.minX) * 0.3,
      y - 10 + random(index + 4) * 20,
      bounds.minX + (bounds.maxX - bounds.minX) * 0.7,
      y + 12 - random(index + 9) * 24,
      bounds.maxX + 30,
      y + random(index + 13) * 12,
    );
    context.stroke();
  }
  context.restore();

  context.save();
  polygonPath(context, points);
  context.strokeStyle = night ? "rgba(255,222,158,0.18)" : "rgba(104,66,34,0.32)";
  context.lineWidth = 2.4;
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, points);
  context.clip();
  const gloss = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.minY);
  gloss.addColorStop(0, "rgba(255,244,198,0)");
  gloss.addColorStop(0.16, night ? "rgba(255,229,171,0.1)" : "rgba(255,241,198,0.26)");
  gloss.addColorStop(0.32, "rgba(255,244,198,0)");
  gloss.addColorStop(0.78, night ? "rgba(0,12,18,0.16)" : "rgba(84,49,22,0.08)");
  gloss.addColorStop(1, "rgba(255,244,198,0)");
  context.fillStyle = gloss;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  context.restore();
}

function paintWoodRim(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const bounds = getPointBounds(outer);
  const gradient = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  gradient.addColorStop(0, night ? "#b68a58" : "#f7d49b");
  gradient.addColorStop(0.24, night ? "#9b7448" : "#e1ae6f");
  gradient.addColorStop(0.68, night ? "#654525" : "#ad7540");
  gradient.addColorStop(1, night ? "#3e2917" : "#7d4f2a");

  context.save();
  ringPath(context, outer, inner);
  context.shadowColor = night ? "rgba(4,10,14,0.42)" : "rgba(83,50,19,0.26)";
  context.shadowBlur = 14;
  context.shadowOffsetY = 6;
  context.fillStyle = gradient;
  context.fill("evenodd");
  context.clip("evenodd");
  for (let index = 0; index < 46; index += 1) {
    context.strokeStyle = index % 4 === 0 ? "rgba(255,242,196,0.34)" : "rgba(82,43,18,0.16)";
    context.lineWidth = 1 + random(index * 19) * 2.8;
    const y = bounds.minY + random(index * 13 + 5) * (bounds.maxY - bounds.minY);
    context.beginPath();
    context.moveTo(bounds.minX - 24, y);
    context.bezierCurveTo(bounds.minX + 220, y - 18, bounds.maxX - 260, y + 20, bounds.maxX + 24, y - 4);
    context.stroke();
  }
  context.restore();

  context.save();
  ringPath(context, outer, inner);
  context.clip("evenodd");
  const topGloss = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.minY);
  topGloss.addColorStop(0, night ? "rgba(255,236,178,0.2)" : "rgba(255,250,218,0.48)");
  topGloss.addColorStop(0.3, "rgba(255,250,218,0)");
  topGloss.addColorStop(0.72, "rgba(255,250,218,0)");
  topGloss.addColorStop(1, night ? "rgba(20,10,4,0.18)" : "rgba(75,40,13,0.18)");
  context.fillStyle = topGloss;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  context.restore();
}

function paintReferenceWoodOilLustre(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const bounds = getPointBounds(outer);

  context.save();
  ringPath(context, outer, inner);
  context.clip("evenodd");

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  context.filter = "blur(0.8px)";
  const broadVarnish = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  broadVarnish.addColorStop(0, night ? "rgba(255,233,173,0.16)" : "rgba(255,250,219,0.5)");
  broadVarnish.addColorStop(0.2, night ? "rgba(255,219,150,0.05)" : "rgba(255,225,160,0.2)");
  broadVarnish.addColorStop(0.54, "rgba(255,255,255,0)");
  broadVarnish.addColorStop(1, night ? "rgba(55,24,8,0.18)" : "rgba(108,55,17,0.2)");
  context.fillStyle = broadVarnish;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  context.restore();

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let grain = 0; grain < 34; grain += 1) {
    const seed = 14200 + grain * 37;
    const y = bounds.minY + 8 + random(seed) * Math.max(1, bounds.maxY - bounds.minY - 16);
    const startX = bounds.minX + random(seed + 3) * 80 - 26;
    const endX = bounds.maxX - random(seed + 7) * 80 + 26;
    const lift = -10 + random(seed + 11) * 20;
    context.globalCompositeOperation = grain % 4 === 0 ? "screen" : "multiply";
    context.strokeStyle = grain % 4 === 0
      ? night
        ? "rgba(255,236,178,0.16)"
        : "rgba(255,246,203,0.34)"
      : night
        ? "rgba(29,15,8,0.16)"
        : "rgba(91,43,14,0.12)";
    context.lineWidth = grain % 4 === 0 ? 1.2 + random(seed + 13) * 1.4 : 1.6 + random(seed + 17) * 2.1;
    context.beginPath();
    context.moveTo(startX, y);
    context.bezierCurveTo(
      bounds.minX + (bounds.maxX - bounds.minX) * 0.28,
      y + lift,
      bounds.minX + (bounds.maxX - bounds.minX) * 0.66,
      y - lift * 0.82,
      endX,
      y + random(seed + 19) * 7 - 3.5,
    );
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  const topEdge = [outer[0], outer[1]];
  const lowerEdge = [outer[3], outer[2]];
  context.strokeStyle = night ? "rgba(255,230,168,0.18)" : "rgba(255,250,224,0.58)";
  context.lineWidth = night ? 1.6 : 2.2;
  drawOpenPolyline(context, topEdge);
  context.stroke();
  context.strokeStyle = night ? "rgba(225,161,92,0.08)" : "rgba(255,218,148,0.24)";
  context.lineWidth = 1.4;
  drawOpenPolyline(context, lowerEdge);
  context.stroke();
  context.restore();

  context.restore();
}

function paintWoodCornerMiterDetails(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const center = outer.reduce(
    (sum, point) => ({ x: sum.x + point.x / outer.length, y: sum.y + point.y / outer.length }),
    { x: 0, y: 0 },
  );
  const miterStroke = night ? "rgba(8,14,13,0.5)" : "rgba(77,41,15,0.46)";
  const miterLight = night ? "rgba(255,229,167,0.18)" : "rgba(255,244,194,0.42)";

  context.save();
  ringPath(context, outer, inner);
  context.clip("evenodd");

  outer.forEach((corner, index) => {
    const innerCorner = inner[index];
    const vectorX = center.x - corner.x;
    const vectorY = center.y - corner.y;
    const length = Math.max(1, Math.hypot(vectorX, vectorY));
    const normalX = vectorX / length;
    const normalY = vectorY / length;
    const endX = corner.x + normalX * Math.min(86, length * 0.18);
    const endY = corner.y + normalY * Math.min(48, length * 0.18);

    context.save();
    context.shadowColor = night ? "rgba(0,0,0,0.32)" : "rgba(58,34,17,0.18)";
    context.shadowBlur = 5;
    context.strokeStyle = miterStroke;
    context.lineWidth = 3.8;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(corner.x, corner.y);
    context.lineTo(innerCorner.x, innerCorner.y);
    context.stroke();

    context.strokeStyle = miterLight;
    context.lineWidth = 1.3;
    context.beginPath();
    context.moveTo(corner.x + normalX * 5, corner.y + normalY * 5);
    context.lineTo(endX, endY);
    context.stroke();
    context.restore();
  });

  for (let knot = 0; knot < 18; knot += 1) {
    const edge = knot % outer.length;
    const start = outer[edge];
    const end = outer[(edge + 1) % outer.length];
    const t = 0.18 + random(knot * 31 + 7) * 0.64;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    const inwardX = center.x - x;
    const inwardY = center.y - y;
    const length = Math.max(1, Math.hypot(inwardX, inwardY));
    const depth = 14 + random(knot * 37 + 11) * 22;

    context.save();
    context.translate(x + (inwardX / length) * depth, y + (inwardY / length) * depth);
    context.rotate(-0.6 + random(knot * 43 + 17) * 1.2);
    context.strokeStyle = night ? "rgba(25,13,6,0.24)" : "rgba(86,46,18,0.22)";
    context.lineWidth = 1.2;
    context.beginPath();
    context.ellipse(0, 0, 6 + random(knot + 3) * 10, 2 + random(knot + 5) * 4, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  context.restore();
}

function paintWoodEndGrainCaps(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const center = outer.reduce(
    (sum, point) => ({ x: sum.x + point.x / outer.length, y: sum.y + point.y / outer.length }),
    { x: 0, y: 0 },
  );

  context.save();
  ringPath(context, outer, inner);
  context.clip("evenodd");

  outer.forEach((corner, index) => {
    const innerCorner = inner[index];
    const next = outer[(index + 1) % outer.length];
    const previous = outer[(index + outer.length - 1) % outer.length];
    const toNext = normalizeVector(next.x - corner.x, next.y - corner.y);
    const toPrevious = normalizeVector(previous.x - corner.x, previous.y - corner.y);
    const toInner = normalizeVector(innerCorner.x - corner.x, innerCorner.y - corner.y);
    const capLength = 48 + random(index * 41 + 7) * 18;
    const capDepth = 32 + random(index * 43 + 11) * 12;
    const p1 = { x: corner.x + toNext.x * capLength, y: corner.y + toNext.y * capLength };
    const p2 = { x: corner.x + toInner.x * capDepth, y: corner.y + toInner.y * capDepth };
    const p3 = { x: corner.x + toPrevious.x * capLength, y: corner.y + toPrevious.y * capLength };
    const capGradient = context.createLinearGradient(corner.x, corner.y, p2.x, p2.y);
    capGradient.addColorStop(0, night ? "rgba(255,230,170,0.2)" : "rgba(255,244,194,0.48)");
    capGradient.addColorStop(0.54, night ? "rgba(103,66,35,0.18)" : "rgba(139,83,36,0.2)");
    capGradient.addColorStop(1, night ? "rgba(18,9,4,0.22)" : "rgba(84,44,16,0.24)");

    context.save();
    context.shadowColor = night ? "rgba(0,0,0,0.18)" : "rgba(82,47,18,0.14)";
    context.shadowBlur = 5;
    context.fillStyle = capGradient;
    context.beginPath();
    context.moveTo(corner.x, corner.y);
    context.lineTo(p1.x, p1.y);
    context.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y);
    context.closePath();
    context.fill();
    context.restore();

    for (let mark = 0; mark < 5; mark += 1) {
      const depth = 10 + mark * 5 + random(index * 73 + mark * 13) * 8;
      const breadth = 13 + random(index * 79 + mark * 17) * 22;
      const x = corner.x + toInner.x * depth + (toNext.x + toPrevious.x) * breadth * 0.12;
      const y = corner.y + toInner.y * depth + (toNext.y + toPrevious.y) * breadth * 0.12;
      context.save();
      context.translate(x, y);
      context.rotate(Math.atan2(toInner.y, toInner.x) + Math.PI * 0.5);
      context.strokeStyle = mark % 2 === 0
        ? night
          ? "rgba(255,223,156,0.16)"
          : "rgba(255,237,184,0.34)"
        : night
          ? "rgba(20,10,4,0.2)"
          : "rgba(75,38,14,0.22)";
      context.lineWidth = 0.9 + random(index * 83 + mark) * 1.1;
      context.beginPath();
      context.ellipse(0, 0, breadth * 0.36, 3.2 + mark * 0.9, 0, 0.1, Math.PI * 1.78);
      context.stroke();
      context.restore();
    }
  });

  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  const topEdgeGlow = night ? "rgba(255,225,158,0.12)" : "rgba(255,249,218,0.34)";
  context.strokeStyle = topEdgeGlow;
  context.lineWidth = night ? 1.3 : 1.8;
  context.lineCap = "round";
  drawOpenPolyline(context, [outer[0], outer[1]]);
  context.stroke();
  context.restore();
}

function paintBlueLiner(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const bounds = getPointBounds(outer);
  const gradient = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  gradient.addColorStop(0, night ? "#0e7ea0" : "#43badd");
  gradient.addColorStop(0.52, night ? "#0a5978" : "#0f8fbd");
  gradient.addColorStop(1, night ? "#063247" : "#08729c");

  context.save();
  ringPath(context, outer, inner);
  context.fillStyle = gradient;
  context.fill("evenodd");
  context.strokeStyle = night ? "rgba(147,243,255,0.36)" : "rgba(217,255,255,0.72)";
  context.lineWidth = 2.6;
  context.stroke();
  context.restore();

  context.save();
  ringPath(context, outer, inner);
  context.clip("evenodd");
  const sheen = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  sheen.addColorStop(0, night ? "rgba(187,255,255,0.16)" : "rgba(255,255,255,0.38)");
  sheen.addColorStop(0.44, "rgba(255,255,255,0)");
  sheen.addColorStop(1, night ? "rgba(0,22,35,0.18)" : "rgba(0,75,112,0.16)");
  context.fillStyle = sheen;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  context.restore();
}

function paintTrayInnerDepthRim(
  context: CanvasRenderingContext2D,
  linerInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(linerInner);

  context.save();
  ringPath(context, linerInner, sand);
  context.clip("evenodd");
  const shade = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  shade.addColorStop(0, night ? "rgba(115,232,248,0.22)" : "rgba(232,255,255,0.54)");
  shade.addColorStop(0.28, night ? "rgba(16,100,129,0.2)" : "rgba(77,177,205,0.24)");
  shade.addColorStop(0.66, night ? "rgba(2,35,54,0.28)" : "rgba(3,94,132,0.22)");
  shade.addColorStop(1, night ? "rgba(0,10,18,0.42)" : "rgba(51,31,13,0.18)");
  context.fillStyle = shade;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  context.globalCompositeOperation = "multiply";
  context.filter = "blur(2px)";
  polygonPath(context, sand);
  context.strokeStyle = night ? "rgba(0,7,13,0.34)" : rainy ? "rgba(36,60,58,0.16)" : "rgba(40,89,101,0.18)";
  context.lineWidth = 18;
  context.lineJoin = "round";
  context.stroke();
  context.restore();

  context.save();
  ringPath(context, linerInner, sand);
  context.clip("evenodd");
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let index = 0; index < 12; index += 1) {
    const edgeIndex = index % linerInner.length;
    const start = linerInner[edgeIndex];
    const end = linerInner[(edgeIndex + 1) % linerInner.length];
    const t = 0.06 + random(index * 97 + 19) * 0.86;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    const inward = nearestDirectionToCenter(x, y, sand);
    const length = 12 + random(index * 101 + 23) * 26;
    context.strokeStyle = index % 3 === 0
      ? night
        ? "rgba(175,255,250,0.14)"
        : "rgba(255,255,255,0.32)"
      : night
        ? "rgba(0,13,22,0.22)"
        : "rgba(0,77,112,0.18)";
    context.lineWidth = 0.8 + random(index * 103 + 29) * 1.6;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + inward.x * length, y + inward.y * length);
    context.stroke();
  }
  context.restore();
}

function paintSandBed(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  const gradient = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  gradient.addColorStop(0, night ? "#d8cca5" : rainy ? "#f5e4bc" : "#fff3cf");
  gradient.addColorStop(0.42, night ? "#b8a074" : rainy ? "#e8cca0" : "#efd9a7");
  gradient.addColorStop(0.72, night ? "#a08358" : rainy ? "#d6b884" : "#ddbf88");
  gradient.addColorStop(1, night ? "#826744" : rainy ? "#bd9564" : "#cea06b");

  context.save();
  polygonPath(context, sand);
  context.shadowColor = night ? "rgba(0,0,0,0.24)" : "rgba(85,53,22,0.16)";
  context.shadowBlur = 12;
  context.fillStyle = gradient;
  context.fill();
  context.clip();

  const warmBloom = context.createRadialGradient(
    bounds.minX + (bounds.maxX - bounds.minX) * 0.26,
    bounds.minY + (bounds.maxY - bounds.minY) * 0.18,
    18,
    bounds.minX + (bounds.maxX - bounds.minX) * 0.26,
    bounds.minY + (bounds.maxY - bounds.minY) * 0.18,
    Math.max(220, (bounds.maxX - bounds.minX) * 0.54),
  );
  warmBloom.addColorStop(0, night ? "rgba(227,213,160,0.11)" : "rgba(255,252,225,0.46)");
  warmBloom.addColorStop(0.52, night ? "rgba(193,160,99,0.04)" : "rgba(248,211,133,0.13)");
  warmBloom.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = warmBloom;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  const grainPattern = createSandSurfacePattern(environment);
  if (grainPattern) {
    context.save();
    context.globalAlpha = night ? 0.1 : rainy ? 0.12 : 0.16;
    context.globalCompositeOperation = "source-over";
    context.fillStyle = grainPattern;
    context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    context.restore();
  }

  for (let index = 0; index < 5800; index += 1) {
    const x = bounds.minX + random(index * 7 + 2) * (bounds.maxX - bounds.minX);
    const y = bounds.minY + random(index * 11 + 4) * (bounds.maxY - bounds.minY);
    const lightGrain = index % 5 === 0;
    context.fillStyle = lightGrain
      ? night
        ? "rgba(255,244,203,0.18)"
        : "rgba(255,253,231,0.58)"
      : night
        ? "rgba(42,31,21,0.13)"
        : rainy
          ? "rgba(105,82,52,0.09)"
          : "rgba(129,88,42,0.055)";
    context.fillRect(x, y, 1.05 + random(index) * 2.2, 0.82 + random(index + 3) * 1.55);
  }

  context.lineCap = "round";
  for (let index = 0; index < 34; index += 1) {
    const y = bounds.minY + 34 + random(index * 37) * Math.max(40, bounds.maxY - bounds.minY - 68);
    context.strokeStyle = index % 2 === 0 ? (night ? "rgba(255,236,188,0.09)" : "rgba(255,251,224,0.24)") : (night ? "rgba(39,31,23,0.09)" : "rgba(132,91,42,0.07)");
    context.lineWidth = 0.9 + random(index) * 1.2;
    context.beginPath();
    context.moveTo(bounds.minX + 36, y);
    context.bezierCurveTo(bounds.minX + 220, y - 30 + random(index + 1) * 62, bounds.maxX - 240, y + 28 - random(index + 2) * 54, bounds.maxX - 34, y + random(index + 3) * 18);
    context.stroke();
  }

  context.restore();
}

function paintPremiumSandLightField(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);

  context.save();
  polygonPath(context, sand);
  context.clip();

  const keyGlow = context.createRadialGradient(
    bounds.minX + (bounds.maxX - bounds.minX) * 0.2,
    bounds.minY + (bounds.maxY - bounds.minY) * 0.12,
    8,
    bounds.minX + (bounds.maxX - bounds.minX) * 0.2,
    bounds.minY + (bounds.maxY - bounds.minY) * 0.12,
    Math.max(260, (bounds.maxX - bounds.minX) * 0.66),
  );
  keyGlow.addColorStop(0, night ? "rgba(225,246,203,0.1)" : rainy ? "rgba(255,250,222,0.18)" : "rgba(255,254,228,0.36)");
  keyGlow.addColorStop(0.42, night ? "rgba(191,163,98,0.035)" : "rgba(244,198,105,0.1)");
  keyGlow.addColorStop(1, "rgba(255,255,255,0)");
  context.globalCompositeOperation = "screen";
  context.fillStyle = keyGlow;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  const sideFalloff = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  sideFalloff.addColorStop(0, "rgba(255,255,255,0)");
  sideFalloff.addColorStop(0.58, night ? "rgba(20,26,22,0.04)" : "rgba(97,65,31,0.045)");
  sideFalloff.addColorStop(1, night ? "rgba(5,11,13,0.18)" : rainy ? "rgba(82,64,43,0.12)" : "rgba(116,70,28,0.12)");
  context.globalCompositeOperation = "multiply";
  context.fillStyle = sideFalloff;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  context.globalCompositeOperation = "soft-light";
  for (let band = 0; band < 8; band += 1) {
    const boardY = 96 + band * ((BOARD_HEIGHT - 192) / 7);
    const start = projectPoint({ x: 94, y: boardY }, camera);
    const middle = projectPoint({ x: BOARD_WIDTH * 0.52, y: boardY + random(band * 83 + 7) * 34 - 17 }, camera);
    const end = projectPoint({ x: BOARD_WIDTH - 96, y: boardY + random(band * 89 + 11) * 28 - 14 }, camera);
    context.strokeStyle = band % 2 === 0
      ? night
        ? "rgba(255,238,189,0.13)"
        : "rgba(255,251,221,0.34)"
      : night
        ? "rgba(26,21,16,0.11)"
        : "rgba(124,79,35,0.14)";
    context.lineWidth = band % 2 === 0 ? 5.4 : 4.2;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.quadraticCurveTo(middle.x, middle.y, end.x, end.y);
    context.stroke();
  }

  context.restore();
}

function createSandSurfacePattern(environment: SandboxEnvironment): CanvasPattern | null {
  if (typeof document === "undefined") {
    return null;
  }

  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < 7600; index += 1) {
    const x = random(index * 5 + 17) * canvas.width;
    const y = random(index * 7 + 23) * canvas.height;
    const radius = 0.36 + random(index * 11 + 31) * 1.54;
    const alpha = 0.08 + random(index * 13 + 37) * (night ? 0.17 : 0.28);
    context.fillStyle = index % 4 === 0
      ? night
        ? `rgba(246,231,184,${alpha * 0.82})`
        : `rgba(255,253,230,${alpha * 1.22})`
      : rainy
        ? `rgba(103,83,55,${alpha * 0.64})`
        : `rgba(137,96,47,${alpha * 0.32})`;
    context.beginPath();
    context.ellipse(x, y, radius * (1.2 + random(index + 3) * 0.9), radius * (0.55 + random(index + 5) * 0.55), random(index + 9) * Math.PI, 0, Math.PI * 2);
    context.fill();
  }

  for (let index = 0; index < 86; index += 1) {
    const x = random(index * 41 + 5) * canvas.width;
    const y = random(index * 53 + 7) * canvas.height;
    context.strokeStyle = night ? "rgba(255,240,198,0.08)" : "rgba(255,250,224,0.24)";
    context.lineWidth = 0.8 + random(index + 13) * 1.2;
    context.beginPath();
    context.moveTo(x - 18, y);
    context.quadraticCurveTo(x, y - 5 + random(index + 19) * 10, x + 22, y + random(index + 23) * 7 - 3.5);
    context.stroke();
  }

  return context.createPattern(canvas, "repeat");
}

function paintSandMicroRelief(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  const grainLight = night ? "rgba(255,242,196,0.11)" : rainy ? "rgba(255,244,207,0.15)" : "rgba(255,248,211,0.2)";
  const grainDark = night ? "rgba(44,33,22,0.14)" : rainy ? "rgba(92,68,42,0.14)" : "rgba(104,72,36,0.14)";

  context.save();
  polygonPath(context, sand);
  context.clip();
  for (let index = 0; index < 14; index += 1) {
    const boardX = 92 + random(index * 61 + 17) * (BOARD_WIDTH - 184);
    const boardY = 76 + random(index * 67 + 19) * (BOARD_HEIGHT - 152);
    const point = projectPoint({ x: boardX, y: boardY }, camera);
    const rx = 72 + random(index * 29 + 5) * 132;
    const ry = 14 + random(index * 31 + 9) * 34;
    const rotation = -0.1 + random(index * 37 + 11) * 0.2;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(rotation);
    const mound = context.createRadialGradient(-rx * 0.32, -ry * 0.55, 2, 0, 0, rx);
    mound.addColorStop(0, night ? "rgba(255,239,188,0.12)" : rainy ? "rgba(255,245,211,0.18)" : "rgba(255,249,217,0.24)");
    mound.addColorStop(0.46, night ? "rgba(212,187,132,0.06)" : "rgba(241,211,143,0.1)");
    mound.addColorStop(0.82, night ? "rgba(45,34,24,0.08)" : rainy ? "rgba(104,78,48,0.08)" : "rgba(118,84,43,0.08)");
    mound.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = mound;
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.globalCompositeOperation = "source-over";
  for (let index = 0; index < 1500; index += 1) {
    const x = bounds.minX + random(index * 29 + 7) * (bounds.maxX - bounds.minX);
    const y = bounds.minY + random(index * 37 + 11) * (bounds.maxY - bounds.minY);
    const radiusX = 0.8 + random(index * 13) * 2.1;
    const radiusY = 0.34 + random(index * 17) * 0.72;
    context.fillStyle = index % 3 === 0 ? grainLight : grainDark;
    context.beginPath();
    context.ellipse(x, y, radiusX, radiusY, random(index + 19) * Math.PI, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();
  context.lineCap = "round";
  for (let row = 0; row < 18; row += 1) {
    const boardY = 70 + row * ((BOARD_HEIGHT - 140) / 17);
    const start = projectPoint({ x: 96, y: boardY + random(row * 47 + 5) * 18 - 9 }, camera);
    const middle = projectPoint({ x: BOARD_WIDTH * 0.5, y: boardY + random(row * 53 + 9) * 26 - 13 }, camera);
    const end = projectPoint({ x: BOARD_WIDTH - 96, y: boardY + random(row * 59 + 13) * 18 - 9 }, camera);
    context.strokeStyle = row % 2 === 0 ? (night ? "rgba(255,236,184,0.12)" : "rgba(255,248,207,0.3)") : (night ? "rgba(31,26,21,0.14)" : "rgba(112,82,46,0.17)");
    context.lineWidth = 1.2 + random(row + 33) * 1.8;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.quadraticCurveTo(middle.x, middle.y, end.x, end.y);
    context.stroke();
  }

  for (let patch = 0; patch < 4; patch += 1) {
    const centerX = 142 + random(patch * 71 + 3) * (BOARD_WIDTH - 284);
    const centerY = 96 + random(patch * 83 + 5) * (BOARD_HEIGHT - 192);
    for (let line = 0; line < 7; line += 1) {
      const offset = (line - 3) * 8;
      const start = projectPoint({ x: centerX - 56, y: centerY + offset }, camera);
      const middle = projectPoint({ x: centerX, y: centerY + offset + random(patch * 31 + line) * 14 - 7 }, camera);
      const end = projectPoint({ x: centerX + 68, y: centerY + offset + random(patch * 43 + line) * 16 - 8 }, camera);
      context.strokeStyle = line % 2 === 0
        ? night
          ? "rgba(255,234,186,0.08)"
          : "rgba(255,248,213,0.22)"
        : night
          ? "rgba(25,21,18,0.13)"
          : "rgba(101,73,42,0.14)";
      context.lineWidth = line % 2 === 0 ? 1.5 : 2.4;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.quadraticCurveTo(middle.x, middle.y, end.x, end.y);
      context.stroke();
    }
  }
  context.restore();
}

function paintPremiumSandDuneFields(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const dunes = [
    { x: 190, y: 156, rx: 128, ry: 28, angle: -0.18, seed: 3101, strength: 0.46 },
    { x: 374, y: 282, rx: 148, ry: 32, angle: 0.08, seed: 3209, strength: 0.42 },
    { x: 586, y: 188, rx: 132, ry: 27, angle: -0.1, seed: 3323, strength: 0.38 },
    { x: 776, y: 398, rx: 156, ry: 34, angle: 0.12, seed: 3449, strength: 0.44 },
    { x: 292, y: 484, rx: 114, ry: 24, angle: 0.2, seed: 3581, strength: 0.36 },
  ];

  context.save();
  polygonPath(context, sand);
  context.clip();

  dunes.forEach((dune) => {
    const anchor = projectPoint({ x: dune.x, y: dune.y }, camera);
    const depth = getDepthScale({ x: dune.x, y: dune.y }, camera);
    const radiusX = dune.rx * camera.zoom * (0.82 + depth * 0.18);
    const radiusY = dune.ry * camera.zoom * camera.pitch * (0.9 + depth * 0.12);

    context.save();
    context.translate(anchor.x, anchor.y);
    context.rotate(dune.angle + (camera.yaw * Math.PI) / 720);

    const mound = context.createRadialGradient(-radiusX * 0.38, -radiusY * 0.66, 4, 0, 0, radiusX * 1.22);
    mound.addColorStop(
      0,
      night
        ? `rgba(255,240,194,${0.13 * dune.strength})`
        : rainy
          ? `rgba(255,246,214,${0.16 * dune.strength})`
          : `rgba(255,251,225,${0.18 * dune.strength})`,
    );
    mound.addColorStop(
      0.42,
      night
        ? `rgba(184,157,101,${0.055 * dune.strength})`
        : `rgba(235,188,105,${0.06 * dune.strength})`,
    );
    mound.addColorStop(
      0.78,
      night
        ? `rgba(28,24,19,${0.115 * dune.strength})`
        : rainy
          ? `rgba(87,68,45,${0.095 * dune.strength})`
          : `rgba(121,78,34,${0.06 * dune.strength})`,
    );
    mound.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = mound;
    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();

    context.globalCompositeOperation = "screen";
    context.strokeStyle = night
      ? `rgba(245,239,190,${0.09 * dune.strength})`
      : `rgba(255,251,224,${0.18 * dune.strength})`;
    context.lineCap = "round";
    for (let line = 0; line < 5; line += 1) {
      const offset = (line - 2) * radiusY * 0.23;
      context.lineWidth = 0.9 + random(dune.seed + line * 13) * 1.4;
      context.beginPath();
      context.moveTo(-radiusX * 0.5, offset - radiusY * 0.22);
      context.bezierCurveTo(
        -radiusX * 0.16,
        offset - radiusY * 0.42,
        radiusX * 0.24,
        offset + radiusY * 0.08,
        radiusX * 0.58,
        offset - radiusY * 0.18,
      );
      context.stroke();
    }
    context.restore();
  });

  context.restore();
}

function paintSandPhotographicFinish(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.globalCompositeOperation = "screen";
  for (let index = 0; index < 860; index += 1) {
    const boardX = 68 + random(index * 97 + 11) * (BOARD_WIDTH - 136);
    const boardY = 58 + random(index * 101 + 17) * (BOARD_HEIGHT - 116);
    const point = projectPoint({ x: boardX, y: boardY }, camera);
    const sparkle = random(index * 113 + 23);
    const alpha = (night ? 0.045 : rainy ? 0.055 : 0.075) + sparkle * (night ? 0.07 : 0.105);
    context.fillStyle = night ? `rgba(225,249,222,${alpha})` : `rgba(255,253,229,${alpha})`;
    context.beginPath();
    context.ellipse(
      point.x,
      point.y,
      0.55 + random(index * 127 + 29) * 1.55,
      0.28 + random(index * 131 + 31) * 0.72,
      -0.28 + random(index * 137 + 37) * 0.56,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  context.globalCompositeOperation = "multiply";
  for (let index = 0; index < 420; index += 1) {
    const x = bounds.minX + random(index * 149 + 41) * width;
    const y = bounds.minY + random(index * 151 + 43) * height;
    const alpha = night ? 0.04 : rainy ? 0.055 : 0.045;
    context.fillStyle = `rgba(72,48,25,${alpha + random(index * 157 + 47) * 0.045})`;
    context.beginPath();
    context.ellipse(x, y, 1.8 + random(index) * 4.2, 0.8 + random(index + 5) * 1.8, random(index + 9) * Math.PI, 0, Math.PI * 2);
    context.fill();
  }

  context.globalCompositeOperation = night ? "screen" : "soft-light";
  const studioSweep = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.minY + height * 0.66);
  studioSweep.addColorStop(0, night ? "rgba(125,218,222,0.05)" : "rgba(255,255,232,0.22)");
  studioSweep.addColorStop(0.28, night ? "rgba(125,218,222,0.025)" : "rgba(255,238,180,0.12)");
  studioSweep.addColorStop(0.62, "rgba(255,255,255,0)");
  studioSweep.addColorStop(1, night ? "rgba(10,28,36,0.1)" : "rgba(112,73,33,0.12)");
  context.fillStyle = studioSweep;
  context.fillRect(bounds.minX, bounds.minY, width, height);

  context.restore();
}

function paintSandSpecularMicroTopology(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const highlight = night ? "rgba(238,247,203," : rainy ? "rgba(246,244,216," : "rgba(255,253,226,";
  const mid = night ? "rgba(171,151,109," : rainy ? "rgba(174,143,94," : "rgba(211,159,83,";
  const shadow = night ? "rgba(11,19,20," : rainy ? "rgba(74,60,42," : "rgba(103,66,31,";

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = "blur(4px)";
  for (let mound = 0; mound < 9; mound += 1) {
    const seed = 6200 + mound * 211;
    const boardX = 110 + random(seed) * (BOARD_WIDTH - 220);
    const boardY = 94 + random(seed + 7) * (BOARD_HEIGHT - 188);
    const point = projectPoint({ x: boardX, y: boardY }, camera);
    const depth = getDepthScale({ x: boardX, y: boardY }, camera);
    const rx = (40 + random(seed + 11) * 108) * camera.zoom * (0.82 + depth * 0.16);
    const ry = (7 + random(seed + 13) * 20) * camera.zoom * camera.pitch;
    const angle = -0.22 + random(seed + 17) * 0.42 + (camera.yaw * Math.PI) / 960;

    context.save();
    context.translate(point.x + rx * 0.08, point.y + ry * 0.68);
    context.rotate(angle);
    context.fillStyle = `${shadow}${night ? 0.06 : rainy ? 0.05 : 0.045})`;
    context.beginPath();
    context.ellipse(0, 0, rx, ry * 1.28, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.filter = "blur(2px)";
  for (let mound = 0; mound < 9; mound += 1) {
    const seed = 6200 + mound * 211;
    const boardX = 110 + random(seed) * (BOARD_WIDTH - 220);
    const boardY = 94 + random(seed + 7) * (BOARD_HEIGHT - 188);
    const point = projectPoint({ x: boardX, y: boardY }, camera);
    const depth = getDepthScale({ x: boardX, y: boardY }, camera);
    const rx = (32 + random(seed + 11) * 86) * camera.zoom * (0.82 + depth * 0.16);
    const ry = (5 + random(seed + 13) * 15) * camera.zoom * camera.pitch;
    const angle = -0.22 + random(seed + 17) * 0.42 + (camera.yaw * Math.PI) / 960;

    context.save();
    context.translate(point.x - rx * 0.18, point.y - ry * 0.5);
    context.rotate(angle);
    context.fillStyle = `${highlight}${night ? 0.055 : rainy ? 0.085 : 0.13})`;
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.globalCompositeOperation = "source-over";
  for (let grain = 0; grain < 2300; grain += 1) {
    const seed = 7900 + grain * 37;
    const x = bounds.minX + random(seed) * width;
    const y = bounds.minY + random(seed + 3) * height;
    const depthT = Math.max(0, Math.min(1, (y - bounds.minY) / Math.max(1, height)));
    const size = 0.48 + random(seed + 5) * (1.85 + depthT * 0.7);
    const raised = grain % 7 === 0;
    const warm = grain % 5 === 0;

    context.save();
    context.translate(x, y);
    context.rotate(-0.34 + random(seed + 9) * 0.68);
    if (raised) {
      context.shadowColor = night ? "rgba(191,255,232,0.14)" : "rgba(255,241,194,0.22)";
      context.shadowBlur = 2;
      context.shadowOffsetX = -0.35;
      context.shadowOffsetY = -0.45;
    }
    context.fillStyle = raised
      ? `${highlight}${night ? 0.11 : rainy ? 0.13 : 0.2})`
      : warm
        ? `${mid}${night ? 0.08 : rainy ? 0.08 : 0.09})`
        : `${shadow}${night ? 0.05 : rainy ? 0.055 : 0.048})`;
    context.beginPath();
    context.ellipse(0, 0, size * (1.15 + random(seed + 13) * 0.9), size * (0.34 + random(seed + 17) * 0.36), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.save();
  context.globalCompositeOperation = rainy ? "multiply" : "soft-light";
  context.lineCap = "round";
  for (let ridge = 0; ridge < 17; ridge += 1) {
    const seed = 9300 + ridge * 97;
    const start = projectPoint({ x: 84, y: 86 + random(seed) * (BOARD_HEIGHT - 172) }, camera);
    const middle = projectPoint({ x: BOARD_WIDTH * (0.34 + random(seed + 5) * 0.28), y: 88 + random(seed + 7) * (BOARD_HEIGHT - 176) }, camera);
    const end = projectPoint({ x: BOARD_WIDTH - 92, y: 86 + random(seed + 11) * (BOARD_HEIGHT - 172) }, camera);
    const alpha = night ? 0.07 : rainy ? 0.075 : 0.095;
    context.strokeStyle = ridge % 2 === 0 ? `${highlight}${alpha * 1.35})` : `${shadow}${alpha})`;
    context.lineWidth = ridge % 2 === 0 ? 1.1 + random(seed + 13) * 1.2 : 2.2 + random(seed + 17) * 1.6;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.quadraticCurveTo(middle.x, middle.y, end.x, end.y);
    context.stroke();
  }
  context.restore();

  context.restore();
}

function paintReferenceSandMiniatureFinish(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const highlight = night ? "rgba(244,240,198," : rainy ? "rgba(255,244,215," : "rgba(255,251,224,";
  const warmMid = night ? "rgba(180,150,98," : rainy ? "rgba(176,132,78," : "rgba(210,151,70,";
  const shadow = night ? "rgba(14,18,16," : rainy ? "rgba(72,55,35," : "rgba(116,75,32,";

  context.save();
  polygonPath(context, sand);
  context.clip();

  const tactileZones = [
    { x: 176, y: 142, rx: 156, ry: 34, angle: -0.22, seed: 41011, strength: 0.82 },
    { x: 334, y: 316, rx: 190, ry: 38, angle: 0.06, seed: 41117, strength: 0.72 },
    { x: 590, y: 214, rx: 176, ry: 32, angle: -0.1, seed: 41239, strength: 0.66 },
    { x: 862, y: 382, rx: 214, ry: 42, angle: 0.18, seed: 41333, strength: 0.74 },
  ];

  tactileZones.forEach((zone) => {
    const point = projectPoint({ x: zone.x, y: zone.y }, camera);
    const depth = getDepthScale({ x: zone.x, y: zone.y }, camera);
    const rx = zone.rx * camera.zoom * (0.92 + depth * 0.16);
    const ry = zone.ry * camera.zoom * camera.pitch * (0.96 + depth * 0.1);
    const rotation = zone.angle + (camera.yaw * Math.PI) / 980;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(rotation);

    context.save();
    context.globalCompositeOperation = "multiply";
    context.filter = "blur(4.5px)";
    context.fillStyle = `${shadow}${(night ? 0.11 : rainy ? 0.096 : 0.13) * zone.strength})`;
    context.beginPath();
    context.ellipse(rx * 0.16, ry * 0.48, rx * 1.02, ry * 1.36, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = "blur(2px)";
    context.fillStyle = `${highlight}${(night ? 0.13 : rainy ? 0.22 : 0.34) * zone.strength})`;
    context.beginPath();
    context.ellipse(-rx * 0.2, -ry * 0.52, rx * 0.78, ry * 0.74, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    for (let line = 0; line < 9; line += 1) {
      const offset = (line - 4) * ry * 0.21;
      const jitter = random(zone.seed + line * 17) * ry * 0.12 - ry * 0.06;
      context.save();
      context.lineCap = "round";
      context.globalCompositeOperation = "multiply";
      context.strokeStyle = `${shadow}${(night ? 0.1 : rainy ? 0.086 : 0.11) * zone.strength})`;
      context.lineWidth = 2.8 + random(zone.seed + line * 23) * 1.8;
      context.beginPath();
      context.moveTo(-rx * 0.56 + 1.2, offset + jitter + 2.2);
      context.bezierCurveTo(-rx * 0.18, offset - ry * 0.24, rx * 0.16, offset + ry * 0.2, rx * 0.56, offset - ry * 0.12);
      context.stroke();

      context.globalCompositeOperation = "screen";
      context.strokeStyle = `${highlight}${(night ? 0.16 : rainy ? 0.28 : 0.48) * zone.strength})`;
      context.lineWidth = 1.2 + random(zone.seed + line * 29) * 1.05;
      context.beginPath();
      context.moveTo(-rx * 0.56 - 0.8, offset + jitter - 1.1);
      context.bezierCurveTo(-rx * 0.18, offset - ry * 0.34, rx * 0.16, offset + ry * 0.1, rx * 0.56, offset - ry * 0.22);
      context.stroke();
      context.restore();
    }

    context.restore();
  });

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let grain = 0; grain < 6200; grain += 1) {
    const seed = 52000 + grain * 19;
    const x = bounds.minX + random(seed) * width;
    const y = bounds.minY + random(seed + 3) * height;
    const depth = (y - bounds.minY) / Math.max(1, height);
    const raised = grain % 6 === 0;
    const bright = grain % 4 === 0;
    const rx = 0.36 + random(seed + 5) * (1.7 + depth * 0.42);
    const ry = 0.22 + random(seed + 7) * 0.58;

    context.save();
    context.translate(x, y);
    context.rotate(-0.45 + random(seed + 11) * 0.9);
    if (raised) {
      context.shadowColor = night ? "rgba(184,255,231,0.12)" : "rgba(255,241,198,0.22)";
      context.shadowBlur = 1.6;
      context.shadowOffsetX = -0.28;
      context.shadowOffsetY = -0.36;
    }
    context.fillStyle = raised
      ? `${highlight}${night ? 0.14 : rainy ? 0.18 : 0.28})`
      : bright
        ? `${warmMid}${night ? 0.07 : rainy ? 0.08 : 0.09})`
        : `${shadow}${night ? 0.058 : rainy ? 0.064 : 0.062})`;
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  context.lineCap = "round";
  for (let sweep = 0; sweep < 28; sweep += 1) {
    const seed = 70000 + sweep * 43;
    const y = bounds.minY + 28 + random(seed) * Math.max(1, height - 56);
    const alpha = night ? 0.13 : rainy ? 0.15 : 0.24;
    const curveLift = 26 + random(seed + 17) * 22;

    context.strokeStyle = `${shadow}${alpha * (sweep % 2 === 0 ? 0.34 : 0.42)})`;
    context.lineWidth = 2.8 + random(seed + 19) * 1.8;
    context.beginPath();
    context.moveTo(bounds.minX + 48, y + 2.4);
    context.bezierCurveTo(
      bounds.minX + width * 0.28,
      y - curveLift + random(seed + 5) * 52,
      bounds.minX + width * 0.64,
      y + 22 - random(seed + 9) * 44,
      bounds.maxX - 50,
      y + random(seed + 13) * 20 - 10,
    );
    context.stroke();

    context.strokeStyle = `${highlight}${alpha * (sweep % 2 === 0 ? 1.1 : 0.82)})`;
    context.lineWidth = 0.9 + random(seed + 23) * 1.1;
    context.beginPath();
    context.moveTo(bounds.minX + 48, y - 1.2);
    context.bezierCurveTo(
      bounds.minX + width * 0.28,
      y - curveLift - 2 + random(seed + 5) * 52,
      bounds.minX + width * 0.64,
      y + 19 - random(seed + 9) * 44,
      bounds.maxX - 50,
      y + random(seed + 13) * 20 - 12,
    );
    context.stroke();
  }
  context.restore();

  context.restore();
}

function paintReferenceSandColorGrade(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "screen";
  const lift = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  lift.addColorStop(0, night ? "rgba(227,238,190,0.12)" : rainy ? "rgba(255,240,200,0.2)" : "rgba(255,245,204,0.32)");
  lift.addColorStop(0.42, night ? "rgba(209,196,138,0.06)" : rainy ? "rgba(255,224,170,0.16)" : "rgba(255,230,174,0.28)");
  lift.addColorStop(1, night ? "rgba(138,111,70,0.025)" : rainy ? "rgba(234,181,109,0.08)" : "rgba(228,164,84,0.1)");
  context.fillStyle = lift;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const contour = context.createRadialGradient(
    bounds.minX + width * 0.46,
    bounds.minY + height * 0.48,
    Math.max(100, width * 0.22),
    bounds.minX + width * 0.52,
    bounds.minY + height * 0.54,
    Math.max(260, width * 0.68),
  );
  contour.addColorStop(0, "rgba(255,255,255,0)");
  contour.addColorStop(0.76, night ? "rgba(8,17,18,0.04)" : rainy ? "rgba(87,61,31,0.045)" : "rgba(118,73,27,0.04)");
  contour.addColorStop(1, night ? "rgba(2,8,10,0.12)" : rainy ? "rgba(80,55,28,0.1)" : "rgba(115,66,22,0.08)");
  context.fillStyle = contour;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  context.lineCap = "round";
  for (let sweep = 0; sweep < 26; sweep += 1) {
    const seed = 88000 + sweep * 61;
    const boardY = 92 + random(seed) * (BOARD_HEIGHT - 184);
    const start = projectPoint({ x: 108, y: boardY }, camera);
    const middle = projectPoint({ x: BOARD_WIDTH * 0.52, y: boardY - 28 + random(seed + 7) * 56 }, camera);
    const end = projectPoint({ x: BOARD_WIDTH - 106, y: boardY + random(seed + 11) * 26 - 13 }, camera);
    const lightAlpha = night ? 0.11 : rainy ? 0.16 : 0.26;
    const shadowAlpha = night ? 0.065 : rainy ? 0.07 : 0.075;

    context.strokeStyle = night ? `rgba(244,237,188,${lightAlpha})` : `rgba(255,250,221,${lightAlpha})`;
    context.lineWidth = 1.2 + random(seed + 13) * 0.85;
    context.beginPath();
    context.moveTo(start.x - 1.4, start.y - 1.4);
    context.quadraticCurveTo(middle.x - 1.1, middle.y - 1.1, end.x - 1.1, end.y - 1);
    context.stroke();

    context.strokeStyle = night ? `rgba(15,20,18,${shadowAlpha})` : `rgba(115,75,33,${shadowAlpha})`;
    context.lineWidth = 2.4 + random(seed + 17) * 1.4;
    context.beginPath();
    context.moveTo(start.x + 1.3, start.y + 2.1);
    context.quadraticCurveTo(middle.x + 1.1, middle.y + 1.7, end.x + 1.2, end.y + 1.5);
    context.stroke();
  }
  context.restore();

  context.restore();
}

function paintReferenceStudioSandPolish(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const warmLight = night ? "rgba(244,238,190," : rainy ? "rgba(255,246,218," : "rgba(255,252,226,";
  const honey = night ? "rgba(166,139,90," : rainy ? "rgba(180,132,76," : "rgba(207,142,58,";
  const umber = night ? "rgba(12,18,16," : rainy ? "rgba(70,55,36," : "rgba(113,70,28,";

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "source-over";
  const sandTopcoat = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  sandTopcoat.addColorStop(0, night ? "rgba(205,194,150,0.2)" : rainy ? "rgba(244,218,171,0.38)" : "rgba(255,234,184,0.62)");
  sandTopcoat.addColorStop(0.46, night ? "rgba(181,158,112,0.18)" : rainy ? "rgba(226,192,139,0.32)" : "rgba(243,205,142,0.52)");
  sandTopcoat.addColorStop(1, night ? "rgba(128,99,66,0.2)" : rainy ? "rgba(190,142,91,0.28)" : "rgba(213,155,91,0.42)");
  context.fillStyle = sandTopcoat;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  const studioKey = context.createRadialGradient(
    bounds.minX + width * 0.18,
    bounds.minY + height * 0.06,
    8,
    bounds.minX + width * 0.24,
    bounds.minY + height * 0.16,
    Math.max(width, height) * 0.78,
  );
  studioKey.addColorStop(0, `${warmLight}${night ? 0.1 : rainy ? 0.16 : cloudy ? 0.2 : 0.24})`);
  studioKey.addColorStop(0.36, `${warmLight}${night ? 0.035 : rainy ? 0.058 : 0.08})`);
  studioKey.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = studioKey;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  const sculptZones = [
    { x: 182, y: 122, rx: 168, ry: 34, angle: -0.22, seed: 11109, strength: 0.72 },
    { x: 380, y: 248, rx: 218, ry: 42, angle: 0.08, seed: 11261, strength: 0.66 },
    { x: 660, y: 156, rx: 196, ry: 36, angle: -0.12, seed: 11393, strength: 0.62 },
    { x: 818, y: 386, rx: 248, ry: 48, angle: 0.18, seed: 11549, strength: 0.7 },
    { x: 318, y: 494, rx: 172, ry: 32, angle: 0.14, seed: 11677, strength: 0.54 },
  ];

  sculptZones.forEach((zone) => {
    const point = projectPoint({ x: zone.x, y: zone.y }, camera);
    const depth = getDepthScale({ x: zone.x, y: zone.y }, camera);
    const rx = zone.rx * camera.zoom * (0.88 + depth * 0.14);
    const ry = zone.ry * camera.zoom * camera.pitch * (0.9 + depth * 0.12);
    const rotation = zone.angle + (camera.yaw * Math.PI) / 860;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(rotation);

    context.save();
    context.globalCompositeOperation = "multiply";
    context.filter = "blur(5px)";
    context.fillStyle = `${umber}${(night ? 0.105 : rainy ? 0.088 : 0.084) * zone.strength})`;
    context.beginPath();
    context.ellipse(rx * 0.2, ry * 0.54, rx * 1.02, ry * 1.42, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = "blur(2px)";
    context.fillStyle = `${warmLight}${(night ? 0.12 : rainy ? 0.22 : 0.34) * zone.strength})`;
    context.beginPath();
    context.ellipse(-rx * 0.24, -ry * 0.54, rx * 0.84, ry * 0.8, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.lineCap = "round";
    for (let ridge = 0; ridge < 8; ridge += 1) {
      const offset = (ridge - 3.5) * ry * 0.2;
      const jitter = random(zone.seed + ridge * 17) * ry * 0.12 - ry * 0.06;
      context.globalCompositeOperation = "multiply";
      context.strokeStyle = `${umber}${(night ? 0.11 : rainy ? 0.098 : 0.11) * zone.strength})`;
      context.lineWidth = 2.3 + random(zone.seed + ridge * 23) * 1.6;
      context.beginPath();
      context.moveTo(-rx * 0.55, offset + jitter + 1.8);
      context.bezierCurveTo(-rx * 0.16, offset - ry * 0.28, rx * 0.2, offset + ry * 0.22, rx * 0.58, offset - ry * 0.14);
      context.stroke();

      context.globalCompositeOperation = "screen";
      context.strokeStyle = `${warmLight}${(night ? 0.16 : rainy ? 0.29 : 0.46) * zone.strength})`;
      context.lineWidth = 0.9 + random(zone.seed + ridge * 29) * 0.9;
      context.beginPath();
      context.moveTo(-rx * 0.55, offset + jitter - 0.9);
      context.bezierCurveTo(-rx * 0.16, offset - ry * 0.34, rx * 0.2, offset + ry * 0.1, rx * 0.58, offset - ry * 0.24);
      context.stroke();
    }
    context.restore();
  });

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let grain = 0; grain < 3600; grain += 1) {
    const seed = 160000 + grain * 23;
    const x = bounds.minX + random(seed) * width;
    const y = bounds.minY + random(seed + 5) * height;
    const depth = (y - bounds.minY) / Math.max(1, height);
    const raised = grain % 8 === 0;
    const bright = grain % 5 === 0;
    const rx = 0.32 + random(seed + 11) * (1.45 + depth * 0.55);
    const ry = 0.18 + random(seed + 17) * 0.5;

    context.save();
    context.translate(x, y);
    context.rotate(-0.48 + random(seed + 19) * 0.96);
    if (raised) {
      context.shadowColor = night ? "rgba(210,255,230,0.1)" : "rgba(255,238,190,0.2)";
      context.shadowBlur = 1.4;
      context.shadowOffsetX = -0.22;
      context.shadowOffsetY = -0.32;
    }
    context.fillStyle = raised
      ? `${warmLight}${night ? 0.14 : rainy ? 0.2 : 0.34})`
      : bright
        ? `${honey}${night ? 0.075 : rainy ? 0.09 : 0.11})`
        : `${umber}${night ? 0.06 : rainy ? 0.064 : 0.07})`;
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let sweep = 0; sweep < 24; sweep += 1) {
    const seed = 180000 + sweep * 43;
    const boardY = 94 + sweep * ((BOARD_HEIGHT - 188) / 23) + random(seed) * 10 - 5;
    const start = projectPoint({ x: 92, y: boardY }, camera);
    const middle = projectPoint({ x: BOARD_WIDTH * (0.42 + random(seed + 7) * 0.16), y: boardY - 22 + random(seed + 11) * 44 }, camera);
    const end = projectPoint({ x: BOARD_WIDTH - 88, y: boardY + random(seed + 13) * 24 - 12 }, camera);
    const shadowAlpha = night ? 0.12 : rainy ? 0.115 : 0.12;
    const lightAlpha = night ? 0.18 : rainy ? 0.24 : 0.34;

    context.globalCompositeOperation = "multiply";
    context.strokeStyle = `${umber}${shadowAlpha})`;
    context.lineWidth = 2.4 + random(seed + 17) * 1.7;
    context.beginPath();
    context.moveTo(start.x + 1.6, start.y + 2.6);
    context.quadraticCurveTo(middle.x + 1.2, middle.y + 2.2, end.x + 1.4, end.y + 2);
    context.stroke();

    context.globalCompositeOperation = "screen";
    context.strokeStyle = `${warmLight}${lightAlpha})`;
    context.lineWidth = 0.95 + random(seed + 19) * 0.8;
    context.beginPath();
    context.moveTo(start.x - 1.2, start.y - 1.4);
    context.quadraticCurveTo(middle.x - 1, middle.y - 1.2, end.x - 1, end.y - 1);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = "blur(1.2px)";
  for (let pit = 0; pit < 18; pit += 1) {
    const seed = 190000 + pit * 59;
    const boardX = 108 + random(seed) * (BOARD_WIDTH - 216);
    const boardY = 86 + random(seed + 5) * (BOARD_HEIGHT - 172);
    const point = projectPoint({ x: boardX, y: boardY }, camera);
    const depth = getDepthScale({ x: boardX, y: boardY }, camera);
    const rx = (18 + random(seed + 11) * 34) * camera.zoom * (0.9 + depth * 0.16);
    const ry = (4 + random(seed + 13) * 8) * camera.zoom * camera.pitch;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(-0.26 + random(seed + 17) * 0.52 + (camera.yaw * Math.PI) / 900);
    context.fillStyle = `${umber}${night ? 0.1 : rainy ? 0.085 : 0.075})`;
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  for (let ridge = 0; ridge < 16; ridge += 1) {
    const seed = 200000 + ridge * 53;
    const edgeT = random(seed);
    const edge = ridge % 4;
    const boardPoint =
      edge === 0
        ? { x: 82 + edgeT * (BOARD_WIDTH - 164), y: 76 + random(seed + 3) * 28 }
        : edge === 1
          ? { x: BOARD_WIDTH - 92 - random(seed + 5) * 28, y: 88 + edgeT * (BOARD_HEIGHT - 176) }
          : edge === 2
            ? { x: 86 + edgeT * (BOARD_WIDTH - 172), y: BOARD_HEIGHT - 86 - random(seed + 7) * 32 }
            : { x: 94 + random(seed + 9) * 28, y: 88 + edgeT * (BOARD_HEIGHT - 176) };
    const point = projectPoint(boardPoint, camera);
    const rx = (20 + random(seed + 11) * 42) * camera.zoom;
    const ry = (4 + random(seed + 13) * 9) * camera.zoom * camera.pitch;
    context.save();
    context.translate(point.x, point.y);
    context.rotate(-0.3 + random(seed + 17) * 0.6);
    context.fillStyle = `${warmLight}${night ? 0.08 : rainy ? 0.13 : 0.2})`;
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const edgeContact = context.createRadialGradient(
    bounds.minX + width * 0.5,
    bounds.minY + height * 0.52,
    Math.min(width, height) * 0.24,
    bounds.minX + width * 0.5,
    bounds.minY + height * 0.52,
    Math.max(width, height) * 0.78,
  );
  edgeContact.addColorStop(0, "rgba(255,255,255,0)");
  edgeContact.addColorStop(0.7, "rgba(255,255,255,0)");
  edgeContact.addColorStop(1, `${umber}${night ? 0.16 : rainy ? 0.13 : 0.13})`);
  context.fillStyle = edgeContact;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.restore();
}

function paintSandStudioColorLift(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "screen";
  const topWash = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  topWash.addColorStop(
    0,
    night
      ? "rgba(214,232,194,0.08)"
      : rainy
        ? "rgba(255,247,220,0.2)"
        : cloudy
          ? "rgba(255,250,224,0.22)"
          : "rgba(255,252,224,0.32)",
  );
  topWash.addColorStop(
    0.42,
    night
      ? "rgba(178,166,118,0.035)"
      : rainy
        ? "rgba(255,233,190,0.12)"
        : "rgba(255,228,178,0.18)",
  );
  topWash.addColorStop(0.76, night ? "rgba(118,93,57,0.012)" : "rgba(224,158,78,0.065)");
  topWash.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = topWash;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "soft-light";
  const windowPatch = context.createRadialGradient(
    bounds.minX + width * 0.24,
    bounds.minY + height * 0.12,
    8,
    bounds.minX + width * 0.25,
    bounds.minY + height * 0.18,
    Math.max(220, width * 0.46),
  );
  windowPatch.addColorStop(0, night ? "rgba(214,244,216,0.12)" : "rgba(255,255,240,0.48)");
  windowPatch.addColorStop(0.52, night ? "rgba(171,183,137,0.04)" : "rgba(255,230,181,0.2)");
  windowPatch.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = windowPatch;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const frontWeight = context.createLinearGradient(bounds.minX, bounds.minY + height * 0.48, bounds.maxX, bounds.maxY);
  frontWeight.addColorStop(0, "rgba(255,255,255,0)");
  frontWeight.addColorStop(
    0.72,
    night ? "rgba(22,21,15,0.035)" : rainy ? "rgba(91,70,44,0.045)" : "rgba(115,72,30,0.04)",
  );
  frontWeight.addColorStop(1, night ? "rgba(4,8,9,0.08)" : "rgba(105,62,23,0.055)");
  context.fillStyle = frontWeight;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.restore();
}

function paintReferenceSandboxFinalGrade(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const highlight = night ? "rgba(223,246,218," : rainy ? "rgba(255,247,223," : "rgba(255,251,226,";
  const warmSand = night ? "rgba(176,151,102," : rainy ? "rgba(197,151,92," : "rgba(230,171,89,";
  const shadow = night ? "rgba(6,14,16," : rainy ? "rgba(79,62,42," : "rgba(109,73,32,";

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "screen";
  const studioSweep = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  studioSweep.addColorStop(0, `${highlight}${night ? 0.1 : rainy ? 0.15 : cloudy ? 0.18 : 0.22})`);
  studioSweep.addColorStop(0.34, `${highlight}${night ? 0.052 : rainy ? 0.085 : 0.12})`);
  studioSweep.addColorStop(0.66, `${warmSand}${night ? 0.036 : rainy ? 0.045 : 0.072})`);
  studioSweep.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = studioSweep;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const trayDepth = context.createLinearGradient(bounds.minX, bounds.minY + height * 0.1, bounds.maxX, bounds.maxY);
  trayDepth.addColorStop(0, "rgba(255,255,255,0)");
  trayDepth.addColorStop(0.62, `${shadow}${night ? 0.042 : rainy ? 0.048 : 0.044})`);
  trayDepth.addColorStop(1, `${shadow}${night ? 0.13 : rainy ? 0.1 : 0.092})`);
  context.fillStyle = trayDepth;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  const dunes = [
    { x: 150, y: 108, rx: 180, ry: 40, angle: -0.18, seed: 34011, strength: 0.72 },
    { x: 386, y: 214, rx: 235, ry: 48, angle: 0.12, seed: 34079, strength: 0.58 },
    { x: 710, y: 120, rx: 210, ry: 38, angle: -0.08, seed: 34133, strength: 0.64 },
    { x: 922, y: 340, rx: 250, ry: 52, angle: 0.18, seed: 34203, strength: 0.6 },
    { x: 300, y: 455, rx: 220, ry: 44, angle: -0.02, seed: 34281, strength: 0.5 },
  ];

  dunes.forEach((dune) => {
    const point = projectPoint({ x: dune.x, y: dune.y }, camera);
    const depth = getDepthScale({ x: dune.x, y: dune.y }, camera);
    const rx = dune.rx * camera.zoom * (0.92 + depth * 0.12);
    const ry = dune.ry * camera.zoom * camera.pitch * (0.9 + depth * 0.12);
    const angle = dune.angle + (camera.yaw * Math.PI) / 980;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle);

    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = "blur(2.4px)";
    context.fillStyle = `${highlight}${(night ? 0.09 : rainy ? 0.13 : 0.21) * dune.strength})`;
    context.beginPath();
    context.ellipse(-rx * 0.18, -ry * 0.36, rx * 0.72, ry * 0.58, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.globalCompositeOperation = "multiply";
    context.filter = "blur(4.6px)";
    context.fillStyle = `${shadow}${(night ? 0.14 : rainy ? 0.098 : 0.088) * dune.strength})`;
    context.beginPath();
    context.ellipse(rx * 0.18, ry * 0.54, rx * 0.92, ry * 1.18, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.lineCap = "round";
    context.lineJoin = "round";
    for (let ridge = 0; ridge < 5; ridge += 1) {
      const seed = dune.seed + ridge * 29;
      const offset = (ridge - 2) * ry * 0.22 + random(seed) * ry * 0.12;
      const span = rx * (0.46 + random(seed + 5) * 0.24);
      context.globalCompositeOperation = "multiply";
      context.strokeStyle = `${shadow}${(night ? 0.096 : rainy ? 0.074 : 0.068) * dune.strength})`;
      context.lineWidth = 1.2 + random(seed + 7) * 0.95;
      context.beginPath();
      context.moveTo(-span, offset + 1.4);
      context.bezierCurveTo(-span * 0.28, offset - ry * 0.2, span * 0.26, offset + ry * 0.18, span, offset - ry * 0.08);
      context.stroke();

      context.globalCompositeOperation = "screen";
      context.strokeStyle = `${highlight}${(night ? 0.074 : rainy ? 0.11 : 0.17) * dune.strength})`;
      context.lineWidth = 0.55 + random(seed + 11) * 0.46;
      context.beginPath();
      context.moveTo(-span, offset - 0.8);
      context.bezierCurveTo(-span * 0.28, offset - ry * 0.28, span * 0.26, offset + ry * 0.08, span, offset - ry * 0.18);
      context.stroke();
    }
    context.restore();
  });

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let grain = 0; grain < 2600; grain += 1) {
    const seed = 36000 + grain * 17;
    const x = bounds.minX + random(seed) * width;
    const y = bounds.minY + random(seed + 3) * height;
    const depth = (y - bounds.minY) / Math.max(1, height);
    const isBright = grain % 4 === 0;
    const isWarm = grain % 7 === 0;
    const rx = 0.22 + random(seed + 9) * (1.0 + depth * 0.35);
    const ry = 0.16 + random(seed + 13) * 0.42;

    context.save();
    context.translate(x, y);
    context.rotate(-0.45 + random(seed + 19) * 0.9);
    context.fillStyle = isBright
      ? `${highlight}${night ? 0.072 : rainy ? 0.12 : 0.18})`
      : isWarm
        ? `${warmSand}${night ? 0.065 : rainy ? 0.07 : 0.075})`
        : `${shadow}${night ? 0.062 : rainy ? 0.048 : 0.044})`;
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  for (let sweep = 0; sweep < 12; sweep += 1) {
    const seed = 38000 + sweep * 37;
    const boardY = 118 + random(seed) * (BOARD_HEIGHT - 236);
    const from = projectPoint({ x: 96 + random(seed + 3) * 80, y: boardY }, camera);
    const mid = projectPoint({ x: BOARD_WIDTH * (0.38 + random(seed + 7) * 0.22), y: boardY - 16 + random(seed + 11) * 32 }, camera);
    const to = projectPoint({ x: BOARD_WIDTH - 94 - random(seed + 13) * 86, y: boardY + random(seed + 17) * 20 - 10 }, camera);
    context.strokeStyle = `${highlight}${night ? 0.06 : rainy ? 0.09 : 0.13})`;
    context.lineWidth = 0.8 + random(seed + 23) * 0.7;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.quadraticCurveTo(mid.x, mid.y, to.x, to.y);
    context.stroke();
  }
  context.restore();

  context.restore();
}

function paintReferenceHeroSandRelief(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const highlight = night ? "rgba(248,246,202," : rainy ? "rgba(255,246,220," : "rgba(255,250,218,";
  const warmBody = night ? "rgba(189,154,92," : rainy ? "rgba(179,128,72," : "rgba(216,148,62,";
  const deepShadow = night ? "rgba(9,15,15," : rainy ? "rgba(77,57,35," : "rgba(110,68,26,";

  context.save();
  polygonPath(context, sand);
  context.clip();

  const heroMounds = [
    { x: 190, y: 130, rx: 185, ry: 42, angle: -0.2, seed: 24011, strength: 0.72 },
    { x: 420, y: 124, rx: 210, ry: 38, angle: 0.08, seed: 24079, strength: 0.52 },
    { x: 708, y: 184, rx: 235, ry: 46, angle: -0.16, seed: 24133, strength: 0.66 },
    { x: 315, y: 340, rx: 250, ry: 48, angle: 0.16, seed: 24203, strength: 0.58 },
    { x: 590, y: 420, rx: 260, ry: 54, angle: -0.05, seed: 24281, strength: 0.5 },
    { x: 888, y: 390, rx: 260, ry: 58, angle: 0.2, seed: 24337, strength: 0.62 },
    { x: 1040, y: 170, rx: 170, ry: 34, angle: 0.04, seed: 24419, strength: 0.42 },
  ];

  heroMounds.forEach((mound) => {
    const point = projectPoint({ x: mound.x, y: mound.y }, camera);
    const depth = getDepthScale({ x: mound.x, y: mound.y }, camera);
    const radiusX = mound.rx * camera.zoom * (0.88 + depth * 0.15);
    const radiusY = mound.ry * camera.zoom * camera.pitch * (0.86 + depth * 0.16);
    const rotation = mound.angle + (camera.yaw * Math.PI) / 920;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(rotation);

    context.save();
    context.globalCompositeOperation = "multiply";
    context.filter = "blur(5.5px)";
    context.fillStyle = `${deepShadow}${(night ? 0.18 : rainy ? 0.138 : 0.135) * mound.strength})`;
    context.beginPath();
    context.ellipse(radiusX * 0.16, radiusY * 0.56, radiusX * 1.02, radiusY * 1.46, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = "blur(2.2px)";
    context.fillStyle = `${highlight}${(night ? 0.095 : rainy ? 0.15 : 0.24) * mound.strength})`;
    context.beginPath();
    context.ellipse(-radiusX * 0.24, -radiusY * 0.52, radiusX * 0.82, radiusY * 0.74, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.globalCompositeOperation = "source-over";
    context.lineCap = "round";
    context.lineJoin = "round";
    for (let ridge = 0; ridge < 7; ridge += 1) {
      const seed = mound.seed + ridge * 31;
      const offset = (ridge - 3) * radiusY * 0.23 + random(seed) * radiusY * 0.08;
      const span = radiusX * (0.58 + random(seed + 5) * 0.2);
      context.globalCompositeOperation = "multiply";
      context.strokeStyle = `${deepShadow}${(night ? 0.16 : rainy ? 0.12 : 0.13) * mound.strength})`;
      context.lineWidth = 1.8 + random(seed + 7) * 1.5;
      context.beginPath();
      context.moveTo(-span, offset + 1.5);
      context.bezierCurveTo(-span * 0.35, offset - radiusY * 0.28, span * 0.24, offset + radiusY * 0.18, span, offset - radiusY * 0.14);
      context.stroke();

      context.globalCompositeOperation = "screen";
      context.strokeStyle = `${highlight}${(night ? 0.12 : rainy ? 0.18 : 0.32) * mound.strength})`;
      context.lineWidth = 0.8 + random(seed + 11) * 0.7;
      context.beginPath();
      context.moveTo(-span, offset - 0.8);
      context.bezierCurveTo(-span * 0.35, offset - radiusY * 0.36, span * 0.24, offset + radiusY * 0.06, span, offset - radiusY * 0.24);
      context.stroke();
    }
    context.restore();

    context.restore();
  });

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let rake = 0; rake < 34; rake += 1) {
    const seed = 25000 + rake * 47;
    const boardY = 82 + random(seed) * (BOARD_HEIGHT - 164);
    const from = projectPoint({ x: 92 + random(seed + 3) * 90, y: boardY }, camera);
    const mid = projectPoint({
      x: BOARD_WIDTH * (0.36 + random(seed + 7) * 0.24),
      y: boardY - 20 + random(seed + 11) * 44,
    }, camera);
    const to = projectPoint({
      x: BOARD_WIDTH - 92 - random(seed + 13) * 90,
      y: boardY + random(seed + 17) * 28 - 14,
    }, camera);
    const tone = 0.7 + random(seed + 19) * 0.5;

    context.globalCompositeOperation = "multiply";
    context.strokeStyle = `${deepShadow}${(night ? 0.105 : rainy ? 0.078 : 0.078) * tone})`;
    context.lineWidth = 1.8 + random(seed + 23) * 1.2;
    context.beginPath();
    context.moveTo(from.x + 1.6, from.y + 2.2);
    context.quadraticCurveTo(mid.x + 1.2, mid.y + 1.8, to.x + 1.4, to.y + 1.7);
    context.stroke();

    context.globalCompositeOperation = "screen";
    context.strokeStyle = `${highlight}${(night ? 0.072 : rainy ? 0.11 : 0.16) * tone})`;
    context.lineWidth = 0.65 + random(seed + 29) * 0.55;
    context.beginPath();
    context.moveTo(from.x - 1.1, from.y - 1);
    context.quadraticCurveTo(mid.x - 0.9, mid.y - 0.9, to.x - 0.9, to.y - 0.8);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let cluster = 0; cluster < 38; cluster += 1) {
    const seed = 27000 + cluster * 67;
    const boardX = 96 + random(seed) * (BOARD_WIDTH - 192);
    const boardY = 82 + random(seed + 5) * (BOARD_HEIGHT - 164);
    const point = projectPoint({ x: boardX, y: boardY }, camera);
    const count = 10 + Math.floor(random(seed + 9) * 16);
    for (let dot = 0; dot < count; dot += 1) {
      const dotSeed = seed + dot * 13;
      const dx = (random(dotSeed) - 0.5) * 34 * camera.zoom;
      const dy = (random(dotSeed + 3) - 0.5) * 14 * camera.zoom * camera.pitch;
      context.fillStyle = dot % 4 === 0
        ? `${highlight}${night ? 0.11 : rainy ? 0.16 : 0.23})`
        : dot % 3 === 0
          ? `${warmBody}${night ? 0.12 : rainy ? 0.14 : 0.17})`
          : `${deepShadow}${night ? 0.09 : rainy ? 0.076 : 0.08})`;
      context.beginPath();
      context.ellipse(
        point.x + dx,
        point.y + dy,
        0.6 + random(dotSeed + 7) * 1.45,
        0.36 + random(dotSeed + 11) * 0.72,
        random(dotSeed + 17) * Math.PI,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = "blur(2.6px)";
  const frontCompression = context.createLinearGradient(bounds.minX, bounds.maxY - height * 0.34, bounds.maxX, bounds.maxY);
  frontCompression.addColorStop(0, "rgba(255,255,255,0)");
  frontCompression.addColorStop(0.58, `${warmBody}${night ? 0.048 : rainy ? 0.054 : 0.06})`);
  frontCompression.addColorStop(1, `${deepShadow}${night ? 0.16 : rainy ? 0.125 : 0.12})`);
  context.fillStyle = frontCompression;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.restore();
}

function paintPremiumSandTactileDepth(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const highlight = night ? "rgba(248,241,190," : rainy ? "rgba(255,246,211," : "rgba(255,252,224,";
  const shadow = night ? "rgba(6,14,16," : rainy ? "rgba(76,58,36," : "rgba(116,72,30,";
  const ochre = night ? "rgba(156,129,84," : rainy ? "rgba(166,122,72," : "rgba(192,130,58,";

  context.save();
  polygonPath(context, sand);
  context.clip();

  const sculptedAreas = [
    { x: 210, y: 150, rx: 142, ry: 25, angle: -0.18, seed: 911, strength: 0.48 },
    { x: 385, y: 348, rx: 166, ry: 30, angle: 0.08, seed: 1247, strength: 0.46 },
    { x: 640, y: 182, rx: 152, ry: 27, angle: -0.1, seed: 1693, strength: 0.4 },
    { x: 820, y: 420, rx: 176, ry: 33, angle: 0.16, seed: 2017, strength: 0.44 },
    { x: 1020, y: 240, rx: 132, ry: 24, angle: -0.12, seed: 2441, strength: 0.34 },
  ];

  sculptedAreas.forEach((area) => {
    const point = projectPoint({ x: area.x, y: area.y }, camera);
    const depth = getDepthScale({ x: area.x, y: area.y }, camera);
    const radiusX = area.rx * camera.zoom * (0.9 + depth * 0.13);
    const radiusY = area.ry * camera.zoom * camera.pitch * (0.92 + depth * 0.12);
    const rotation = area.angle + (camera.yaw * Math.PI) / 1040;

    context.save();
    context.translate(point.x, point.y);
    context.rotate(rotation);

    context.save();
    context.globalCompositeOperation = "multiply";
    context.filter = "blur(5px)";
    const basinShadow = context.createRadialGradient(radiusX * 0.18, radiusY * 0.46, 4, radiusX * 0.12, radiusY * 0.36, radiusX * 1.08);
    basinShadow.addColorStop(0, `${shadow}${(night ? 0.07 : rainy ? 0.056 : 0.052) * area.strength})`);
    basinShadow.addColorStop(0.55, `${shadow}${(night ? 0.036 : rainy ? 0.03 : 0.028) * area.strength})`);
    basinShadow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = basinShadow;
    context.beginPath();
    context.ellipse(radiusX * 0.12, radiusY * 0.42, radiusX, radiusY * 1.35, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = "blur(2.2px)";
    const crestLight = context.createRadialGradient(-radiusX * 0.35, -radiusY * 0.78, 3, -radiusX * 0.22, -radiusY * 0.52, radiusX * 0.86);
    crestLight.addColorStop(0, `${highlight}${(night ? 0.065 : rainy ? 0.105 : 0.15) * area.strength})`);
    crestLight.addColorStop(0.58, `${highlight}${(night ? 0.026 : rainy ? 0.044 : 0.064) * area.strength})`);
    crestLight.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = crestLight;
    context.beginPath();
    context.ellipse(-radiusX * 0.18, -radiusY * 0.55, radiusX * 0.82, radiusY * 0.9, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.restore();
  });

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  const rakeZones = [
    { x: 212, y: 268, width: 250, lines: 10, spacing: 8.5, curve: -20, angle: -0.08, seed: 3301, strength: 0.95 },
    { x: 556, y: 448, width: 280, lines: 8, spacing: 9, curve: 18, angle: 0.06, seed: 3587, strength: 0.8 },
    { x: 804, y: 176, width: 210, lines: 7, spacing: 8, curve: -14, angle: -0.12, seed: 3907, strength: 0.66 },
  ];

  rakeZones.forEach((zone) => {
    const tangentX = Math.cos(zone.angle);
    const tangentY = Math.sin(zone.angle);
    const normalX = -tangentY;
    const normalY = tangentX;

    for (let line = 0; line < zone.lines; line += 1) {
      const offset = (line - (zone.lines - 1) / 2) * zone.spacing;
      const jitter = random(zone.seed + line * 41) * 3 - 1.5;
      const from = {
        x: zone.x - tangentX * zone.width * 0.5 + normalX * (offset + jitter),
        y: zone.y - tangentY * zone.width * 0.5 + normalY * (offset + jitter),
      };
      const mid = {
        x: zone.x + normalX * (offset * 0.72) - tangentY * zone.curve,
        y: zone.y + normalY * (offset * 0.72) + tangentX * zone.curve,
      };
      const to = {
        x: zone.x + tangentX * zone.width * 0.5 + normalX * (offset - jitter),
        y: zone.y + tangentY * zone.width * 0.5 + normalY * (offset - jitter),
      };
      const start = projectPoint(from, camera);
      const middle = projectPoint(mid, camera);
      const end = projectPoint(to, camera);

      context.save();
      context.globalCompositeOperation = "multiply";
      context.strokeStyle = `${shadow}${(night ? 0.092 : rainy ? 0.078 : 0.07) * zone.strength})`;
      context.lineWidth = 2.8;
      context.beginPath();
      context.moveTo(start.x + 1.4, start.y + 2.2);
      context.quadraticCurveTo(middle.x + 1.1, middle.y + 1.8, end.x + 1.2, end.y + 1.6);
      context.stroke();

      context.globalCompositeOperation = "screen";
      context.strokeStyle = `${highlight}${(night ? 0.092 : rainy ? 0.142 : 0.21) * zone.strength})`;
      context.lineWidth = 1.05;
      context.beginPath();
      context.moveTo(start.x - 1.1, start.y - 1.1);
      context.quadraticCurveTo(middle.x - 0.9, middle.y - 0.9, end.x - 0.8, end.y - 0.7);
      context.stroke();
      context.restore();
    }
  });
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let grain = 0; grain < 980; grain += 1) {
    const seed = 14300 + grain * 43;
    const x = bounds.minX + random(seed) * width;
    const y = bounds.minY + random(seed + 5) * height;
    const depthT = (y - bounds.minY) / Math.max(1, height);
    const size = 0.65 + random(seed + 11) * (1.7 + depthT * 0.72);
    const raised = grain % 6 === 0;
    const muted = grain % 4 === 0;

    context.save();
    context.translate(x, y);
    context.rotate(-0.44 + random(seed + 17) * 0.88);
    if (raised) {
      context.shadowColor = night ? "rgba(198,255,234,0.18)" : "rgba(255,238,187,0.26)";
      context.shadowBlur = 2.4;
      context.shadowOffsetX = -0.45;
      context.shadowOffsetY = -0.55;
    }
    context.fillStyle = raised
      ? `${highlight}${night ? 0.15 : rainy ? 0.19 : 0.28})`
      : muted
        ? `${ochre}${night ? 0.09 : rainy ? 0.1 : 0.12})`
        : `${shadow}${night ? 0.07 : rainy ? 0.075 : 0.07})`;
    context.beginPath();
    context.ellipse(0, 0, size * (1.12 + random(seed + 19) * 0.9), size * (0.3 + random(seed + 23) * 0.34), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  context.strokeStyle = night ? "rgba(255,242,196,0.095)" : "rgba(255,252,224,0.23)";
  context.lineWidth = 1.2;
  context.setLineDash([1.2, 9]);
  for (let line = 0; line < 10; line += 1) {
    const seed = 17600 + line * 67;
    const y = bounds.minY + 40 + random(seed) * Math.max(1, height - 80);
    context.beginPath();
    context.moveTo(bounds.minX + 42, y);
    context.bezierCurveTo(
      bounds.minX + width * 0.32,
      y - 24 + random(seed + 3) * 48,
      bounds.minX + width * 0.68,
      y + 22 - random(seed + 7) * 44,
      bounds.maxX - 42,
      y + random(seed + 11) * 18 - 9,
    );
    context.stroke();
  }
  context.setLineDash([]);
  context.restore();

  context.restore();
}

function paintSandOrganicMicroBlend(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const warm = night ? "rgba(244,229,178," : rainy ? "rgba(238,216,168," : "rgba(255,231,168,";
  const pale = night ? "rgba(232,249,218," : rainy ? "rgba(255,248,221," : "rgba(255,252,224,";
  const low = night ? "rgba(8,19,22," : rainy ? "rgba(82,65,43," : "rgba(116,75,34,";

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  context.filter = "blur(1.2px)";
  for (let ribbon = 0; ribbon < 18; ribbon += 1) {
    const seed = 21100 + ribbon * 83;
    const y = bounds.minY + random(seed) * height;
    const amplitude = 8 + random(seed + 7) * 22;
    const lift = random(seed + 11) * 28 - 14;
    const alpha = night ? 0.032 : rainy ? 0.044 : 0.062;
    context.strokeStyle = ribbon % 3 === 0 ? `${pale}${alpha * 1.35})` : `${warm}${alpha})`;
    context.lineWidth = 1.1 + random(seed + 17) * 2.1;
    context.beginPath();
    context.moveTo(bounds.minX + 22, y + lift);
    context.bezierCurveTo(
      bounds.minX + width * 0.28,
      y - amplitude,
      bounds.minX + width * 0.62,
      y + amplitude * 0.9,
      bounds.maxX - 26,
      y + random(seed + 23) * 18 - 9,
    );
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = "blur(0.8px)";
  for (let hollow = 0; hollow < 18; hollow += 1) {
    const seed = 23200 + hollow * 97;
    const point = projectPoint(
      {
        x: 84 + random(seed) * (BOARD_WIDTH - 168),
        y: 74 + random(seed + 3) * (BOARD_HEIGHT - 148),
      },
      camera,
    );
    const rx = (14 + random(seed + 5) * 36) * camera.zoom;
    const ry = (2.6 + random(seed + 9) * 7) * camera.zoom * camera.pitch;
    context.save();
    context.translate(point.x, point.y);
    context.rotate(-0.28 + random(seed + 13) * 0.56 + (camera.yaw * Math.PI) / 1400);
    context.fillStyle = `${low}${night ? 0.028 : rainy ? 0.025 : 0.022})`;
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let grain = 0; grain < 1800; grain += 1) {
    const seed = 25100 + grain * 31;
    const x = bounds.minX + random(seed) * width;
    const y = bounds.minY + random(seed + 5) * height;
    const depthT = (y - bounds.minY) / Math.max(1, height);
    const size = 0.45 + random(seed + 9) * (1.25 + depthT * 0.54);
    const shade = grain % 6 === 0 ? pale : grain % 3 === 0 ? warm : low;
    const alpha = grain % 6 === 0 ? (night ? 0.09 : 0.15) : grain % 3 === 0 ? (night ? 0.052 : 0.07) : (night ? 0.042 : 0.045);
    context.save();
    context.translate(x, y);
    context.rotate(-0.55 + random(seed + 13) * 1.1);
    context.fillStyle = `${shade}${alpha})`;
    context.beginPath();
    context.ellipse(0, 0, size * (1.2 + random(seed + 17) * 1.4), size * (0.32 + random(seed + 21) * 0.42), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();

  context.restore();
}

function paintSandDirectionalSculptedRidges(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const ridgeSets = [
    { x: 170, y: 188, width: 190, lines: 9, angle: -0.22, seed: 421, strength: 0.8 },
    { x: 420, y: 386, width: 230, lines: 8, angle: 0.08, seed: 829, strength: 0.68 },
    { x: 760, y: 246, width: 210, lines: 7, angle: -0.12, seed: 1249, strength: 0.58 },
  ];
  const high = night ? "rgba(246,239,190," : rainy ? "rgba(255,246,211," : "rgba(255,250,218,";
  const low = night ? "rgba(15,21,20," : rainy ? "rgba(78,64,44," : "rgba(116,75,35,";

  context.save();
  polygonPath(context, sand);
  context.clip();
  context.lineCap = "round";

  ridgeSets.forEach((set) => {
    for (let line = 0; line < set.lines; line += 1) {
      const offset = (line - (set.lines - 1) / 2) * 8.5;
      const jitter = random(set.seed + line * 19) * 10 - 5;
      const start = projectPoint({ x: set.x - set.width * 0.5, y: set.y + offset + jitter }, camera);
      const middle = projectPoint({
        x: set.x,
        y: set.y + offset + random(set.seed + line * 23) * 22 - 11,
      }, camera);
      const end = projectPoint({
        x: set.x + set.width * 0.5,
        y: set.y + offset + random(set.seed + line * 29) * 14 - 7,
      }, camera);

      context.save();
      context.globalCompositeOperation = "multiply";
      context.strokeStyle = `${low}${(night ? 0.1 : rainy ? 0.085 : 0.075) * set.strength})`;
      context.lineWidth = 3.4;
      context.beginPath();
      context.moveTo(start.x + 1.8, start.y + 2.2);
      context.quadraticCurveTo(middle.x + 1.2, middle.y + 1.8, end.x + 1.4, end.y + 1.5);
      context.stroke();

      context.globalCompositeOperation = "screen";
      context.strokeStyle = `${high}${(night ? 0.12 : rainy ? 0.18 : 0.24) * set.strength})`;
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(start.x - 1.2, start.y - 1.2);
      context.quadraticCurveTo(middle.x - 1, middle.y - 1.1, end.x - 0.9, end.y - 0.8);
      context.stroke();
      context.restore();
    }
  });

  context.restore();
}

function paintRakedSandGardenMarks(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const paths = [
    { from: { x: 142, y: 232 }, mid: { x: 278, y: 192 }, to: { x: 438, y: 228 }, lines: 9, spacing: 9, seed: 4703, strength: 0.95 },
    { from: { x: 498, y: 422 }, mid: { x: 646, y: 360 }, to: { x: 814, y: 418 }, lines: 8, spacing: 9.5, seed: 4889, strength: 0.84 },
    { from: { x: 650, y: 152 }, mid: { x: 790, y: 126 }, to: { x: 910, y: 174 }, lines: 6, spacing: 8.5, seed: 5003, strength: 0.68 },
  ];
  const shadow = night ? "rgba(20,21,18," : rainy ? "rgba(74,62,45," : "rgba(103,67,31,";
  const shine = night ? "rgba(255,242,195," : rainy ? "rgba(255,248,216," : "rgba(255,252,229,";

  context.save();
  polygonPath(context, sand);
  context.clip();
  context.lineCap = "round";

  paths.forEach((path) => {
    const tangentX = path.to.x - path.from.x;
    const tangentY = path.to.y - path.from.y;
    const tangentLength = Math.max(1, Math.hypot(tangentX, tangentY));
    const normalX = -tangentY / tangentLength;
    const normalY = tangentX / tangentLength;

    for (let line = 0; line < path.lines; line += 1) {
      const offset = (line - (path.lines - 1) / 2) * path.spacing;
      const jitter = random(path.seed + line * 37) * 3 - 1.5;
      const start = projectPoint({ x: path.from.x + normalX * (offset + jitter), y: path.from.y + normalY * (offset + jitter) }, camera);
      const middle = projectPoint({
        x: path.mid.x + normalX * (offset + random(path.seed + line * 41) * 5 - 2.5),
        y: path.mid.y + normalY * (offset + random(path.seed + line * 43) * 5 - 2.5),
      }, camera);
      const end = projectPoint({ x: path.to.x + normalX * (offset - jitter), y: path.to.y + normalY * (offset - jitter) }, camera);
      const alpha = (night ? 0.09 : rainy ? 0.105 : 0.13) * path.strength;

      context.save();
      context.globalCompositeOperation = "multiply";
      context.strokeStyle = `${shadow}${alpha})`;
      context.lineWidth = 3.2;
      context.beginPath();
      context.moveTo(start.x + 1.6, start.y + 2.2);
      context.quadraticCurveTo(middle.x + 1.2, middle.y + 1.8, end.x + 1.2, end.y + 1.7);
      context.stroke();

      context.globalCompositeOperation = "screen";
      context.strokeStyle = `${shine}${(night ? 0.11 : rainy ? 0.16 : 0.24) * path.strength})`;
      context.lineWidth = 1.35;
      context.beginPath();
      context.moveTo(start.x - 1, start.y - 1);
      context.quadraticCurveTo(middle.x - 0.8, middle.y - 0.9, end.x - 0.8, end.y - 0.7);
      context.stroke();
      context.restore();
    }
  });

  context.restore();
}

function paintPremiumSandGranularClusters(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const clusters = [
    { x: 152, y: 128, radius: 42, seed: 701, intensity: 0.78 },
    { x: 326, y: 426, radius: 54, seed: 929, intensity: 0.72 },
    { x: 488, y: 232, radius: 62, seed: 1103, intensity: 0.7 },
    { x: 706, y: 462, radius: 58, seed: 1543, intensity: 0.66 },
    { x: 884, y: 154, radius: 38, seed: 1913, intensity: 0.62 },
    { x: 998, y: 372, radius: 48, seed: 2371, intensity: 0.64 },
  ];
  const shadow = night ? "rgba(12,18,19," : rainy ? "rgba(63,50,35," : "rgba(111,72,32,";
  const mid = night ? "rgba(175,155,112," : rainy ? "rgba(180,145,92," : "rgba(209,157,77,";
  const light = night ? "rgba(246,238,188," : rainy ? "rgba(255,245,209," : "rgba(255,249,215,";
  const coolLight = night ? "rgba(181,255,242," : rainy ? "rgba(215,238,232," : "rgba(255,255,232,";

  context.save();
  polygonPath(context, sand);
  context.clip();

  clusters.forEach((cluster, clusterIndex) => {
    const anchor = projectPoint({ x: cluster.x, y: cluster.y }, camera);
    const radiusX = cluster.radius * (0.96 + random(cluster.seed + 1) * 0.34);
    const radiusY = cluster.radius * (0.22 + random(cluster.seed + 2) * 0.13);

    context.save();
    context.translate(anchor.x, anchor.y);
    context.rotate(-0.12 + random(cluster.seed + 3) * 0.24);
    context.filter = "blur(7px)";
    context.globalCompositeOperation = "multiply";
    context.fillStyle = `${shadow}${(night ? 0.08 : rainy ? 0.07 : 0.06) * cluster.intensity})`;
    context.beginPath();
    context.ellipse(radiusX * 0.12, radiusY * 0.42, radiusX * 1.25, radiusY * 1.45, 0, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "screen";
    context.fillStyle = `${coolLight}${(night ? 0.055 : rainy ? 0.075 : 0.09) * cluster.intensity})`;
    context.beginPath();
    context.ellipse(-radiusX * 0.18, -radiusY * 0.52, radiusX * 0.88, radiusY * 0.72, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    for (let grain = 0; grain < 56; grain += 1) {
      const seed = cluster.seed + grain * 31 + clusterIndex * 101;
      const angle = random(seed + 5) * Math.PI * 2;
      const distance = Math.sqrt(random(seed + 7)) * cluster.radius;
      const boardX = cluster.x + Math.cos(angle) * distance;
      const boardY = cluster.y + Math.sin(angle) * distance * (0.56 + random(seed + 9) * 0.18);
      const point = projectPoint({ x: boardX, y: boardY }, camera);
      const radius = 0.72 + random(seed + 13) * 2.1;
      const raised = grain % 5 === 0;
      const tint = raised ? light : grain % 3 === 0 ? mid : shadow;
      const alpha = raised
        ? night
          ? 0.11
          : rainy
            ? 0.13
            : 0.18
        : night
          ? 0.075
          : rainy
            ? 0.08
            : 0.09;

      context.save();
      context.translate(point.x, point.y);
      context.rotate(-0.28 + random(seed + 17) * 0.56);
      if (raised) {
        context.shadowColor = night ? "rgba(178,255,239,0.2)" : "rgba(255,242,193,0.28)";
        context.shadowBlur = 2.4;
        context.shadowOffsetX = -0.4;
        context.shadowOffsetY = -0.5;
      }
      context.fillStyle = `${tint}${alpha * cluster.intensity})`;
      context.beginPath();
      context.ellipse(0, 0, radius * (1.05 + random(seed + 19) * 1.15), radius * (0.34 + random(seed + 23) * 0.45), 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  });

  context.restore();
}

function paintSandEdgePile(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  context.save();
  polygonPath(context, sand);
  context.strokeStyle = night ? "rgba(255,236,190,0.11)" : "rgba(255,248,215,0.36)";
  context.lineWidth = 22;
  context.lineJoin = "round";
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.strokeStyle = night ? "rgba(28,22,16,0.18)" : "rgba(95,67,36,0.14)";
  context.lineWidth = 11;
  context.lineJoin = "round";
  context.stroke();
  context.restore();
}

function paintPremiumSandEdgeCrumble(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const center = sand.reduce(
    (sum, point) => ({ x: sum.x + point.x / sand.length, y: sum.y + point.y / sand.length }),
    { x: 0, y: 0 },
  );

  context.save();
  polygonPath(context, sand);
  context.clip();

  for (let edge = 0; edge < sand.length; edge += 1) {
    const start = sand[edge];
    const end = sand[(edge + 1) % sand.length];
    const edgeAngle = Math.atan2(end.y - start.y, end.x - start.x);
    for (let index = 0; index < 42; index += 1) {
      const seed = edge * 433 + index * 37 + 5;
      const t = 0.018 + random(seed) * 0.964;
      const baseX = start.x + (end.x - start.x) * t;
      const baseY = start.y + (end.y - start.y) * t;
      const inward = normalizeVector(center.x - baseX, center.y - baseY);
      const scatter = 3 + random(seed + 7) * 38;
      const tangent = (random(seed + 11) - 0.5) * 18;
      const tangentVector = normalizeVector(end.x - start.x, end.y - start.y);
      const x = baseX + inward.x * scatter + tangentVector.x * tangent;
      const y = baseY + inward.y * scatter + tangentVector.y * tangent;
      const size = 0.8 + random(seed + 13) * (index % 5 === 0 ? 4.4 : 2.6);
      const raised = index % 6 === 0;

      context.save();
      context.translate(x, y);
      context.rotate(edgeAngle + (random(seed + 17) - 0.5) * 0.42);
      context.shadowColor = raised
        ? night
          ? "rgba(232,245,207,0.13)"
          : "rgba(255,245,206,0.26)"
        : "transparent";
      context.shadowBlur = raised ? 3.2 : 0;
      context.shadowOffsetX = raised ? -0.5 : 0;
      context.shadowOffsetY = raised ? -0.6 : 0;
      context.fillStyle = raised
        ? night
          ? "rgba(225,211,158,0.15)"
          : rainy
            ? "rgba(255,236,190,0.22)"
            : "rgba(255,241,195,0.32)"
        : night
          ? "rgba(34,25,17,0.11)"
          : rainy
            ? "rgba(95,74,49,0.12)"
            : "rgba(124,78,35,0.12)";
      context.beginPath();
      context.ellipse(0, 0, size * (1.2 + random(seed + 19) * 1.25), size * (0.32 + random(seed + 23) * 0.28), 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  polygonPath(context, sand);
  context.strokeStyle = night ? "rgba(255,238,190,0.08)" : "rgba(255,247,209,0.26)";
  context.lineWidth = 5;
  context.lineJoin = "round";
  context.stroke();
  context.restore();

  context.restore();
}

function paintSandEdgeCompression(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const center = sand.reduce(
    (sum, point) => ({ x: sum.x + point.x / sand.length, y: sum.y + point.y / sand.length }),
    { x: 0, y: 0 },
  );

  context.save();
  polygonPath(context, sand);
  context.clip();

  [
    {
      width: 38,
      color: night ? "rgba(2,12,18,0.13)" : rainy ? "rgba(70,58,42,0.11)" : "rgba(91,61,29,0.09)",
      blur: "blur(3px)",
    },
    {
      width: 18,
      color: night ? "rgba(246,236,190,0.095)" : rainy ? "rgba(255,245,205,0.16)" : "rgba(255,247,204,0.25)",
      blur: "none",
    },
  ].forEach((band) => {
    context.save();
    context.filter = band.blur;
    polygonPath(context, sand);
    context.strokeStyle = band.color;
    context.lineWidth = band.width;
    context.lineJoin = "round";
    context.stroke();
    context.restore();
  });

  for (let edge = 0; edge < sand.length; edge += 1) {
    const start = sand[edge];
    const end = sand[(edge + 1) % sand.length];
    for (let index = 0; index < 30; index += 1) {
      const seed = edge * 379 + index * 29;
      const t = random(seed + 3);
      const baseX = start.x + (end.x - start.x) * t;
      const baseY = start.y + (end.y - start.y) * t;
      const inwardX = center.x - baseX;
      const inwardY = center.y - baseY;
      const length = Math.max(1, Math.hypot(inwardX, inwardY));
      const depth = 8 + random(seed + 7) * 30;
      const x = baseX + (inwardX / length) * depth + (random(seed + 11) - 0.5) * 8;
      const y = baseY + (inwardY / length) * depth + (random(seed + 13) - 0.5) * 5;
      const radius = 0.8 + random(seed + 17) * 2.2;
      context.fillStyle = index % 4 === 0
        ? night
          ? "rgba(242,236,190,0.12)"
          : "rgba(255,248,209,0.24)"
        : rainy
          ? "rgba(86,69,47,0.1)"
          : "rgba(121,78,35,0.1)";
      context.beginPath();
      context.ellipse(x, y, radius * (1.4 + random(seed + 19)), radius * 0.42, -0.22 + random(seed + 23) * 0.44, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.restore();
}

function paintSandFootprints(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const footprintDark = night ? "rgba(22,18,14,0.12)" : "rgba(91,65,39,0.13)";
  const footprintLight = night ? "rgba(255,238,188,0.08)" : "rgba(255,248,213,0.18)";

  context.save();
  polygonPath(context, sand);
  context.clip();
  for (let index = 0; index < 9; index += 1) {
    const boardX = 118 + random(index * 101 + 9) * (BOARD_WIDTH - 236);
    const boardY = 92 + random(index * 113 + 13) * (BOARD_HEIGHT - 184);
    const stepAngle = -0.55 + random(index * 17 + 3) * 1.1;
    for (let foot = 0; foot < 2; foot += 1) {
      const side = foot === 0 ? -1 : 1;
      const p = projectPoint({ x: boardX + side * 8, y: boardY + foot * 14 }, camera);
      context.save();
      context.translate(p.x, p.y);
      context.rotate(stepAngle);
      context.fillStyle = footprintDark;
      context.beginPath();
      context.ellipse(0, 0, 12 + random(index + foot) * 6, 3.8 + random(index + foot + 5) * 2.2, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = footprintLight;
      context.beginPath();
      context.ellipse(-2.5, -1.8, 9, 1.3, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
  context.restore();
}

function paintSandInsetAmbientOcclusion(
  context: CanvasRenderingContext2D,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);

  context.save();
  polygonPath(context, sand);
  context.clip();

  const innerShade = context.createRadialGradient(
    bounds.minX + (bounds.maxX - bounds.minX) * 0.5,
    bounds.minY + (bounds.maxY - bounds.minY) * 0.52,
    Math.max(120, (bounds.maxX - bounds.minX) * 0.28),
    bounds.minX + (bounds.maxX - bounds.minX) * 0.5,
    bounds.minY + (bounds.maxY - bounds.minY) * 0.5,
    Math.max(300, (bounds.maxX - bounds.minX) * 0.74),
  );
  innerShade.addColorStop(0, "rgba(255,255,255,0)");
  innerShade.addColorStop(0.64, night ? "rgba(2,9,13,0.04)" : "rgba(83,52,22,0.035)");
  innerShade.addColorStop(1, night ? "rgba(0,5,9,0.18)" : rainy ? "rgba(65,50,32,0.12)" : "rgba(88,55,23,0.11)");
  context.globalCompositeOperation = "multiply";
  context.fillStyle = innerShade;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  [
    { width: 30, alpha: night ? 0.12 : rainy ? 0.12 : 0.105, blur: 4 },
    { width: 10, alpha: night ? 0.18 : rainy ? 0.16 : 0.14, blur: 1.4 },
  ].forEach((ring) => {
    context.save();
    context.filter = `blur(${ring.blur}px)`;
    polygonPath(context, sand);
    context.strokeStyle = night ? `rgba(0,8,12,${ring.alpha})` : `rgba(77,49,22,${ring.alpha})`;
    context.lineWidth = ring.width;
    context.lineJoin = "round";
    context.stroke();
    context.restore();
  });

  context.restore();
}

function paintInnerWallShade(
  context: CanvasRenderingContext2D,
  linerInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const linerBounds = getPointBounds(linerInner);
  const sandBounds = getPointBounds(sand);

  context.save();
  ringPath(context, linerInner, sand);
  const shade = context.createLinearGradient(linerBounds.minX, linerBounds.minY, linerBounds.maxX, linerBounds.maxY);
  shade.addColorStop(0, night ? "rgba(118,216,230,0.15)" : "rgba(255,255,255,0.28)");
  shade.addColorStop(0.52, night ? "rgba(0,22,34,0.08)" : "rgba(72,126,141,0.08)");
  shade.addColorStop(1, night ? "rgba(0,10,18,0.24)" : "rgba(59,34,14,0.12)");
  context.fillStyle = shade;
  context.fill("evenodd");
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.strokeStyle = night ? "rgba(0,10,16,0.34)" : "rgba(96,66,30,0.22)";
  context.lineWidth = 9;
  context.shadowColor = night ? "rgba(0,0,0,0.22)" : "rgba(95,64,30,0.14)";
  context.shadowBlur = 8;
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.strokeStyle = night ? "rgba(221,255,247,0.16)" : "rgba(255,248,214,0.4)";
  context.lineWidth = 2;
  context.stroke();
  context.restore();

  if (sandBounds.maxX > sandBounds.minX) {
    context.save();
    polygonPath(context, sand);
    context.clip();
    const innerGlow = context.createRadialGradient(
      sandBounds.minX + (sandBounds.maxX - sandBounds.minX) * 0.23,
      sandBounds.minY + (sandBounds.maxY - sandBounds.minY) * 0.18,
      20,
      sandBounds.minX + (sandBounds.maxX - sandBounds.minX) * 0.23,
      sandBounds.minY + (sandBounds.maxY - sandBounds.minY) * 0.18,
      Math.max(260, (sandBounds.maxX - sandBounds.minX) * 0.48),
    );
    innerGlow.addColorStop(0, night ? "rgba(181,250,236,0.09)" : "rgba(255,255,220,0.24)");
    innerGlow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = innerGlow;
    context.fillRect(sandBounds.minX, sandBounds.minY, sandBounds.maxX - sandBounds.minX, sandBounds.maxY - sandBounds.minY);
    context.restore();
  }
}

function paintPremiumWoodBevel(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  context.save();
  polygonPath(context, outer);
  context.strokeStyle = night ? "rgba(255,225,164,0.2)" : "rgba(255,248,210,0.72)";
  context.lineWidth = 3.4;
  context.lineJoin = "round";
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, inner);
  context.strokeStyle = night ? "rgba(16,7,3,0.42)" : "rgba(80,45,18,0.46)";
  context.lineWidth = 5.2;
  context.lineJoin = "round";
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, inner);
  context.strokeStyle = night ? "rgba(255,240,178,0.13)" : "rgba(255,226,154,0.32)";
  context.lineWidth = 1.4;
  context.lineJoin = "round";
  context.stroke();
  context.restore();
}

function paintReferenceWoodFrameFinish(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const bounds = getPointBounds(outer);
  const center = outer.reduce(
    (sum, point) => ({ x: sum.x + point.x / outer.length, y: sum.y + point.y / outer.length }),
    { x: 0, y: 0 },
  );

  context.save();
  ringPath(context, outer, inner);
  context.clip("evenodd");

  context.save();
  context.globalCompositeOperation = "screen";
  const topGlow = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  topGlow.addColorStop(0, night ? "rgba(255,224,165,0.12)" : "rgba(255,238,188,0.46)");
  topGlow.addColorStop(0.36, night ? "rgba(213,152,82,0.05)" : "rgba(255,210,139,0.22)");
  topGlow.addColorStop(0.74, "rgba(255,255,255,0)");
  topGlow.addColorStop(1, night ? "rgba(0,0,0,0)" : "rgba(255,219,160,0.08)");
  context.fillStyle = topGlow;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const depthShade = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  depthShade.addColorStop(0, "rgba(255,255,255,0)");
  depthShade.addColorStop(0.56, night ? "rgba(16,8,3,0.08)" : "rgba(72,34,10,0.06)");
  depthShade.addColorStop(1, night ? "rgba(0,0,0,0.18)" : "rgba(66,31,8,0.14)");
  context.fillStyle = depthShade;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  context.restore();

  outer.forEach((point, index) => {
    const next = outer[(index + 1) % outer.length];
    const innerPoint = inner[index];
    const nextInner = inner[(index + 1) % inner.length];
    const inward = normalizeVector(center.x - point.x, center.y - point.y);
    const edgeLength = Math.hypot(next.x - point.x, next.y - point.y);
    const edgeAngle = Math.atan2(next.y - point.y, next.x - point.x);
    const marks = Math.max(8, Math.floor(edgeLength / 80));

    for (let mark = 0; mark < marks; mark += 1) {
      const seed = index * 991 + mark * 73;
      const t = 0.08 + (mark / Math.max(1, marks - 1)) * 0.84 + (random(seed) - 0.5) * 0.035;
      const x = point.x + (next.x - point.x) * t + inward.x * (12 + random(seed + 3) * 24);
      const y = point.y + (next.y - point.y) * t + inward.y * (12 + random(seed + 5) * 24);
      const length = 26 + random(seed + 7) * 74;

      context.save();
      context.translate(x, y);
      context.rotate(edgeAngle + (random(seed + 11) - 0.5) * 0.12);
      context.strokeStyle = mark % 2 === 0
        ? night
          ? "rgba(255,220,157,0.11)"
          : "rgba(255,235,178,0.34)"
        : night
          ? "rgba(14,7,3,0.14)"
          : "rgba(93,44,13,0.18)";
      context.lineWidth = 0.9 + random(seed + 13) * 1.3;
      context.beginPath();
      context.moveTo(-length * 0.5, 0);
      context.bezierCurveTo(-length * 0.16, -2 + random(seed + 17) * 4, length * 0.18, 2 - random(seed + 19) * 4, length * 0.5, 0);
      context.stroke();
      context.restore();
    }

    context.save();
    context.globalCompositeOperation = index < 2 ? "screen" : "multiply";
    context.strokeStyle = index < 2
      ? night
        ? "rgba(255,224,160,0.14)"
        : "rgba(255,242,194,0.42)"
      : night
        ? "rgba(0,0,0,0.2)"
        : "rgba(76,35,9,0.2)";
    context.lineWidth = index < 2 ? 2.2 : 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(point.x + inward.x * 4, point.y + inward.y * 4);
    context.lineTo(next.x + inward.x * 4, next.y + inward.y * 4);
    context.stroke();
    context.restore();

    context.save();
    context.globalCompositeOperation = "multiply";
    context.strokeStyle = night ? "rgba(0,0,0,0.22)" : "rgba(59,28,8,0.18)";
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(innerPoint.x - inward.x * 2, innerPoint.y - inward.y * 2);
    context.lineTo(nextInner.x - inward.x * 2, nextInner.y - inward.y * 2);
    context.stroke();
    context.restore();
  });

  context.restore();
}

function paintWoodSpecularEdges(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const lit = night ? "rgba(255,229,166,0.22)" : "rgba(255,249,216,0.72)";
  const hot = night ? "rgba(177,250,230,0.13)" : "rgba(255,255,240,0.58)";
  const shade = night ? "rgba(7,9,10,0.38)" : "rgba(71,39,16,0.32)";

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalCompositeOperation = "screen";
  context.shadowColor = hot;
  context.shadowBlur = night ? 6 : 9;
  context.strokeStyle = lit;
  context.lineWidth = 2.8;
  drawOpenPolyline(context, [outer[0], outer[1]]);
  context.stroke();
  context.lineWidth = 1.5;
  drawOpenPolyline(context, [inner[0], inner[1]]);
  context.stroke();
  context.restore();

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalCompositeOperation = "multiply";
  context.strokeStyle = shade;
  context.lineWidth = 4.4;
  drawOpenPolyline(context, [outer[2], outer[3]]);
  context.stroke();
  context.lineWidth = 2.3;
  drawOpenPolyline(context, [inner[2], inner[3]]);
  context.stroke();
  context.restore();

  context.save();
  ringPath(context, outer, inner);
  context.clip("evenodd");
  for (let mark = 0; mark < 20; mark += 1) {
    const edgeIndex = mark % 4;
    const start = outer[edgeIndex];
    const end = outer[(edgeIndex + 1) % outer.length];
    const t = 0.08 + random(mark * 53 + 11) * 0.84;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    context.save();
    context.translate(x, y);
    context.rotate(Math.atan2(end.y - start.y, end.x - start.x));
    context.strokeStyle = mark % 3 === 0
      ? night
        ? "rgba(255,235,174,0.14)"
        : "rgba(255,241,190,0.28)"
      : night
        ? "rgba(18,8,3,0.18)"
        : "rgba(78,39,14,0.2)";
    context.lineWidth = 0.8 + random(mark + 7) * 1.4;
    context.beginPath();
    context.moveTo(-9 - random(mark + 13) * 8, 0);
    context.quadraticCurveTo(0, -2 + random(mark + 17) * 4, 12 + random(mark + 19) * 10, 0.5);
    context.stroke();
    context.restore();
  }
  context.restore();
}

function paintWoodStudioFinish(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const bounds = getPointBounds(outer);
  const center = outer.reduce(
    (sum, point) => ({ x: sum.x + point.x / outer.length, y: sum.y + point.y / outer.length }),
    { x: 0, y: 0 },
  );

  context.save();
  ringPath(context, outer, inner);
  context.clip("evenodd");

  context.save();
  context.globalCompositeOperation = "screen";
  const longHighlight = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.minY + 42);
  longHighlight.addColorStop(0, night ? "rgba(255,224,162,0.18)" : "rgba(255,251,218,0.46)");
  longHighlight.addColorStop(0.26, night ? "rgba(255,224,162,0.08)" : "rgba(255,246,199,0.22)");
  longHighlight.addColorStop(0.72, "rgba(255,255,255,0)");
  longHighlight.addColorStop(1, night ? "rgba(126,74,35,0.1)" : "rgba(111,65,28,0.08)");
  context.fillStyle = longHighlight;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, Math.max(80, (bounds.maxY - bounds.minY) * 0.45));
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const lowerShade = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  lowerShade.addColorStop(0, "rgba(255,255,255,0)");
  lowerShade.addColorStop(0.56, "rgba(255,255,255,0)");
  lowerShade.addColorStop(1, night ? "rgba(0,8,12,0.22)" : "rgba(75,38,13,0.18)");
  context.fillStyle = lowerShade;
  context.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  context.restore();

  for (let streak = 0; streak < 34; streak += 1) {
    const edge = streak % outer.length;
    const start = outer[edge];
    const end = outer[(edge + 1) % outer.length];
    const toCenter = normalizeVector(center.x - start.x, center.y - start.y);
    const t = 0.06 + random(streak * 61 + 5) * 0.88;
    const x = start.x + (end.x - start.x) * t + toCenter.x * (14 + random(streak * 67 + 7) * 30);
    const y = start.y + (end.y - start.y) * t + toCenter.y * (10 + random(streak * 71 + 11) * 22);

    context.save();
    context.translate(x, y);
    context.rotate(Math.atan2(end.y - start.y, end.x - start.x) + (random(streak * 73 + 13) - 0.5) * 0.16);
    context.strokeStyle = streak % 4 === 0
      ? night
        ? "rgba(255,229,169,0.13)"
        : "rgba(255,243,192,0.32)"
      : night
        ? "rgba(18,10,5,0.16)"
        : "rgba(84,43,16,0.2)";
    context.lineWidth = 0.75 + random(streak * 79 + 17) * 1.35;
    context.beginPath();
    context.moveTo(-16 - random(streak * 83 + 19) * 18, 0);
    context.bezierCurveTo(-6, -2, 8, 2, 18 + random(streak * 89 + 23) * 20, 0.3);
    context.stroke();
    context.restore();
  }

  for (let knot = 0; knot < 12; knot += 1) {
    const edge = knot % outer.length;
    const start = outer[edge];
    const end = outer[(edge + 1) % outer.length];
    const toCenter = normalizeVector(center.x - start.x, center.y - start.y);
    const t = 0.14 + random(knot * 97 + 31) * 0.72;
    const x = start.x + (end.x - start.x) * t + toCenter.x * (18 + random(knot * 101 + 37) * 38);
    const y = start.y + (end.y - start.y) * t + toCenter.y * (10 + random(knot * 103 + 41) * 28);

    context.save();
    context.translate(x, y);
    context.rotate(Math.atan2(end.y - start.y, end.x - start.x) + random(knot * 107 + 43) * 0.34 - 0.17);
    context.strokeStyle = night ? "rgba(20,10,4,0.18)" : "rgba(76,37,12,0.24)";
    context.lineWidth = 1;
    for (let ring = 0; ring < 3; ring += 1) {
      context.beginPath();
      context.ellipse(0, 0, 5 + ring * 4 + random(knot * 109 + ring) * 4, 2.2 + ring * 1.7, 0, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  context.restore();

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalCompositeOperation = "screen";
  context.shadowColor = night ? "rgba(132,240,220,0.18)" : "rgba(255,241,190,0.44)";
  context.shadowBlur = night ? 7 : 10;
  context.strokeStyle = night ? "rgba(255,231,170,0.18)" : "rgba(255,250,219,0.58)";
  context.lineWidth = night ? 1.8 : 2.4;
  drawOpenPolyline(context, [outer[0], outer[1]]);
  context.stroke();
  context.restore();
}

function paintPremiumWoodEdgeDepth(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  const center = outer.reduce(
    (sum, point) => ({ x: sum.x + point.x / outer.length, y: sum.y + point.y / outer.length }),
    { x: 0, y: 0 },
  );
  const outerHighlight = night ? "rgba(255,231,174,0.2)" : "rgba(255,248,214,0.68)";
  const innerShadow = night ? "rgba(0,10,15,0.44)" : "rgba(68,38,14,0.38)";
  const grainDark = night ? "rgba(26,13,6,0.24)" : "rgba(79,38,12,0.24)";
  const grainLight = night ? "rgba(255,222,157,0.15)" : "rgba(255,232,174,0.3)";

  context.save();
  ringPath(context, outer, inner);
  context.clip("evenodd");
  context.lineCap = "round";
  context.lineJoin = "round";

  outer.forEach((start, edge) => {
    const end = outer[(edge + 1) % outer.length];
    const inward = normalizeVector(center.x - start.x, center.y - start.y);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const edgeLength = Math.hypot(end.x - start.x, end.y - start.y);

    context.save();
    context.globalCompositeOperation = "screen";
    context.strokeStyle = edge === 3 ? (night ? "rgba(255,227,164,0.12)" : "rgba(255,245,199,0.36)") : outerHighlight;
    context.lineWidth = edge === 2 ? 2.2 : 1.55;
    context.beginPath();
    context.moveTo(start.x + inward.x * 4, start.y + inward.y * 4);
    context.lineTo(end.x + inward.x * 4, end.y + inward.y * 4);
    context.stroke();
    context.restore();

    context.save();
    context.globalCompositeOperation = "multiply";
    context.strokeStyle = edge === 0 ? (night ? "rgba(0,6,10,0.16)" : "rgba(72,38,13,0.16)") : innerShadow;
    context.lineWidth = edge === 2 ? 5.2 : 3.5;
    context.beginPath();
    context.moveTo(start.x + inward.x * 23, start.y + inward.y * 23);
    context.lineTo(end.x + inward.x * 23, end.y + inward.y * 23);
    context.stroke();
    context.restore();

    const streaks = edge === 2 ? 14 : 8;
    for (let streak = 0; streak < streaks; streak += 1) {
      const seed = edge * 1009 + streak * 61 + 23;
      const t = 0.08 + random(seed) * 0.84;
      const baseX = start.x + (end.x - start.x) * t;
      const baseY = start.y + (end.y - start.y) * t;
      const depth = 10 + random(seed + 7) * (edge === 2 ? 42 : 28);
      const length = Math.min(edgeLength * 0.12, 34 + random(seed + 11) * 56);

      context.save();
      context.translate(baseX + inward.x * depth, baseY + inward.y * depth);
      context.rotate(angle + (random(seed + 13) - 0.5) * 0.08);
      context.globalCompositeOperation = streak % 4 === 0 ? "screen" : "multiply";
      context.strokeStyle = streak % 4 === 0 ? grainLight : grainDark;
      context.lineWidth = streak % 4 === 0 ? 0.9 : 1.15;
      context.beginPath();
      context.moveTo(-length * 0.5, 0);
      context.bezierCurveTo(-length * 0.2, -1.6 + random(seed + 17) * 3.2, length * 0.22, 1.2 - random(seed + 19) * 2.4, length * 0.5, 0.2);
      context.stroke();
      context.restore();
    }
  });

  inner.forEach((start, edge) => {
    const end = inner[(edge + 1) % inner.length];
    const inward = normalizeVector(center.x - start.x, center.y - start.y);
    context.save();
    context.globalCompositeOperation = "multiply";
    context.strokeStyle = night ? "rgba(0,10,15,0.38)" : "rgba(57,33,12,0.32)";
    context.lineWidth = edge === 2 ? 6.5 : 4.2;
    context.beginPath();
    context.moveTo(start.x - inward.x * 2, start.y - inward.y * 2);
    context.lineTo(end.x - inward.x * 2, end.y - inward.y * 2);
    context.stroke();
    context.restore();

    context.save();
    context.globalCompositeOperation = "screen";
    context.strokeStyle = night ? "rgba(176,255,239,0.1)" : "rgba(255,247,211,0.34)";
    context.lineWidth = 1.35;
    context.beginPath();
    context.moveTo(start.x + inward.x * 3, start.y + inward.y * 3);
    context.lineTo(end.x + inward.x * 3, end.y + inward.y * 3);
    context.stroke();
    context.restore();
  });

  context.restore();
}

function paintTrayBevels(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  rimInner: Array<{ x: number; y: number }>,
  linerInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
  environment: SandboxEnvironment,
): void {
  const night = environment.light === "night";
  [
    { points: outer, color: night ? "rgba(244,223,161,0.18)" : "rgba(255,243,199,0.75)", width: 2.4 },
    { points: rimInner, color: night ? "rgba(0,12,18,0.38)" : "rgba(82,48,22,0.44)", width: 2.8 },
    { points: linerInner, color: night ? "rgba(127,233,255,0.24)" : "rgba(231,255,255,0.58)", width: 2.1 },
    { points: sand, color: night ? "rgba(26,20,13,0.2)" : "rgba(123,83,39,0.2)", width: 1.5 },
  ].forEach((line) => {
    context.save();
    polygonPath(context, line.points);
    context.strokeStyle = line.color;
    context.lineWidth = line.width;
    context.stroke();
    context.restore();
  });
}

function paintStageGlaze(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  sand: Array<{ x: number; y: number }>,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const bounds = getPointBounds(sand);
  context.save();
  polygonPath(context, sand);
  context.clip();
  drawSoftEllipse(context, bounds.minX + (bounds.maxX - bounds.minX) * 0.18, bounds.minY + 54, 220, 48, night ? "rgba(125,213,220,0.08)" : "rgba(255,255,234,0.2)");
  drawSoftEllipse(context, bounds.minX + (bounds.maxX - bounds.minX) * 0.78, bounds.minY + 88, 260, 58, night ? "rgba(80,151,178,0.08)" : rainy ? "rgba(183,214,214,0.16)" : "rgba(255,243,194,0.16)");
  context.restore();
}

function paintCinematicStageFocus(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  outer: Array<{ x: number; y: number }>,
  rimInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const trayBounds = getPointBounds(outer);
  const sandBounds = getPointBounds(sand);
  const trayWidth = trayBounds.maxX - trayBounds.minX;
  const trayHeight = trayBounds.maxY - trayBounds.minY;

  context.save();
  const vignette = context.createRadialGradient(
    VIEW_WIDTH * 0.48,
    VIEW_HEIGHT * 0.48,
    VIEW_WIDTH * 0.16,
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.5,
    VIEW_WIDTH * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(0.58, "rgba(0,0,0,0)");
  vignette.addColorStop(1, night ? "rgba(0,8,14,0.32)" : "rgba(87,61,26,0.16)");
  context.globalCompositeOperation = "multiply";
  context.fillStyle = vignette;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();

  context.save();
  polygonPath(context, outer);
  context.clip();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  drawSoftEllipse(
    context,
    trayBounds.minX + trayWidth * 0.22,
    trayBounds.minY + trayHeight * 0.2,
    trayWidth * 0.22,
    trayHeight * 0.12,
    night ? "rgba(111,190,214,0.12)" : rainy ? "rgba(217,237,228,0.18)" : "rgba(255,248,211,0.34)",
  );
  drawSoftEllipse(
    context,
    trayBounds.minX + trayWidth * 0.78,
    trayBounds.minY + trayHeight * 0.54,
    trayWidth * 0.24,
    trayHeight * 0.14,
    night ? "rgba(80,151,178,0.12)" : "rgba(255,255,242,0.2)",
  );
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  const sweep = context.createLinearGradient(sandBounds.minX, sandBounds.minY, sandBounds.maxX, sandBounds.maxY);
  sweep.addColorStop(0, night ? "rgba(133,215,225,0.08)" : "rgba(255,255,232,0.2)");
  sweep.addColorStop(0.48, "rgba(255,255,255,0)");
  sweep.addColorStop(1, night ? "rgba(21,73,94,0.1)" : "rgba(138,88,38,0.12)");
  context.fillStyle = sweep;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();

  context.save();
  polygonPath(context, rimInner);
  context.globalCompositeOperation = "screen";
  context.strokeStyle = night ? "rgba(131,224,229,0.2)" : "rgba(255,250,220,0.42)";
  context.lineWidth = 2.5;
  context.stroke();
  polygonPath(context, outer);
  context.strokeStyle = night ? "rgba(151,223,221,0.12)" : "rgba(255,255,244,0.36)";
  context.lineWidth = 1.25;
  context.stroke();
  context.restore();
}

function paintTrayCrispMaterialEdges(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  outer: Array<{ x: number; y: number }>,
  rimInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
): void {
  const night = environment.light === "night";
  const rimBounds = getPointBounds(outer);
  const sandBounds = getPointBounds(sand);

  context.save();
  ringPath(context, outer, rimInner);
  context.clip("evenodd");
  context.globalCompositeOperation = "screen";
  const rimLight = context.createLinearGradient(rimBounds.minX, rimBounds.minY, rimBounds.maxX, rimBounds.minY);
  rimLight.addColorStop(0, night ? "rgba(255,232,174,0.16)" : "rgba(255,249,211,0.48)");
  rimLight.addColorStop(0.28, night ? "rgba(255,232,174,0.05)" : "rgba(255,249,211,0.12)");
  rimLight.addColorStop(0.68, "rgba(255,255,255,0)");
  rimLight.addColorStop(1, night ? "rgba(118,77,39,0.1)" : "rgba(125,74,31,0.12)");
  context.fillStyle = rimLight;
  context.fillRect(rimBounds.minX, rimBounds.minY, rimBounds.maxX - rimBounds.minX, rimBounds.maxY - rimBounds.minY);
  context.restore();

  context.save();
  polygonPath(context, outer);
  context.lineJoin = "round";
  context.strokeStyle = night ? "rgba(255,231,170,0.12)" : "rgba(255,246,204,0.42)";
  context.lineWidth = 2.8;
  context.stroke();
  polygonPath(context, rimInner);
  context.strokeStyle = night ? "rgba(7,16,20,0.34)" : "rgba(81,47,18,0.24)";
  context.lineWidth = 3.2;
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();
  const innerShade = context.createRadialGradient(
    sandBounds.minX + (sandBounds.maxX - sandBounds.minX) * 0.5,
    sandBounds.minY + (sandBounds.maxY - sandBounds.minY) * 0.48,
    Math.min(sandBounds.maxX - sandBounds.minX, sandBounds.maxY - sandBounds.minY) * 0.2,
    sandBounds.minX + (sandBounds.maxX - sandBounds.minX) * 0.5,
    sandBounds.minY + (sandBounds.maxY - sandBounds.minY) * 0.48,
    Math.max(sandBounds.maxX - sandBounds.minX, sandBounds.maxY - sandBounds.minY) * 0.72,
  );
  innerShade.addColorStop(0, "rgba(255,255,255,0)");
  innerShade.addColorStop(0.68, "rgba(255,255,255,0)");
  innerShade.addColorStop(1, night ? "rgba(12,16,13,0.2)" : "rgba(91,61,27,0.16)");
  context.globalCompositeOperation = "multiply";
  context.fillStyle = innerShade;
  context.fillRect(sandBounds.minX, sandBounds.minY, sandBounds.maxX - sandBounds.minX, sandBounds.maxY - sandBounds.minY);
  context.restore();
}

function paintPremiumStagePresentationGrade(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  outer: Array<{ x: number; y: number }>,
  rimInner: Array<{ x: number; y: number }>,
  linerInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const trayBounds = getPointBounds(outer);
  const sandBounds = getPointBounds(sand);
  const trayWidth = trayBounds.maxX - trayBounds.minX;
  const trayHeight = trayBounds.maxY - trayBounds.minY;

  context.save();
  context.globalCompositeOperation = "multiply";
  const roomFocus = context.createRadialGradient(
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.48,
    VIEW_WIDTH * 0.18,
    VIEW_WIDTH * 0.5,
    VIEW_HEIGHT * 0.5,
    VIEW_WIDTH * 0.72,
  );
  roomFocus.addColorStop(0, "rgba(255,255,255,0)");
  roomFocus.addColorStop(0.54, "rgba(255,255,255,0)");
  roomFocus.addColorStop(1, night ? "rgba(0,8,14,0.24)" : rainy ? "rgba(44,50,42,0.12)" : "rgba(84,58,28,0.075)");
  context.fillStyle = roomFocus;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "screen";
  const sandKey = context.createRadialGradient(
    sandBounds.minX + (sandBounds.maxX - sandBounds.minX) * 0.26,
    sandBounds.minY + (sandBounds.maxY - sandBounds.minY) * 0.17,
    12,
    sandBounds.minX + (sandBounds.maxX - sandBounds.minX) * 0.3,
    sandBounds.minY + (sandBounds.maxY - sandBounds.minY) * 0.23,
    Math.max(240, (sandBounds.maxX - sandBounds.minX) * 0.55),
  );
  sandKey.addColorStop(0, night ? "rgba(213,237,192,0.082)" : rainy ? "rgba(255,248,218,0.1)" : "rgba(255,246,216,0.11)");
  sandKey.addColorStop(0.48, night ? "rgba(148,178,148,0.025)" : "rgba(255,207,132,0.038)");
  sandKey.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = sandKey;
  context.fillRect(sandBounds.minX, sandBounds.minY, sandBounds.maxX - sandBounds.minX, sandBounds.maxY - sandBounds.minY);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const sandDepth = context.createLinearGradient(sandBounds.minX, sandBounds.minY, sandBounds.maxX, sandBounds.maxY);
  sandDepth.addColorStop(0, "rgba(255,255,255,0)");
  sandDepth.addColorStop(0.56, "rgba(255,255,255,0)");
  sandDepth.addColorStop(1, night ? "rgba(0,8,10,0.22)" : rainy ? "rgba(73,60,43,0.16)" : "rgba(88,52,20,0.2)");
  context.fillStyle = sandDepth;
  context.fillRect(sandBounds.minX, sandBounds.minY, sandBounds.maxX - sandBounds.minX, sandBounds.maxY - sandBounds.minY);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.lineJoin = "round";
  context.strokeStyle = night ? "rgba(0,8,12,0.24)" : "rgba(97,62,29,0.23)";
  context.lineWidth = 5.8;
  polygonPath(context, sand);
  context.stroke();
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineJoin = "round";
  context.strokeStyle = night ? "rgba(181,255,239,0.1)" : rainy ? "rgba(255,255,238,0.17)" : "rgba(255,245,210,0.19)";
  context.lineWidth = 1.45;
  polygonPath(context, sand);
  context.stroke();
  context.restore();

  context.restore();

  context.save();
  ringPath(context, outer, rimInner);
  context.clip("evenodd");

  context.save();
  context.globalCompositeOperation = "multiply";
  const woodDepth = context.createLinearGradient(trayBounds.minX, trayBounds.minY, trayBounds.maxX, trayBounds.maxY);
  woodDepth.addColorStop(0, "rgba(255,255,255,0)");
  woodDepth.addColorStop(0.5, "rgba(255,255,255,0)");
  woodDepth.addColorStop(1, night ? "rgba(0,5,8,0.2)" : "rgba(74,35,11,0.18)");
  context.fillStyle = woodDepth;
  context.fillRect(trayBounds.minX, trayBounds.minY, trayWidth, trayHeight);
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  const woodLight = context.createLinearGradient(trayBounds.minX, trayBounds.minY, trayBounds.maxX, trayBounds.minY + trayHeight * 0.18);
  woodLight.addColorStop(0, night ? "rgba(255,231,174,0.1)" : "rgba(255,238,190,0.32)");
  woodLight.addColorStop(0.44, night ? "rgba(255,231,174,0.05)" : "rgba(255,224,154,0.12)");
  woodLight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = woodLight;
  context.fillRect(trayBounds.minX, trayBounds.minY, trayWidth, trayHeight * 0.34);
  context.restore();

  context.restore();

  context.save();
  polygonPath(context, linerInner);
  context.globalCompositeOperation = "screen";
  context.strokeStyle = night ? "rgba(108,226,255,0.24)" : "rgba(206,246,255,0.36)";
  context.lineWidth = 2.1;
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, outer);
  context.lineJoin = "round";
  context.globalCompositeOperation = "source-over";
  context.strokeStyle = night ? "rgba(247,230,176,0.28)" : "rgba(255,239,196,0.48)";
  context.lineWidth = 1.2;
  context.stroke();
  context.restore();

  if (!night && !rainy && !cloudy) {
    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = "blur(7px)";
    drawSoftEllipse(
      context,
      trayBounds.minX + trayWidth * 0.22,
      trayBounds.minY + trayHeight * 0.16,
      trayWidth * 0.18,
      trayHeight * 0.06,
      "rgba(255,244,203,0.12)",
    );
    context.restore();
  }
}

function paintDesignTargetShowcasePass(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  outer: Array<{ x: number; y: number }>,
  rimInner: Array<{ x: number; y: number }>,
  linerInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const outerBounds = getPointBounds(outer);
  const sandBounds = getPointBounds(sand);
  const trayWidth = outerBounds.maxX - outerBounds.minX;
  const trayHeight = outerBounds.maxY - outerBounds.minY;
  const sandWidth = sandBounds.maxX - sandBounds.minX;
  const sandHeight = sandBounds.maxY - sandBounds.minY;
  const yawShift = camera.yaw / 32;
  const pitchDepth = Math.min(1, Math.max(0, (camera.pitch - 0.48) / 0.26));

  context.save();
  context.globalCompositeOperation = "multiply";
  const focus = context.createRadialGradient(
    outerBounds.minX + trayWidth * 0.52,
    outerBounds.minY + trayHeight * 0.48,
    Math.max(180, trayWidth * 0.18),
    outerBounds.minX + trayWidth * 0.52,
    outerBounds.minY + trayHeight * 0.48,
    Math.max(trayWidth, trayHeight) * 0.82,
  );
  focus.addColorStop(0, "rgba(255,255,255,0)");
  focus.addColorStop(0.62, "rgba(255,255,255,0)");
  focus.addColorStop(1, night ? "rgba(0,9,14,0.32)" : rainy ? "rgba(54,62,53,0.14)" : "rgba(84,58,28,0.12)");
  context.fillStyle = focus;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  context.filter = "blur(16px)";
  drawSoftEllipse(
    context,
    outerBounds.minX + trayWidth * (0.48 + yawShift * 0.04),
    outerBounds.maxY + STAGE_THICKNESS * 0.64,
    trayWidth * 0.52,
    44 + pitchDepth * 26,
    night ? "rgba(96,188,188,0.08)" : rainy ? "rgba(196,213,187,0.12)" : "rgba(255,228,168,0.22)",
  );
  context.restore();

  context.save();
  ringPath(context, outer, rimInner);
  context.clip("evenodd");
  context.globalCompositeOperation = "screen";
  const varnish = context.createLinearGradient(
    outerBounds.minX,
    outerBounds.minY + yawShift * 18,
    outerBounds.maxX,
    outerBounds.minY + trayHeight * 0.32,
  );
  varnish.addColorStop(0, night ? "rgba(255,232,176,0.14)" : "rgba(255,250,218,0.46)");
  varnish.addColorStop(0.26, night ? "rgba(255,206,128,0.05)" : "rgba(255,224,148,0.18)");
  varnish.addColorStop(0.64, "rgba(255,255,255,0)");
  varnish.addColorStop(1, night ? "rgba(89,48,22,0.06)" : "rgba(109,57,18,0.08)");
  context.fillStyle = varnish;
  context.fillRect(outerBounds.minX, outerBounds.minY, trayWidth, trayHeight);

  context.lineCap = "round";
  for (let index = 0; index < 28; index += 1) {
    const seed = 26200 + index * 53;
    const edge = index % 2 === 0 ? [outer[0], outer[1]] : [outer[3], outer[2]];
    const t = 0.04 + random(seed) * 0.9;
    const x = edge[0].x + (edge[1].x - edge[0].x) * t;
    const y = edge[0].y + (edge[1].y - edge[0].y) * t + (index % 2 === 0 ? 10 : -10);
    context.strokeStyle =
      index % 4 === 0
        ? night
          ? "rgba(255,229,166,0.16)"
          : "rgba(255,246,204,0.38)"
        : night
          ? "rgba(28,14,6,0.12)"
          : "rgba(85,42,13,0.12)";
    context.lineWidth = 0.9 + random(seed + 1) * 1.6;
    context.beginPath();
    context.moveTo(x - 48, y);
    context.bezierCurveTo(
      x - 12,
      y - 7 + yawShift * 4,
      x + 34,
      y + 8 - yawShift * 5,
      x + 78,
      y + random(seed + 2) * 7 - 3.5,
    );
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineJoin = "round";
  context.lineCap = "round";
  context.strokeStyle = night ? "rgba(196,255,245,0.18)" : "rgba(255,252,224,0.58)";
  context.lineWidth = night ? 1.6 : 2.2;
  drawOpenPolyline(context, [outer[0], outer[1]]);
  context.stroke();
  context.strokeStyle = night ? "rgba(245,212,146,0.1)" : "rgba(255,218,144,0.28)";
  context.lineWidth = 1.4;
  drawOpenPolyline(context, [outer[3], outer[2]]);
  context.stroke();
  context.restore();

  context.save();
  ringPath(context, rimInner, linerInner);
  context.clip("evenodd");
  context.globalCompositeOperation = "screen";
  const linerLight = context.createLinearGradient(outerBounds.minX, outerBounds.minY, outerBounds.maxX, outerBounds.maxY);
  linerLight.addColorStop(0, night ? "rgba(112,232,255,0.24)" : "rgba(218,255,255,0.58)");
  linerLight.addColorStop(0.48, "rgba(255,255,255,0)");
  linerLight.addColorStop(1, night ? "rgba(0,35,58,0.08)" : "rgba(0,92,138,0.12)");
  context.fillStyle = linerLight;
  context.fillRect(outerBounds.minX, outerBounds.minY, trayWidth, trayHeight);
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.globalCompositeOperation = "screen";
  const sandAir = context.createRadialGradient(
    sandBounds.minX + sandWidth * (0.26 + yawShift * 0.05),
    sandBounds.minY + sandHeight * 0.18,
    4,
    sandBounds.minX + sandWidth * (0.28 + yawShift * 0.05),
    sandBounds.minY + sandHeight * 0.22,
    Math.max(260, sandWidth * 0.58),
  );
  sandAir.addColorStop(
    0,
    night ? "rgba(214,240,196,0.1)" : rainy ? "rgba(255,250,224,0.16)" : cloudy ? "rgba(255,244,214,0.22)" : "rgba(255,252,225,0.34)",
  );
  sandAir.addColorStop(0.42, night ? "rgba(178,154,100,0.035)" : "rgba(255,213,132,0.08)");
  sandAir.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = sandAir;
  context.fillRect(sandBounds.minX, sandBounds.minY, sandWidth, sandHeight);

  context.globalCompositeOperation = "source-over";
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let index = 0; index < 58; index += 1) {
    const seed = 27000 + index * 47;
    const y = sandBounds.minY + 24 + random(seed) * Math.max(1, sandHeight - 48);
    const startX = sandBounds.minX + 28 + random(seed + 1) * sandWidth * 0.16;
    const endX = sandBounds.maxX - 28 - random(seed + 2) * sandWidth * 0.16;
    const bow = -18 + random(seed + 3) * 36 + yawShift * 18;
    const lightLine = index % 3 === 0;
    context.strokeStyle = lightLine
      ? night
        ? "rgba(229,246,211,0.055)"
        : "rgba(255,250,218,0.17)"
      : night
        ? "rgba(16,19,14,0.055)"
        : "rgba(103,69,32,0.065)";
    context.lineWidth = lightLine ? 0.8 + random(seed + 4) * 0.9 : 1 + random(seed + 5) * 1.4;
    context.beginPath();
    context.moveTo(startX, y);
    context.bezierCurveTo(
      startX + sandWidth * 0.28,
      y + bow,
      endX - sandWidth * 0.28,
      y - bow * 0.72,
      endX,
      y + random(seed + 6) * 7 - 3.5,
    );
    context.stroke();
  }

  for (let index = 0; index < 150; index += 1) {
    const seed = 28100 + index * 31;
    const x = sandBounds.minX + random(seed) * sandWidth;
    const y = sandBounds.minY + random(seed + 1) * sandHeight;
    const depth = (y - sandBounds.minY) / Math.max(1, sandHeight);
    const radius = 0.7 + random(seed + 2) * (2.5 + depth * 1.2);
    context.fillStyle =
      index % 5 === 0
        ? night
          ? "rgba(232,244,210,0.09)"
          : "rgba(255,252,224,0.38)"
        : night
          ? "rgba(8,12,10,0.052)"
          : "rgba(96,62,27,0.055)";
    context.beginPath();
    context.ellipse(x, y, radius * 1.8, radius * 0.46, -0.25 + yawShift * 0.4 + random(seed + 3) * 0.5, 0, Math.PI * 2);
    context.fill();
  }

  context.globalCompositeOperation = "multiply";
  context.lineJoin = "round";
  context.strokeStyle = night ? "rgba(0,9,13,0.22)" : "rgba(81,51,22,0.17)";
  context.lineWidth = 10;
  polygonPath(context, sand);
  context.stroke();

  context.globalCompositeOperation = "screen";
  context.strokeStyle = night ? "rgba(190,246,226,0.08)" : "rgba(255,250,220,0.22)";
  context.lineWidth = 2;
  polygonPath(context, sand);
  context.stroke();

  context.restore();
}

function paintReferenceMockupSandTrayPass(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  outer: Array<{ x: number; y: number }>,
  rimInner: Array<{ x: number; y: number }>,
  linerInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const outerBounds = getPointBounds(outer);
  const sandBounds = getPointBounds(sand);
  const trayWidth = outerBounds.maxX - outerBounds.minX;
  const trayHeight = outerBounds.maxY - outerBounds.minY;
  const sandWidth = sandBounds.maxX - sandBounds.minX;
  const sandHeight = sandBounds.maxY - sandBounds.minY;
  const yawShift = camera.yaw / 36;
  const pitchLift = Math.min(1, Math.max(0, (camera.pitch - 0.46) / 0.28));
  const weatherMute = rainy ? 0.72 : cloudy ? 0.86 : 1;

  context.save();
  context.globalCompositeOperation = "multiply";
  context.filter = "blur(18px)";
  drawSoftEllipse(
    context,
    outerBounds.minX + trayWidth * (0.5 + yawShift * 0.04),
    outerBounds.maxY + STAGE_THICKNESS * (0.72 + pitchLift * 0.12),
    trayWidth * 0.48,
    38 + pitchLift * 24,
    night ? "rgba(0,10,16,0.38)" : rainy ? "rgba(45,58,55,0.16)" : "rgba(86,54,24,0.18)",
  );
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();

  const reliefFields = [
    { x: 0.23, y: 0.24, rx: 0.22, ry: 0.15, seed: 3021, lift: 1 },
    { x: 0.47, y: 0.34, rx: 0.31, ry: 0.18, seed: 3045, lift: 0.74 },
    { x: 0.74, y: 0.22, rx: 0.18, ry: 0.13, seed: 3091, lift: 0.86 },
    { x: 0.65, y: 0.66, rx: 0.28, ry: 0.16, seed: 3117, lift: 0.66 },
    { x: 0.3, y: 0.72, rx: 0.2, ry: 0.12, seed: 3165, lift: 0.72 },
  ];

  reliefFields.forEach((field, index) => {
    const centerX = sandBounds.minX + sandWidth * (field.x + yawShift * 0.025);
    const centerY = sandBounds.minY + sandHeight * field.y;
    const radiusX = sandWidth * field.rx;
    const radiusY = sandHeight * field.ry * (0.92 + pitchLift * 0.16);

    context.save();
    context.globalCompositeOperation = "screen";
    context.filter = "blur(11px)";
    const lift = context.createRadialGradient(
      centerX - radiusX * 0.2,
      centerY - radiusY * 0.38,
      2,
      centerX,
      centerY,
      Math.max(radiusX, radiusY),
    );
    lift.addColorStop(0, night ? `rgba(225,236,195,${0.05 * field.lift})` : `rgba(255,251,222,${0.28 * field.lift * weatherMute})`);
    lift.addColorStop(0.36, night ? `rgba(180,196,147,${0.028 * field.lift})` : `rgba(255,226,158,${0.12 * field.lift * weatherMute})`);
    lift.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = lift;
    context.beginPath();
    context.ellipse(centerX, centerY, radiusX, radiusY, -0.18 + yawShift * 0.55 + random(field.seed) * 0.16, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.globalCompositeOperation = "multiply";
    context.filter = "blur(9px)";
    const trough = context.createRadialGradient(
      centerX + radiusX * 0.22,
      centerY + radiusY * 0.48,
      4,
      centerX + radiusX * 0.2,
      centerY + radiusY * 0.45,
      Math.max(radiusX * 0.92, radiusY * 1.5),
    );
    trough.addColorStop(0, night ? `rgba(1,8,9,${0.1 + index * 0.012})` : `rgba(92,64,31,${0.09 * weatherMute})`);
    trough.addColorStop(0.5, night ? "rgba(0,8,10,0.035)" : "rgba(98,70,38,0.038)");
    trough.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = trough;
    context.beginPath();
    context.ellipse(centerX, centerY, radiusX * 1.08, radiusY * 0.92, -0.18 + yawShift * 0.52, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let index = 0; index < 34; index += 1) {
    const seed = 33000 + index * 59;
    const start = projectPoint(
      {
        x: BOARD_WIDTH * (0.13 + random(seed) * 0.12),
        y: BOARD_HEIGHT * (0.18 + random(seed + 1) * 0.68),
      },
      camera,
    );
    const end = projectPoint(
      {
        x: BOARD_WIDTH * (0.76 + random(seed + 2) * 0.12),
        y: BOARD_HEIGHT * (0.16 + random(seed + 3) * 0.7),
      },
      camera,
    );
    const bow = (random(seed + 4) - 0.5) * 52 + yawShift * 20;
    const lineAlpha = night ? 0.055 : rainy ? 0.06 : 0.11;
    context.strokeStyle = index % 4 === 0 ? `rgba(255,250,214,${lineAlpha + 0.035})` : `rgba(102,76,42,${lineAlpha})`;
    context.lineWidth = index % 4 === 0 ? 1.05 : 1.55;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.bezierCurveTo(
      start.x + (end.x - start.x) * 0.28,
      start.y + bow,
      start.x + (end.x - start.x) * 0.72,
      end.y - bow * 0.72,
      end.x,
      end.y,
    );
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  context.lineJoin = "round";
  context.strokeStyle = night ? "rgba(4,13,14,0.28)" : rainy ? "rgba(68,63,46,0.14)" : "rgba(93,62,28,0.17)";
  context.lineWidth = 16;
  polygonPath(context, sand);
  context.stroke();
  context.strokeStyle = night ? "rgba(218,238,197,0.05)" : "rgba(255,242,196,0.2)";
  context.lineWidth = 5;
  polygonPath(context, sand);
  context.stroke();
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let index = 0; index < 230; index += 1) {
    const seed = 34100 + index * 37;
    const x = sandBounds.minX + random(seed) * sandWidth;
    const y = sandBounds.minY + random(seed + 1) * sandHeight;
    const depth = (y - sandBounds.minY) / Math.max(1, sandHeight);
    const radius = 0.45 + random(seed + 2) * (1.6 + depth * 1.2);
    const warm = index % 6 === 0;
    context.fillStyle = warm
      ? night
        ? "rgba(231,242,205,0.075)"
        : `rgba(255,246,205,${0.24 * weatherMute})`
      : night
        ? "rgba(4,9,8,0.06)"
        : "rgba(112,82,44,0.052)";
    context.beginPath();
    context.ellipse(x, y, radius * (1.4 + random(seed + 3)), radius * 0.44, -0.25 + yawShift * 0.3, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.restore();

  context.save();
  ringPath(context, rimInner, linerInner);
  context.clip("evenodd");
  context.globalCompositeOperation = "screen";
  const linerGlance = context.createLinearGradient(outerBounds.minX, outerBounds.minY, outerBounds.maxX, outerBounds.maxY);
  linerGlance.addColorStop(0, night ? "rgba(112,234,255,0.2)" : "rgba(223,255,255,0.5)");
  linerGlance.addColorStop(0.32, night ? "rgba(70,186,210,0.08)" : "rgba(112,217,255,0.16)");
  linerGlance.addColorStop(0.72, "rgba(255,255,255,0)");
  linerGlance.addColorStop(1, night ? "rgba(0,22,38,0.06)" : "rgba(0,76,116,0.1)");
  context.fillStyle = linerGlance;
  context.fillRect(outerBounds.minX, outerBounds.minY, trayWidth, trayHeight);
  context.restore();

  context.save();
  ringPath(context, outer, rimInner);
  context.clip("evenodd");
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  context.strokeStyle = night ? "rgba(255,220,158,0.18)" : "rgba(255,247,205,0.62)";
  context.lineWidth = night ? 2 : 3.2;
  drawOpenPolyline(context, [outer[0], outer[1]]);
  context.stroke();
  context.strokeStyle = night ? "rgba(99,213,218,0.08)" : "rgba(255,227,157,0.34)";
  context.lineWidth = 2.2;
  drawOpenPolyline(context, [outer[3], outer[2]]);
  context.stroke();

  for (let index = 0; index < 18; index += 1) {
    const seed = 35200 + index * 41;
    const t = 0.08 + random(seed) * 0.84;
    const x = outer[3].x + (outer[2].x - outer[3].x) * t;
    const y = outer[3].y + (outer[2].y - outer[3].y) * t + STAGE_THICKNESS * (0.12 + random(seed + 1) * 0.24);
    context.strokeStyle = index % 3 === 0 ? "rgba(255,236,177,0.18)" : "rgba(63,32,13,0.12)";
    context.lineWidth = 0.9 + random(seed + 2) * 1.4;
    context.beginPath();
    context.moveTo(x - 36, y + random(seed + 3) * 4);
    context.bezierCurveTo(x - 12, y - 4, x + 24, y + 5, x + 58, y + random(seed + 4) * 6 - 3);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  context.filter = "blur(12px)";
  drawSoftEllipse(
    context,
    outerBounds.minX + trayWidth * (0.31 + yawShift * 0.05),
    outerBounds.minY + trayHeight * 0.16,
    trayWidth * 0.24,
    trayHeight * 0.08,
    night ? "rgba(151,226,232,0.06)" : rainy ? "rgba(255,255,228,0.1)" : "rgba(255,255,230,0.22)",
  );
  drawSoftEllipse(
    context,
    outerBounds.minX + trayWidth * 0.76,
    outerBounds.minY + trayHeight * 0.72,
    trayWidth * 0.24,
    trayHeight * 0.07,
    night ? "rgba(90,213,210,0.045)" : "rgba(255,221,166,0.13)",
  );
  context.restore();
}

function paintGallerySandTrayPolish(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  outer: Array<{ x: number; y: number }>,
  rimInner: Array<{ x: number; y: number }>,
  linerInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const sandBounds = getPointBounds(sand);
  const outerBounds = getPointBounds(outer);
  const width = sandBounds.maxX - sandBounds.minX;
  const height = sandBounds.maxY - sandBounds.minY;
  const lightAlpha = night ? 0.1 : rainy ? 0.13 : cloudy ? 0.16 : 0.2;
  const darkAlpha = night ? 0.16 : rainy ? 0.12 : cloudy ? 0.1 : 0.095;

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "screen";
  const warmTopLift = context.createLinearGradient(sandBounds.minX, sandBounds.minY, sandBounds.maxX, sandBounds.maxY);
  warmTopLift.addColorStop(0, night ? "rgba(180,218,195,0.055)" : rainy ? "rgba(255,237,190,0.105)" : "rgba(255,232,170,0.16)");
  warmTopLift.addColorStop(0.38, night ? "rgba(157,185,154,0.035)" : rainy ? "rgba(255,214,142,0.062)" : "rgba(255,205,122,0.105)");
  warmTopLift.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = warmTopLift;
  context.fillRect(sandBounds.minX, sandBounds.minY, width, height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const contactBowl = context.createRadialGradient(
    sandBounds.minX + width * 0.5,
    sandBounds.minY + height * 0.5,
    width * 0.18,
    sandBounds.minX + width * 0.5,
    sandBounds.minY + height * 0.52,
    width * 0.72,
  );
  contactBowl.addColorStop(0, "rgba(255,255,255,0)");
  contactBowl.addColorStop(0.64, "rgba(255,255,255,0)");
  contactBowl.addColorStop(1, night ? "rgba(0,8,12,0.18)" : "rgba(96,63,29,0.105)");
  context.fillStyle = contactBowl;
  context.fillRect(sandBounds.minX, sandBounds.minY, width, height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let grain = 0; grain < 1850; grain += 1) {
    const seed = 72000 + grain * 19;
    const x = sandBounds.minX + random(seed) * width;
    const y = sandBounds.minY + random(seed + 3) * height;
    const depth = (y - sandBounds.minY) / Math.max(1, height);
    const bright = grain % 5 === 0;
    const umber = grain % 7 === 0;
    const radius = 0.34 + random(seed + 9) * (0.82 + depth * 0.36);
    context.fillStyle = bright
      ? `rgba(${night ? "206,230,205" : "255,246,211"},${lightAlpha * (0.34 + random(seed + 11) * 0.58)})`
      : umber
        ? `rgba(${night ? "126,106,72" : "157,103,45"},${darkAlpha * (0.32 + random(seed + 13) * 0.44)})`
        : `rgba(${night ? "50,61,52" : "112,78,42"},${darkAlpha * (0.24 + random(seed + 17) * 0.34)})`;
    context.beginPath();
    context.ellipse(x, y, radius, radius * (0.34 + random(seed + 21) * 0.32), -0.45 + random(seed + 25) * 0.9, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.lineCap = "round";
  context.lineJoin = "round";
  for (let ridge = 0; ridge < 26; ridge += 1) {
    const seed = 76000 + ridge * 41;
    const boardY = 92 + random(seed) * (BOARD_HEIGHT - 184);
    const start = projectPoint({ x: 92 + random(seed + 1) * 96, y: boardY }, camera);
    const mid = projectPoint({ x: BOARD_WIDTH * (0.42 + random(seed + 5) * 0.2), y: boardY - 24 + random(seed + 9) * 48 }, camera);
    const end = projectPoint({
      x: BOARD_WIDTH - 104 - random(seed + 13) * 110,
      y: boardY + random(seed + 17) * 34 - 17,
    }, camera);
    context.strokeStyle = night
      ? `rgba(3,12,14,${0.058 + random(seed + 23) * 0.034})`
      : `rgba(116,70,26,${0.052 + random(seed + 23) * 0.038})`;
    context.lineWidth = 0.9 + random(seed + 29) * 1.15;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  for (let ridge = 0; ridge < 20; ridge += 1) {
    const seed = 79000 + ridge * 37;
    const boardY = 98 + random(seed) * (BOARD_HEIGHT - 196);
    const start = projectPoint({ x: 108 + random(seed + 1) * 90, y: boardY }, camera);
    const mid = projectPoint({ x: BOARD_WIDTH * (0.4 + random(seed + 5) * 0.22), y: boardY - 18 + random(seed + 9) * 38 }, camera);
    const end = projectPoint({
      x: BOARD_WIDTH - 120 - random(seed + 13) * 96,
      y: boardY + random(seed + 17) * 30 - 15,
    }, camera);
    context.strokeStyle = night
      ? `rgba(194,239,224,${0.035 + random(seed + 23) * 0.032})`
      : `rgba(255,244,205,${0.07 + random(seed + 23) * 0.05})`;
    context.lineWidth = 0.55 + random(seed + 29) * 0.64;
    context.beginPath();
    context.moveTo(start.x, start.y - 0.6);
    context.quadraticCurveTo(mid.x, mid.y - 1.3, end.x, end.y - 0.8);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  for (let dune = 0; dune < 18; dune += 1) {
    const seed = 83500 + dune * 67;
    const cx = sandBounds.minX + width * (0.16 + random(seed) * 0.7);
    const cy = sandBounds.minY + height * (0.16 + random(seed + 7) * 0.68);
    const rx = width * (0.045 + random(seed + 11) * 0.075);
    const ry = height * (0.01 + random(seed + 13) * 0.018);
    context.fillStyle = night
      ? `rgba(4,14,18,${0.05 + random(seed + 17) * 0.035})`
      : rainy
        ? `rgba(88,74,52,${0.04 + random(seed + 17) * 0.028})`
        : `rgba(122,76,31,${0.042 + random(seed + 17) * 0.032})`;
    context.beginPath();
    context.ellipse(cx, cy, rx, ry, -0.18 + random(seed + 19) * 0.36, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  for (let dune = 0; dune < 16; dune += 1) {
    const seed = 85200 + dune * 71;
    const cx = sandBounds.minX + width * (0.14 + random(seed) * 0.72);
    const cy = sandBounds.minY + height * (0.12 + random(seed + 7) * 0.64);
    const rx = width * (0.05 + random(seed + 11) * 0.08);
    const ry = height * (0.008 + random(seed + 13) * 0.015);
    context.fillStyle = night
      ? `rgba(199,238,216,${0.038 + random(seed + 17) * 0.032})`
      : `rgba(255,244,205,${0.09 + random(seed + 17) * 0.055})`;
    context.beginPath();
    context.ellipse(cx - rx * 0.13, cy - ry * 0.9, rx * 0.82, ry, -0.18 + random(seed + 19) * 0.36, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let cluster = 0; cluster < 32; cluster += 1) {
    const seed = 87100 + cluster * 53;
    const cx = sandBounds.minX + random(seed) * width;
    const cy = sandBounds.minY + random(seed + 5) * height;
    const grains = 7 + Math.floor(random(seed + 11) * 10);
    for (let dot = 0; dot < grains; dot += 1) {
      const dotSeed = seed + dot * 17;
      const x = cx + (random(dotSeed) - 0.5) * 32;
      const y = cy + (random(dotSeed + 3) - 0.5) * 18;
      const r = 0.55 + random(dotSeed + 7) * 1.25;
      context.fillStyle =
        dot % 3 === 0
          ? `rgba(${night ? "218,240,214" : "255,246,214"},${night ? 0.07 : 0.18})`
          : `rgba(${night ? "84,83,66" : "126,84,42"},${night ? 0.075 : 0.105})`;
      context.beginPath();
      context.ellipse(x, y, r, r * (0.45 + random(dotSeed + 9) * 0.3), random(dotSeed + 13) * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();

  context.restore();

  context.save();
  ringPath(context, outer, rimInner);
  context.clip("evenodd");

  context.save();
  context.globalCompositeOperation = "multiply";
  for (let streak = 0; streak < 90; streak += 1) {
    const seed = 82000 + streak * 23;
    const x = outerBounds.minX + random(seed) * (outerBounds.maxX - outerBounds.minX);
    const y = outerBounds.minY + random(seed + 3) * (outerBounds.maxY - outerBounds.minY);
    const length = 16 + random(seed + 7) * 54;
    context.strokeStyle = night ? "rgba(16,8,3,0.1)" : "rgba(84,44,18,0.1)";
    context.lineWidth = 0.5 + random(seed + 9) * 1.2;
    context.beginPath();
    context.moveTo(x - length * 0.5, y - length * 0.08);
    context.lineTo(x + length * 0.5, y + length * 0.08);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  const rimGlow = context.createLinearGradient(outerBounds.minX, outerBounds.minY, outerBounds.maxX, outerBounds.minY);
  rimGlow.addColorStop(0, night ? "rgba(255,232,183,0.06)" : "rgba(255,237,184,0.18)");
  rimGlow.addColorStop(0.28, night ? "rgba(255,232,183,0.1)" : "rgba(255,244,199,0.3)");
  rimGlow.addColorStop(0.66, "rgba(255,255,255,0)");
  rimGlow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = rimGlow;
  context.fillRect(outerBounds.minX, outerBounds.minY, outerBounds.maxX - outerBounds.minX, outerBounds.maxY - outerBounds.minY);
  context.restore();

  context.restore();

  context.save();
  polygonPath(context, linerInner);
  context.globalCompositeOperation = "source-over";
  context.lineJoin = "round";
  context.strokeStyle = night ? "rgba(12,48,63,0.52)" : "rgba(22,104,138,0.42)";
  context.lineWidth = 4.5;
  context.stroke();
  context.globalCompositeOperation = "screen";
  context.strokeStyle = night ? "rgba(144,239,255,0.16)" : "rgba(212,248,255,0.34)";
  context.lineWidth = 1.4;
  context.stroke();
  context.restore();
}

function paintReferenceDaylightHeroGrade(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  outer: Array<{ x: number; y: number }>,
  rimInner: Array<{ x: number; y: number }>,
  linerInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const trayBounds = getPointBounds(outer);
  const sandBounds = getPointBounds(sand);
  const sandWidth = sandBounds.maxX - sandBounds.minX;
  const sandHeight = sandBounds.maxY - sandBounds.minY;
  const trayWidth = trayBounds.maxX - trayBounds.minX;
  const trayHeight = trayBounds.maxY - trayBounds.minY;
  const daylightStrength = night ? 0.18 : rainy ? 0.58 : cloudy ? 0.72 : 1;

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  const roomBloom = context.createRadialGradient(
    VIEW_WIDTH * 0.36,
    VIEW_HEIGHT * 0.04,
    12,
    VIEW_WIDTH * 0.42,
    VIEW_HEIGHT * 0.1,
    VIEW_WIDTH * 0.72,
  );
  roomBloom.addColorStop(0, night ? "rgba(137,216,226,0.08)" : `rgba(255,255,246,${0.34 * daylightStrength})`);
  roomBloom.addColorStop(0.45, night ? "rgba(79,142,161,0.032)" : `rgba(255,226,163,${0.13 * daylightStrength})`);
  roomBloom.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = roomBloom;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT * 0.72);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const focusVignette = context.createRadialGradient(
    trayBounds.minX + trayWidth * 0.48,
    trayBounds.minY + trayHeight * 0.46,
    Math.max(120, trayWidth * 0.32),
    trayBounds.minX + trayWidth * 0.48,
    trayBounds.minY + trayHeight * 0.5,
    Math.max(420, trayWidth * 0.86),
  );
  focusVignette.addColorStop(0, "rgba(255,255,255,0)");
  focusVignette.addColorStop(0.68, "rgba(255,255,255,0)");
  focusVignette.addColorStop(1, night ? "rgba(0,8,14,0.18)" : `rgba(113,72,30,${0.095 * daylightStrength})`);
  context.fillStyle = focusVignette;
  context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "screen";
  const heroSandLight = context.createRadialGradient(
    sandBounds.minX + sandWidth * 0.24,
    sandBounds.minY + sandHeight * 0.16,
    8,
    sandBounds.minX + sandWidth * 0.24,
    sandBounds.minY + sandHeight * 0.18,
    Math.max(260, sandWidth * 0.72),
  );
  heroSandLight.addColorStop(0, night ? "rgba(210,239,210,0.07)" : `rgba(255,255,229,${0.18 * daylightStrength})`);
  heroSandLight.addColorStop(0.48, night ? "rgba(169,196,153,0.024)" : `rgba(255,218,137,${0.075 * daylightStrength})`);
  heroSandLight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = heroSandLight;
  context.fillRect(sandBounds.minX, sandBounds.minY, sandWidth, sandHeight);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const sculptDepth = context.createLinearGradient(sandBounds.minX, sandBounds.minY, sandBounds.maxX, sandBounds.maxY);
  sculptDepth.addColorStop(0, "rgba(255,255,255,0)");
  sculptDepth.addColorStop(0.54, "rgba(255,255,255,0)");
  sculptDepth.addColorStop(1, night ? "rgba(0,8,10,0.11)" : `rgba(120,72,26,${0.2 * daylightStrength})`);
  context.fillStyle = sculptDepth;
  context.fillRect(sandBounds.minX, sandBounds.minY, sandWidth, sandHeight);
  context.restore();

  for (let ridge = 0; ridge < 34; ridge += 1) {
    const seed = 93000 + ridge * 43;
    const boardY = 82 + random(seed) * (BOARD_HEIGHT - 164);
    const start = projectPoint({ x: 84 + random(seed + 1) * 74, y: boardY }, camera);
    const mid = projectPoint({
      x: BOARD_WIDTH * (0.36 + random(seed + 5) * 0.26),
      y: boardY - 22 + random(seed + 9) * 44,
    }, camera);
    const end = projectPoint({
      x: BOARD_WIDTH - 92 - random(seed + 13) * 86,
      y: boardY - 14 + random(seed + 17) * 32,
    }, camera);

    context.save();
    context.lineCap = "round";
    context.globalCompositeOperation = "multiply";
    context.strokeStyle = night ? "rgba(9,16,16,0.045)" : `rgba(120,74,30,${0.095 * daylightStrength})`;
    context.lineWidth = 2.2 + random(seed + 19) * 2.2;
    context.beginPath();
    context.moveTo(start.x + 1.6, start.y + 2.4);
    context.quadraticCurveTo(mid.x + 1.4, mid.y + 2.1, end.x + 1.2, end.y + 1.6);
    context.stroke();
    context.globalCompositeOperation = "screen";
    context.strokeStyle = night ? "rgba(202,238,218,0.035)" : `rgba(255,250,219,${0.145 * daylightStrength})`;
    context.lineWidth = 1.25 + random(seed + 23) * 0.75;
    context.beginPath();
    context.moveTo(start.x - 0.9, start.y - 1.1);
    context.quadraticCurveTo(mid.x - 0.8, mid.y - 1.2, end.x - 0.7, end.y - 0.8);
    context.stroke();
    context.restore();
  }

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let grain = 0; grain < 5200; grain += 1) {
    const seed = 95000 + grain * 17;
    const x = sandBounds.minX + random(seed) * sandWidth;
    const y = sandBounds.minY + random(seed + 3) * sandHeight;
    const depth = (y - sandBounds.minY) / Math.max(1, sandHeight);
    const sparkle = grain % 8 === 0;
    const radius = 0.38 + random(seed + 7) * (0.74 + depth * 0.3);
    context.fillStyle = sparkle
      ? night
        ? "rgba(224,247,222,0.052)"
        : `rgba(255,252,224,${0.14 * daylightStrength})`
      : night
        ? "rgba(82,78,60,0.042)"
        : `rgba(135,91,42,${0.105 * daylightStrength})`;
    context.beginPath();
    context.ellipse(x, y, radius * (1.4 + random(seed + 11) * 1.2), radius * (0.34 + random(seed + 13) * 0.3), -0.45 + random(seed + 19) * 0.9, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "multiply";
  context.strokeStyle = night ? "rgba(196,230,213,0.032)" : `rgba(112,72,31,${0.078 * daylightStrength})`;
  context.lineCap = "round";
  for (let rake = 0; rake < 54; rake += 1) {
    const seed = 98200 + rake * 29;
    const baseX = 46 + random(seed) * (BOARD_WIDTH - 92);
    const baseY = 60 + random(seed + 3) * (BOARD_HEIGHT - 120);
    const start = projectPoint({ x: baseX - 26 - random(seed + 7) * 20, y: baseY }, camera);
    const end = projectPoint({ x: baseX + 38 + random(seed + 11) * 28, y: baseY + 6 + random(seed + 13) * 16 }, camera);
    context.lineWidth = 0.62 + random(seed + 17) * 0.85;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.strokeStyle = night ? "rgba(206,240,220,0.036)" : `rgba(255,246,205,${0.13 * daylightStrength})`;
  context.lineCap = "round";
  for (let rake = 0; rake < 36; rake += 1) {
    const seed = 98860 + rake * 37;
    const baseX = 56 + random(seed) * (BOARD_WIDTH - 112);
    const baseY = 64 + random(seed + 3) * (BOARD_HEIGHT - 128);
    const start = projectPoint({ x: baseX - 18 - random(seed + 7) * 28, y: baseY - 2 }, camera);
    const end = projectPoint({ x: baseX + 46 + random(seed + 11) * 30, y: baseY + 4 + random(seed + 13) * 14 }, camera);
    context.lineWidth = 0.42 + random(seed + 17) * 0.58;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  context.restore();

  context.restore();

  context.save();
  ringPath(context, outer, rimInner);
  context.clip("evenodd");
  context.globalCompositeOperation = "screen";
  const rimVarnish = context.createLinearGradient(trayBounds.minX, trayBounds.minY, trayBounds.maxX, trayBounds.minY + trayHeight * 0.28);
  rimVarnish.addColorStop(0, night ? "rgba(255,225,164,0.06)" : `rgba(255,249,216,${0.34 * daylightStrength})`);
  rimVarnish.addColorStop(0.36, night ? "rgba(255,225,164,0.035)" : `rgba(255,222,148,${0.16 * daylightStrength})`);
  rimVarnish.addColorStop(0.7, "rgba(255,255,255,0)");
  rimVarnish.addColorStop(1, night ? "rgba(255,225,164,0.02)" : `rgba(255,244,202,${0.08 * daylightStrength})`);
  context.fillStyle = rimVarnish;
  context.fillRect(trayBounds.minX, trayBounds.minY, trayWidth, trayHeight);
  context.restore();

  context.save();
  ringPath(context, outer, rimInner);
  context.clip("evenodd");
  context.globalCompositeOperation = night ? "screen" : "multiply";
  context.lineCap = "round";
  for (let grain = 0; grain < 46; grain += 1) {
    const seed = 100400 + grain * 31;
    const y = trayBounds.minY + 6 + random(seed) * Math.max(1, trayHeight - 12);
    const x1 = trayBounds.minX + random(seed + 3) * trayWidth * 0.28;
    const x2 = trayBounds.maxX - random(seed + 7) * trayWidth * 0.18;
    context.strokeStyle = night ? "rgba(255,226,170,0.035)" : `rgba(96,55,21,${0.105 * daylightStrength})`;
    context.lineWidth = 0.8 + random(seed + 11) * 2.2;
    context.beginPath();
    context.moveTo(x1, y + random(seed + 13) * 3);
    context.bezierCurveTo(
      trayBounds.minX + trayWidth * (0.3 + random(seed + 17) * 0.18),
      y - 8 + random(seed + 19) * 16,
      trayBounds.minX + trayWidth * (0.66 + random(seed + 23) * 0.14),
      y - 10 + random(seed + 29) * 20,
      x2,
      y + random(seed + 31) * 5,
    );
    context.stroke();
  }
  context.globalCompositeOperation = "screen";
  context.strokeStyle = night ? "rgba(255,235,198,0.03)" : `rgba(255,231,178,${0.18 * daylightStrength})`;
  context.lineWidth = 1.1;
  for (let highlight = 0; highlight < 13; highlight += 1) {
    const seed = 101800 + highlight * 37;
    const y = trayBounds.minY + random(seed) * trayHeight;
    context.beginPath();
    context.moveTo(trayBounds.minX + random(seed + 3) * trayWidth * 0.18, y);
    context.lineTo(trayBounds.maxX - random(seed + 7) * trayWidth * 0.2, y + 3 + random(seed + 11) * 7);
    context.stroke();
  }
  context.restore();

  context.save();
  polygonPath(context, outer);
  context.lineJoin = "round";
  context.globalCompositeOperation = "source-over";
  context.strokeStyle = night ? "rgba(255,230,176,0.18)" : `rgba(255,246,210,${0.46 * daylightStrength})`;
  context.lineWidth = night ? 1.1 : 1.7;
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, linerInner);
  context.globalCompositeOperation = "screen";
  context.strokeStyle = night ? "rgba(120,235,255,0.12)" : `rgba(226,252,255,${0.46 * daylightStrength})`;
  context.lineWidth = night ? 1.15 : 1.8;
  context.stroke();
  context.restore();
}

function paintReferencePhotographicDepthPass(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  outer: Array<{ x: number; y: number }>,
  rimInner: Array<{ x: number; y: number }>,
  linerInner: Array<{ x: number; y: number }>,
  sand: Array<{ x: number; y: number }>,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const trayBounds = getPointBounds(outer);
  const sandBounds = getPointBounds(sand);
  const linerBounds = getPointBounds(linerInner);
  const trayWidth = trayBounds.maxX - trayBounds.minX;
  const trayHeight = trayBounds.maxY - trayBounds.minY;
  const sandWidth = sandBounds.maxX - sandBounds.minX;
  const sandHeight = sandBounds.maxY - sandBounds.minY;
  const lightStrength = night ? 0.26 : rainy ? 0.62 : cloudy ? 0.78 : 1;
  const pitchScale = 0.72 + (1 - camera.pitch) * 0.45;

  context.save();
  context.shadowColor = night ? "rgba(0,0,0,0.36)" : "rgba(83,58,32,0.24)";
  context.shadowBlur = night ? 26 : 18;
  context.shadowOffsetY = night ? 10 : 8;
  polygonPath(context, outer);
  context.strokeStyle = night ? "rgba(7,17,23,0.22)" : "rgba(94,54,19,0.14)";
  context.lineWidth = 10;
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "screen";
  const granularBloom = context.createRadialGradient(
    sandBounds.minX + sandWidth * 0.33,
    sandBounds.minY + sandHeight * 0.18,
    12,
    sandBounds.minX + sandWidth * 0.34,
    sandBounds.minY + sandHeight * 0.2,
    Math.max(sandWidth, sandHeight) * 0.82,
  );
  granularBloom.addColorStop(0, night ? "rgba(189,225,198,0.08)" : `rgba(255,255,224,${0.155 * lightStrength})`);
  granularBloom.addColorStop(0.42, night ? "rgba(111,145,129,0.035)" : `rgba(255,231,161,${0.058 * lightStrength})`);
  granularBloom.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = granularBloom;
  context.fillRect(sandBounds.minX, sandBounds.minY, sandWidth, sandHeight);
  context.restore();

  const duneSpecs = [
    { x: 0.18, y: 0.22, radiusX: 0.17, radiusY: 0.095, lift: 1, angle: -0.12 },
    { x: 0.43, y: 0.28, radiusX: 0.24, radiusY: 0.075, lift: 0.76, angle: 0.06 },
    { x: 0.68, y: 0.22, radiusX: 0.2, radiusY: 0.085, lift: 0.7, angle: 0.1 },
    { x: 0.25, y: 0.57, radiusX: 0.2, radiusY: 0.085, lift: -0.62, angle: -0.04 },
    { x: 0.52, y: 0.6, radiusX: 0.26, radiusY: 0.1, lift: 0.58, angle: 0.03 },
    { x: 0.78, y: 0.62, radiusX: 0.19, radiusY: 0.105, lift: -0.7, angle: 0.18 },
    { x: 0.34, y: 0.82, radiusX: 0.22, radiusY: 0.08, lift: 0.44, angle: 0.08 },
  ];

  duneSpecs.forEach((dune, index) => {
    const center = projectPoint(
      {
        x: 72 + dune.x * (BOARD_WIDTH - 144),
        y: 64 + dune.y * (BOARD_HEIGHT - 128),
      },
      camera,
    );
    const radiusX = sandWidth * dune.radiusX;
    const radiusY = sandHeight * dune.radiusY * pitchScale;

    context.save();
    context.translate(center.x, center.y);
    context.rotate(dune.angle + camera.yaw * 0.005);
    context.globalCompositeOperation = dune.lift > 0 ? "screen" : "multiply";
    const duneGradient = context.createRadialGradient(-radiusX * 0.16, -radiusY * 0.42, 1, 0, 0, radiusX);
    if (dune.lift > 0) {
      duneGradient.addColorStop(0, night ? "rgba(196,220,190,0.055)" : `rgba(255,252,219,${0.13 * lightStrength * dune.lift})`);
      duneGradient.addColorStop(0.58, night ? "rgba(141,157,124,0.02)" : `rgba(255,222,146,${0.04 * lightStrength * dune.lift})`);
      duneGradient.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      duneGradient.addColorStop(0, night ? "rgba(0,8,11,0.048)" : `rgba(112,71,28,${0.17 * lightStrength * Math.abs(dune.lift)})`);
      duneGradient.addColorStop(0.62, night ? "rgba(0,8,11,0.018)" : `rgba(108,68,24,${0.07 * lightStrength * Math.abs(dune.lift)})`);
      duneGradient.addColorStop(1, "rgba(255,255,255,0)");
    }
    context.fillStyle = duneGradient;
    context.beginPath();
    context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.save();
    context.translate(center.x + radiusX * 0.1, center.y + radiusY * 0.44);
    context.rotate(dune.angle + camera.yaw * 0.005);
    context.globalCompositeOperation = "multiply";
    context.fillStyle = night
      ? `rgba(0,8,12,${0.018 + index * 0.001})`
      : `rgba(98,60,22,${0.065 * lightStrength})`;
    context.beginPath();
    context.ellipse(0, 0, radiusX * 0.7, radiusY * 0.28, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  context.save();
  context.globalCompositeOperation = night ? "screen" : "multiply";
  context.lineCap = "round";
  for (let groove = 0; groove < 86; groove += 1) {
    const seed = 143000 + groove * 47;
    const boardX = 88 + random(seed) * (BOARD_WIDTH - 176);
    const boardY = 76 + random(seed + 3) * (BOARD_HEIGHT - 152);
    const length = 24 + random(seed + 7) * 82;
    const start = projectPoint({ x: boardX - length * 0.5, y: boardY - random(seed + 11) * 8 }, camera);
    const end = projectPoint({ x: boardX + length * 0.5, y: boardY + 7 + random(seed + 13) * 11 }, camera);
    const alpha = night ? 0.032 : 0.105 * lightStrength;
    context.strokeStyle = night ? `rgba(201,232,214,${alpha})` : `rgba(108,70,30,${alpha})`;
    context.lineWidth = 0.74 + random(seed + 17) * 1.26;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.quadraticCurveTo(
      (start.x + end.x) * 0.5 + (random(seed + 19) - 0.5) * 14,
      (start.y + end.y) * 0.5 + (random(seed + 23) - 0.5) * 8,
      end.x,
      end.y,
    );
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  for (let highlight = 0; highlight < 52; highlight += 1) {
    const seed = 148600 + highlight * 41;
    const boardX = 92 + random(seed) * (BOARD_WIDTH - 184);
    const boardY = 72 + random(seed + 5) * (BOARD_HEIGHT - 144);
    const start = projectPoint({ x: boardX - 14, y: boardY - 2 }, camera);
    const end = projectPoint({ x: boardX + 34 + random(seed + 11) * 34, y: boardY + random(seed + 13) * 9 }, camera);
    context.strokeStyle = night
      ? "rgba(215,242,219,0.028)"
      : `rgba(255,249,214,${0.135 * lightStrength})`;
    context.lineWidth = 0.58 + random(seed + 17) * 0.74;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.lineCap = "round";
  for (let band = 0; band < 18; band += 1) {
    const seed = 149700 + band * 113;
    const boardX = 92 + random(seed) * (BOARD_WIDTH - 184);
    const boardY = 78 + random(seed + 5) * (BOARD_HEIGHT - 156);
    const bandLength = 76 + random(seed + 7) * 158;
    const bandCount = 4 + Math.floor(random(seed + 11) * 5);
    for (let line = 0; line < bandCount; line += 1) {
      const offset = (line - bandCount * 0.5) * (3.8 + random(seed + line) * 1.9);
      const start = projectPoint({ x: boardX - bandLength * 0.5, y: boardY + offset }, camera);
      const mid = projectPoint({ x: boardX, y: boardY + offset - 8 + random(seed + 17) * 16 }, camera);
      const end = projectPoint({ x: boardX + bandLength * 0.5, y: boardY + offset + 4 + random(seed + 19) * 11 }, camera);
      context.strokeStyle = night ? "rgba(5,10,11,0.024)" : `rgba(92,60,29,${0.076 * lightStrength})`;
      context.lineWidth = 0.9 + random(seed + line * 23) * 0.76;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
      context.stroke();
    }
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  for (let band = 0; band < 18; band += 1) {
    const seed = 150300 + band * 107;
    const boardX = 92 + random(seed) * (BOARD_WIDTH - 184);
    const boardY = 78 + random(seed + 5) * (BOARD_HEIGHT - 156);
    const bandLength = 54 + random(seed + 7) * 128;
    const lineCount = 3 + Math.floor(random(seed + 11) * 4);
    for (let line = 0; line < lineCount; line += 1) {
      const offset = (line - lineCount * 0.5) * (3.2 + random(seed + line) * 1.4) - 1.3;
      const start = projectPoint({ x: boardX - bandLength * 0.5, y: boardY + offset }, camera);
      const end = projectPoint({ x: boardX + bandLength * 0.5, y: boardY + offset + 2 + random(seed + 19) * 6 }, camera);
      context.strokeStyle = night ? "rgba(209,240,216,0.026)" : `rgba(255,246,207,${0.11 * lightStrength})`;
      context.lineWidth = 0.45 + random(seed + line * 29) * 0.55;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "source-over";
  for (let grain = 0; grain < 4200; grain += 1) {
    const seed = 151000 + grain * 13;
    const x = sandBounds.minX + random(seed) * sandWidth;
    const y = sandBounds.minY + random(seed + 3) * sandHeight;
    const warm = grain % 4 === 0;
    const glint = grain % 19 === 0;
    const radius = glint ? 0.72 + random(seed + 9) * 1.05 : 0.34 + random(seed + 7) * 0.62;
    context.fillStyle = glint
      ? night
        ? "rgba(222,250,222,0.035)"
        : `rgba(255,255,229,${0.14 * lightStrength})`
      : warm
        ? night
          ? "rgba(95,84,58,0.03)"
          : `rgba(138,88,36,${0.075 * lightStrength})`
        : night
          ? "rgba(211,202,155,0.025)"
          : `rgba(255,223,150,${0.07 * lightStrength})`;
    context.beginPath();
    context.ellipse(
      x,
      y,
      radius * (1.8 + random(seed + 11)),
      radius * (0.28 + random(seed + 17) * 0.26),
      -0.38 + random(seed + 21) * 0.76,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();

  context.restore();

  context.save();
  polygonPath(context, sand);
  context.lineJoin = "round";
  context.globalCompositeOperation = "multiply";
  context.shadowColor = night ? "rgba(0,4,8,0.36)" : "rgba(83,46,15,0.26)";
  context.shadowBlur = night ? 10 : 8;
  context.strokeStyle = night ? "rgba(0,9,13,0.2)" : `rgba(86,49,16,${0.27 * lightStrength})`;
  context.lineWidth = night ? 7 : 7.6;
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, linerInner);
  context.globalCompositeOperation = "screen";
  context.shadowColor = night ? "rgba(109,232,255,0.16)" : "rgba(233,254,255,0.35)";
  context.shadowBlur = night ? 7 : 5;
  context.strokeStyle = night ? "rgba(106,229,255,0.2)" : `rgba(238,255,255,${0.36 * lightStrength})`;
  context.lineWidth = night ? 1.7 : 2.2;
  context.stroke();
  context.restore();

  context.save();
  ringPath(context, outer, rimInner);
  context.clip("evenodd");

  context.save();
  context.globalCompositeOperation = "screen";
  const varnishSweep = context.createLinearGradient(trayBounds.minX, trayBounds.minY, trayBounds.maxX, trayBounds.maxY);
  varnishSweep.addColorStop(0, night ? "rgba(255,224,161,0.1)" : `rgba(255,249,216,${0.32 * lightStrength})`);
  varnishSweep.addColorStop(0.28, night ? "rgba(255,224,161,0.05)" : `rgba(255,224,151,${0.16 * lightStrength})`);
  varnishSweep.addColorStop(0.56, "rgba(255,255,255,0)");
  varnishSweep.addColorStop(1, night ? "rgba(255,224,161,0.035)" : `rgba(255,220,153,${0.075 * lightStrength})`);
  context.fillStyle = varnishSweep;
  context.fillRect(trayBounds.minX, trayBounds.minY, trayWidth, trayHeight);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const insideLipShade = context.createLinearGradient(linerBounds.minX, linerBounds.minY, linerBounds.maxX, linerBounds.maxY);
  insideLipShade.addColorStop(0, "rgba(255,255,255,0)");
  insideLipShade.addColorStop(0.48, night ? "rgba(0,7,12,0.08)" : `rgba(80,42,13,${0.08 * lightStrength})`);
  insideLipShade.addColorStop(1, night ? "rgba(0,4,9,0.18)" : `rgba(70,34,9,${0.17 * lightStrength})`);
  context.fillStyle = insideLipShade;
  context.fillRect(linerBounds.minX - 24, linerBounds.minY - 24, linerBounds.maxX - linerBounds.minX + 48, linerBounds.maxY - linerBounds.minY + 48);
  context.restore();

  context.save();
  context.lineCap = "round";
  for (let streak = 0; streak < 64; streak += 1) {
    const seed = 156000 + streak * 53;
    const edge = streak % outer.length;
    const start = outer[edge];
    const end = outer[(edge + 1) % outer.length];
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const t = 0.06 + random(seed) * 0.88;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    const length = 22 + random(seed + 5) * 92;
    context.save();
    context.translate(x, y);
    context.rotate(angle + (random(seed + 7) - 0.5) * 0.08);
    context.globalCompositeOperation = streak % 5 === 0 ? "screen" : "multiply";
    context.strokeStyle = streak % 5 === 0
      ? night
        ? "rgba(255,232,180,0.08)"
        : `rgba(255,243,193,${0.22 * lightStrength})`
      : night
        ? "rgba(17,8,3,0.12)"
        : `rgba(83,42,14,${0.135 * lightStrength})`;
    context.lineWidth = streak % 5 === 0 ? 0.9 : 1.15;
    context.beginPath();
    context.moveTo(-length * 0.5, 0);
    context.bezierCurveTo(-length * 0.2, -2, length * 0.18, 2, length * 0.5, 0.4);
    context.stroke();
    context.restore();
  }
  context.restore();

  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "multiply";
  context.lineCap = "round";
  for (let field = 0; field < 15; field += 1) {
    const seed = 159400 + field * 131;
    const baseX = 96 + random(seed) * (BOARD_WIDTH - 192);
    const baseY = 82 + random(seed + 5) * (BOARD_HEIGHT - 164);
    const length = 92 + random(seed + 11) * 190;
    const lanes = 5 + Math.floor(random(seed + 17) * 6);
    for (let lane = 0; lane < lanes; lane += 1) {
      const laneOffset = (lane - lanes * 0.5) * (5.2 + random(seed + lane * 7) * 2.6);
      const start = projectPoint({ x: baseX - length * 0.5, y: baseY + laneOffset }, camera);
      const mid = projectPoint({ x: baseX, y: baseY + laneOffset - 12 + random(seed + lane * 11) * 24 }, camera);
      const end = projectPoint({ x: baseX + length * 0.5, y: baseY + laneOffset + 8 + random(seed + lane * 13) * 16 }, camera);
      context.strokeStyle = night ? "rgba(0,8,12,0.03)" : `rgba(72,45,20,${0.12 * lightStrength})`;
      context.lineWidth = 1.25 + random(seed + lane * 19) * 1.1;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.quadraticCurveTo(mid.x, mid.y, end.x, end.y);
      context.stroke();
    }
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  for (let field = 0; field < 15; field += 1) {
    const seed = 161500 + field * 137;
    const baseX = 96 + random(seed) * (BOARD_WIDTH - 192);
    const baseY = 82 + random(seed + 5) * (BOARD_HEIGHT - 164);
    const length = 72 + random(seed + 11) * 152;
    const lanes = 4 + Math.floor(random(seed + 17) * 4);
    for (let lane = 0; lane < lanes; lane += 1) {
      const laneOffset = (lane - lanes * 0.5) * (5 + random(seed + lane * 7) * 2.2) - 2.6;
      const start = projectPoint({ x: baseX - length * 0.5, y: baseY + laneOffset }, camera);
      const end = projectPoint({ x: baseX + length * 0.5, y: baseY + laneOffset + 5 + random(seed + lane * 13) * 10 }, camera);
      context.strokeStyle = night ? "rgba(210,240,217,0.025)" : `rgba(255,248,212,${0.18 * lightStrength})`;
      context.lineWidth = 0.72 + random(seed + lane * 19) * 0.65;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    }
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  for (let hollow = 0; hollow < 12; hollow += 1) {
    const seed = 163900 + hollow * 151;
    const center = projectPoint(
      {
        x: 92 + random(seed) * (BOARD_WIDTH - 184),
        y: 78 + random(seed + 5) * (BOARD_HEIGHT - 156),
      },
      camera,
    );
    const rx = 24 + random(seed + 11) * 52;
    const ry = (5 + random(seed + 17) * 12) * pitchScale;
    const gradient = context.createRadialGradient(center.x - rx * 0.16, center.y - ry * 0.8, 1, center.x, center.y, rx);
    gradient.addColorStop(0, night ? "rgba(0,8,12,0.035)" : `rgba(84,54,24,${0.1 * lightStrength})`);
    gradient.addColorStop(0.62, night ? "rgba(0,8,12,0.016)" : `rgba(99,64,29,${0.045 * lightStrength})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(center.x, center.y, rx, ry, -0.18 + random(seed + 23) * 0.36, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "screen";
  for (let mound = 0; mound < 10; mound += 1) {
    const seed = 165800 + mound * 157;
    const center = projectPoint(
      {
        x: 92 + random(seed) * (BOARD_WIDTH - 184),
        y: 78 + random(seed + 5) * (BOARD_HEIGHT - 156),
      },
      camera,
    );
    const rx = 30 + random(seed + 11) * 64;
    const ry = (5 + random(seed + 17) * 13) * pitchScale;
    const gradient = context.createRadialGradient(center.x - rx * 0.2, center.y - ry * 0.7, 1, center.x, center.y, rx);
    gradient.addColorStop(0, night ? "rgba(208,236,213,0.035)" : `rgba(255,252,221,${0.14 * lightStrength})`);
    gradient.addColorStop(0.54, night ? "rgba(208,236,213,0.012)" : `rgba(255,229,163,${0.05 * lightStrength})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(center.x, center.y, rx, ry, -0.18 + random(seed + 23) * 0.36, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  context.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();
  context.lineCap = "round";
  context.lineJoin = "round";

  for (let sweep = 0; sweep < 60; sweep += 1) {
    const seed = 168200 + sweep * 73;
    const boardY = 78 + random(seed) * (BOARD_HEIGHT - 156);
    const start = projectPoint({ x: 88 + random(seed + 3) * 60, y: boardY }, camera);
    const mid = projectPoint({
      x: BOARD_WIDTH * (0.34 + random(seed + 7) * 0.3),
      y: boardY - 18 + random(seed + 11) * 36,
    }, camera);
    const end = projectPoint({
      x: BOARD_WIDTH - 94 - random(seed + 13) * 76,
      y: boardY - 8 + random(seed + 17) * 28,
    }, camera);
    const darkAlpha = night ? 0.032 : 0.22 * lightStrength;
    const lightAlpha = night ? 0.026 : 0.24 * lightStrength;
    context.strokeStyle = night ? `rgba(13,24,23,${darkAlpha})` : `rgba(111,73,34,${darkAlpha})`;
    context.lineWidth = 1.8 + random(seed + 19) * 2.15;
    context.beginPath();
    context.moveTo(start.x + 1.8, start.y + 2.6);
    context.quadraticCurveTo(mid.x + 1.5, mid.y + 2, end.x + 1.2, end.y + 1.6);
    context.stroke();
    context.strokeStyle = night ? `rgba(210,240,219,${lightAlpha})` : `rgba(255,245,199,${lightAlpha})`;
    context.lineWidth = 0.92 + random(seed + 23) * 0.95;
    context.beginPath();
    context.moveTo(start.x - 1.2, start.y - 1);
    context.quadraticCurveTo(mid.x - 0.9, mid.y - 1.1, end.x - 0.8, end.y - 0.7);
    context.stroke();
  }

  for (let cluster = 0; cluster < 72; cluster += 1) {
    const seed = 171100 + cluster * 59;
    const center = projectPoint(
      {
        x: 84 + random(seed) * (BOARD_WIDTH - 168),
        y: 74 + random(seed + 3) * (BOARD_HEIGHT - 148),
      },
      camera,
    );
    const size = 1.4 + random(seed + 7) * 2.6;
    context.fillStyle = cluster % 3 === 0
      ? night
        ? "rgba(210,229,198,0.032)"
        : `rgba(255,240,186,${0.22 * lightStrength})`
      : night
        ? "rgba(31,32,25,0.036)"
        : `rgba(116,78,36,${0.19 * lightStrength})`;
    context.beginPath();
    context.ellipse(center.x, center.y, size * (1.5 + random(seed + 11)), size * 0.44, -0.32 + random(seed + 17) * 0.64, 0, Math.PI * 2);
    context.fill();
  }

  for (let contour = 0; contour < 18; contour += 1) {
    const seed = 173900 + contour * 89;
    const boardY = 96 + (contour / 17) * (BOARD_HEIGHT - 192) + (random(seed) - 0.5) * 28;
    const start = projectPoint({ x: 92 + random(seed + 3) * 54, y: boardY }, camera);
    const controlA = projectPoint({
      x: BOARD_WIDTH * (0.28 + random(seed + 7) * 0.08),
      y: boardY - 22 + random(seed + 11) * 44,
    }, camera);
    const controlB = projectPoint({
      x: BOARD_WIDTH * (0.66 + random(seed + 13) * 0.1),
      y: boardY + 20 - random(seed + 17) * 40,
    }, camera);
    const end = projectPoint({ x: BOARD_WIDTH - 94 - random(seed + 19) * 56, y: boardY + random(seed + 23) * 22 - 11 }, camera);
    const strength = 0.72 + random(seed + 29) * 0.5;

    context.strokeStyle = night ? "rgba(0,10,14,0.026)" : `rgba(97,64,31,${0.32 * lightStrength * strength})`;
    context.lineWidth = 4.2 + random(seed + 31) * 2.4;
    context.beginPath();
    context.moveTo(start.x + 2.4, start.y + 3.2);
    context.bezierCurveTo(controlA.x + 1.8, controlA.y + 2.5, controlB.x + 1.5, controlB.y + 2.1, end.x + 1.2, end.y + 1.6);
    context.stroke();

    context.strokeStyle = night ? "rgba(218,244,219,0.022)" : `rgba(255,247,209,${0.28 * lightStrength * strength})`;
    context.lineWidth = 1.4 + random(seed + 37) * 1.1;
    context.beginPath();
    context.moveTo(start.x - 1.2, start.y - 1);
    context.bezierCurveTo(controlA.x - 0.9, controlA.y - 0.8, controlB.x - 0.8, controlB.y - 0.8, end.x - 0.7, end.y - 0.6);
    context.stroke();
  }

  context.restore();

  context.save();
  polygonPath(context, outer);
  context.lineJoin = "round";
  context.globalCompositeOperation = "source-over";
  context.strokeStyle = night ? "rgba(255,238,188,0.18)" : `rgba(255,250,223,${0.44 * lightStrength})`;
  context.lineWidth = night ? 1.2 : 1.8;
  context.stroke();
  context.restore();

  context.save();
  polygonPath(context, rimInner);
  context.lineJoin = "round";
  context.globalCompositeOperation = "multiply";
  context.strokeStyle = night ? "rgba(0,8,12,0.34)" : `rgba(72,38,13,${0.25 * lightStrength})`;
  context.lineWidth = night ? 3.4 : 4.2;
  context.stroke();
  context.restore();
}

function paintHighDefinitionSandHeightMap(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  sand: Array<{ x: number; y: number }>,
): void {
  if (typeof document === "undefined") {
    return;
  }

  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const bounds = getPointBounds(sand);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const textureWidth = Math.min(1180, Math.max(600, Math.round(width * 1.45)));
  const textureHeight = Math.min(720, Math.max(300, Math.round(height * 1.45)));
  const lightStrength = night ? 0.26 : rainy ? 0.62 : cloudy ? 0.82 : 1.08;
  const canvas = document.createElement("canvas");
  canvas.width = textureWidth;
  canvas.height = textureHeight;
  const offscreen = canvas.getContext("2d", { willReadFrequently: true });

  if (!offscreen) {
    return;
  }

  const image = offscreen.createImageData(textureWidth, textureHeight);
  const data = image.data;
  const heightAt = (u: number, v: number): number => {
    const clampedU = Math.max(0, Math.min(1, u));
    const clampedV = Math.max(0, Math.min(1, v));
    const rake = Math.sin(clampedV * 78 + Math.sin(clampedU * 10.4) * 3.2) * 0.048;
    const diagonalRake = Math.sin((clampedU * 0.78 + clampedV * 1.18) * 46) * 0.03;
    const macro =
      Math.sin(clampedU * 11.4 + clampedV * 2.1) * 0.115 +
      Math.sin(clampedU * 24.2 - clampedV * 5.4) * 0.056 +
      Math.sin((clampedU - clampedV) * 18.5) * 0.052;
    const edgePile =
      Math.exp(-Math.min(clampedU, 1 - clampedU) * 18) * 0.072 +
      Math.exp(-Math.min(clampedV, 1 - clampedV) * 14) * 0.066;
    const basinA = -0.17 * gaussian2d(clampedU, clampedV, 0.3, 0.5, 0.13, 0.08);
    const basinB = -0.15 * gaussian2d(clampedU, clampedV, 0.7, 0.58, 0.16, 0.09);
    const moundA = 0.15 * gaussian2d(clampedU, clampedV, 0.22, 0.22, 0.18, 0.07);
    const moundB = 0.13 * gaussian2d(clampedU, clampedV, 0.56, 0.33, 0.2, 0.08);
    const moundC = 0.11 * gaussian2d(clampedU, clampedV, 0.82, 0.24, 0.15, 0.07);
    return macro + rake + diagonalRake + edgePile + basinA + basinB + moundA + moundB + moundC;
  };

  for (let y = 0; y < textureHeight; y += 1) {
    const v = y / Math.max(1, textureHeight - 1);
    for (let x = 0; x < textureWidth; x += 1) {
      const u = x / Math.max(1, textureWidth - 1);
      const h = heightAt(u, v);
      const dx = heightAt(u + 0.0022, v) - heightAt(u - 0.0022, v);
      const dy = heightAt(u, v + 0.0028) - heightAt(u, v - 0.0028);
      const grain = seededNoise2d(x, y);
      const sparkle = seededNoise2d(x + 91, y + 37);
      const shade = (-dx * 32 - dy * 20 + h * 0.55 + (grain - 0.5) * 0.22) * lightStrength;
      const pixel = (y * textureWidth + x) * 4;

      if (shade >= 0) {
        const alpha = Math.min(162, Math.max(0, 34 + shade * 172 + (sparkle > 0.982 ? 48 : 0)));
        data[pixel] = night ? 215 : 255;
        data[pixel + 1] = night ? 232 : 246;
        data[pixel + 2] = night ? 198 : 204;
        data[pixel + 3] = alpha;
      } else {
        const alpha = Math.min(164, Math.max(0, 28 + Math.abs(shade) * 172 + (grain > 0.92 ? 28 : 0)));
        data[pixel] = night ? 18 : rainy ? 98 : 108;
        data[pixel + 1] = night ? 24 : rainy ? 75 : 72;
        data[pixel + 2] = night ? 20 : rainy ? 45 : 32;
        data[pixel + 3] = alpha;
      }
    }
  }

  offscreen.putImageData(image, 0, 0);

  offscreen.save();
  offscreen.globalCompositeOperation = "source-over";
  offscreen.lineCap = "round";
  for (let ridge = 0; ridge < 32; ridge += 1) {
    const seed = 231000 + ridge * 43;
    const y = textureHeight * (0.12 + random(seed) * 0.76);
    const startX = textureWidth * (0.06 + random(seed + 3) * 0.08);
    const endX = textureWidth * (0.86 + random(seed + 5) * 0.08);
    const midY = y - textureHeight * 0.055 + random(seed + 7) * textureHeight * 0.11;
    const shadowAlpha = night ? 0.045 : 0.2 * lightStrength;
    const lightAlpha = night ? 0.032 : 0.24 * lightStrength;

    offscreen.strokeStyle = night ? `rgba(4,12,14,${shadowAlpha})` : `rgba(85,55,25,${shadowAlpha})`;
    offscreen.lineWidth = 2.8 + random(seed + 11) * 2.4;
    offscreen.beginPath();
    offscreen.moveTo(startX + 2, y + 3);
    offscreen.quadraticCurveTo(textureWidth * 0.52, midY + 2, endX, y + 2 + random(seed + 13) * 12);
    offscreen.stroke();

    offscreen.strokeStyle = night ? `rgba(212,240,216,${lightAlpha})` : `rgba(255,246,205,${lightAlpha})`;
    offscreen.lineWidth = 1 + random(seed + 17) * 1;
    offscreen.beginPath();
    offscreen.moveTo(startX - 1, y - 1);
    offscreen.quadraticCurveTo(textureWidth * 0.52, midY - 1.2, endX - 1, y - 1 + random(seed + 19) * 8);
    offscreen.stroke();
  }
  offscreen.restore();

  context.save();
  polygonPath(context, sand);
  context.clip();
  context.globalCompositeOperation = night ? "screen" : "source-over";
  context.globalAlpha = night ? 0.5 : rainy ? 0.82 : cloudy ? 0.92 : 0.98;
  context.drawImage(canvas, bounds.minX, bounds.minY, width, height);
  context.restore();
}

function paintFinalVisibleSandPolish(
  context: CanvasRenderingContext2D,
  environment: SandboxEnvironment,
  sand: Array<{ x: number; y: number }>,
  camera: SandboxCameraState,
): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const bounds = getPointBounds(sand);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const strength = night ? 0.38 : rainy ? 0.64 : cloudy ? 0.78 : 1;

  context.save();
  polygonPath(context, sand);
  context.clip();

  context.save();
  context.globalCompositeOperation = "screen";
  const sunWash = context.createRadialGradient(
    bounds.minX + width * 0.28,
    bounds.minY + height * 0.12,
    6,
    bounds.minX + width * 0.3,
    bounds.minY + height * 0.18,
    Math.max(width * 0.78, 300),
  );
  sunWash.addColorStop(0, night ? "rgba(205,232,208,0.055)" : `rgba(255,255,230,${0.18 * strength})`);
  sunWash.addColorStop(0.42, night ? "rgba(132,171,150,0.022)" : `rgba(255,226,150,${0.07 * strength})`);
  sunWash.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = sunWash;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  const troughShade = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  troughShade.addColorStop(0, "rgba(255,255,255,0)");
  troughShade.addColorStop(0.58, night ? "rgba(0,8,12,0.055)" : `rgba(101,62,24,${0.075 * strength})`);
  troughShade.addColorStop(1, night ? "rgba(0,8,12,0.16)" : `rgba(108,65,25,${0.17 * strength})`);
  context.fillStyle = troughShade;
  context.fillRect(bounds.minX, bounds.minY, width, height);
  context.restore();

  context.save();
  context.lineCap = "round";
  [
    { x: 0.17, y: 0.22, rx: 0.2, ry: 0.095, angle: -0.16, lift: 1 },
    { x: 0.42, y: 0.27, rx: 0.25, ry: 0.09, angle: 0.06, lift: 0.8 },
    { x: 0.73, y: 0.24, rx: 0.2, ry: 0.08, angle: 0.12, lift: 0.78 },
    { x: 0.22, y: 0.58, rx: 0.22, ry: 0.09, angle: -0.04, lift: -0.7 },
    { x: 0.55, y: 0.6, rx: 0.26, ry: 0.1, angle: 0.08, lift: 0.64 },
    { x: 0.8, y: 0.64, rx: 0.18, ry: 0.09, angle: 0.18, lift: -0.78 },
    { x: 0.34, y: 0.82, rx: 0.24, ry: 0.08, angle: 0.08, lift: 0.58 },
  ].forEach((dune, index) => {
    const center = {
      x: bounds.minX + width * dune.x,
      y: bounds.minY + height * dune.y,
    };
    const rx = width * dune.rx;
    const ry = height * dune.ry;
    context.save();
    context.translate(center.x, center.y);
    context.rotate(dune.angle + camera.yaw * 0.006);
    context.globalCompositeOperation = dune.lift > 0 ? "screen" : "multiply";
    const duneGradient = context.createRadialGradient(-rx * 0.18, -ry * 0.46, 1, 0, 0, rx);
    if (dune.lift > 0) {
      duneGradient.addColorStop(0, night ? `rgba(205,232,208,${0.08 * strength})` : `rgba(255,252,218,${0.32 * strength})`);
      duneGradient.addColorStop(0.62, night ? `rgba(144,166,128,${0.024 * strength})` : `rgba(255,220,142,${0.12 * strength})`);
      duneGradient.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      duneGradient.addColorStop(0, night ? `rgba(0,8,12,${0.075 * strength})` : `rgba(104,65,25,${0.3 * strength})`);
      duneGradient.addColorStop(0.62, night ? `rgba(0,8,12,${0.03 * strength})` : `rgba(92,54,20,${0.12 * strength})`);
      duneGradient.addColorStop(1, "rgba(255,255,255,0)");
    }
    context.fillStyle = duneGradient;
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();

    context.globalCompositeOperation = "multiply";
    context.fillStyle = night ? `rgba(0,8,12,${0.024 + index * 0.001})` : `rgba(88,52,18,${0.078 * strength})`;
    context.beginPath();
    context.ellipse(rx * 0.08, ry * 0.42, rx * 0.72, ry * 0.28, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  });

  for (let line = 0; line < 62; line += 1) {
    const seed = 319000 + line * 53;
    const baseY = 76 + random(seed) * (BOARD_HEIGHT - 152);
    const start = projectPoint({ x: 84 + random(seed + 3) * 58, y: baseY }, camera);
    const mid = projectPoint(
      {
        x: BOARD_WIDTH * (0.36 + random(seed + 7) * 0.24),
        y: baseY - 20 + random(seed + 11) * 40,
      },
      camera,
    );
    const end = projectPoint(
      {
        x: BOARD_WIDTH - 86 - random(seed + 13) * 70,
        y: baseY - 8 + random(seed + 17) * 28,
      },
      camera,
    );
    const visible = random(seed + 19) > 0.22;
    if (!visible) {
      continue;
    }

    context.save();
    context.globalCompositeOperation = "multiply";
    context.strokeStyle = night ? `rgba(0,8,12,${0.024 + 0.044 * strength})` : `rgba(98,61,25,${0.075 + 0.072 * strength})`;
    context.lineWidth = 1.9 + random(seed + 23) * 2.9;
    context.beginPath();
    context.moveTo(start.x + 1.2, start.y + 2.2);
    context.quadraticCurveTo(mid.x + 1.8, mid.y + 2.4, end.x + 1.4, end.y + 2);
    context.stroke();

    context.globalCompositeOperation = "screen";
    context.strokeStyle = night ? `rgba(215,240,216,${0.022 + 0.032 * strength})` : `rgba(255,250,218,${0.11 + 0.09 * strength})`;
    context.lineWidth = 0.86 + random(seed + 29) * 1.1;
    context.beginPath();
    context.moveTo(start.x - 0.7, start.y - 0.9);
    context.quadraticCurveTo(mid.x - 0.9, mid.y - 1.1, end.x - 0.8, end.y - 0.6);
    context.stroke();
    context.restore();
  }
  context.restore();

  context.save();
  for (let grain = 0; grain < 2200; grain += 1) {
    const seed = 343000 + grain * 29;
    const x = bounds.minX + random(seed) * width;
    const y = bounds.minY + random(seed + 3) * height;
    const depth = (y - bounds.minY) / height;
    const radius = 0.35 + random(seed + 7) * (1.1 + depth * 0.55);
    const sparkle = grain % 11 === 0;
    context.globalCompositeOperation = sparkle ? "screen" : "multiply";
    context.fillStyle = sparkle
      ? night
        ? `rgba(219,244,217,${0.05 * strength})`
        : `rgba(255,252,222,${0.16 * strength})`
      : night
        ? `rgba(0,8,10,${0.025 * strength})`
        : `rgba(97,61,28,${0.055 * strength})`;
    context.beginPath();
    context.ellipse(
      x,
      y,
      radius * (1.2 + random(seed + 11) * 1.6),
      radius * (0.3 + random(seed + 13) * 0.32),
      -0.54 + random(seed + 17) * 0.92,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();

  context.restore();
}

function gaussian2d(x: number, y: number, centerX: number, centerY: number, radiusX: number, radiusY: number): number {
  const dx = (x - centerX) / Math.max(0.001, radiusX);
  const dy = (y - centerY) / Math.max(0.001, radiusY);
  return Math.exp(-(dx * dx + dy * dy));
}

function seededNoise2d(x: number, y: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function polygonPath(context: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>): void {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
      return;
    }
    context.lineTo(point.x, point.y);
  });
  context.closePath();
}

function ringPath(
  context: CanvasRenderingContext2D,
  outer: Array<{ x: number; y: number }>,
  inner: Array<{ x: number; y: number }>,
): void {
  context.beginPath();
  outer.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
      return;
    }
    context.lineTo(point.x, point.y);
  });
  context.closePath();
  [...inner].reverse().forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
      return;
    }
    context.lineTo(point.x, point.y);
  });
  context.closePath();
}

function drawOpenPolyline(context: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>): void {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
      return;
    }
    context.lineTo(point.x, point.y);
  });
}

function normalizeVector(x: number, y: number): { x: number; y: number } {
  const length = Math.max(0.0001, Math.hypot(x, y));
  return { x: x / length, y: y / length };
}

function nearestDirectionToCenter(
  x: number,
  y: number,
  points: Array<{ x: number; y: number }>,
): { x: number; y: number } {
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 },
  );
  return normalizeVector(center.x - x, center.y - y);
}

function getPointBounds(points: Array<{ x: number; y: number }>): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
}

function createTexture(
  width: number,
  height: number,
  painter: (context: CanvasRenderingContext2D, width: number, height: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    painter(context, width, height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

function drawDistantStudioProps(context: CanvasRenderingContext2D, environment: SandboxEnvironment): void {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const baseOpacity = night ? 0.13 : rainy ? 0.18 : 0.24;

  context.save();
  context.filter = "blur(15px)";
  context.globalAlpha = baseOpacity;

  const plantGradient = context.createLinearGradient(0, 72, 0, 290);
  plantGradient.addColorStop(0, night ? "#477d7a" : "#6a9b78");
  plantGradient.addColorStop(1, night ? "#1c4146" : "#9e8a59");
  context.fillStyle = plantGradient;
  [74, 948].forEach((x, sideIndex) => {
    context.beginPath();
    context.ellipse(x, 214, 52, 126, sideIndex === 0 ? -0.22 : 0.18, 0, Math.PI * 2);
    context.ellipse(x + (sideIndex === 0 ? 44 : -42), 246, 36, 92, sideIndex === 0 ? 0.18 : -0.18, 0, Math.PI * 2);
    context.fill();
  });

  context.fillStyle = night ? "#60432d" : "#b88c54";
  context.fillRect(34, 330, 62, 96);
  context.fillRect(972, 326, 70, 104);
  context.restore();

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  drawSoftEllipse(context, VIEW_WIDTH * 0.17, 82, 118, 24, night ? "rgba(111,190,205,0.12)" : "rgba(255,255,255,0.38)");
  drawSoftEllipse(context, VIEW_WIDTH * 0.86, 88, 132, 28, night ? "rgba(88,158,178,0.1)" : "rgba(255,246,214,0.3)");
  context.restore();
}

function drawBackdropDust(context: CanvasRenderingContext2D, environment: SandboxEnvironment): void {
  const night = environment.light === "night";
  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  for (let index = 0; index < 130; index += 1) {
    const x = random(index * 67 + 21) * VIEW_WIDTH;
    const y = random(index * 71 + 23) * VIEW_HEIGHT * 0.88;
    const radius = 0.6 + random(index * 79 + 29) * 2.2;
    context.fillStyle = night
      ? `rgba(184,235,224,${0.015 + random(index + 31) * 0.038})`
      : `rgba(255,247,217,${0.028 + random(index + 31) * 0.06})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawCalendarMoon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  environment: SandboxEnvironment,
): void {
  const cloudy = environment.weather === "cloudy";
  const rainy = environment.weather === "rainy";
  const phase = getApproximateMoonPhase();
  const illuminated = Math.cos(phase * Math.PI * 2);
  const offset = illuminated * radius * 0.86;

  context.save();
  context.globalCompositeOperation = "screen";
  drawSoftEllipse(context, x, y, radius * 2.1, radius * 2.1, rainy ? "rgba(149,190,188,0.16)" : "rgba(245,239,195,0.22)");
  context.restore();

  context.save();
  context.shadowColor = "rgba(248,239,195,0.34)";
  context.shadowBlur = 18;
  context.fillStyle = cloudy || rainy ? "rgba(232,230,205,0.38)" : "rgba(248,239,195,0.62)";
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = rainy ? "rgba(18,39,50,0.64)" : "rgba(18,37,48,0.7)";
  context.beginPath();
  context.arc(x + offset, y - radius * 0.08, radius * (0.95 - Math.abs(illuminated) * 0.12), 0, Math.PI * 2);
  context.fill();
  context.restore();

  if (cloudy || rainy) {
    context.save();
    context.globalCompositeOperation = "source-over";
    drawSoftEllipse(context, x - radius * 0.2, y + radius * 0.1, radius * 1.55, radius * 0.44, rainy ? "rgba(84,111,119,0.24)" : "rgba(126,154,160,0.2)");
    context.restore();
  }
}

function getApproximateMoonPhase(): number {
  const synodicMonth = 29.530588853;
  const knownNewMoonUtc = Date.UTC(2000, 0, 6, 18, 14);
  const days = (Date.now() - knownNewMoonUtc) / 86400000;
  return ((days % synodicMonth) + synodicMonth) % synodicMonth / synodicMonth;
}

function drawWindowSlats(context: CanvasRenderingContext2D, width: number, height: number, night: boolean): void {
  context.strokeStyle = night ? "rgba(170,255,246,0.08)" : "rgba(136,184,168,0.16)";
  context.lineWidth = 3;
  [0.22, 0.38, 0.54, 0.7, 0.86].forEach((ratio) => {
    context.beginPath();
    context.moveTo(width * ratio, 0);
    context.lineTo(width * ratio, height * 0.58);
    context.stroke();
  });
}

function drawSoftEllipse(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  fill: string,
): void {
  context.save();
  context.filter = "blur(10px)";
  context.fillStyle = fill;
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function random(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
