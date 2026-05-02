import { useEffect, useRef, type MutableRefObject } from "react";
import type Konva from "konva";
import { Circle, Ellipse, Group, Line, Rect } from "react-konva";
import { getEnvironmentProfile } from "../data/environment";
import type { SandboxEnvironment } from "../types";
import { VIEW_HEIGHT, VIEW_WIDTH } from "../utils/projection";

interface WeatherLayerProps {
  environment: SandboxEnvironment;
}

interface RainDrop {
  id: string;
  x: number;
  y: number;
  length: number;
  opacity: number;
}

interface StarPoint {
  id: string;
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

const rainDrops = createRainDrops(84);
const stars = createStars(46);

export function WeatherLayer({ environment }: WeatherLayerProps): JSX.Element {
  const profile = getEnvironmentProfile(environment);
  const rainRef = useRef<Konva.Group | null>(null);
  const mistRef = useRef<Konva.Group | null>(null);
  const starRef = useRef<Konva.Group | null>(null);

  useEffect(() => {
    if (profile.rainOpacity <= 0 && profile.mistOpacity <= 0 && profile.starOpacity <= 0) {
      return undefined;
    }

    let animationFrame = 0;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = (now - startedAt) / 1000;

      if (rainRef.current) {
        const slide = (elapsed * 78) % 72;
        rainRef.current.y(slide);
        rainRef.current.x(-slide * 0.32);
      }

      if (mistRef.current) {
        mistRef.current.x(Math.sin(elapsed * 0.28) * 14);
      }

      if (starRef.current) {
        starRef.current.opacity(profile.starOpacity * (0.82 + Math.sin(elapsed * 1.25) * 0.18));
      }

      const layer = rainRef.current?.getLayer() ?? mistRef.current?.getLayer() ?? starRef.current?.getLayer();
      layer?.batchDraw();
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [profile.mistOpacity, profile.rainOpacity, profile.starOpacity]);

  return (
    <Group listening={false}>
      {profile.mistOpacity > 0 ? <Mist opacity={profile.mistOpacity} nodeRef={mistRef} /> : null}
      {profile.starOpacity > 0 ? <Stars opacity={profile.starOpacity} nodeRef={starRef} /> : null}
      <Rect
        x={0}
        y={0}
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        fill={profile.globalTint}
        opacity={profile.globalTintOpacity}
        listening={false}
      />
      {profile.rainOpacity > 0 ? <Rain opacity={profile.rainOpacity} nodeRef={rainRef} /> : null}
      <Vignette opacity={profile.vignetteOpacity} />
    </Group>
  );
}

function Mist({
  opacity,
  nodeRef,
}: {
  opacity: number;
  nodeRef: MutableRefObject<Konva.Group | null>;
}): JSX.Element {
  return (
    <Group ref={nodeRef} listening={false}>
      {[
        { x: 230, y: 168, rx: 280, ry: 58 },
        { x: 790, y: 238, rx: 260, ry: 52 },
        { x: 540, y: 560, rx: 340, ry: 70 },
      ].map((cloud, index) => (
        <Ellipse
          key={`mist-${index}`}
          x={cloud.x}
          y={cloud.y}
          radiusX={cloud.rx}
          radiusY={cloud.ry}
          fill="#e8f2ed"
          opacity={opacity}
          rotation={index % 2 === 0 ? -6 : 8}
        />
      ))}
    </Group>
  );
}

function Rain({
  opacity,
  nodeRef,
}: {
  opacity: number;
  nodeRef: MutableRefObject<Konva.Group | null>;
}): JSX.Element {
  return (
    <Group ref={nodeRef} listening={false}>
      {rainDrops.map((drop) => (
        <Line
          key={drop.id}
          points={[drop.x, drop.y, drop.x + 16, drop.y + drop.length]}
          stroke="#d7f4ff"
          strokeWidth={1.4}
          opacity={opacity * drop.opacity}
          lineCap="round"
        />
      ))}
    </Group>
  );
}

function Stars({
  opacity,
  nodeRef,
}: {
  opacity: number;
  nodeRef: MutableRefObject<Konva.Group | null>;
}): JSX.Element {
  return (
    <Group ref={nodeRef} listening={false} opacity={opacity}>
      {stars.map((star) => (
        <Circle
          key={star.id}
          x={star.x}
          y={star.y}
          radius={star.radius}
          fill="#fff4ca"
          opacity={star.opacity}
        />
      ))}
    </Group>
  );
}

function Vignette({ opacity }: { opacity: number }): JSX.Element {
  if (opacity <= 0) {
    return <Group listening={false} />;
  }

  return (
    <Group listening={false}>
      <Rect
        x={0}
        y={0}
        width={VIEW_WIDTH}
        height={170}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: 170 }}
        fillLinearGradientColorStops={[0, "#07131c", 1, "rgba(7, 19, 28, 0)"]}
        opacity={opacity}
      />
      <Rect
        x={0}
        y={VIEW_HEIGHT - 190}
        width={VIEW_WIDTH}
        height={190}
        fillLinearGradientStartPoint={{ x: 0, y: VIEW_HEIGHT }}
        fillLinearGradientEndPoint={{ x: 0, y: VIEW_HEIGHT - 190 }}
        fillLinearGradientColorStops={[0, "#07131c", 1, "rgba(7, 19, 28, 0)"]}
        opacity={opacity * 0.92}
      />
      <Rect
        x={0}
        y={0}
        width={210}
        height={VIEW_HEIGHT}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 210, y: 0 }}
        fillLinearGradientColorStops={[0, "#07131c", 1, "rgba(7, 19, 28, 0)"]}
        opacity={opacity * 0.72}
      />
      <Rect
        x={VIEW_WIDTH - 210}
        y={0}
        width={210}
        height={VIEW_HEIGHT}
        fillLinearGradientStartPoint={{ x: VIEW_WIDTH, y: 0 }}
        fillLinearGradientEndPoint={{ x: VIEW_WIDTH - 210, y: 0 }}
        fillLinearGradientColorStops={[0, "#07131c", 1, "rgba(7, 19, 28, 0)"]}
        opacity={opacity * 0.72}
      />
    </Group>
  );
}

function createRainDrops(count: number): RainDrop[] {
  let seed = 7531;
  return Array.from({ length: count }, (_, index) => {
    seed = (seed * 9301 + 49297) % 233280;
    const x = (seed / 233280) * (VIEW_WIDTH + 160) - 80;
    seed = (seed * 9301 + 49297) % 233280;
    const y = (seed / 233280) * (VIEW_HEIGHT + 120) - 80;
    seed = (seed * 9301 + 49297) % 233280;

    return {
      id: `rain-${index}`,
      x,
      y,
      length: 24 + (seed / 233280) * 26,
      opacity: 0.42 + (seed / 233280) * 0.58,
    };
  });
}

function createStars(count: number): StarPoint[] {
  let seed = 4909;
  return Array.from({ length: count }, (_, index) => {
    seed = (seed * 9301 + 49297) % 233280;
    const x = (seed / 233280) * VIEW_WIDTH;
    seed = (seed * 9301 + 49297) % 233280;
    const y = (seed / 233280) * VIEW_HEIGHT * 0.52;
    seed = (seed * 9301 + 49297) % 233280;

    return {
      id: `star-${index}`,
      x,
      y,
      radius: 0.8 + (seed / 233280) * 1.3,
      opacity: 0.35 + (seed / 233280) * 0.65,
    };
  });
}
