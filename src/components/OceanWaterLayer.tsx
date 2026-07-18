import Konva from "konva";
import { useEffect, useRef } from "react";
import { Circle, Ellipse, Group, Line, Rect } from "react-konva";
import type { SandboxCameraState, SandboxEnvironment } from "../types";
import { flattenProjectedPoints, getPointBounds, getProjectedIslandPoints, random } from "../utils/islandStage";
import { VIEW_HEIGHT, VIEW_WIDTH } from "../utils/projection";

interface OceanWaterLayerProps {
  camera: SandboxCameraState;
  environment: SandboxEnvironment;
}

const waveRows = Array.from({ length: 16 }, (_, index) => ({
  id: `ocean-wave-${index}`,
  y: -42 + index * 54,
  amplitude: 10 + random(30000 + index * 23) * 18,
  phase: random(30100 + index * 29) * Math.PI * 2,
  strokeWidth: 1 + random(30200 + index * 31) * 2.4,
  opacity: 0.08 + random(30300 + index * 37) * 0.15,
}));

const causticRows = Array.from({ length: 10 }, (_, index) => ({
  id: `ocean-caustic-${index}`,
  y: 24 + index * 67,
  amplitude: 7 + random(31000 + index * 19) * 12,
  phase: random(31100 + index * 23) * Math.PI * 2,
  opacity: 0.07 + random(31200 + index * 31) * 0.12,
}));

const rippleSeeds = Array.from({ length: 24 }, (_, index) => ({
  id: `ocean-ripple-${index}`,
  x: random(32000 + index * 31) * VIEW_WIDTH,
  y: random(32100 + index * 37) * VIEW_HEIGHT,
  radius: 8 + random(32200 + index * 41) * 26,
  opacity: 0.045 + random(32300 + index * 43) * 0.08,
}));

