import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import type Konva from "konva";
import { Circle, Ellipse, Group, Line, Path } from "react-konva";
import type { SandboxEnvironment } from "../types";
import { VIEW_HEIGHT, VIEW_WIDTH } from "../utils/projection";

interface EnvironmentBackdropProps {
  environment: SandboxEnvironment;
}

interface BackdropStar {
  id: string;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  twinkle: number;
}

interface BackdropCloud {
  id: string;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  drift: number;
}

type MoonKind = "new" | "crescent" | "quarter" | "gibbous" | "full";

interface MoonAppearance {
  kind: MoonKind;
  waxing: boolean;
  illumination: number;
}

const backdropStars = createBackdropStars(78);
const dayClouds: BackdropCloud[] = [
  { id: "day-cloud-left", x: 152, y: 92, scale: 1.08, opacity: 0.44, drift: 8 },
  { id: "day-cloud-right", x: 908, y: 126, scale: 0.88, opacity: 0.36, drift: -10 },
];
const nightClouds: BackdropCloud[] = [
  { id: "night-cloud-left", x: 178, y: 104, scale: 1, opacity: 0.24, drift: 7 },
  { id: "night-cloud-right", x: 894, y: 92, scale: 0.86, opacity: 0.2, drift: -6 },
];
const stormClouds: BackdropCloud[] = [
  { id: "storm-cloud-left", x: 180, y: 88, scale: 1.12, opacity: 0.52, drift: 5 },
  { id: "storm-cloud-center", x: 554, y: 96, scale: 1.18, opacity: 0.46, drift: -6 },
  { id: "storm-cloud-right", x: 920, y: 114, scale: 1.04, opacity: 0.42, drift: 7 },
];

export function EnvironmentBackdrop({ environment }: EnvironmentBackdropProps): JSX.Element {
  const starsRef = useRef<Konva.Group | null>(null);
  const cloudsRef = useRef<Konva.Group | null>(null);
  const celestialRef = useRef<Konva.Group | null>(null);
  const moon = useMemo(() => getMoonAppearance(new Date()), []);
  const isNight = environment.light === "night";
  const isCloudy = environment.weather === "cloudy";
  const isRainy = environment.weather === "rainy";

  useEffect(() => {
    let animationFrame = 0;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = (now - startedAt) / 1000;

      if (starsRef.current) {
        starsRef.current.opacity(isNight ? 0.72 + Math.sin(elapsed * 1.08) * 0.12 : 0);
      }

      if (cloudsRef.current) {
        cloudsRef.current.x(Math.sin(elapsed * 0.14) * 10);
      }

      if (celestialRef.current) {
        celestialRef.current.y(Math.sin(elapsed * 0.34) * 2.2);
        celestialRef.current.opacity(isNight ? 0.92 + Math.sin(elapsed * 0.82) * 0.04 : 1);
      }

      const layer = starsRef.current?.getLayer() ?? cloudsRef.current?.getLayer() ?? celestialRef.current?.getLayer();
      layer?.batchDraw();
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isNight]);

  if (isNight) {
    return (
      <Group listening={false}>
        <NightGlow weather={environment.weather} />
        <StarField nodeRef={starsRef} muted={isCloudy || isRainy} />
        <Group ref={celestialRef} listening={false}>
          <Moon appearance={moon} muted={isCloudy || isRainy} />
        </Group>
        <CloudBank
          nodeRef={cloudsRef}
          clouds={isCloudy || isRainy ? stormClouds : nightClouds}
          variant={isCloudy || isRainy ? "storm-night" : "night"}
        />
      </Group>
    );
  }

  if (isCloudy || isRainy) {
    return (
      <Group listening={false}>
        <DayAmbient weather={environment.weather} />
        <CloudBank nodeRef={cloudsRef} clouds={stormClouds} variant={isRainy ? "rain" : "storm-day"} />
      </Group>
    );
  }

  return (
    <Group listening={false}>
      <DayAmbient weather={environment.weather} />
      <Group ref={celestialRef} listening={false}>
        <Sun />
      </Group>
      <CloudBank nodeRef={cloudsRef} clouds={dayClouds} variant="day" />
    </Group>
  );
}

