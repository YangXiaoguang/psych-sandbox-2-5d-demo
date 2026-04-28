import { Circle, Ellipse, Group, Line, Path, Rect, Star } from "react-konva";
import type { RiskTag } from "../types";

interface SandboxObjectShapeProps {
  assetId: string;
  width: number;
  height: number;
  riskTag: RiskTag;
}

export function SandboxObjectShape({
  assetId,
  width,
  height,
  riskTag,
}: SandboxObjectShapeProps): JSX.Element {
  const accent = riskTag === "death" ? "#60666d" : riskTag === "conflict" ? "#bd6b36" : riskTag === "fantasy" ? "#7157a5" : "#2f8f83";
  return (
    <Group>
      <Ellipse
        x={0}
        y={height * 0.43}
        radiusX={width * 0.44}
        radiusY={height * 0.08}
        fill="#352719"
        opacity={0.16}
        shadowColor="#352719"
        shadowBlur={18}
        shadowOpacity={0.12}
        listening={false}
      />
      <AssetBody assetId={assetId} width={width} height={height} accent={accent} />
    </Group>
  );
}

function AssetBody({
  assetId,
  width,
  height,
  accent,
}: {
  assetId: string;
  width: number;
  height: number;
  accent: string;
}): JSX.Element {
  const left = -width / 2;
  const top = -height / 2;

  switch (assetId) {
    case "person_child":
    case "person_adult":
    case "person_elder": {
      const isChild = assetId === "person_child";
      const isElder = assetId === "person_elder";
      const skin = isElder ? "#d8b089" : isChild ? "#f0ba78" : "#d49a68";
      const cloth = isElder ? "#7a7169" : isChild ? "#5ba8d8" : "#376b8d";
      return (
        <Group>
          <Line points={[left + width * 0.38, top + height * 0.82, left + width * 0.28, top + height]} stroke="#654936" strokeWidth={6} lineCap="round" />
          <Line points={[left + width * 0.62, top + height * 0.82, left + width * 0.72, top + height]} stroke="#654936" strokeWidth={6} lineCap="round" />
          <Rect x={left + width * 0.3} y={top + height * 0.32} width={width * 0.4} height={height * 0.5} cornerRadius={9} fill={cloth} stroke="#1d2e36" strokeWidth={1} />
          <Circle x={0} y={top + height * 0.2} radius={width * 0.18} fill={skin} stroke="#7b543b" strokeWidth={1.5} />
          <Line points={[left + width * 0.31, top + height * 0.44, left + width * 0.12, top + height * 0.58]} stroke="#654936" strokeWidth={6} lineCap="round" />
          <Line points={[left + width * 0.69, top + height * 0.44, left + width * 0.88, top + height * 0.58]} stroke="#654936" strokeWidth={6} lineCap="round" />
          {isElder ? <Line points={[left + width * 0.78, top + height * 0.5, left + width * 0.86, top + height]} stroke="#5a4030" strokeWidth={4} lineCap="round" /> : null}
          <Circle x={-width * 0.06} y={top + height * 0.2} radius={2.2} fill="#172027" />
          <Circle x={width * 0.06} y={top + height * 0.2} radius={2.2} fill="#172027" />
        </Group>
      );
    }
    case "animal_dog":
      return (
        <Group>
          <Ellipse x={left + width * 0.43} y={top + height * 0.56} radiusX={width * 0.3} radiusY={height * 0.26} fill="#b97845" stroke="#7a4b2d" strokeWidth={1.5} />
          <Circle x={left + width * 0.76} y={top + height * 0.42} radius={height * 0.23} fill="#c98a50" stroke="#7a4b2d" strokeWidth={1.5} />
          <Circle x={left + width * 0.81} y={top + height * 0.4} radius={2.4} fill="#101820" />
          <Line points={[left + width * 0.24, top + height * 0.52, left + width * 0.05, top + height * 0.34]} stroke="#8b5834" strokeWidth={6} lineCap="round" />
          <Line points={[left + width * 0.36, top + height * 0.75, left + width * 0.34, top + height]} stroke="#8b5834" strokeWidth={6} lineCap="round" />
          <Line points={[left + width * 0.58, top + height * 0.75, left + width * 0.6, top + height]} stroke="#8b5834" strokeWidth={6} lineCap="round" />
        </Group>
      );
    case "animal_bird":
      return (
        <Group>
          <Ellipse x={0} y={top + height * 0.52} radiusX={width * 0.31} radiusY={height * 0.23} fill="#4f8bbd" stroke="#315c7e" strokeWidth={1.5} />
          <Path data={`M${left + width * 0.38} ${top + height * 0.48} C${left + width * 0.1} ${top + height * 0.42} ${left + width * 0.08} ${top + height * 0.12} ${left + width * 0.48} ${top + height * 0.46} Z`} fill="#78b8db" />
          <Line points={[left + width * 0.72, top + height * 0.49, left + width, top + height * 0.38, left + width * 0.72, top + height * 0.31]} closed fill="#d99b36" stroke="#a86d21" strokeWidth={1} />
          <Circle x={left + width * 0.6} y={top + height * 0.39} radius={2.6} fill="#16202a" />
          <Line points={[left + width * 0.42, top + height * 0.7, left + width * 0.34, top + height]} stroke="#6f482f" strokeWidth={4} lineCap="round" />
          <Line points={[left + width * 0.55, top + height * 0.71, left + width * 0.64, top + height]} stroke="#6f482f" strokeWidth={4} lineCap="round" />
        </Group>
      );
    case "animal_fish":
      return (
        <Group>
          <Line points={[left + width * 0.2, top + height * 0.5, left, top + height * 0.18, left, top + height * 0.82]} closed fill="#2a7f86" />
          <Ellipse x={left + width * 0.55} y={0} radiusX={width * 0.33} radiusY={height * 0.36} fill="#3d9fa8" stroke="#236d74" strokeWidth={1.5} />
          <Path data={`M${left + width * 0.52} ${top + height * 0.18} C${left + width * 0.7} ${top + height * 0.28} ${left + width * 0.76} ${top + height * 0.44} ${left + width * 0.62} ${top + height * 0.58} C${left + width * 0.51} ${top + height * 0.5} ${left + width * 0.45} ${top + height * 0.36} ${left + width * 0.52} ${top + height * 0.18} Z`} fill="#75c5c8" />
          <Circle x={left + width * 0.78} y={top + height * 0.42} radius={2.8} fill="#172027" />
        </Group>
      );
    case "animal_lion":
      return (
        <Group>
          <Ellipse x={left + width * 0.42} y={top + height * 0.63} radiusX={width * 0.28} radiusY={height * 0.2} fill="#bd8640" stroke="#7d4f2a" strokeWidth={1.5} />
          <Circle x={left + width * 0.75} y={top + height * 0.42} radius={height * 0.28} fill="#8e5a2d" />
          <Circle x={left + width * 0.75} y={top + height * 0.42} radius={height * 0.18} fill="#d0a04f" />
          <Circle x={left + width * 0.7} y={top + height * 0.39} radius={2.4} fill="#171717" />
          <Circle x={left + width * 0.8} y={top + height * 0.39} radius={2.4} fill="#171717" />
          <Line points={[left + width * 0.2, top + height * 0.6, left + width * 0.02, top + height * 0.47]} stroke="#80512b" strokeWidth={6} lineCap="round" />
          <Line points={[left + width * 0.34, top + height * 0.78, left + width * 0.33, top + height]} stroke="#80512b" strokeWidth={6} lineCap="round" />
          <Line points={[left + width * 0.56, top + height * 0.78, left + width * 0.58, top + height]} stroke="#80512b" strokeWidth={6} lineCap="round" />
        </Group>
      );
    case "env_house":
      return (
        <Group>
          <Rect x={left + width * 0.2} y={top + height * 0.44} width={width * 0.6} height={height * 0.46} cornerRadius={4} fill="#e2b06d" stroke="#96633b" strokeWidth={1.5} />
          <Line points={[left + width * 0.13, top + height * 0.48, 0, top + height * 0.12, left + width * 0.87, top + height * 0.48]} closed fill="#b9493e" stroke="#79342f" strokeWidth={1.5} />
          <Rect x={left + width * 0.43} y={top + height * 0.64} width={width * 0.14} height={height * 0.26} cornerRadius={2} fill="#6d4a35" />
          <Rect x={left + width * 0.27} y={top + height * 0.57} width={width * 0.12} height={height * 0.12} cornerRadius={2} fill="#7db1c6" />
          <Rect x={left + width * 0.61} y={top + height * 0.57} width={width * 0.12} height={height * 0.12} cornerRadius={2} fill="#7db1c6" />
        </Group>
      );
    case "env_bridge":
      return (
        <Group>
          <Path data={`M${left + width * 0.1} ${top + height * 0.73} C${left + width * 0.3} ${top + height * 0.15} ${left + width * 0.7} ${top + height * 0.15} ${left + width * 0.9} ${top + height * 0.73}`} stroke="#8b6a4e" strokeWidth={height * 0.14} lineCap="round" />
          <Line points={[left + width * 0.1, top + height * 0.74, left + width * 0.9, top + height * 0.74]} stroke="#c19867" strokeWidth={height * 0.16} lineCap="round" />
          {[0.28, 0.5, 0.72].map((ratio) => (
            <Line key={ratio} points={[left + width * ratio, top + height * 0.37, left + width * ratio, top + height * 0.82]} stroke="#6d4e39" strokeWidth={4} lineCap="round" />
          ))}
        </Group>
      );
    case "env_fence":
      return (
        <Group>
          <Line points={[left + width * 0.06, top + height * 0.42, left + width * 0.94, top + height * 0.42]} stroke="#9b734c" strokeWidth={7} lineCap="round" />
          <Line points={[left + width * 0.06, top + height * 0.68, left + width * 0.94, top + height * 0.68]} stroke="#9b734c" strokeWidth={7} lineCap="round" />
          {[0.13, 0.31, 0.5, 0.69, 0.87].map((ratio) => (
            <Line key={ratio} points={[left + width * ratio, top + height * 0.12, left + width * ratio, top + height * 0.92]} stroke="#c6925d" strokeWidth={8} lineCap="round" />
          ))}
        </Group>
      );
    case "env_tower":
      return (
        <Group>
          <Line points={[left + width * 0.24, top + height * 0.2, 0, top + height * 0.02, left + width * 0.76, top + height * 0.2]} closed fill="#4f6475" />
          <Line points={[left + width * 0.28, top + height * 0.2, left + width * 0.72, top + height * 0.2, left + width * 0.82, top + height * 0.92, left + width * 0.18, top + height * 0.92]} closed fill="#8a98a4" stroke="#56606a" strokeWidth={1.5} />
          <Rect x={left + width * 0.42} y={top + height * 0.68} width={width * 0.16} height={height * 0.24} cornerRadius={2} fill="#4b3b34" />
          <Rect x={left + width * 0.4} y={top + height * 0.34} width={width * 0.2} height={height * 0.1} cornerRadius={2} fill="#e8c66e" />
        </Group>
      );
    case "nature_tree":
      return (
        <Group>
          <Rect x={left + width * 0.42} y={top + height * 0.55} width={width * 0.16} height={height * 0.36} cornerRadius={4} fill="#8c6139" stroke="#67452a" strokeWidth={1} />
          <Circle x={left + width * 0.38} y={top + height * 0.43} radius={width * 0.24} fill="#478f5b" />
          <Circle x={left + width * 0.6} y={top + height * 0.36} radius={width * 0.27} fill="#3f7f52" />
          <Circle x={left + width * 0.59} y={top + height * 0.55} radius={width * 0.23} fill="#5da66c" />
        </Group>
      );
    case "nature_water":
      return (
        <Group>
          <Ellipse x={0} y={top + height * 0.56} radiusX={width * 0.43} radiusY={height * 0.28} fill="#77bed0" stroke="#3a8fa1" strokeWidth={1.5} />
          <Line points={[left + width * 0.2, top + height * 0.5, left + width * 0.34, top + height * 0.42, left + width * 0.48, top + height * 0.5, left + width * 0.62, top + height * 0.58, left + width * 0.8, top + height * 0.5]} stroke="#e4fbff" strokeWidth={5} lineCap="round" tension={0.55} />
          <Line points={[left + width * 0.28, top + height * 0.66, left + width * 0.42, top + height * 0.58, left + width * 0.57, top + height * 0.66, left + width * 0.75, top + height * 0.61]} stroke="#2b8da1" strokeWidth={4} lineCap="round" tension={0.5} />
        </Group>
      );
    case "nature_rock":
      return (
        <Line
          points={[left + width * 0.08, top + height * 0.72, left + width * 0.22, top + height * 0.26, left + width * 0.48, top + height * 0.12, left + width * 0.82, top + height * 0.32, left + width * 0.94, top + height * 0.72, left + width * 0.68, top + height * 0.92, left + width * 0.26, top + height * 0.9]}
          closed
          fill="#8e9494"
          stroke="#687173"
          strokeWidth={2}
        />
      );
    case "nature_sun":
      return (
        <Group>
          <Star x={0} y={0} numPoints={12} innerRadius={width * 0.27} outerRadius={width * 0.47} fill="#f0ad37" stroke="#ca8120" strokeWidth={1.5} />
          <Circle x={0} y={0} radius={width * 0.27} fill="#f3c94e" />
        </Group>
      );
    case "symbol_monster":
      return (
        <Group>
          <Line points={[left + width * 0.3, top + height * 0.22, left + width * 0.2, top + height * 0.02, left + width * 0.42, top + height * 0.18]} closed fill={accent} />
          <Line points={[left + width * 0.68, top + height * 0.22, left + width * 0.82, top + height * 0.02, left + width * 0.56, top + height * 0.18]} closed fill={accent} />
          <Ellipse x={0} y={top + height * 0.56} radiusX={width * 0.36} radiusY={height * 0.34} fill="#7b66b1" stroke="#4f3b78" strokeWidth={1.5} />
          <Circle x={-width * 0.12} y={top + height * 0.45} radius={width * 0.07} fill="#e9f5fb" />
          <Circle x={width * 0.12} y={top + height * 0.45} radius={width * 0.07} fill="#e9f5fb" />
          <Circle x={-width * 0.11} y={top + height * 0.46} radius={2.2} fill="#111827" />
          <Circle x={width * 0.13} y={top + height * 0.46} radius={2.2} fill="#111827" />
          <Line points={[-width * 0.16, top + height * 0.66, width * 0.16, top + height * 0.66, width * 0.05, top + height * 0.75, 0, top + height * 0.69, -width * 0.05, top + height * 0.75]} closed fill="#ffffff" />
        </Group>
      );
    case "symbol_robot":
      return (
        <Group>
          <Line points={[0, top + height * 0.02, 0, top + height * 0.16]} stroke="#56606d" strokeWidth={4} lineCap="round" />
          <Circle x={0} y={top + height * 0.02} radius={4} fill="#e06f4f" />
          <Rect x={left + width * 0.28} y={top + height * 0.18} width={width * 0.44} height={height * 0.28} cornerRadius={5} fill="#9aa6b2" stroke="#56606d" strokeWidth={1.5} />
          <Rect x={left + width * 0.22} y={top + height * 0.52} width={width * 0.56} height={height * 0.3} cornerRadius={6} fill="#6f7f8d" stroke="#4f5c66" strokeWidth={1.5} />
          <Circle x={-width * 0.08} y={top + height * 0.32} radius={3.3} fill="#22313d" />
          <Circle x={width * 0.08} y={top + height * 0.32} radius={3.3} fill="#22313d" />
          <Line points={[left + width * 0.22, top + height * 0.62, left + width * 0.03, top + height * 0.62]} stroke="#56606d" strokeWidth={6} lineCap="round" />
          <Line points={[left + width * 0.78, top + height * 0.62, left + width * 0.97, top + height * 0.62]} stroke="#56606d" strokeWidth={6} lineCap="round" />
          <Line points={[left + width * 0.38, top + height * 0.82, left + width * 0.38, top + height]} stroke="#56606d" strokeWidth={6} lineCap="round" />
          <Line points={[left + width * 0.62, top + height * 0.82, left + width * 0.62, top + height]} stroke="#56606d" strokeWidth={6} lineCap="round" />
        </Group>
      );
    case "symbol_skull":
      return (
        <Group>
          <Circle x={0} y={top + height * 0.36} radius={width * 0.35} fill="#e8e4da" stroke="#8f887d" strokeWidth={1.5} />
          <Rect x={left + width * 0.31} y={top + height * 0.56} width={width * 0.38} height={height * 0.26} cornerRadius={5} fill="#d8d2c6" stroke="#8f887d" strokeWidth={1} />
          <Circle x={-width * 0.14} y={top + height * 0.34} radius={width * 0.09} fill="#30343a" />
          <Circle x={width * 0.14} y={top + height * 0.34} radius={width * 0.09} fill="#30343a" />
          <Line points={[0, top + height * 0.42, -width * 0.08, top + height * 0.54, width * 0.08, top + height * 0.54]} closed fill="#34383d" />
          {[-0.12, 0, 0.12].map((ratio) => (
            <Line key={ratio} points={[width * ratio, top + height * 0.65, width * ratio, top + height * 0.82]} stroke="#817a70" strokeWidth={2.5} />
          ))}
        </Group>
      );
    case "symbol_light":
      return (
        <Group>
          {[0, 45, 90, 135].map((angle) => {
            const radians = (angle * Math.PI) / 180;
            return (
              <Line
                key={angle}
                points={[
                  Math.cos(radians) * width * 0.28,
                  top + height * 0.34 + Math.sin(radians) * width * 0.28,
                  Math.cos(radians) * width * 0.46,
                  top + height * 0.34 + Math.sin(radians) * width * 0.46,
                ]}
                stroke="#f3c85c"
                strokeWidth={4}
                lineCap="round"
              />
            );
          })}
          <Circle x={0} y={top + height * 0.42} radius={width * 0.26} fill="#f7d978" stroke="#d9a83d" strokeWidth={1.5} shadowColor="#f1c75e" shadowBlur={14} shadowOpacity={0.35} />
          <Rect x={left + width * 0.39} y={top + height * 0.68} width={width * 0.22} height={height * 0.13} cornerRadius={3} fill="#77715e" />
          <Line points={[left + width * 0.38, top + height * 0.86, left + width * 0.62, top + height * 0.86]} stroke="#4e4a40" strokeWidth={5} lineCap="round" />
        </Group>
      );
    default:
      return <Circle x={0} y={0} radius={Math.min(width, height) * 0.35} fill={accent} />;
  }
}
