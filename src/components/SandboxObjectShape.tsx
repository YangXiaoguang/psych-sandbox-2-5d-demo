import { Circle, Ellipse, Group, Line, Path, Rect, Star } from "react-konva";
import type { RiskTag } from "../types";

interface SandboxObjectShapeProps {
  assetId: string;
  width: number;
  height: number;
  riskTag: RiskTag;
}

interface IsoBlockProps {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  top: string;
  left: string;
  right: string;
  stroke?: string;
}

export function SandboxObjectShape({
  assetId,
  width,
  height,
  riskTag,
}: SandboxObjectShapeProps): JSX.Element {
  const palette = getPalette(riskTag);

  return (
    <Group>
      <Group x={height * 0.2} y={height * 0.11} rotation={-8} listening={false}>
        <Ellipse
          radiusX={width * 0.5}
          radiusY={height * 0.13}
          fill="#2b2318"
          opacity={0.22}
          shadowColor="#2b2318"
          shadowBlur={14}
          shadowOpacity={0.2}
        />
      </Group>
      <AssetModel assetId={assetId} width={width} height={height} palette={palette} />
    </Group>
  );
}

function AssetModel({
  assetId,
  width,
  height,
  palette,
}: {
  assetId: string;
  width: number;
  height: number;
  palette: ReturnType<typeof getPalette>;
}): JSX.Element {
  switch (assetId) {
    case "env_house":
      return <IsoHouse width={width} height={height} />;
    case "env_bridge":
      return <IsoBridge width={width} height={height} />;
    case "env_fence":
      return <IsoFence width={width} height={height} />;
    case "env_tower":
      return <IsoTower width={width} height={height} />;
    case "nature_tree":
      return <IsoTree width={width} height={height} />;
    case "nature_water":
      return <IsoWater width={width} height={height} />;
    case "nature_rock":
      return <IsoRock width={width} height={height} />;
    case "nature_sun":
      return <IsoSun width={width} />;
    case "animal_dog":
      return <IsoAnimal width={width} height={height} body="#b97845" head="#d29255" ear="#765036" />;
    case "animal_bird":
      return <IsoBird width={width} height={height} />;
    case "animal_fish":
      return <IsoFish width={width} height={height} />;
    case "animal_lion":
      return <IsoLion width={width} height={height} />;
    case "person_child":
      return <IsoPerson width={width} height={height} cloth="#57a7d7" skin="#f0bb78" small />;
    case "person_adult":
      return <IsoPerson width={width} height={height} cloth="#376b8d" skin="#d89a67" />;
    case "person_elder":
      return <IsoPerson width={width} height={height} cloth="#81766e" skin="#d7ae83" cane />;
    case "symbol_robot":
      return <IsoRobot width={width} height={height} />;
    case "symbol_skull":
      return <IsoSkull width={width} height={height} />;
    case "symbol_monster":
      return <IsoMonster width={width} height={height} accent={palette.accent} />;
    case "symbol_light":
      return <IsoLamp width={width} height={height} />;
    default:
      return <IsoBlock x={0} y={0} w={width * 0.74} d={height * 0.42} h={height * 0.52} top={palette.top} left={palette.left} right={palette.right} />;
  }
}

function IsoBlock({ x, y, w, d, h, top, left, right, stroke = "#5d5146" }: IsoBlockProps): JSX.Element {
  const topFace = [x, y - h - d * 0.5, x + w * 0.5, y - h, x, y - h + d * 0.5, x - w * 0.5, y - h];
  const rightFace = [x + w * 0.5, y - h, x, y - h + d * 0.5, x, y + d * 0.5, x + w * 0.5, y];
  const leftFace = [x - w * 0.5, y - h, x, y - h + d * 0.5, x, y + d * 0.5, x - w * 0.5, y];

  return (
    <Group>
      <Line points={leftFace} closed fill={left} stroke={stroke} strokeWidth={1.8} lineJoin="round" />
      <Line points={rightFace} closed fill={right} stroke={stroke} strokeWidth={1.8} lineJoin="round" />
      <Line points={topFace} closed fill={top} stroke={stroke} strokeWidth={1.8} lineJoin="round" />
      <Line points={[x - w * 0.34, y - h - d * 0.08, x - w * 0.08, y - h - d * 0.22]} stroke="#ffffff" strokeWidth={2.2} opacity={0.32} lineCap="round" />
    </Group>
  );
}