function NightGlow({ weather }: { weather: SandboxEnvironment["weather"] }): JSX.Element {
  const opacity = weather === "rainy" ? 0.13 : weather === "cloudy" ? 0.16 : 0.22;
  return (
    <Group listening={false}>
      <Ellipse x={VIEW_WIDTH * 0.78} y={94} radiusX={220} radiusY={86} fill="#8eb6d8" opacity={opacity} />
      <Ellipse x={VIEW_WIDTH * 0.18} y={156} radiusX={190} radiusY={62} fill="#6f92b2" opacity={opacity * 0.56} />
    </Group>
  );
}

function DayAmbient({ weather }: { weather: SandboxEnvironment["weather"] }): JSX.Element {
  const warm = weather === "sunny";
  return (
    <Group listening={false}>
      <Ellipse
        x={VIEW_WIDTH * 0.77}
        y={96}
        radiusX={warm ? 260 : 190}
        radiusY={warm ? 112 : 76}
        fill={warm ? "#fff3bd" : "#dbe3de"}
        opacity={warm ? 0.28 : 0.18}
      />
      <Ellipse x={VIEW_WIDTH * 0.18} y={156} radiusX={190} radiusY={64} fill="#ffffff" opacity={warm ? 0.18 : 0.1} />
    </Group>
  );
}

function StarField({
  nodeRef,
  muted,
}: {
  nodeRef: MutableRefObject<Konva.Group | null>;
  muted: boolean;
}): JSX.Element {
  return (
    <Group ref={nodeRef} listening={false} opacity={muted ? 0.26 : 0.8}>
      {backdropStars.map((star, index) => (
        <Group key={star.id} listening={false} opacity={muted ? star.opacity * 0.42 : star.opacity}>
          <Circle x={star.x} y={star.y} radius={star.radius} fill="#fff5c8" opacity={0.78 + star.twinkle * 0.18} />
          {index % 7 === 0 ? (
            <>
              <Line
                points={[star.x - star.radius * 2.5, star.y, star.x + star.radius * 2.5, star.y]}
                stroke="#fff7d8"
                strokeWidth={0.75}
                opacity={0.36}
                lineCap="round"
              />
              <Line
                points={[star.x, star.y - star.radius * 2.5, star.x, star.y + star.radius * 2.5]}
                stroke="#fff7d8"
                strokeWidth={0.75}
                opacity={0.3}
                lineCap="round"
              />
            </>
          ) : null}
        </Group>
      ))}
    </Group>
  );
}

function Sun(): JSX.Element {
  return (
    <Group x={904} y={94} listening={false}>
      <Circle radius={56} fill="#ffe7a3" opacity={0.18} />
      <Circle radius={36} fill="#ffd86c" opacity={0.52} />
      <Circle radius={24} fill="#fff0a8" opacity={0.88} />
      {Array.from({ length: 10 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 10;
        const start = { x: Math.cos(angle) * 43, y: Math.sin(angle) * 43 };
        const end = { x: Math.cos(angle) * 60, y: Math.sin(angle) * 60 };
        return (
          <Line
            key={`sun-ray-${index}`}
            points={[start.x, start.y, end.x, end.y]}
            stroke="#ffe39a"
            strokeWidth={2}
            opacity={0.34}
            lineCap="round"
          />
        );
      })}
    </Group>
  );
}

function Moon({ appearance, muted }: { appearance: MoonAppearance; muted: boolean }): JSX.Element {
  if (appearance.kind === "new") {
    return <Group listening={false} />;
  }

  const scaleX = appearance.waxing ? 1 : -1;
  const opacity = muted ? 0.52 : 0.92;

  return (
    <Group x={904} y={96} listening={false} opacity={opacity}>
      <Circle radius={62} fill="#c9d8e7" opacity={0.12} />
      <Circle radius={42} fill="#e8e1bc" opacity={0.18} />
      <Group scaleX={scaleX}>
        {appearance.kind === "full" ? (
          <Circle radius={32} fill="#f5edc9" shadowColor="#e8e6c8" shadowBlur={18} shadowOpacity={0.18} />
        ) : (
          <Path
            data={getMoonPath(appearance.kind)}
            fill="#f5edc9"
            shadowColor="#e8e6c8"
            shadowBlur={16}
            shadowOpacity={0.16}
          />
        )}
      </Group>
      <Circle x={-10} y={-8} radius={3.5} fill="#d3c89d" opacity={0.28} />
      <Circle x={9} y={8} radius={2.2} fill="#d3c89d" opacity={0.22} />
      <Circle x={18} y={-11} radius={1.8} fill="#d3c89d" opacity={0.2} />
    </Group>
  );
}