export function OceanWaterLayer({ camera, environment }: OceanWaterLayerProps): JSX.Element {
  const waveRef = useRef<Konva.Group | null>(null);
  const causticRef = useRef<Konva.Group | null>(null);
  const foamRef = useRef<Konva.Group | null>(null);
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const islandPoints = getProjectedIslandPoints(camera);
  const island = flattenProjectedPoints(islandPoints);
  const bounds = getPointBounds(islandPoints);
  const waterTop = night ? "#061522" : rainy ? "#82cfd5" : cloudy ? "#9fe2e4" : "#80f0ee";
  const waterMid = night ? "#09283c" : rainy ? "#4fb7c6" : cloudy ? "#62ccd2" : "#22c9d4";
  const waterDeep = night ? "#02101a" : rainy ? "#1d7188" : cloudy ? "#258da0" : "#087eaa";
  const highlight = night ? "rgba(182,241,239,0.16)" : "rgba(255,255,255,0.46)";

  useEffect(() => {
    const layer = waveRef.current?.getLayer();
    const animation = new Konva.Animation((frame) => {
      if (!frame) {
        return;
      }

      const time = frame.time / 1000;
      waveRef.current?.x(Math.sin(time * 0.38) * 18);
      waveRef.current?.y(Math.cos(time * 0.25) * 5);
      causticRef.current?.x(((time * 18) % 120) - 60);
      causticRef.current?.opacity((night ? 0.38 : 0.72) + Math.sin(time * 0.9) * 0.08);
      foamRef.current?.opacity((night ? 0.36 : rainy ? 0.58 : 0.78) + Math.sin(time * 1.25) * 0.08);
    }, layer ?? undefined);

    animation.start();
    return () => {
      animation.stop();
    };
  }, [night, rainy]);

  return (
    <Group listening={false}>
      <Rect
        x={0}
        y={0}
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        fillLinearGradientStartPoint={{ x: VIEW_WIDTH * 0.2, y: 0 }}
        fillLinearGradientEndPoint={{ x: VIEW_WIDTH * 0.85, y: VIEW_HEIGHT }}
        fillLinearGradientColorStops={[0, waterTop, 0.45, waterMid, 1, waterDeep]}
      />

      <Group opacity={night ? 0.34 : cloudy ? 0.62 : 0.8}>
        <Ellipse
          x={VIEW_WIDTH * 0.2}
          y={VIEW_HEIGHT * 0.12}
          radiusX={VIEW_WIDTH * 0.5}
          radiusY={VIEW_HEIGHT * 0.2}
          rotation={-8}
          fillRadialGradientStartPoint={{ x: 0, y: 0 }}
          fillRadialGradientStartRadius={1}
          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
          fillRadialGradientEndRadius={VIEW_WIDTH * 0.5}
          fillRadialGradientColorStops={[0, "rgba(255,255,255,0.38)", 0.52, "rgba(255,255,255,0.08)", 1, "rgba(255,255,255,0)"]}
        />
        <Ellipse
          x={VIEW_WIDTH * 0.82}
          y={VIEW_HEIGHT * 0.86}
          radiusX={VIEW_WIDTH * 0.42}
          radiusY={VIEW_HEIGHT * 0.25}
          rotation={10}
          fillRadialGradientStartPoint={{ x: 0, y: 0 }}
          fillRadialGradientStartRadius={1}
          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
          fillRadialGradientEndRadius={VIEW_WIDTH * 0.42}
          fillRadialGradientColorStops={[0, "rgba(255,255,255,0.22)", 0.54, "rgba(255,255,255,0.06)", 1, "rgba(255,255,255,0)"]}
        />
      </Group>

      <Group ref={waveRef}>
        {waveRows.map((wave) => (
          <Line
            key={wave.id}
            points={makeWavePoints(wave.y, wave.amplitude, wave.phase)}
            tension={0.45}
            stroke={highlight}
            strokeWidth={wave.strokeWidth}
            opacity={wave.opacity * (night ? 0.48 : rainy ? 0.66 : 1)}
            lineCap="round"
            lineJoin="round"
          />
        ))}
      </Group>

      <Group ref={causticRef}>
        {causticRows.map((wave) => (
          <Line
            key={wave.id}
            points={makeWavePoints(wave.y, wave.amplitude, wave.phase, 9)}
            tension={0.6}
            stroke={night ? "rgba(108,212,217,0.13)" : "rgba(242,255,235,0.32)"}
            strokeWidth={1.1}
            opacity={wave.opacity * (rainy ? 0.55 : 1)}
            dash={[18, 28]}
            lineCap="round"
          />
        ))}
      </Group>

      <Line
        points={island}
        closed
        stroke={night ? "rgba(61,159,178,0.24)" : "rgba(255,255,255,0.42)"}
        strokeWidth={34}
        opacity={night ? 0.18 : rainy ? 0.34 : 0.54}
        lineJoin="round"
      />
      <Group ref={foamRef}>
        <Line
          points={island}
          closed
          stroke={night ? "rgba(202,250,246,0.24)" : "rgba(255,255,255,0.7)"}
          strokeWidth={10}
          opacity={rainy ? 0.48 : 0.74}
          lineJoin="round"
        />
        <Line
          points={island}
          closed
          stroke={night ? "rgba(129,221,223,0.16)" : "rgba(195,255,249,0.44)"}
          strokeWidth={25}
          opacity={rainy ? 0.26 : 0.42}
          dash={[20, 18]}
          lineJoin="round"
        />
      </Group>

      {rippleSeeds.map((ripple, index) => (
        <Ellipse
          key={ripple.id}
          x={ripple.x}
          y={ripple.y}
          radiusX={ripple.radius * (1.6 + random(33000 + index * 13))}
          radiusY={ripple.radius * 0.36}
          rotation={-12 + random(33100 + index * 17) * 24}
          stroke={rainy ? "rgba(233,255,255,0.22)" : night ? "rgba(150,236,240,0.1)" : "rgba(255,255,255,0.16)"}
          strokeWidth={rainy ? 1.4 : 0.9}
          opacity={ripple.opacity * (rainy ? 1.8 : night ? 0.55 : 1)}
        />
      ))}

      <Ellipse
        x={bounds.minX + (bounds.maxX - bounds.minX) * 0.5}
        y={bounds.maxY + 34}
        radiusX={(bounds.maxX - bounds.minX) * 0.54}
        radiusY={54}
        fill={night ? "rgba(0, 4, 10, 0.2)" : "rgba(3, 87, 94, 0.12)"}
        opacity={rainy ? 0.24 : 0.18}
      />
    </Group>
  );
}

function makeWavePoints(y: number, amplitude: number, phase: number, segments = 8): number[] {
  const points: number[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const ratio = index / segments;
    const x = -80 + ratio * (VIEW_WIDTH + 160);
    const waveY =
      y +
      Math.sin(ratio * Math.PI * 2.2 + phase) * amplitude +
      Math.sin(ratio * Math.PI * 5.1 + phase * 0.7) * amplitude * 0.22;
    points.push(x, waveY);
  }
  return points;
}
