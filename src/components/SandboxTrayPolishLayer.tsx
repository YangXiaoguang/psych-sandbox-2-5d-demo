import { Ellipse, Group, Line } from "react-konva";
import type { SandboxCameraState, SandboxEnvironment } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../utils/analysis";
import { getProjectedStageCorners, projectRect, STAGE_THICKNESS } from "../utils/projection";

interface SandboxTrayPolishLayerProps {
  camera: SandboxCameraState;
  environment: SandboxEnvironment;
}

interface Point {
  x: number;
  y: number;
}

const woodGrainSeeds = Array.from({ length: 30 }, (_, index) => ({
  id: `wood-grain-${index}`,
  t: 0.05 + random(7000 + index * 61) * 0.9,
  depth: 0.18 + random(7100 + index * 67) * 0.66,
  wave: random(7200 + index * 71) * 18 - 9,
  alpha: 0.045 + random(7300 + index * 73) * 0.07,
}));

const rimSparkSeeds = Array.from({ length: 22 }, (_, index) => ({
  id: `rim-spark-${index}`,
  x: 0.07 + random(8000 + index * 37) * 0.86,
  y: random(8100 + index * 41) > 0.54 ? 0.04 : 0.96,
  size: 1 + random(8200 + index * 43) * 2.3,
  alpha: 0.12 + random(8300 + index * 47) * 0.18,
}));