function IsoHouse({ width, height }: { width: number; height: number }): JSX.Element {
  const w = width * 0.88;
  const d = height * 0.5;
  const h = height * 0.52;
  return (
    <Group y={height * 0.12}>
      <IsoBlock x={0} y={0} w={w} d={d} h={h} top="#f3d29c" left="#dca96e" right="#b97a4e" stroke="#704629" />
      <Roof w={w * 1.08} d={d * 1.08} y={-h} />
      <IsoWindow x={-w * 0.22} y={-h * 0.43} />
      <IsoWindow x={w * 0.2} y={-h * 0.35} />
      <Rect x={-8} y={-h * 0.22} width={16} height={h * 0.46} cornerRadius={3} fill="#74472b" stroke="#442a1d" strokeWidth={1.5} />
    </Group>
  );
}

function Roof({ w, d, y }: { w: number; d: number; y: number }): JSX.Element {
  const ridgeY = y - d * 0.62;
  return (
    <Group>
      <Line points={[0, ridgeY, w * 0.52, y, 0, y + d * 0.52, -w * 0.52, y]} closed fill="#d9513e" stroke="#71352c" strokeWidth={2} />
      <Line points={[0, ridgeY, w * 0.52, y, 0, y + d * 0.52]} closed fill="#b64135" opacity={0.72} />
      <Line points={[0, ridgeY, -w * 0.52, y, 0, y + d * 0.52]} closed fill="#ef6a4d" opacity={0.82} />
    </Group>
  );
}

function IsoWindow({ x, y }: { x: number; y: number }): JSX.Element {
  return <Rect x={x - 8} y={y - 12} width={16} height={20} cornerRadius={3} fill="#9dd5e2" stroke="#f7f0dc" strokeWidth={2} />;
}

function IsoBridge({ width, height }: { width: number; height: number }): JSX.Element {
  const w = width * 0.86;
  return (
    <Group y={height * 0.05}>
      <IsoBlock x={0} y={0} w={w} d={height * 0.32} h={height * 0.18} top="#c89a62" left="#8a6040" right="#6e4b34" stroke="#5a3d2a" />
      {[-0.3, 0, 0.3].map((ratio) => (
        <Rect key={`bridge-post-${ratio}`} x={w * ratio - 5} y={-height * 0.58} width={10} height={height * 0.48} cornerRadius={4} fill="#7b573a" stroke="#4d3424" strokeWidth={1.4} />
      ))}
      <Path data={`M${-w * 0.42} ${-height * 0.34} C${-w * 0.14} ${-height * 0.72} ${w * 0.14} ${-height * 0.72} ${w * 0.42} ${-height * 0.34}`} stroke="#b98754" strokeWidth={8} lineCap="round" />
    </Group>
  );
}

function IsoFence({ width, height }: { width: number; height: number }): JSX.Element {
  const w = width * 0.9;
  return (
    <Group y={height * 0.14}>
      <IsoBlock x={0} y={0} w={w} d={height * 0.18} h={height * 0.12} top="#c9975d" left="#9e6f43" right="#765033" stroke="#5d3a24" />
      {[-0.38, -0.18, 0.02, 0.22, 0.42].map((ratio) => (
        <IsoBlock key={`post-${ratio}`} x={w * ratio} y={-height * 0.03} w={width * 0.1} d={height * 0.18} h={height * 0.58} top="#f2bd7a" left="#c38750" right="#9c623b" stroke="#764928" />
      ))}
      <Line points={[-w * 0.48, -height * 0.42, w * 0.46, -height * 0.3]} stroke="#dca36d" strokeWidth={7} lineCap="round" />
      <Line points={[-w * 0.48, -height * 0.22, w * 0.46, -height * 0.1]} stroke="#a16d42" strokeWidth={7} lineCap="round" />
    </Group>
  );
}

