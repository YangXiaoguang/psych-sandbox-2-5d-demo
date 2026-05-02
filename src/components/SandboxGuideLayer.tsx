import { Circle, Ellipse, Group, Line, Path, Rect } from "react-konva";
import { getEnvironmentProfile } from "../data/environment";
import type { SandboxEnvironment } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH, BOUNDARY_MARGIN } from "../utils/analysis";
import {
  getProjectedStageCorners,
  projectPoint,
  projectRect,
  STAGE_THICKNESS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "../utils/projection";

interface SandboxGuideLayerProps {
  environment: SandboxEnvironment;
  showGuides: boolean;
}

interface SandPoint {
  id: string;
  x: number;
  y: number;
  tone: number;
}

const thirdsX = [BOARD_WIDTH / 3, (BOARD_WIDTH * 2) / 3];
const thirdsY = [BOARD_HEIGHT / 3, (BOARD_HEIGHT * 2) / 3];

const grains = createSandPoints(760, 37, 46, 42, BOARD_WIDTH - 92, BOARD_HEIGHT - 86);
const fineGrains = createSandPoints(520, 913, 58, 54, BOARD_WIDTH - 116, BOARD_HEIGHT - 108);
const flecks = createSandPoints(170, 211, 74, 64, BOARD_WIDTH - 148, BOARD_HEIGHT - 128);

export function SandboxGuideLayer({ environment, showGuides }: SandboxGuideLayerProps): JSX.Element {
  const profile = getEnvironmentProfile(environment);
  const corners = getProjectedStageCorners();
  const top = projectRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  const frontFace = [
    corners.bottomLeft.x,
    corners.bottomLeft.y,
    corners.bottomRight.x,
    corners.bottomRight.y,
    corners.bottomRight.x,
    corners.bottomRight.y + STAGE_THICKNESS,
    corners.bottomLeft.x,
    corners.bottomLeft.y + STAGE_THICKNESS,
  ];
  const leftFace = [
    corners.topLeft.x,
    corners.topLeft.y,
    corners.bottomLeft.x,
    corners.bottomLeft.y,
    corners.bottomLeft.x,
    corners.bottomLeft.y + STAGE_THICKNESS,
    corners.topLeft.x,
    corners.topLeft.y + STAGE_THICKNESS * 0.72,
  ];
  const rightFace = [
    corners.topRight.x,
    corners.topRight.y,
    corners.bottomRight.x,
    corners.bottomRight.y,
    corners.bottomRight.x,
    corners.bottomRight.y + STAGE_THICKNESS,
    corners.topRight.x,
    corners.topRight.y + STAGE_THICKNESS * 0.72,
  ];

  return (
    <Group>
      <Rect
        x={0}
        y={0}
        width={VIEW_WIDTH}
        height={VIEW_HEIGHT}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: VIEW_WIDTH, y: VIEW_HEIGHT }}
        fillLinearGradientColorStops={profile.backgroundStops}
      />

      <Line
        points={[
          corners.bottomLeft.x - 34,
          corners.bottomLeft.y + STAGE_THICKNESS + 20,
          corners.bottomRight.x + 30,
          corners.bottomRight.y + STAGE_THICKNESS + 22,
          corners.topRight.x + 22,
          corners.topRight.y + 26,
          corners.topLeft.x - 24,
          corners.topLeft.y + 24,
        ]}
        closed
        fill="#273026"
        opacity={profile.stageShadowOpacity}
        shadowColor="#1f261d"
        shadowBlur={28}
        shadowOpacity={0.24}
        listening={false}
      />

      <Line points={leftFace} closed fill="#a98151" stroke="#5f452b" strokeWidth={3} listening={false} />
      <Line points={rightFace} closed fill="#7d5a35" stroke="#4c3522" strokeWidth={3} listening={false} />
      <Line points={frontFace} closed fillLinearGradientStartPoint={{ x: corners.bottomLeft.x, y: corners.bottomLeft.y }} fillLinearGradientEndPoint={{ x: corners.bottomRight.x, y: corners.bottomRight.y + STAGE_THICKNESS }} fillLinearGradientColorStops={[0, "#c79a5e", 0.52, "#8b6137", 1, "#654323"]} stroke="#4f3722" strokeWidth={3} listening={false} />
      <WoodGrain />

      <Line
        name="tray"
        points={top}
        closed
        fillLinearGradientStartPoint={{ x: corners.topLeft.x, y: corners.topLeft.y }}
        fillLinearGradientEndPoint={{ x: corners.bottomRight.x, y: corners.bottomRight.y }}
        fillLinearGradientColorStops={profile.sandStops}
        stroke="#6d4a2b"
        strokeWidth={9}
        shadowColor="#6d4a2b"
        shadowBlur={16}
        shadowOpacity={0.14}
      />

      <SandMounds />
      <SandRakeLines />
      <BlueInnerLiner />
      <StageLightWash environment={environment} />
      <SandTexture />
      {showGuides ? <GuideOverlay /> : null}
      <WoodFrameHighlights />
    </Group>
  );
}

