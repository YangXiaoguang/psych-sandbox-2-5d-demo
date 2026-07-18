import { Circle, Ellipse, Group, Line } from "react-konva";
import type { SandboxCameraState, SandboxEnvironment, SandboxObject } from "../types";
import { clamp } from "../utils/analysis";
import { clipIsland } from "../utils/islandStage";
import { getDepthScale, projectPoint } from "../utils/projection";

interface SandboxObjectContactLayerProps {
  objects: SandboxObject[];
  camera: SandboxCameraState;
  environment: SandboxEnvironment;
}

export function SandboxObjectContactLayer({
  objects,
  camera,
  environment,
}: SandboxObjectContactLayerProps): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const atmosphere = night ? 0.72 : rainy ? 0.82 : 1;
  const sorted = [...objects].sort((a, b) => a.y - b.y || a.createdAt - b.createdAt);

  return (
    <Group listening={false} clipFunc={(ctx: any) => clipIsland(ctx, camera)}>
      {sorted.map((object) => {
        const projected = projectPoint(object, camera);
        const depthScale = getDepthScale(object, camera);
        const footprintWidth = clamp(object.footprint.width * object.scale * depthScale, 28, 170);
        const footprintDepth = clamp(object.footprint.depth * object.scale * depthScale, 12, 105);
        const lift = clamp(object.footprint.height / Math.max(object.footprint.depth, 1), 0.55, 2.4);
        const broadness =
          object.footprint.kind === "wide" ? 1.22 : object.footprint.kind === "flat" ? 1.36 : object.footprint.kind === "tall" ? 0.82 : 1;
        const depthness = object.footprint.kind === "flat" ? 0.7 : object.footprint.kind === "tall" ? 1.18 : 1;
        const isWater = object.assetId === "nature_water";
        const isLight = object.assetId === "nature_sun" || object.assetId === "symbol_light";
        const seed = hashString(object.id);
        const contactRotation = -5 + camera.yaw * 0.22 + object.rotation * 0.05;
        const pressureOpacity = (night ? 0.074 : rainy ? 0.082 : 0.067) * atmosphere * (isWater ? 0.42 : 1);
        const ridgeOpacity = (night ? 0.13 : rainy ? 0.17 : 0.2) * atmosphere * (isWater ? 1.1 : 1);
        const castOpacity = clamp((night ? 0.043 : rainy ? 0.052 : 0.064) * lift * (isLight ? 0.36 : 1), 0.018, night ? 0.075 : 0.105);

        return (
          <Group key={object.id} x={projected.x} y={projected.y} rotation={contactRotation} opacity={object.assetId === "nature_sun" ? 0.74 : 1}>
            <Ellipse
              x={footprintWidth * 0.08}
              y={footprintDepth * 0.12}
              radiusX={footprintWidth * 0.74 * broadness}
              radiusY={footprintDepth * 0.46 * depthness}
              fill={night ? "#071923" : rainy ? "#4c4636" : "#68481f"}
              opacity={pressureOpacity}
              shadowColor={night ? "#04131a" : "#422a12"}
              shadowBlur={night ? 10 : rainy ? 8 : 6}
              shadowOpacity={night ? 0.12 : 0.08}
            />
            <Ellipse
              x={-footprintWidth * 0.07}
              y={-footprintDepth * 0.25}
              radiusX={footprintWidth * 0.62 * broadness}
              radiusY={Math.max(2.6, footprintDepth * 0.18)}
              fill={night ? "#d2fff4" : rainy ? "#fbefcf" : "#fff0ba"}
              opacity={ridgeOpacity * (isWater ? 0.7 : 0.86)}
              rotation={-4}
            />
            <Line
              points={[
                -footprintWidth * 0.62 * broadness,
                -footprintDepth * 0.08,
                -footprintWidth * 0.22 * broadness,
                -footprintDepth * 0.34,
                footprintWidth * 0.18 * broadness,
                -footprintDepth * 0.27,
                footprintWidth * 0.6 * broadness,
                -footprintDepth * 0.02,
              ]}
              stroke={night ? "#c7fff4" : rainy ? "#ffe9b7" : "#fff2c0"}
              strokeWidth={clamp(footprintWidth * 0.018, 1.1, 3)}
              tension={0.48}
              lineCap="round"
              lineJoin="round"
              opacity={ridgeOpacity}
            />
            <Line
              points={[
                -footprintWidth * 0.52 * broadness,
                footprintDepth * 0.4,
                -footprintWidth * 0.1 * broadness,
                footprintDepth * 0.68,
                footprintWidth * 0.28 * broadness,
                footprintDepth * 0.58,
                footprintWidth * 0.6 * broadness,
                footprintDepth * 0.32,
              ]}
              stroke={night ? "#06131a" : rainy ? "#4a3a24" : "#5a3716"}
              strokeWidth={clamp(footprintWidth * 0.014, 0.9, 2.4)}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              opacity={(night ? 0.12 : 0.1) * atmosphere}
            />
            <Ellipse
              x={footprintWidth * 0.28 + lift * 3.5}
              y={footprintDepth * 0.17 + lift * 1.4}
              radiusX={footprintWidth * clamp(0.28 + lift * 0.05, 0.28, 0.46)}
              radiusY={Math.max(2.6, footprintDepth * clamp(0.16 + lift * 0.032, 0.16, 0.29))}
              fill={night ? "#020d14" : rainy ? "#263238" : "#2d1b0d"}
              opacity={castOpacity}
              rotation={-8}
              shadowColor={night ? "#020d14" : "#241507"}
              shadowBlur={night ? 16 : rainy ? 12 : 10}
              shadowOpacity={night ? 0.12 : 0.1}
            />
            {isWater ? (
              <Ellipse
                x={0}
                y={footprintDepth * 0.06}
                radiusX={footprintWidth * 0.82}
                radiusY={Math.max(4, footprintDepth * 0.34)}
                stroke={night ? "#8ff2ef" : "#c5ffff"}
                strokeWidth={1.4}
                opacity={night ? 0.14 : rainy ? 0.2 : 0.16}
              />
            ) : null}
            {Array.from({ length: 9 }, (_, index) => {
              const particleSeed = seed + index * 97;
              const angle = -0.2 + random(particleSeed) * Math.PI * 1.2;
              const distance = 0.24 + random(particleSeed + 11) * 0.56;
              const x = Math.cos(angle) * footprintWidth * broadness * distance;
              const y = Math.sin(angle) * footprintDepth * 0.72 * distance + footprintDepth * 0.13;
              const warm = index % 3 !== 2;
              return (
                <Circle
                  key={`contact-grain-${object.id}-${index}`}
                  x={x}
                  y={y}
                  radius={0.75 + random(particleSeed + 23) * 1.9}
                  fill={warm ? (night ? "#d4fff3" : rainy ? "#f7dfaf" : "#ffe4a8") : night ? "#071820" : "#715229"}
                  opacity={(warm ? 0.12 : 0.07) * atmosphere * (isWater ? 0.55 : 1)}
                />
              );
            })}
          </Group>
        );
      })}
    </Group>
  );
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function random(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}