export function SandboxTrayPolishLayer({ camera, environment }: SandboxTrayPolishLayerProps): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const corners = getProjectedStageCorners(camera);
  const outer = pointArray(projectRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT, camera));
  const rimInner = pointArray(projectRect(34, 30, BOARD_WIDTH - 68, BOARD_HEIGHT - 60, camera));
  const linerOuter = pointArray(projectRect(50, 46, BOARD_WIDTH - 100, BOARD_HEIGHT - 92, camera));
  const linerInner = pointArray(projectRect(62, 56, BOARD_WIDTH - 124, BOARD_HEIGHT - 112, camera));
  const sand = pointArray(projectRect(72, 64, BOARD_WIDTH - 144, BOARD_HEIGHT - 128, camera));
  const frontFace = [
    corners.bottomLeft,
    corners.bottomRight,
    { x: corners.bottomRight.x + 18, y: corners.bottomRight.y + STAGE_THICKNESS },
    { x: corners.bottomLeft.x - 18, y: corners.bottomLeft.y + STAGE_THICKNESS },
  ];
  const leftFace = [
    corners.topLeft,
    corners.bottomLeft,
    { x: corners.bottomLeft.x - 18, y: corners.bottomLeft.y + STAGE_THICKNESS },
    { x: corners.topLeft.x - 12, y: corners.topLeft.y + STAGE_THICKNESS * 0.72 },
  ];
  const rightFace = [
    corners.topRight,
    corners.bottomRight,
    { x: corners.bottomRight.x + 18, y: corners.bottomRight.y + STAGE_THICKNESS },
    { x: corners.topRight.x + 12, y: corners.topRight.y + STAGE_THICKNESS * 0.72 },
  ];
  const woodBase = night ? "rgba(88,68,43,0.52)" : rainy ? "rgba(156,105,57,0.58)" : "rgba(188,122,55,0.62)";
  const woodDark = night ? "rgba(18,14,10,0.34)" : "rgba(92,51,19,0.28)";
  const woodLight = night ? "rgba(199,177,123,0.16)" : "rgba(255,221,148,0.42)";
  const linerBlue = night ? "rgba(33,145,176,0.72)" : "rgba(24,150,196,0.78)";
  const linerDeep = night ? "rgba(5,53,75,0.82)" : "rgba(9,94,140,0.7)";
  const innerShade = night ? "rgba(0,6,10,0.3)" : rainy ? "rgba(65,45,28,0.2)" : "rgba(88,54,25,0.18)";

  return (
    <Group listening={false}>
      <Line
        points={flatten(leftFace)}
        closed
        fill={night ? "rgba(62,48,32,0.36)" : "rgba(143,93,48,0.34)"}
        stroke={woodDark}
        strokeWidth={2}
        opacity={0.72}
      />
      <Line
        points={flatten(rightFace)}
        closed
        fill={night ? "rgba(48,37,26,0.32)" : "rgba(116,71,34,0.3)"}
        stroke={woodDark}
        strokeWidth={2}
        opacity={0.66}
      />
      <Line
        points={flatten(frontFace)}
        closed
        fillLinearGradientStartPoint={{ x: corners.bottomLeft.x, y: corners.bottomLeft.y }}
        fillLinearGradientEndPoint={{ x: corners.bottomRight.x, y: corners.bottomRight.y + STAGE_THICKNESS }}
        fillLinearGradientColorStops={
          night
            ? [0, "rgba(122,96,58,0.34)", 0.42, "rgba(72,54,34,0.48)", 1, "rgba(28,22,16,0.42)"]
            : [0, "rgba(229,166,87,0.42)", 0.46, woodBase, 1, "rgba(95,57,25,0.38)"]
        }
        stroke={woodDark}
        strokeWidth={2.4}
        opacity={0.76}
      />

      {woodGrainSeeds.map((seed) => {
        const start = lerpPoint(corners.bottomLeft, corners.bottomRight, seed.t);
        const end = {
          x: start.x + seed.wave,
          y: start.y + STAGE_THICKNESS * seed.depth,
        };
        return (
          <Line
            key={seed.id}
            points={[start.x, start.y + STAGE_THICKNESS * seed.depth * 0.16, (start.x + end.x) / 2, (start.y + end.y) / 2, end.x, end.y]}
            tension={0.44}
            stroke={night ? `rgba(227,201,144,${seed.alpha * 0.9})` : `rgba(255,218,142,${seed.alpha})`}
            strokeWidth={1.1 + seed.depth * 1.2}
            lineCap="round"
            lineJoin="round"
            opacity={0.8}
          />
        );
      })}

      <Line
        points={flatten(outer)}
        closed
        stroke={woodDark}
        strokeWidth={18}
        opacity={night ? 0.34 : 0.28}
        lineJoin="round"
      />
      <Line
        points={flatten(rimInner)}
        closed
        stroke={woodLight}
        strokeWidth={8}
        opacity={night ? 0.34 : 0.58}
        lineJoin="round"
      />
      <Line
        points={flatten(outer)}
        closed
        stroke={night ? "rgba(255,235,176,0.16)" : "rgba(255,239,178,0.55)"}
        strokeWidth={3}
        opacity={rainy ? 0.34 : 0.62}
        lineJoin="round"
      />

      <Line
        points={flatten(linerOuter)}
        closed
        stroke={linerDeep}
        strokeWidth={18}
        opacity={night ? 0.62 : 0.7}
        lineJoin="round"
      />
      <Line
        points={flatten(linerInner)}
        closed
        stroke={linerBlue}
        strokeWidth={8}
        opacity={night ? 0.58 : 0.74}
        lineJoin="round"
      />
      <Line
        points={flatten(sand)}
        closed
        stroke={innerShade}
        strokeWidth={14}
        opacity={night ? 0.72 : 0.64}
        lineJoin="round"
      />
      <Line
        points={flatten(sand)}
        closed
        stroke={night ? "rgba(223,255,246,0.12)" : "rgba(255,246,203,0.22)"}
        strokeWidth={3}
        opacity={rainy ? 0.42 : 0.7}
        lineJoin="round"
      />

      {rimSparkSeeds.map((spark) => {
        const point = projectPointOnInnerRim(spark.x, spark.y, camera);
        return (
          <Ellipse
            key={spark.id}
            x={point.x}
            y={point.y}
            radiusX={spark.size * 1.8}
            radiusY={spark.size * 0.5}
            rotation={spark.y < 0.5 ? -4 : 5}
            fill={night ? `rgba(204,246,236,${spark.alpha * 0.45})` : `rgba(255,246,202,${spark.alpha})`}
            opacity={rainy ? 0.45 : 0.86}
          />
        );
      })}
    </Group>
  );
}

function projectPointOnInnerRim(xRatio: number, yRatio: number, camera: SandboxCameraState): Point {
  const x = 44 + (BOARD_WIDTH - 88) * xRatio;
  const y = yRatio < 0.5 ? 38 + random(xRatio * 2000) * 18 : BOARD_HEIGHT - 44 - random(xRatio * 3000) * 18;
  return pointArray(projectRect(x, y, 1, 1, camera))[0];
}

function pointArray(points: number[]): Point[] {
  const result: Point[] = [];
  for (let index = 0; index < points.length; index += 2) {
    result.push({ x: points[index], y: points[index + 1] });
  }
  return result;
}

function flatten(points: Point[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

function lerpPoint(start: Point, end: Point, ratio: number): Point {
  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

function random(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