function CloudBank({
  nodeRef,
  clouds,
  variant,
}: {
  nodeRef: MutableRefObject<Konva.Group | null>;
  clouds: BackdropCloud[];
  variant: "day" | "night" | "storm-day" | "storm-night" | "rain";
}): JSX.Element {
  return (
    <Group ref={nodeRef} listening={false}>
      {clouds.map((cloud) => (
        <SoftCloud key={cloud.id} cloud={cloud} variant={variant} />
      ))}
    </Group>
  );
}

function SoftCloud({ cloud, variant }: { cloud: BackdropCloud; variant: "day" | "night" | "storm-day" | "storm-night" | "rain" }): JSX.Element {
  const isStorm = variant === "storm-day" || variant === "storm-night" || variant === "rain";
  const isNight = variant === "night" || variant === "storm-night";
  const fill = isStorm ? (isNight ? "#2b3944" : "#6d7c7b") : isNight ? "#405463" : "#ffffff";
  const shade = isStorm ? (isNight ? "#182630" : "#4f5d5d") : isNight ? "#263b4b" : "#dfe9e7";
  const highlight = isStorm ? (isNight ? "#495b66" : "#899694") : isNight ? "#6f8795" : "#ffffff";

  return (
    <Group x={cloud.x} y={cloud.y} scaleX={cloud.scale} scaleY={cloud.scale} opacity={cloud.opacity} listening={false}>
      <Ellipse x={-54} y={10} radiusX={72} radiusY={24} fill={shade} opacity={0.52} />
      <Circle x={-46} y={0} radius={24} fill={fill} />
      <Circle x={-18} y={-15} radius={34} fill={highlight} opacity={0.84} />
      <Circle x={24} y={-6} radius={30} fill={fill} />
      <Circle x={58} y={7} radius={22} fill={shade} opacity={0.86} />
      <Ellipse x={14} y={18} radiusX={84} radiusY={23} fill={fill} />
      {isStorm ? (
        <Ellipse x={8} y={28} radiusX={76} radiusY={10} fill={isNight ? "#111d25" : "#445252"} opacity={0.26} />
      ) : null}
    </Group>
  );
}

function getMoonPath(kind: Exclude<MoonKind, "new" | "full">): string {
  if (kind === "crescent") {
    return "M 0 -32 C 22 -28 32 -16 32 0 C 32 16 22 28 0 32 C 12 20 12 -20 0 -32 Z";
  }
  if (kind === "quarter") {
    return "M 0 -32 A 32 32 0 0 1 0 32 L 0 -32 Z";
  }
  return "M -9 -32 A 32 32 0 1 1 -9 32 C 17 23 27 12 27 0 C 27 -12 17 -23 -9 -32 Z";
}

function getMoonAppearance(date: Date): MoonAppearance {
  const synodicMonth = 29.53058867;
  const knownNewMoonUtc = Date.UTC(2000, 0, 6, 18, 14);
  const currentUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const days = (currentUtc - knownNewMoonUtc) / 86_400_000;
  const age = ((days % synodicMonth) + synodicMonth) % synodicMonth;
  const phase = age / synodicMonth;
  const illumination = (1 - Math.cos(Math.PI * 2 * phase)) / 2;
  const waxing = phase < 0.5;

  if (illumination < 0.06) {
    return { kind: "new", waxing, illumination };
  }
  if (illumination < 0.34) {
    return { kind: "crescent", waxing, illumination };
  }
  if (illumination < 0.66) {
    return { kind: "quarter", waxing, illumination };
  }
  if (illumination < 0.94) {
    return { kind: "gibbous", waxing, illumination };
  }
  return { kind: "full", waxing, illumination };
}

function createBackdropStars(count: number): BackdropStar[] {
  let seed = 9029;
  return Array.from({ length: count }, (_, index) => {
    seed = (seed * 9301 + 49297) % 233280;
    const x = (seed / 233280) * VIEW_WIDTH;
    seed = (seed * 9301 + 49297) % 233280;
    const yBias = seed / 233280;
    const y = yBias < 0.72 ? 24 + yBias * 210 : 24 + yBias * VIEW_HEIGHT * 0.42;
    seed = (seed * 9301 + 49297) % 233280;
    const tone = seed / 233280;

    return {
      id: `backdrop-star-${index}`,
      x,
      y,
      radius: 0.65 + tone * 1.15,
      opacity: 0.32 + tone * 0.48,
      twinkle: tone,
    };
  });
}