function BlueInnerLiner(): JSX.Element {
  return (
    <Group listening={false}>
      <Line points={projectRect(12, 12, BOARD_WIDTH - 24, 28)} closed fill="#2f9bd0" opacity={0.78} />
      <Line points={projectRect(12, BOARD_HEIGHT - 40, BOARD_WIDTH - 24, 28)} closed fill="#197bac" opacity={0.72} />
      <Line points={projectRect(12, 12, 28, BOARD_HEIGHT - 24)} closed fill="#2c95c8" opacity={0.78} />
      <Line points={projectRect(BOARD_WIDTH - 40, 12, 28, BOARD_HEIGHT - 24)} closed fill="#1878a8" opacity={0.72} />
      <Line points={projectRect(40, 40, BOARD_WIDTH - 80, BOARD_HEIGHT - 80)} closed stroke="#f6e6bd" strokeWidth={2.5} opacity={0.52} />
    </Group>
  );
}

function SandMounds(): JSX.Element {
  return (
    <Group listening={false}>
      {[
        { x: 230, y: 150, rx: 150, ry: 38, color: "#f8eac3", opacity: 0.28 },
        { x: 520, y: 276, rx: 190, ry: 48, color: "#fff2c8", opacity: 0.22 },
        { x: 690, y: 130, rx: 94, ry: 23, color: "#9f8759", opacity: 0.16 },
        { x: 330, y: 410, rx: 160, ry: 42, color: "#a89161", opacity: 0.13 },
        { x: 755, y: 462, rx: 116, ry: 33, color: "#fff5d6", opacity: 0.2 },
      ].map((mound) => {
        const point = projectPoint({ x: mound.x, y: mound.y });
        return (
          <Ellipse
            key={`${mound.x}-${mound.y}`}
            x={point.x}
            y={point.y}
            radiusX={mound.rx}
            radiusY={mound.ry}
            fill={mound.color}
            opacity={mound.opacity}
          />
        );
      })}
      <Path
        data={sandCurve([
          { x: 145, y: 250 },
          { x: 280, y: 210 },
          { x: 430, y: 250 },
          { x: 620, y: 210 },
          { x: 820, y: 270 },
        ])}
        stroke="#f6e5b9"
        strokeWidth={22}
        opacity={0.18}
        lineCap="round"
        lineJoin="round"
      />
      <Path
        data={sandCurve([
          { x: 190, y: 360 },
          { x: 300, y: 330 },
          { x: 430, y: 350 },
          { x: 570, y: 325 },
          { x: 720, y: 360 },
        ])}
        stroke="#7e6744"
        strokeWidth={10}
        opacity={0.07}
        lineCap="round"
        lineJoin="round"
      />
    </Group>
  );
}

function SandRakeLines(): JSX.Element {
  const paths = [
    {
      points: [
        { x: 118, y: 184 },
        { x: 220, y: 162 },
        { x: 346, y: 174 },
        { x: 478, y: 150 },
      ],
      stroke: "#fff0c4",
      width: 5,
      opacity: 0.18,
    },
    {
      points: [
        { x: 558, y: 222 },
        { x: 650, y: 202 },
        { x: 752, y: 214 },
        { x: 866, y: 188 },
      ],
      stroke: "#7c6746",
      width: 4,
      opacity: 0.09,
    },
    {
      points: [
        { x: 130, y: 438 },
        { x: 276, y: 410 },
        { x: 418, y: 430 },
        { x: 582, y: 396 },
      ],
      stroke: "#fff1c9",
      width: 6,
      opacity: 0.13,
    },
  ];

  return (
    <Group listening={false}>
      {paths.map((path, index) => (
        <Path
          key={`sand-rake-${index}`}
          data={sandCurve(path.points)}
          stroke={path.stroke}
          strokeWidth={path.width}
          opacity={path.opacity}
          lineCap="round"
          lineJoin="round"
        />
      ))}
    </Group>
  );
}

