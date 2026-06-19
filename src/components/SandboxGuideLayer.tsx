import { Circle, Ellipse, Group, Line, Path, Rect } from "react-konva";
import { getEnvironmentProfile } from "../data/environment";
import type { SandboxCameraState, SandboxEnvironment } from "../types";
import { BOARD_HEIGHT, BOARD_WIDTH, BOUNDARY_MARGIN } from "../utils/analysis";
import {
  getProjectedStageCorners,
  projectPoint,
  projectRect,
  STAGE_THICKNESS,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "../utils/projection";
import { EnvironmentBackdrop } from "./EnvironmentBackdrop";

interface SandboxGuideLayerProps {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
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

export function SandboxGuideLayer({ environment, camera, showGuides }: SandboxGuideLayerProps): JSX.Element {
  const profile = getEnvironmentProfile(environment);
  const corners = getProjectedStageCorners(camera);
  const top = projectRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT, camera);
  const yawRatio = Math.max(-1, Math.min(1, camera.yaw / 32));
  const leftFaceFill = yawRatio < -0.18 ? "#c7965c" : yawRatio > 0.18 ? "#835b35" : "#a98151";
  const rightFaceFill = yawRatio > 0.18 ? "#b88751" : yawRatio < -0.18 ? "#664729" : "#7d5a35";
  const edgeGlowOpacity = 0.16 + Math.abs(yawRatio) * 0.12;
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
      <EnvironmentBackdrop environment={environment} />

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

      <Line points={leftFace} closed fill={leftFaceFill} stroke="#5f452b" strokeWidth={3} listening={false} />
      <Line points={rightFace} closed fill={rightFaceFill} stroke="#4c3522" strokeWidth={3} listening={false} />
      <Line points={frontFace} closed fillLinearGradientStartPoint={{ x: corners.bottomLeft.x, y: corners.bottomLeft.y }} fillLinearGradientEndPoint={{ x: corners.bottomRight.x, y: corners.bottomRight.y + STAGE_THICKNESS }} fillLinearGradientColorStops={[0, "#d0a66a", 0.48, "#93683d", 1, "#5d3d20"]} stroke="#4f3722" strokeWidth={3} listening={false} />
      <WoodGrain camera={camera} />

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

      <SandMounds camera={camera} />
      <SandRakeLines camera={camera} />
      <BlueInnerLiner camera={camera} />
      <SandEdgeOcclusion camera={camera} edgeGlowOpacity={edgeGlowOpacity} />
      <StageLightWash environment={environment} camera={camera} />
      <SandTexture camera={camera} />
      <SandMicroRelief camera={camera} />
      {showGuides ? <GuideOverlay camera={camera} /> : null}
      <WoodFrameHighlights camera={camera} />
    </Group>
  );
}

function BlueInnerLiner({ camera }: { camera: SandboxCameraState }): JSX.Element {
  return (
    <Group listening={false}>
      <Line points={projectRect(12, 12, BOARD_WIDTH - 24, 28, camera)} closed fill="#2f9bd0" opacity={0.78} />
      <Line points={projectRect(12, BOARD_HEIGHT - 40, BOARD_WIDTH - 24, 28, camera)} closed fill="#197bac" opacity={0.72} />
      <Line points={projectRect(12, 12, 28, BOARD_HEIGHT - 24, camera)} closed fill="#2c95c8" opacity={0.78} />
      <Line points={projectRect(BOARD_WIDTH - 40, 12, 28, BOARD_HEIGHT - 24, camera)} closed fill="#1878a8" opacity={0.72} />
      <Line points={projectRect(40, 40, BOARD_WIDTH - 80, BOARD_HEIGHT - 80, camera)} closed stroke="#f6e6bd" strokeWidth={2.5} opacity={0.52} />
    </Group>
  );
}