function IsoTower({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group y={height * 0.08}>
      <IsoBlock x={0} y={0} w={width * 0.52} d={height * 0.34} h={height * 0.86} top="#d7d0b8" left="#9fa7a6" right="#7f898d" stroke="#5f676a" />
      <Roof w={width * 0.68} d={height * 0.28} y={-height * 0.86} />
      <Rect x={-8} y={-height * 0.44} width={16} height={26} cornerRadius={3} fill="#f6d873" stroke="#5f676a" strokeWidth={1.5} />
    </Group>
  );
}

function IsoTree({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group y={height * 0.1}>
      <IsoBlock x={0} y={0} w={width * 0.18} d={height * 0.22} h={height * 0.42} top="#b78245" left="#8b5d34" right="#684528" stroke="#51351f" />
      <TreeTier y={-height * 0.46} w={width * 0.84} color="#45b96b" />
      <TreeTier y={-height * 0.7} w={width * 0.7} color="#6fde88" />
      <TreeTier y={-height * 0.92} w={width * 0.54} color="#a9f08e" />
    </Group>
  );
}

function TreeTier({ y, w, color }: { y: number; w: number; color: string }): JSX.Element {
  return (
    <Group>
      <Line points={[0, y - w * 0.34, w * 0.5, y, 0, y + w * 0.2, -w * 0.5, y]} closed fill={color} stroke="#247447" strokeWidth={2.2} />
      <Line points={[0, y - w * 0.34, -w * 0.5, y, 0, y + w * 0.2]} closed fill="#8df58c" opacity={0.2} />
      <Line points={[0, y - w * 0.34, w * 0.5, y, 0, y + w * 0.2]} closed fill="#1f7d4a" opacity={0.18} />
    </Group>
  );
}

function IsoWater({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group y={height * 0.08}>
      <Ellipse radiusX={width * 0.48} radiusY={height * 0.28} fill="#41a9c2" stroke="#e8fdff" strokeWidth={4} />
      <Ellipse y={height * 0.08} radiusX={width * 0.42} radiusY={height * 0.14} fill="#1c7d9d" opacity={0.48} />
      <Path data={`M${-width * 0.32} 0 C${-width * 0.15} ${-height * 0.12} ${width * 0.08} ${height * 0.12} ${width * 0.32} ${-height * 0.04}`} stroke="#dffcff" strokeWidth={5} lineCap="round" opacity={0.8} />
    </Group>
  );
}

function IsoRock({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group y={height * 0.1}>
      <Line points={[0, -height * 0.5, width * 0.44, -height * 0.1, width * 0.22, height * 0.18, -width * 0.3, height * 0.16, -width * 0.46, -height * 0.16]} closed fill="#969d9b" stroke="#626c6b" strokeWidth={2} />
      <Line points={[0, -height * 0.5, width * 0.44, -height * 0.1, width * 0.02, -height * 0.05]} closed fill="#c0c5c1" opacity={0.62} />
      <Line points={[0, -height * 0.5, -width * 0.46, -height * 0.16, width * 0.02, -height * 0.05]} closed fill="#737d7b" opacity={0.5} />
    </Group>
  );
}