function StageLightWash({ environment }: { environment: SandboxEnvironment }): JSX.Element {
  const profile = getEnvironmentProfile(environment);
  const warm = projectPoint({ x: 260, y: 132 });
  const cool = projectPoint({ x: 760, y: 430 });

  return (
    <Group listening={false}>
      <Ellipse
        x={warm.x}
        y={warm.y}
        radiusX={310}
        radiusY={88}
        fill="#fff7cf"
        opacity={profile.warmWashOpacity}
        rotation={-8}
      />
      <Ellipse
        x={cool.x}
        y={cool.y}
        radiusX={250}
        radiusY={72}
        fill="#8ccfc7"
        opacity={profile.coolWashOpacity}
        rotation={-10}
      />
      <Line
        points={projectRect(42, 42, BOARD_WIDTH - 84, BOARD_HEIGHT - 84)}
        closed
        stroke="#fff5ca"
        strokeWidth={5}
        opacity={0.13}
      />
    </Group>
  );
}

function SandTexture(): JSX.Element {
  return (
    <Group listening={false}>
      {fineGrains.map((grain) => {
        const point = projectPoint(grain);
        return (
          <Circle
            key={grain.id}
            x={point.x}
            y={point.y}
            radius={0.55 + grain.tone * 0.45}
            fill={grain.tone > 0.58 ? "#fff6d3" : "#b69462"}
            opacity={grain.tone > 0.58 ? 0.36 : 0.16}
          />
        );
      })}
      {grains.map((grain) => {
        const point = projectPoint(grain);
        const radius = grain.tone > 0.72 ? 1.5 : 0.9;
        return (
          <Circle
            key={grain.id}
            x={point.x}
            y={point.y}
            radius={radius}
            fill={grain.tone > 0.5 ? "#f7e8c4" : "#9f8457"}
            opacity={grain.tone > 0.5 ? 0.46 : 0.23}
          />
        );
      })}
      {flecks.map((fleck) => {
        const point = projectPoint(fleck);
        return (
          <Ellipse
            key={fleck.id}
            x={point.x}
            y={point.y}
            radiusX={2 + fleck.tone * 3}
            radiusY={0.8 + fleck.tone * 1.2}
            fill="#7d6645"
            opacity={0.18}
            rotation={fleck.tone * 120}
          />
        );
      })}
    </Group>
  );
}

function WoodFrameHighlights(): JSX.Element {
  const corners = getProjectedStageCorners();
  return (
    <Group listening={false}>
      <Line points={[corners.topLeft.x, corners.topLeft.y, corners.topRight.x, corners.topRight.y]} stroke="#deb56d" strokeWidth={4} opacity={0.8} />
      <Line points={[corners.topLeft.x, corners.topLeft.y, corners.bottomLeft.x, corners.bottomLeft.y]} stroke="#e1ba76" strokeWidth={4} opacity={0.72} />
      <Line points={[corners.bottomLeft.x, corners.bottomLeft.y, corners.bottomRight.x, corners.bottomRight.y]} stroke="#5f3d22" strokeWidth={5} opacity={0.52} />
      <Line points={[corners.topRight.x, corners.topRight.y, corners.bottomRight.x, corners.bottomRight.y]} stroke="#5a3921" strokeWidth={5} opacity={0.5} />
      <Line points={projectRect(30, 30, BOARD_WIDTH - 60, BOARD_HEIGHT - 60)} closed stroke="#fff0c5" strokeWidth={2.4} opacity={0.34} />
      <Line points={projectRect(18, 18, BOARD_WIDTH - 36, BOARD_HEIGHT - 36)} closed stroke="#2d1d12" strokeWidth={5} opacity={0.12} />
      <Line points={projectRect(22, 22, BOARD_WIDTH - 44, BOARD_HEIGHT - 44)} closed stroke="#4b3320" strokeWidth={2.2} opacity={0.16} />
      {[0.18, 0.82].map((offset) => {
        const topPoint = projectPoint({ x: BOARD_WIDTH * offset, y: 18 });
        const bottomPoint = projectPoint({ x: BOARD_WIDTH * offset, y: BOARD_HEIGHT - 18 });
        return (
          <Line
            key={`wood-cross-highlight-${offset}`}
            points={[topPoint.x, topPoint.y, bottomPoint.x, bottomPoint.y]}
            stroke="#fff2c5"
            strokeWidth={1}
            opacity={0.16}
          />
        );
      })}
    </Group>
  );
}

