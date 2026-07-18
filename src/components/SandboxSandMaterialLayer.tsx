import { useMemo } from "react";
import { Circle, Ellipse, Group, Image as KonvaImage, Line } from "react-konva";
import type { SandboxCameraState, SandboxEnvironment } from "../types";
import { BOARD_WIDTH } from "../utils/analysis";
import {
  clipProjectedPolygon,
  flattenProjectedPoints,
  getPointBounds,
  getProjectedIslandPoints,
  isInsideIslandRectPoint,
  SAND_ISLAND_RECT,
} from "../utils/islandStage";
import { projectPoint } from "../utils/projection";

interface SandboxSandMaterialLayerProps {
  camera: SandboxCameraState;
  environment: SandboxEnvironment;
}

interface BoardSeed {
  id: string;
  x: number;
  y: number;
  tone: number;
}

interface DuneSeed {
  id: string;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  lift: number;
}

const sandInset = SAND_ISLAND_RECT;
const duneSeeds: DuneSeed[] = [
  { id: "dune-nw", x: 0.18, y: 0.2, radiusX: 0.2, radiusY: 0.11, rotation: -8, lift: 1 },
  { id: "dune-n", x: 0.43, y: 0.25, radiusX: 0.25, radiusY: 0.1, rotation: 3, lift: 0.9 },
  { id: "dune-ne", x: 0.75, y: 0.23, radiusX: 0.22, radiusY: 0.09, rotation: 7, lift: 0.78 },
  { id: "dune-w-basin", x: 0.2, y: 0.58, radiusX: 0.22, radiusY: 0.09, rotation: -5, lift: -0.8 },
  { id: "dune-c", x: 0.54, y: 0.57, radiusX: 0.26, radiusY: 0.11, rotation: 5, lift: 0.66 },
  { id: "dune-e-basin", x: 0.81, y: 0.64, radiusX: 0.2, radiusY: 0.1, rotation: 11, lift: -0.75 },
  { id: "dune-s", x: 0.35, y: 0.82, radiusX: 0.24, radiusY: 0.08, rotation: 4, lift: 0.58 },
];
const grainSeeds = createBoardSeeds(520, 9103, sandInset.x + 18, sandInset.y + 16, sandInset.x + sandInset.width - 18, sandInset.y + sandInset.height - 16);
const sparkleSeeds = createBoardSeeds(118, 2159, sandInset.x + 24, sandInset.y + 18, sandInset.x + sandInset.width - 24, sandInset.y + sandInset.height - 18);
const rakeSeeds = createBoardSeeds(16, 6197, sandInset.x + 22, sandInset.y + 26, sandInset.x + sandInset.width - 22, sandInset.y + sandInset.height - 26);