function IsoSun({ width }: { width: number }): JSX.Element {
  return (
    <Group>
      <Star numPoints={12} innerRadius={width * 0.28} outerRadius={width * 0.48} fill="#f7b941" stroke="#c17926" strokeWidth={2} shadowColor="#ffd566" shadowBlur={16} shadowOpacity={0.28} />
      <Circle radius={width * 0.28} fillRadialGradientStartPoint={{ x: -8, y: -10 }} fillRadialGradientStartRadius={2} fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientEndRadius={width * 0.3} fillRadialGradientColorStops={[0, "#fff6a6", 0.42, "#ffd25a", 1, "#e58b28"]} />
    </Group>
  );
}

function IsoPerson({ width, height, cloth, skin, small = false, cane = false }: { width: number; height: number; cloth: string; skin: string; small?: boolean; cane?: boolean }): JSX.Element {
  const s = small ? 0.86 : 1;
  return (
    <Group y={height * 0.08} scaleX={s} scaleY={s}>
      <IsoBlock x={0} y={0} w={width * 0.36} d={height * 0.22} h={height * 0.48} top={lighten(cloth)} left={cloth} right={darken(cloth)} stroke="#4b3a31" />
      <Sphere x={0} y={-height * 0.62} r={width * 0.2} color={skin} />
      <IsoBlock x={-width * 0.16} y={height * 0.14} w={width * 0.11} d={height * 0.12} h={height * 0.2} top="#6c4b35" left="#5c3d2c" right="#402b21" />
      <IsoBlock x={width * 0.16} y={height * 0.14} w={width * 0.11} d={height * 0.12} h={height * 0.2} top="#6c4b35" left="#5c3d2c" right="#402b21" />
      {cane ? <Line points={[width * 0.34, -height * 0.42, width * 0.44, height * 0.18]} stroke="#5b3824" strokeWidth={4} lineCap="round" /> : null}
    </Group>
  );
}

function IsoAnimal({ width, height, body, head, ear }: { width: number; height: number; body: string; head: string; ear: string }): JSX.Element {
  return (
    <Group y={height * 0.08}>
      <Ellipse x={-width * 0.05} y={-height * 0.2} radiusX={width * 0.34} radiusY={height * 0.23} fillRadialGradientStartPoint={{ x: -width * 0.14, y: -height * 0.1 }} fillRadialGradientStartRadius={2} fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientEndRadius={width * 0.5} fillRadialGradientColorStops={[0, lighten(body), 0.52, body, 1, darken(body)]} stroke="#704a2d" strokeWidth={2} />
      <Sphere x={width * 0.32} y={-height * 0.36} r={height * 0.2} color={head} />
      <Line points={[width * 0.21, -height * 0.53, width * 0.15, -height * 0.72, width * 0.35, -height * 0.57]} closed fill={ear} stroke="#704a2d" strokeWidth={1.5} />
      <Circle x={width * 0.39} y={-height * 0.38} radius={2.4} fill="#251915" />
      <Line points={[-width * 0.38, -height * 0.2, -width * 0.52, -height * 0.35]} stroke="#704a2d" strokeWidth={5} lineCap="round" />
      {[-0.18, 0.06].map((ratio) => (
        <IsoBlock key={`leg-${ratio}`} x={width * ratio} y={height * 0.1} w={width * 0.09} d={height * 0.1} h={height * 0.22} top={body} left={darken(body)} right={darken(body)} stroke="#704a2d" />
      ))}
    </Group>
  );
}

function IsoBird({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group y={height * 0.08}>
      <Ellipse radiusX={width * 0.32} radiusY={height * 0.24} fill="#58a7d9" stroke="#315c7e" strokeWidth={2} />
      <Line points={[-width * 0.14, -height * 0.08, -width * 0.5, -height * 0.34, -width * 0.36, height * 0.08]} closed fill="#86c7e7" stroke="#315c7e" strokeWidth={1.8} />
      <Line points={[width * 0.3, -height * 0.04, width * 0.52, -height * 0.14, width * 0.33, -height * 0.23]} closed fill="#e7a03a" stroke="#9a6522" strokeWidth={1.5} />
      <Circle x={width * 0.16} y={-height * 0.13} radius={2.5} fill="#1d1d1d" />
      <Line points={[-width * 0.06, height * 0.17, -width * 0.1, height * 0.36]} stroke="#6e4a2d" strokeWidth={3} lineCap="round" />
      <Line points={[width * 0.1, height * 0.16, width * 0.17, height * 0.34]} stroke="#6e4a2d" strokeWidth={3} lineCap="round" />
    </Group>
  );
}