function WoodGrain(): JSX.Element {
  const corners = getProjectedStageCorners();
  const frontLines = [0.22, 0.36, 0.5, 0.64, 0.78];
  const leftLines = [0.24, 0.42, 0.6, 0.78];
  const rightLines = [0.22, 0.4, 0.58, 0.76];

  return (
    <Group listening={false}>
      {frontLines.map((offset) => (
        <Line
          key={`front-grain-${offset}`}
          points={[
            corners.bottomLeft.x + 24,
            corners.bottomLeft.y + STAGE_THICKNESS * offset,
            corners.bottomRight.x - 18,
            corners.bottomRight.y + STAGE_THICKNESS * (offset + 0.02),
          ]}
          stroke="#e1b575"
          strokeWidth={1.2}
          opacity={0.2}
        />
      ))}
      {leftLines.map((offset) => (
        <Line
          key={`left-grain-${offset}`}
          points={[
            corners.topLeft.x + 8,
            corners.topLeft.y + STAGE_THICKNESS * offset,
            corners.bottomLeft.x + 8,
            corners.bottomLeft.y + STAGE_THICKNESS * (offset + 0.08),
          ]}
          stroke="#e6bd7a"
          strokeWidth={1}
          opacity={0.18}
        />
      ))}
      {rightLines.map((offset) => (
        <Line
          key={`right-grain-${offset}`}
          points={[
            corners.topRight.x - 8,
            corners.topRight.y + STAGE_THICKNESS * offset,
            corners.bottomRight.x - 8,
            corners.bottomRight.y + STAGE_THICKNESS * (offset + 0.1),
          ]}
          stroke="#3f2a1a"
          strokeWidth={1}
          opacity={0.15}
        />
      ))}
    </Group>
  );
}

function GuideOverlay(): JSX.Element {
  return (
    <Group listening={false}>
      {thirdsX.map((x) => {
        const start = projectPoint({ x, y: 40 });
        const end = projectPoint({ x, y: BOARD_HEIGHT - 40 });
        return <Line key={`x-${x}`} points={[start.x, start.y, end.x, end.y]} stroke="#8b6a3f" strokeWidth={1.5} dash={[9, 9]} opacity={0.36} />;
      })}
      {thirdsY.map((y) => {
        const start = projectPoint({ x: 40, y });
        const end = projectPoint({ x: BOARD_WIDTH - 40, y });
        return <Line key={`y-${y}`} points={[start.x, start.y, end.x, end.y]} stroke="#8b6a3f" strokeWidth={1.5} dash={[9, 9]} opacity={0.36} />;
      })}
      <Line
        points={projectRect(BOARD_WIDTH / 3, BOARD_HEIGHT / 3, BOARD_WIDTH / 3, BOARD_HEIGHT / 3)}
        closed
        stroke="#2f8f83"
        strokeWidth={2}
        dash={[12, 8]}
        opacity={0.62}
      />
      <Line
        points={projectRect(BOUNDARY_MARGIN, BOUNDARY_MARGIN, BOARD_WIDTH - BOUNDARY_MARGIN * 2, BOARD_HEIGHT - BOUNDARY_MARGIN * 2)}
        closed
        stroke="#b06124"
        strokeWidth={1.6}
        dash={[7, 8]}
        opacity={0.5}
      />
    </Group>
  );
}

function sandCurve(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point, index) => {
      const projected = projectPoint(point);
      return `${index === 0 ? "M" : "L"}${projected.x} ${projected.y}`;
    })
    .join(" ");
}

function createSandPoints(
  count: number,
  seed: number,
  x: number,
  y: number,
  width: number,
  height: number,
): SandPoint[] {
  let value = seed;
  return Array.from({ length: count }, (_, index) => {
    value = (value * 9301 + 49297) % 233280;
    const first = value / 233280;
    value = (value * 9301 + 49297) % 233280;
    const second = value / 233280;
    value = (value * 9301 + 49297) % 233280;

    return {
      id: `sand-${seed}-${index}`,
      x: x + first * width,
      y: y + second * height,
      tone: value / 233280,
    };
  });
}