export function SandboxSandMaterialLayer({ camera, environment }: SandboxSandMaterialLayerProps): JSX.Element {
  const texture = useMemo(() => createSandTexture(environment), [environment.light, environment.weather]);
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const sandPoints = getProjectedIslandPoints(camera);
  const sand = flattenProjectedPoints(sandPoints);
  const bounds = getPointBounds(sandPoints);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const atmosphere = night ? 0.62 : rainy ? 0.72 : cloudy ? 0.86 : 1;

  return (
    <Group listening={false}>
      <Line
        points={sand}
        closed
        fillLinearGradientStartPoint={{ x: bounds.minX, y: bounds.minY }}
        fillLinearGradientEndPoint={{ x: bounds.maxX, y: bounds.maxY }}
        fillLinearGradientColorStops={
          night
            ? [0, "rgba(210,199,165,0.5)", 0.48, "rgba(169,148,113,0.46)", 1, "rgba(113,91,67,0.48)"]
            : rainy
              ? [0, "rgba(247,224,180,0.84)", 0.48, "rgba(222,190,137,0.78)", 1, "rgba(181,136,85,0.68)"]
              : [0, "rgba(255,239,190,0.96)", 0.45, "rgba(244,205,135,0.9)", 1, "rgba(212,151,84,0.78)"]
        }
        opacity={night ? 0.88 : 1}
      />

      <Group clipFunc={(ctx: any) => clipProjectedPolygon(ctx, sandPoints)}>
        {texture ? (
          <KonvaImage
            image={texture}
            x={bounds.minX}
            y={bounds.minY}
            width={width}
            height={height}
            opacity={night ? 0.12 : rainy ? 0.15 : 0.14}
          />
        ) : null}

        <Ellipse
          x={bounds.minX + width * 0.28}
          y={bounds.minY + height * 0.16}
          radiusX={width * 0.72}
          radiusY={height * 0.34}
          rotation={-6 + camera.yaw * 0.12}
          fillRadialGradientStartPoint={{ x: -width * 0.18, y: -height * 0.08 }}
          fillRadialGradientStartRadius={1}
          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
          fillRadialGradientEndRadius={width * 0.72}
          fillRadialGradientColorStops={
            night
              ? [0, "rgba(211,232,198,0.13)", 0.52, "rgba(118,143,119,0.05)", 1, "rgba(255,255,255,0)"]
              : [0, `rgba(255,255,228,${0.46 * atmosphere})`, 0.48, `rgba(255,219,139,${0.22 * atmosphere})`, 1, "rgba(255,255,255,0)"]
          }
        />

        {duneSeeds.map((dune) => {
          const center = projectPoint(
            {
              x: sandInset.x + sandInset.width * dune.x,
              y: sandInset.y + sandInset.height * dune.y,
            },
            camera,
          );
          const radiusX = width * dune.radiusX;
          const radiusY = Math.max(8, height * dune.radiusY);
          const isLift = dune.lift > 0;

          return (
            <Group key={dune.id} x={center.x} y={center.y} rotation={dune.rotation + camera.yaw * 0.1}>
              <Ellipse
                radiusX={radiusX}
                radiusY={radiusY}
                fillRadialGradientStartPoint={{ x: -radiusX * 0.2, y: -radiusY * 0.58 }}
                fillRadialGradientStartRadius={1}
                fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                fillRadialGradientEndRadius={radiusX}
                fillRadialGradientColorStops={
                  isLift
                    ? night
                      ? [0, "rgba(213,231,197,0.1)", 0.62, "rgba(151,157,111,0.04)", 1, "rgba(255,255,255,0)"]
                      : [0, `rgba(255,250,213,${0.42 * atmosphere})`, 0.58, `rgba(248,207,130,${0.2 * atmosphere})`, 1, "rgba(255,255,255,0)"]
                    : night
                      ? [0, "rgba(6,14,15,0.13)", 0.62, "rgba(7,12,12,0.06)", 1, "rgba(0,0,0,0)"]
                      : [0, `rgba(104,65,25,${0.18 * atmosphere})`, 0.64, `rgba(96,55,20,${0.07 * atmosphere})`, 1, "rgba(0,0,0,0)"]
                }
              />
              <Ellipse
                x={radiusX * 0.08}
                y={radiusY * 0.42}
                radiusX={radiusX * 0.62}
                radiusY={radiusY * 0.24}
                fill={night ? "rgba(0,8,10,0.04)" : `rgba(92,55,19,${0.06 * atmosphere})`}
              />
            </Group>
          );
        })}

        {rakeSeeds.map((seed, index) => {
          const start = projectPoint({ x: sandInset.x + 16, y: seed.y }, camera);
          const mid = projectPoint({ x: BOARD_WIDTH * (0.35 + seed.tone * 0.28), y: seed.y - 18 + seed.tone * 36 }, camera);
          const end = projectPoint({ x: BOARD_WIDTH - sandInset.x - 18, y: seed.y + 6 - seed.tone * 24 }, camera);
          const opacity = (index % 3 === 0 ? 0.08 : 0.052) * atmosphere;

          return (
            <Group key={seed.id}>
              <Line
                points={[start.x + 1.4, start.y + 2.4, mid.x + 1, mid.y + 2, end.x + 1.2, end.y + 2.2]}
                tension={0.45}
                stroke={night ? "rgba(0,9,12,0.05)" : `rgba(96,61,27,${opacity * 0.55})`}
                strokeWidth={0.7 + seed.tone * 0.9}
                lineCap="round"
                lineJoin="round"
              />
              <Line
                points={[start.x - 0.8, start.y - 0.8, mid.x - 0.6, mid.y - 1, end.x - 0.8, end.y - 0.8]}
                tension={0.45}
                stroke={night ? "rgba(212,240,216,0.035)" : `rgba(255,248,211,${0.08 * atmosphere})`}
                strokeWidth={0.55 + seed.tone * 0.52}
                lineCap="round"
                lineJoin="round"
              />
            </Group>
          );
        })}

        {grainSeeds.map((grain) => {
          const point = projectPoint({ x: grain.x, y: grain.y }, camera);
          const depth = (grain.y - sandInset.y) / sandInset.height;
          const radiusX = 0.55 + grain.tone * 1.8 + depth * 0.55;
          const radiusY = Math.max(0.3, radiusX * (0.34 + grain.tone * 0.18));
          return (
            <Ellipse
              key={grain.id}
              x={point.x}
              y={point.y}
              radiusX={radiusX}
              radiusY={radiusY}
              rotation={-28 + grain.tone * 58 + camera.yaw * 0.12}
              fill={night ? `rgba(0,8,10,${0.018 * atmosphere})` : `rgba(130,87,38,${0.024 * atmosphere})`}
            />
          );
        })}

        {sparkleSeeds.map((grain) => {
          const point = projectPoint({ x: grain.x, y: grain.y }, camera);
          return (
            <Circle
              key={grain.id}
              x={point.x}
              y={point.y}
              radius={0.55 + grain.tone * 0.9}
              fill={night ? "rgba(213,239,212,0.1)" : `rgba(255,252,220,${0.28 * atmosphere})`}
            />
          );
        })}

        <Line
          points={sand}
          closed
          stroke={night ? "rgba(0,7,9,0.26)" : "rgba(136,89,38,0.2)"}
          strokeWidth={18}
          opacity={night ? 0.3 : 0.4}
        />
        <Line
          points={sand}
          closed
          stroke={night ? "rgba(206,232,210,0.08)" : "rgba(255,244,204,0.18)"}
          strokeWidth={5}
          opacity={cloudy ? 0.5 : 0.72}
        />
      </Group>
    </Group>
  );
}