function SandEdgeOcclusion({
  camera,
  edgeGlowOpacity,
}: {
  camera: SandboxCameraState;
  edgeGlowOpacity: number;
}): JSX.Element {
  return (
    <Group listening={false}>
      <Line
        points={projectRect(34, 34, BOARD_WIDTH - 68, BOARD_HEIGHT - 68, camera)}
        closed
        stroke="#5d4328"
        strokeWidth={12}
        opacity={0.11}
        lineJoin="round"
      />
      <Line
        points={projectRect(52, 52, BOARD_WIDTH - 104, BOARD_HEIGHT - 104, camera)}
        closed
        stroke="#fff3cc"
        strokeWidth={3}
        opacity={edgeGlowOpacity}
        lineJoin="round"
      />
      <Line
        points={projectRect(72, 74, BOARD_WIDTH - 144, BOARD_HEIGHT - 148, camera)}
        closed
        stroke="#79623f"
        strokeWidth={1.2}
        opacity={0.16}
        dash={[14, 16]}
        lineJoin="round"
      />
    </Group>
  );
}

function SandMounds({ camera }: { camera: SandboxCameraState }): JSX.Element {
  return (
    <Group listening={false}>
      {[
        { x: 230, y: 150, rx: 150, ry: 38, color: "#f8eac3", opacity: 0.28 },
        { x: 520, y: 276, rx: 190, ry: 48, color: "#fff2c8", opacity: 0.22 },
        { x: 690, y: 130, rx: 94, ry: 23, color: "#9f8759", opacity: 0.16 },
        { x: 330, y: 410, rx: 160, ry: 42, color: "#a89161", opacity: 0.13 },
        { x: 755, y: 462, rx: 116, ry: 33, color: "#fff5d6", opacity: 0.2 },
      ].map((mound) => {
        const point = projectPoint({ x: mound.x, y: mound.y }, camera);
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
        ], camera)}
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
        ], camera)}
        stroke="#7e6744"
        strokeWidth={10}
        opacity={0.07}
        lineCap="round"
        lineJoin="round"
      />
    </Group>
  );
}