function IsoFish({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group y={height * 0.06}>
      <Line points={[-width * 0.36, 0, -width * 0.55, -height * 0.24, -width * 0.55, height * 0.24]} closed fill="#2e8490" stroke="#205d66" strokeWidth={2} />
      <Ellipse x={width * 0.05} y={0} radiusX={width * 0.42} radiusY={height * 0.28} fill="#42a7ae" stroke="#205d66" strokeWidth={2} />
      <Path data={`M${-width * 0.08} ${-height * 0.2} C${width * 0.1} ${-height * 0.32} ${width * 0.28} ${-height * 0.12} ${width * 0.16} ${height * 0.05}`} fill="#8ed6d7" opacity={0.8} />
      <Circle x={width * 0.34} y={-height * 0.06} radius={2.6} fill="#172027" />
    </Group>
  );
}

function IsoLion({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group>
      <IsoAnimal width={width} height={height} body="#bd8640" head="#d4a04f" ear="#8e5a2d" />
      <Circle x={width * 0.32} y={-height * 0.28} radius={height * 0.27} fill="#8e5a2d" opacity={0.88} />
      <Sphere x={width * 0.32} y={-height * 0.3} r={height * 0.17} color="#d2a04f" />
    </Group>
  );
}

function IsoRobot({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group y={height * 0.1}>
      <IsoBlock x={0} y={0} w={width * 0.56} d={height * 0.3} h={height * 0.45} top="#aab6c2" left="#7d8c9a" right="#596979" stroke="#3e4a56" />
      <IsoBlock x={0} y={-height * 0.45} w={width * 0.44} d={height * 0.28} h={height * 0.26} top="#c7d0da" left="#9aa7b4" right="#738190" stroke="#3e4a56" />
      <Circle x={-width * 0.1} y={-height * 0.56} radius={3.5} fill="#1f3340" />
      <Circle x={width * 0.1} y={-height * 0.56} radius={3.5} fill="#1f3340" />
      <Line points={[0, -height * 0.76, 0, -height * 0.92]} stroke="#53606d" strokeWidth={4} lineCap="round" />
      <Circle x={0} y={-height * 0.96} radius={5} fill="#e0634d" />
    </Group>
  );
}

function IsoSkull({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group y={height * 0.08}>
      <Sphere x={0} y={-height * 0.36} r={width * 0.34} color="#e9e4d9" stroke="#827a70" />
      <IsoBlock x={0} y={height * 0.05} w={width * 0.36} d={height * 0.2} h={height * 0.22} top="#ded7cc" left="#c5bdb2" right="#a59c91" stroke="#827a70" />
      <Circle x={-width * 0.12} y={-height * 0.38} radius={width * 0.08} fill="#30343a" />
      <Circle x={width * 0.12} y={-height * 0.38} radius={width * 0.08} fill="#30343a" />
      <Line points={[0, -height * 0.28, -width * 0.07, -height * 0.16, width * 0.07, -height * 0.16]} closed fill="#34383d" />
    </Group>
  );
}

