import { Circle, Ellipse, Group, Line } from "react-konva";
import type { SandboxCameraState, SandboxEnvironment } from "../types";
import {
  flattenProjectedPoints,
  getPointBounds,
  getProjectedIslandPoints,
  random,
  SAND_ISLAND_RECT,
} from "../utils/islandStage";
import { projectPoint } from "../utils/projection";

interface SandboxTrayPolishLayerProps {
  camera: SandboxCameraState;
  environment: SandboxEnvironment;
}

const foamSeeds = Array.from({ length: 42 }, (_, index) => ({
  id: `shore-foam-${index}`,
  edgeIndex: index * 2 + Math.floor(random(21000 + index * 31) * 3),
  offset: random(21100 + index * 37) * 7 - 2.5,
  radius: 1.8 + random(21200 + index * 41) * 5.8,
  opacity: 0.18 + random(21300 + index * 43) * 0.34,
}));

const shellSeeds = Array.from({ length: 18 }, (_, index) => ({
  id: `shore-shell-${index}`,
  x: 0.08 + random(23000 + index * 47) * 0.84,
  y: 0.09 + random(23100 + index * 53) * 0.82,
  size: 1.5 + random(23200 + index * 59) * 3.6,
  rotation: -28 + random(23300 + index * 61) * 56,
  tone: random(23400 + index * 67),
}));

export function SandboxTrayPolishLayer({ camera, environment }: SandboxTrayPolishLayerProps): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const islandPoints = getProjectedIslandPoints(camera);
  const island = flattenProjectedPoints(islandPoints);
  const bounds = getPointBounds(islandPoints);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const waterGlow = night ? "#226d83" : rainy ? "#87d7df" : cloudy ? "#9de8e6" : "#7cf3ec";
  const foam = night ? "rgba(196,242,239,0.33)" : rainy ? "rgba(237,255,250,0.43)" : "rgba(255,255,249,0.62)";
  const wetSand = night ? "rgba(76,91,86,0.22)" : rainy ? "rgba(122,140,113,0.2)" : "rgba(202,175,111,0.18)";

  return (
    <Group listening={false}>
      <Ellipse
        x={bounds.minX + width * 0.52}
        y={bounds.minY + height * 0.63}
        radiusX={width * 0.57}
        radiusY={height * 0.22}
        rotation={camera.yaw * 0.28 - 4}
        fill={night ? "rgba(0, 7, 12, 0.32)" : "rgba(20, 77, 79, 0.16)"}
        opacity={rainy ? 0.42 : 0.34}
        shadowColor={night ? "#000a10" : "#0c6e78"}
        shadowBlur={24}
        shadowOpacity={night ? 0.2 : 0.1}
      />

      <Line
        points={island}
        closed
        stroke={waterGlow}
        strokeWidth={36}
        opacity={night ? 0.2 : rainy ? 0.28 : 0.36}
        lineJoin="round"
        shadowColor={waterGlow}
        shadowBlur={18}
        shadowOpacity={night ? 0.18 : 0.2}
      />
      <Line
        points={island}
        closed
        stroke={foam}
        strokeWidth={16}
        opacity={night ? 0.22 : rainy ? 0.38 : 0.5}
        lineJoin="round"
      />
      <Line
        points={island}
        closed
        stroke={wetSand}
        strokeWidth={9}
        opacity={night ? 0.4 : 0.72}
        lineJoin="round"
      />
      <Line
        points={island}
        closed
        stroke={night ? "rgba(222,245,222,0.1)" : "rgba(255,246,202,0.34)"}
        strokeWidth={3}
        opacity={cloudy ? 0.46 : 0.7}
        lineJoin="round"
      />

      {foamSeeds.map((seed) => {
        const edge = islandPoints[seed.edgeIndex % islandPoints.length];
        const previous = islandPoints[(seed.edgeIndex - 1 + islandPoints.length) % islandPoints.length];
        const next = islandPoints[(seed.edgeIndex + 1) % islandPoints.length];
        const tangent = Math.atan2(next.y - previous.y, next.x - previous.x);
        const normal = tangent + Math.PI / 2;
        const x = edge.x + Math.cos(normal) * seed.offset;
        const y = edge.y + Math.sin(normal) * seed.offset;

        return (
          <Ellipse
            key={seed.id}
            x={x}
            y={y}
            radiusX={seed.radius * (1.2 + random(seed.edgeIndex + 99) * 1.4)}
            radiusY={Math.max(1.2, seed.radius * 0.32)}
            rotation={(tangent * 180) / Math.PI}
            fill={night ? "rgba(205,246,246,0.18)" : "rgba(255,255,255,0.52)"}
            opacity={seed.opacity * (night ? 0.44 : rainy ? 0.72 : 0.94)}
          />
        );
      })}

      {shellSeeds.map((seed) => {
        const boardPoint = {
          x: SAND_ISLAND_RECT.x + SAND_ISLAND_RECT.width * seed.x,
          y: SAND_ISLAND_RECT.y + SAND_ISLAND_RECT.height * seed.y,
        };
        const point = projectPoint(boardPoint, camera);
        const warm = seed.tone > 0.42;

        return (
          <Ellipse
            key={seed.id}
            x={point.x}
            y={point.y}
            radiusX={seed.size * 1.35}
            radiusY={seed.size * 0.44}
            rotation={seed.rotation + camera.yaw * 0.08}
            fill={warm ? (night ? "rgba(218,202,170,0.2)" : "rgba(255,232,181,0.72)") : night ? "rgba(204,224,208,0.16)" : "rgba(235,211,166,0.5)"}
            opacity={night ? 0.34 : rainy ? 0.5 : 0.72}
          />
        );
      })}

      {Array.from({ length: 14 }, (_, index) => {
        const edge = islandPoints[(index * 8 + 5) % islandPoints.length];
        return (
          <Circle
            key={`shore-spark-${index}`}
            x={edge.x + random(25000 + index * 11) * 16 - 8}
            y={edge.y + random(25100 + index * 13) * 10 - 5}
            radius={0.8 + random(25200 + index * 17) * 1.8}
            fill={night ? "rgba(184,244,242,0.24)" : "rgba(255,255,255,0.8)"}
            opacity={(night ? 0.24 : 0.55) * (rainy ? 0.68 : 1)}
          />
        );
      })}
    </Group>
  );
}