function createBoardSeeds(count: number, seed: number, minX: number, minY: number, maxX: number, maxY: number): BoardSeed[] {
  const seeds: BoardSeed[] = [];
  let index = 0;

  while (seeds.length < count && index < count * 4) {
    const idSeed = seed + index * 47;
    const candidate = {
      id: `sand-seed-${seed}-${index}`,
      x: minX + random(idSeed) * (maxX - minX),
      y: minY + random(idSeed + 11) * (maxY - minY),
      tone: random(idSeed + 29),
    };

    if (isInsideIslandRectPoint(candidate)) {
      seeds.push(candidate);
    }

    index += 1;
  }

  return seeds;
}

function createSandTexture(environment: SandboxEnvironment): HTMLCanvasElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const width = 768;
  const height = 432;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return canvas;
  }

  const image = context.createImageData(width, height);
  const data = image.data;
  const lightStrength = night ? 0.42 : rainy ? 0.72 : cloudy ? 0.88 : 1.1;
  const base = night ? [176, 160, 119] : rainy ? [224, 189, 124] : cloudy ? [241, 202, 130] : [250, 210, 122];
  const highlight = night ? [220, 222, 178] : [255, 246, 194];
  const shadeColor = night ? [70, 61, 47] : rainy ? [134, 95, 52] : [159, 101, 45];
  const heightAt = (u: number, v: number): number => {
    const clampedU = Math.max(0, Math.min(1, u));
    const clampedV = Math.max(0, Math.min(1, v));
    const broad =
      Math.sin(clampedU * 8.2 + clampedV * 1.8) * 0.12 +
      Math.sin(clampedU * 18.6 - clampedV * 4.7) * 0.055 +
      Math.sin((clampedU + clampedV) * 15.2) * 0.05;
    const mounds =
      gaussian(clampedU, clampedV, 0.18, 0.2, 0.22, 0.1) * 0.18 +
      gaussian(clampedU, clampedV, 0.43, 0.26, 0.28, 0.1) * 0.14 +
      gaussian(clampedU, clampedV, 0.76, 0.24, 0.2, 0.09) * 0.12 -
      gaussian(clampedU, clampedV, 0.23, 0.58, 0.2, 0.1) * 0.12 -
      gaussian(clampedU, clampedV, 0.78, 0.62, 0.22, 0.11) * 0.11;
    const granular =
      Math.sin((clampedU * 137.8 + clampedV * 43.4) * Math.PI) * 0.0028 +
      Math.sin((clampedU * 37.6 - clampedV * 83.2) * Math.PI) * 0.0024;
    const edge =
      Math.exp(-Math.min(clampedU, 1 - clampedU) * 16) * 0.06 +
      Math.exp(-Math.min(clampedV, 1 - clampedV) * 18) * 0.055;
    return broad + mounds + granular + edge;
  };

  for (let y = 0; y < height; y += 1) {
    const v = y / Math.max(1, height - 1);
    for (let x = 0; x < width; x += 1) {
      const u = x / Math.max(1, width - 1);
      const h = heightAt(u, v);
      const dx = heightAt(u + 0.002, v) - heightAt(u - 0.002, v);
      const dy = heightAt(u, v + 0.0025) - heightAt(u, v - 0.0025);
      const fine = noise2d(x, y);
      const micro = noise2d(Math.floor(x * 1.7), Math.floor(y * 1.7));
      const coarse = noise2d(Math.floor(x / 3), Math.floor(y / 3));
      const shade = (-dx * 22 - dy * 12 + h * 0.46 + (fine - 0.5) * 0.1 + (micro - 0.5) * 0.035 + (coarse - 0.5) * 0.06) * lightStrength;
      const pixel = (y * width + x) * 4;
      const mix = shade >= 0 ? Math.min(1, shade * 1.9) : Math.min(1, Math.abs(shade) * 1.6);
      const target = shade >= 0 ? highlight : shadeColor;
      const warmth = 1 + Math.sin(u * Math.PI) * 0.05 - v * 0.035;

      data[pixel] = clampColor((base[0] * (1 - mix) + target[0] * mix) * warmth + (fine - 0.5) * 12 + (micro - 0.5) * 4);
      data[pixel + 1] = clampColor((base[1] * (1 - mix) + target[1] * mix) * warmth + (fine - 0.5) * 9 + (micro - 0.5) * 3);
      data[pixel + 2] = clampColor((base[2] * (1 - mix) + target[2] * mix) * warmth + (fine - 0.5) * 7 + (micro - 0.5) * 3);
      data[pixel + 3] = 245;
    }
  }

  context.putImageData(image, 0, 0);

  context.save();
  context.globalCompositeOperation = night ? "screen" : "soft-light";
  const wash = context.createRadialGradient(width * 0.22, height * 0.12, 4, width * 0.26, height * 0.18, width * 0.72);
  wash.addColorStop(0, night ? "rgba(205,232,202,0.13)" : "rgba(255,255,230,0.62)");
  wash.addColorStop(0.5, night ? "rgba(132,168,150,0.04)" : "rgba(255,225,146,0.18)");
  wash.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);
  context.restore();

  context.save();
  context.globalAlpha = night ? 0.01 : 0.014;
  context.strokeStyle = night ? "#d6ead0" : "#fff1bd";
  context.lineCap = "round";
  for (let index = 0; index < 5; index += 1) {
    const seed = 44700 + index * 71;
    const y = height * (0.12 + random(seed) * 0.76);
    context.lineWidth = 0.8 + random(seed + 5) * 1.2;
    context.beginPath();
    context.moveTo(width * 0.08, y);
    context.quadraticCurveTo(width * (0.42 + random(seed + 9) * 0.15), y - height * 0.06 + random(seed + 13) * height * 0.12, width * 0.9, y + random(seed + 17) * 20);
    context.stroke();
  }
  context.restore();

  return canvas;
}

function gaussian(x: number, y: number, centerX: number, centerY: number, radiusX: number, radiusY: number): number {
  const dx = (x - centerX) / Math.max(0.001, radiusX);
  const dy = (y - centerY) / Math.max(0.001, radiusY);
  return Math.exp(-(dx * dx + dy * dy));
}

function noise2d(x: number, y: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function random(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