function SandMicroRelief({ camera }: { camera: SandboxCameraState }): JSX.Element {
  const reliefPaths = [
    {
      points: [
        { x: 88, y: 122 },
        { x: 210, y: 102 },
        { x: 338, y: 116 },
        { x: 476, y: 92 },
      ],
      stroke: "#fff8dc",
      width: 1.7,
      opacity: 0.18,
    },
    {
      points: [
        { x: 602, y: 154 },
        { x: 704, y: 132 },
        { x: 822, y: 154 },
        { x: 916, y: 126 },
      ],
      stroke: "#8f744c",
      width: 1.2,
      opacity: 0.13,
    },
    {
      points: [
        { x: 116, y: 528 },
        { x: 266, y: 496 },
        { x: 402, y: 516 },
        { x: 568, y: 480 },
      ],
      stroke: "#fff5cf",
      width: 1.4,
      opacity: 0.15,
    },
    {
      points: [
        { x: 618, y: 462 },
        { x: 722, y: 438 },
        { x: 836, y: 462 },
        { x: 914, y: 442 },
      ],
      stroke: "#806844",
      width: 1.1,
      opacity: 0.12,
    },
  ];

  return (
    <Group listening={false}>
      {reliefPaths.map((path, index) => (
        <Path
          key={`sand-relief-${index}`}
          data={sandCurve(path.points, camera)}
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

function SandRakeLines({ camera }: { camera: SandboxCameraState }): JSX.Element {
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
          data={sandCurve(path.points, camera)}
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

function StageLightWash({ environment, camera }: { environment: SandboxEnvironment; camera: SandboxCameraState }): JSX.Element {
  const profile = getEnvironmentProfile(environment);
  const warm = projectPoint({ x: 260, y: 132 }, camera);
  const cool = projectPoint({ x: 760, y: 430 }, camera);

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
        points={projectRect(42, 42, BOARD_WIDTH - 84, BOARD_HEIGHT - 84, camera)}
        closed
        stroke="#fff5ca"
        strokeWidth={5}
        opacity={0.13}
      />
    </Group>
  );
}

function SandTexture({ camera }: { camera: SandboxCameraState }): JSX.Element {
  return (
    <Group listening={false}>
      {fineGrains.map((grain) => {
        const point = projectPoint(grain, camera);
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
        const point = projectPoint(grain, camera);
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
        const point = projectPoint(fleck, camera);
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

function WoodFrameHighlights({ camera }: { camera: SandboxCameraState }): JSX.Element {
  const corners = getProjectedStageCorners(camera);
  return (
    <Group listening={false}>
      <Line points={[corners.topLeft.x, corners.topLeft.y, corners.topRight.x, corners.topRight.y]} stroke="#deb56d" strokeWidth={4} opacity={0.8} />
      <Line points={[corners.topLeft.x, corners.topLeft.y, corners.bottomLeft.x, corners.bottomLeft.y]} stroke="#e1ba76" strokeWidth={4} opacity={0.72} />
      <Line points={[corners.bottomLeft.x, corners.bottomLeft.y, corners.bottomRight.x, corners.bottomRight.y]} stroke="#5f3d22" strokeWidth={5} opacity={0.52} />
      <Line points={[corners.topRight.x, corners.topRight.y, corners.bottomRight.x, corners.bottomRight.y]} stroke="#5a3921" strokeWidth={5} opacity={0.5} />
      <Line points={projectRect(30, 30, BOARD_WIDTH - 60, BOARD_HEIGHT - 60, camera)} closed stroke="#fff0c5" strokeWidth={2.4} opacity={0.34} />
      <Line points={projectRect(18, 18, BOARD_WIDTH - 36, BOARD_HEIGHT - 36, camera)} closed stroke="#2d1d12" strokeWidth={5} opacity={0.12} />
      <Line points={projectRect(22, 22, BOARD_WIDTH - 44, BOARD_HEIGHT - 44, camera)} closed stroke="#4b3320" strokeWidth={2.2} opacity={0.16} />
      {[0.18, 0.82].map((offset) => {
        const topPoint = projectPoint({ x: BOARD_WIDTH * offset, y: 18 }, camera);
        const bottomPoint = projectPoint({ x: BOARD_WIDTH * offset, y: BOARD_HEIGHT - 18 }, camera);
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

function WoodGrain({ camera }: { camera: SandboxCameraState }): JSX.Element {
  const corners = getProjectedStageCorners(camera);
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

function GuideOverlay({ camera }: { camera: SandboxCameraState }): JSX.Element {
  return (
    <Group listening={false}>
      {thirdsX.map((x) => {
        const start = projectPoint({ x, y: 40 }, camera);
        const end = projectPoint({ x, y: BOARD_HEIGHT - 40 }, camera);
        return <Line key={`x-${x}`} points={[start.x, start.y, end.x, end.y]} stroke="#8b6a3f" strokeWidth={1.5} dash={[9, 9]} opacity={0.36} />;
      })}
      {thirdsY.map((y) => {
        const start = projectPoint({ x: 40, y }, camera);
        const end = projectPoint({ x: BOARD_WIDTH - 40, y }, camera);
        return <Line key={`y-${y}`} points={[start.x, start.y, end.x, end.y]} stroke="#8b6a3f" strokeWidth={1.5} dash={[9, 9]} opacity={0.36} />;
      })}
      <Line
        points={projectRect(BOARD_WIDTH / 3, BOARD_HEIGHT / 3, BOARD_WIDTH / 3, BOARD_HEIGHT / 3, camera)}
        closed
        stroke="#2f8f83"
        strokeWidth={2}
        dash={[12, 8]}
        opacity={0.62}
      />
      <Line
        points={projectRect(BOUNDARY_MARGIN, BOUNDARY_MARGIN, BOARD_WIDTH - BOUNDARY_MARGIN * 2, BOARD_HEIGHT - BOUNDARY_MARGIN * 2, camera)}
        closed
        stroke="#b06124"
        strokeWidth={1.6}
        dash={[7, 8]}
        opacity={0.5}
      />
    </Group>
  );
}

function sandCurve(points: Array<{ x: number; y: number }>, camera: SandboxCameraState): string {
  return points
    .map((point, index) => {
      const projected = projectPoint(point, camera);
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