function IsoMonster({ width, height, accent }: { width: number; height: number; accent: string }): JSX.Element {
  return (
    <Group y={height * 0.1}>
      <Ellipse radiusX={width * 0.4} radiusY={height * 0.42} fillRadialGradientStartPoint={{ x: -width * 0.18, y: -height * 0.25 }} fillRadialGradientStartRadius={2} fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientEndRadius={width * 0.54} fillRadialGradientColorStops={[0, "#b7a5ff", 0.48, accent, 1, "#46316e"]} stroke="#3d2a62" strokeWidth={2.5} />
      <Line points={[-width * 0.24, -height * 0.38, -width * 0.34, -height * 0.68, -width * 0.02, -height * 0.48]} closed fill={accent} stroke="#3d2a62" strokeWidth={2} />
      <Line points={[width * 0.24, -height * 0.38, width * 0.38, -height * 0.68, width * 0.02, -height * 0.48]} closed fill={accent} stroke="#3d2a62" strokeWidth={2} />
      <Circle x={-width * 0.12} y={-height * 0.14} radius={width * 0.08} fill="#eaf7ff" />
      <Circle x={width * 0.12} y={-height * 0.14} radius={width * 0.08} fill="#eaf7ff" />
      <Circle x={-width * 0.1} y={-height * 0.13} radius={2.2} fill="#111827" />
      <Circle x={width * 0.14} y={-height * 0.13} radius={2.2} fill="#111827" />
    </Group>
  );
}

function IsoLamp({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group y={height * 0.06}>
      <IsoBlock x={0} y={0} w={width * 0.26} d={height * 0.18} h={height * 0.18} top="#8b7f64" left="#68604e" right="#4b453a" stroke="#3d372c" />
      <Line points={[0, -height * 0.18, 0, -height * 0.55]} stroke="#74684f" strokeWidth={5} lineCap="round" />
      <Circle x={0} y={-height * 0.7} radius={width * 0.24} fillRadialGradientStartPoint={{ x: -7, y: -9 }} fillRadialGradientStartRadius={1} fillRadialGradientEndPoint={{ x: 0, y: 0 }} fillRadialGradientEndRadius={width * 0.28} fillRadialGradientColorStops={[0, "#fff8b0", 0.45, "#ffd765", 1, "#d58a2e"]} stroke="#8c6332" strokeWidth={2} shadowColor="#ffd765" shadowBlur={16} shadowOpacity={0.45} />
    </Group>
  );
}

function Sphere({ x, y, r, color, stroke = "#6e4c36" }: { x: number; y: number; r: number; color: string; stroke?: string }): JSX.Element {
  return (
    <Circle
      x={x}
      y={y}
      radius={r}
      fillRadialGradientStartPoint={{ x: -r * 0.38, y: -r * 0.45 }}
      fillRadialGradientStartRadius={1}
      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
      fillRadialGradientEndRadius={r * 1.1}
      fillRadialGradientColorStops={[0, "#ffffff", 0.22, color, 1, darken(color)]}
      stroke={stroke}
      strokeWidth={1.8}
    />
  );
}

function getPalette(riskTag: RiskTag): { accent: string; top: string; left: string; right: string } {
  if (riskTag === "death") {
    return { accent: "#60666d", top: "#dedbd2", left: "#9aa0a3", right: "#6c7378" };
  }
  if (riskTag === "conflict") {
    return { accent: "#bd6b36", top: "#f1b267", left: "#c47940", right: "#8d4f2f" };
  }
  if (riskTag === "fantasy") {
    return { accent: "#7157a5", top: "#c1acf0", left: "#8068ba", right: "#564082" };
  }

  return { accent: "#2f8f83", top: "#bfe7d7", left: "#68b49d", right: "#3d7c72" };
}

function lighten(color: string): string {
  const hex = color.replace("#", "");
  const value = Number.parseInt(hex, 16);
  const r = Math.min(255, ((value >> 16) & 255) + 38);
  const g = Math.min(255, ((value >> 8) & 255) + 38);
  const b = Math.min(255, (value & 255) + 38);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function darken(color: string): string {
  const hex = color.replace("#", "");
  const value = Number.parseInt(hex, 16);
  const r = Math.max(0, ((value >> 16) & 255) - 42);
  const g = Math.max(0, ((value >> 8) & 255) - 42);
  const b = Math.max(0, (value & 255) - 42);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}
