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
  renderBackdrop?: boolean;
}

interface SandPoint {
  id: string;
  x: number;
  y: number;
  tone: number;
}

interface EdgeSandPoint extends SandPoint {
  size: number;
  rotation: number;
}

interface SandFootprintTrail {
  id: string;
  startX: number;
  startY: number;
  stepX: number;
  stepY: number;
  count: number;
  rotation: number;
  scale: number;
}

interface SandRimDune {
  id: string;
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  tone: "light" | "dark";
  opacity: number;
}

interface WoodKnot {
  id: string;
  side: "front" | "left" | "right";
  along: number;
  depth: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  tone: number;
}

const thirdsX = [BOARD_WIDTH / 3, (BOARD_WIDTH * 2) / 3];
const thirdsY = [BOARD_HEIGHT / 3, (BOARD_HEIGHT * 2) / 3];

const grains = createSandPoints(760, 37, 46, 42, BOARD_WIDTH - 92, BOARD_HEIGHT - 86);
const fineGrains = createSandPoints(520, 913, 58, 54, BOARD_WIDTH - 116, BOARD_HEIGHT - 108);
const flecks = createSandPoints(170, 211, 74, 64, BOARD_WIDTH - 148, BOARD_HEIGHT - 128);
const coarseGrains = createSandPoints(110, 1517, 72, 72, BOARD_WIDTH - 144, BOARD_HEIGHT - 144);
const glintGrains = createSandPoints(80, 6773, 62, 58, BOARD_WIDTH - 124, BOARD_HEIGHT - 116);
const cinematicGrains = createSandPoints(150, 9181, 86, 88, BOARD_WIDTH - 172, BOARD_HEIGHT - 176);
const edgeSand = createEdgeSandPoints(190, 2711);
const footprintTrails = createFootprintTrails();
const rimDunes = createSandRimDunes();
const woodKnots = createWoodKnots(24, 4811);

export function SandboxGuideLayer({
  environment,
  camera,
  showGuides,
  renderBackdrop = true,
}: SandboxGuideLayerProps): JSX.Element {
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

  if (!renderBackdrop) {
    return <Group>{showGuides ? <GuideOverlay camera={camera} /> : null}</Group>;
  }

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
      <StudioDepthBackdrop environment={environment} />
      <StudioRoomAmbience environment={environment} />
      <StudioTableSurface environment={environment} camera={camera} />

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

      <SandInsetVolume environment={environment} camera={camera} />
      <SandPremiumRelief environment={environment} camera={camera} />
      <SandSculptedSurface environment={environment} camera={camera} />
      <SandMounds camera={camera} />
      <SandRakeComb camera={camera} />
      <SandRakeLines camera={camera} />
      <SandContourBands camera={camera} />
      <BlueInnerLiner camera={camera} />
      <BlueInnerLinerGloss environment={environment} camera={camera} />
      <BlueInnerLinerDepth environment={environment} camera={camera} />
      <SandEdgeOcclusion camera={camera} edgeGlowOpacity={edgeGlowOpacity} />
      <SandEdgeBuildUp camera={camera} />
      <SandPocketShadows environment={environment} camera={camera} />
      <StageLightWash environment={environment} camera={camera} />
      <SandWindowLight environment={environment} camera={camera} />
      <SandTexture camera={camera} />
      <SandMicroRelief camera={camera} />
      <SandSpecularGrains environment={environment} camera={camera} />
      <SandCinematicGrainField environment={environment} camera={camera} />
      <SandHighDefinitionRelief environment={environment} camera={camera} />
      <SandFootprints camera={camera} />
      {showGuides ? <GuideOverlay camera={camera} /> : null}
      <WoodFrameHighlights camera={camera} />
      <WoodMiterDetails environment={environment} camera={camera} />
      <WoodBevelCaps environment={environment} camera={camera} />
    </Group>
  );
}

function StudioTableSurface({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const corners = getProjectedStageCorners(camera);
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";

  return (
    <Group listening={false}>
      <Ellipse
        x={(corners.bottomLeft.x + corners.bottomRight.x) * 0.5}
        y={corners.bottomLeft.y + STAGE_THICKNESS * 0.9}
        radiusX={night ? 430 : 470}
        radiusY={night ? 82 : 92}
        fill={night ? "#07141c" : "#b99662"}
        opacity={night ? 0.2 : rainy ? 0.12 : 0.16}
        rotation={-1}
      />
      <Ellipse
        x={VIEW_WIDTH * 0.28}
        y={VIEW_HEIGHT * 0.78}
        radiusX={260}
        radiusY={68}
        fill={night ? "#21434e" : "#fff3cf"}
        opacity={night ? 0.05 : rainy ? 0.07 : 0.11}
        rotation={-6}
      />
      <Ellipse
        x={VIEW_WIDTH * 0.78}
        y={VIEW_HEIGHT * 0.28}
        radiusX={210}
        radiusY={56}
        fill={night ? "#7dd8d4" : "#ffffff"}
        opacity={night ? 0.05 : rainy ? 0.06 : 0.12}
        rotation={-10}
      />
    </Group>
  );
}

function StudioDepthBackdrop({ environment }: { environment: SandboxEnvironment }): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const panelOpacity = night ? 0.08 : rainy ? 0.1 : cloudy ? 0.12 : 0.18;
  const plantOpacity = night ? 0.045 : rainy ? 0.055 : 0.085;
  const warmGlowOpacity = night ? 0.02 : rainy ? 0.04 : cloudy ? 0.055 : 0.12;

  return (
    <Group listening={false}>
      <Rect
        x={64}
        y={26}
        width={184}
        height={202}
        cornerRadius={24}
        fillLinearGradientStartPoint={{ x: 64, y: 26 }}
        fillLinearGradientEndPoint={{ x: 248, y: 228 }}
        fillLinearGradientColorStops={[
          0,
          night ? "#193444" : "#fff6dc",
          0.55,
          night ? "#0c2330" : "#eef4df",
          1,
          night ? "#071923" : "#d8e8cc",
        ]}
        opacity={panelOpacity}
        shadowColor={night ? "#6fe5e0" : "#fff1c6"}
        shadowBlur={34}
        shadowOpacity={night ? 0.08 : 0.16}
      />
      <Rect
        x={820}
        y={18}
        width={214}
        height={174}
        cornerRadius={28}
        fillLinearGradientStartPoint={{ x: 820, y: 18 }}
        fillLinearGradientEndPoint={{ x: 1034, y: 192 }}
        fillLinearGradientColorStops={[
          0,
          night ? "#18394d" : "#fffdf0",
          0.54,
          night ? "#102838" : "#edf5e3",
          1,
          night ? "#081923" : "#d6e6ca",
        ]}
        opacity={night ? 0.075 : rainy ? 0.08 : 0.13}
        shadowColor={night ? "#7bded8" : "#ffffff"}
        shadowBlur={26}
        shadowOpacity={night ? 0.08 : 0.12}
      />
      {[120, 172, 224, 882, 946, 1010].map((x, index) => (
        <Line
          key={`studio-window-slat-${x}`}
          points={[x, index < 3 ? 44 : 34, x, index < 3 ? 208 : 174]}
          stroke={night ? "#a9ede8" : "#fff9e5"}
          strokeWidth={1.4}
          opacity={night ? 0.075 : 0.16}
        />
      ))}
      <Ellipse
        x={VIEW_WIDTH * 0.5}
        y={VIEW_HEIGHT * 0.15}
        radiusX={night ? 360 : 420}
        radiusY={night ? 82 : 108}
        fill={night ? "#5ca7ba" : "#fff2c4"}
        opacity={warmGlowOpacity}
        rotation={-5}
      />
      <Group opacity={plantOpacity} listening={false}>
        <Ellipse x={76} y={474} radiusX={74} radiusY={164} fill={night ? "#68a79c" : "#6dbb72"} rotation={-10} />
        <Ellipse x={122} y={444} radiusX={54} radiusY={136} fill={night ? "#78b7ad" : "#8dca7b"} rotation={8} />
        <Ellipse x={1034} y={420} radiusX={88} radiusY={166} fill={night ? "#65a29a" : "#72bd70"} rotation={10} />
        <Ellipse x={978} y={466} radiusX={58} radiusY={126} fill={night ? "#7bbab0" : "#99ce80"} rotation={-12} />
      </Group>
    </Group>
  );
}

function StudioRoomAmbience({ environment }: { environment: SandboxEnvironment }): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const beamOpacity = night ? 0.035 : rainy ? 0.045 : cloudy ? 0.075 : 0.16;
  const windowOpacity = night ? 0.12 : rainy ? 0.16 : cloudy ? 0.18 : 0.26;
  const plantOpacity = night ? 0.08 : rainy ? 0.09 : 0.12;
  const warmth = night ? "#9ee9ee" : rainy ? "#eef2df" : "#fff2c3";
  const wallTone = night ? "#18313f" : rainy ? "#dbe2d2" : "#fff5d8";
  const plantDark = night ? "#13363a" : rainy ? "#6a8f72" : "#4f9560";
  const plantLight = night ? "#2c6a69" : rainy ? "#95b982" : "#8bcf7c";

  return (
    <Group listening={false}>
      <Rect
        x={154}
        y={18}
        width={792}
        height={238}
        cornerRadius={30}
        fillLinearGradientStartPoint={{ x: 154, y: 18 }}
        fillLinearGradientEndPoint={{ x: 946, y: 256 }}
        fillLinearGradientColorStops={[
          0,
          night ? "#102839" : "#fffdf1",
          0.42,
          wallTone,
          1,
          night ? "#0a1d2a" : "#dbe8d0",
        ]}
        opacity={windowOpacity}
        shadowColor={night ? "#75fff2" : "#ffffff"}
        shadowBlur={42}
        shadowOpacity={night ? 0.06 : 0.18}
      />
      {[240, 384, 528, 672, 816].map((x) => (
        <Line
          key={`studio-room-window-vertical-${x}`}
          points={[x, 40, x, 224]}
          stroke={night ? "#b8fff7" : "#ffffff"}
          strokeWidth={1.2}
          opacity={night ? 0.1 : 0.22}
        />
      ))}
      {[84, 150, 216].map((y) => (
        <Line
          key={`studio-room-window-horizontal-${y}`}
          points={[184, y, 916, y]}
          stroke={night ? "#b8fff7" : "#ffffff"}
          strokeWidth={1.1}
          opacity={night ? 0.08 : 0.16}
        />
      ))}
      <Line
        points={[120, 40, 392, 38, 274, 318, 20, 352]}
        closed
        fill={warmth}
        opacity={beamOpacity}
      />
      <Line
        points={[742, 32, 1028, 52, 1056, 328, 812, 282]}
        closed
        fill={night ? "#7adce4" : "#fff7d0"}
        opacity={beamOpacity * 0.72}
      />
      <Line
        points={[420, 18, 610, 28, 744, 284, 516, 294]}
        closed
        fill={night ? "#7adce4" : "#fff7d0"}
        opacity={beamOpacity * 0.48}
      />
      {rainy ? (
        <Group opacity={night ? 0.16 : 0.18} listening={false}>
          {[208, 334, 472, 642, 788, 902].map((x, index) => (
            <Line
              key={`studio-room-rain-streak-${x}`}
              points={[x, 48 + (index % 2) * 14, x + 18, 164 + (index % 3) * 22]}
              stroke={night ? "#d8fff8" : "#ffffff"}
              strokeWidth={1}
              opacity={0.58}
              lineCap="round"
            />
          ))}
        </Group>
      ) : null}
      <Group opacity={plantOpacity} listening={false}>
        <Rect x={34} y={430} width={42} height={74} cornerRadius={12} fill={night ? "#29414a" : "#b98758"} />
        <Ellipse x={56} y={392} radiusX={54} radiusY={112} fill={plantDark} rotation={-12} />
        <Ellipse x={94} y={384} radiusX={38} radiusY={96} fill={plantLight} rotation={9} />
        <Ellipse x={22} y={422} radiusX={30} radiusY={84} fill={plantLight} rotation={-22} />
        <Rect x={1022} y={426} width={46} height={78} cornerRadius={13} fill={night ? "#263f48" : "#ad7c52"} />
        <Ellipse x={1044} y={378} radiusX={72} radiusY={132} fill={plantDark} rotation={12} />
        <Ellipse x={1000} y={408} radiusX={42} radiusY={104} fill={plantLight} rotation={-16} />
        <Ellipse x={1080} y={410} radiusX={38} radiusY={96} fill={plantLight} rotation={24} />
      </Group>
      <Ellipse
        x={VIEW_WIDTH * 0.5}
        y={VIEW_HEIGHT * 0.88}
        radiusX={510}
        radiusY={82}
        fill={night ? "#06121b" : "#6f4d26"}
        opacity={night ? 0.2 : rainy ? 0.09 : 0.12}
        rotation={-1}
      />
    </Group>
  );
}

function SandInsetVolume({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const innerDark = night ? "#162833" : rainy ? "#67593f" : "#6a4c2b";
  const innerLight = night ? "#cdfdf5" : rainy ? "#f6e5bd" : "#fff0bd";

  return (
    <Group listening={false}>
      <Line
        points={projectRect(26, 26, BOARD_WIDTH - 52, BOARD_HEIGHT - 52, camera)}
        closed
        stroke={innerDark}
        strokeWidth={18}
        opacity={night ? 0.16 : rainy ? 0.13 : 0.1}
        lineJoin="round"
      />
      <Line
        points={projectRect(46, 44, BOARD_WIDTH - 92, BOARD_HEIGHT - 88, camera)}
        closed
        stroke={innerLight}
        strokeWidth={5}
        opacity={night ? 0.09 : rainy ? 0.14 : 0.22}
        lineJoin="round"
      />
      <Line
        points={projectRect(62, 60, BOARD_WIDTH - 124, BOARD_HEIGHT - 120, camera)}
        closed
        stroke={night ? "#395d64" : "#d7b776"}
        strokeWidth={2.2}
        opacity={night ? 0.12 : 0.14}
        dash={[24, 24]}
        lineJoin="round"
      />
    </Group>
  );
}

function SandPocketShadows({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const pockets = [
    { id: "pocket-a", x: 196, y: 194, rx: 92, ry: 20, rot: -7, opacity: 0.13 },
    { id: "pocket-b", x: 482, y: 162, rx: 122, ry: 26, rot: 5, opacity: 0.1 },
    { id: "pocket-c", x: 704, y: 348, rx: 152, ry: 36, rot: -4, opacity: 0.12 },
    { id: "pocket-d", x: 278, y: 496, rx: 118, ry: 28, rot: -10, opacity: 0.1 },
  ];

  return (
    <Group listening={false}>
      {pockets.map((pocket) => {
        const point = projectPoint({ x: pocket.x, y: pocket.y }, camera);
        return (
          <Group key={pocket.id} listening={false}>
            <Ellipse
              x={point.x}
              y={point.y}
              radiusX={pocket.rx}
              radiusY={pocket.ry}
              fill={night ? "#102833" : rainy ? "#665b46" : "#826440"}
              opacity={night ? pocket.opacity * 0.66 : pocket.opacity}
              rotation={pocket.rot}
            />
            <Ellipse
              x={point.x - 8}
              y={point.y - 4}
              radiusX={pocket.rx * 0.74}
              radiusY={pocket.ry * 0.44}
              fill={night ? "#b7f2ea" : "#fff4ca"}
              opacity={night ? 0.035 : rainy ? 0.04 : 0.055}
              rotation={pocket.rot}
            />
          </Group>
        );
      })}
    </Group>
  );
}

function SandEdgeBuildUp({ camera }: { camera: SandboxCameraState }): JSX.Element {
  return (
    <Group listening={false}>
      <Line
        points={projectRect(48, 48, BOARD_WIDTH - 96, BOARD_HEIGHT - 96, camera)}
        closed
        stroke="#fff0c4"
        strokeWidth={7}
        opacity={0.15}
        lineJoin="round"
      />
      <Line
        points={projectRect(66, 66, BOARD_WIDTH - 132, BOARD_HEIGHT - 132, camera)}
        closed
        stroke="#8b6e44"
        strokeWidth={5}
        opacity={0.09}
        lineJoin="round"
      />
      <Line
        points={projectRect(88, 82, BOARD_WIDTH - 176, BOARD_HEIGHT - 164, camera)}
        closed
        stroke="#fff7d5"
        strokeWidth={2.2}
        opacity={0.13}
        dash={[18, 28]}
        lineJoin="round"
      />
      {rimDunes.map((dune) => {
        const point = projectPoint(dune, camera);
        const fill = dune.tone === "light" ? "#fff0bd" : "#9a7d50";
        return (
          <Ellipse
            key={dune.id}
            x={point.x}
            y={point.y}
            radiusX={dune.radiusX}
            radiusY={dune.radiusY}
            fill={fill}
            opacity={dune.opacity}
            rotation={dune.rotation}
          />
        );
      })}
      {edgeSand.map((grain) => {
        const point = projectPoint(grain, camera);
        const light = grain.tone > 0.56;
        return (
          <Ellipse
            key={grain.id}
            x={point.x}
            y={point.y}
            radiusX={2.2 + grain.size * 4.8}
            radiusY={0.7 + grain.size * 1.65}
            fill={light ? "#fff1c9" : "#a88758"}
            opacity={light ? 0.24 : 0.16}
            rotation={grain.rotation}
          />
        );
      })}
    </Group>
  );
}

function SandPremiumRelief({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const warm = night ? "#c7efe7" : rainy ? "#f1dfb5" : "#fff2c4";
  const cool = night ? "#163541" : rainy ? "#6f664f" : "#8b6d45";

  return (
    <Group listening={false}>
      <Line
        points={projectRect(76, 74, BOARD_WIDTH - 152, BOARD_HEIGHT - 148, camera)}
        closed
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: VIEW_WIDTH, y: VIEW_HEIGHT }}
        fillLinearGradientColorStops={[
          0,
          night ? "rgba(203, 245, 235, 0.045)" : "rgba(255, 248, 209, 0.13)",
          0.48,
          rainy ? "rgba(112, 102, 78, 0.05)" : "rgba(255, 255, 255, 0.05)",
          1,
          night ? "rgba(7, 20, 28, 0.1)" : "rgba(118, 83, 45, 0.08)",
        ]}
        opacity={1}
      />
      {[
        { x: 172, y: 130, rx: 78, ry: 15, rot: -8, a: 0.16 },
        { x: 350, y: 104, rx: 96, ry: 18, rot: 3, a: 0.12 },
        { x: 760, y: 182, rx: 112, ry: 22, rot: -4, a: 0.12 },
        { x: 230, y: 386, rx: 118, ry: 24, rot: -7, a: 0.11 },
        { x: 666, y: 496, rx: 132, ry: 25, rot: 5, a: 0.13 },
      ].map((ridge, index) => {
        const point = projectPoint(ridge, camera);
        return (
          <Group key={`premium-ridge-${index}`} listening={false}>
            <Ellipse
              x={point.x}
              y={point.y}
              radiusX={ridge.rx}
              radiusY={ridge.ry}
              fill={warm}
              opacity={night ? ridge.a * 0.38 : rainy ? ridge.a * 0.72 : ridge.a}
              rotation={ridge.rot}
            />
            <Ellipse
              x={point.x + 9}
              y={point.y + 6}
              radiusX={ridge.rx * 0.82}
              radiusY={ridge.ry * 0.55}
              fill={cool}
              opacity={night ? 0.055 : rainy ? 0.07 : 0.06}
              rotation={ridge.rot}
            />
          </Group>
        );
      })}
      <Path
        data={sandCurve(
          [
            { x: 108, y: 96 },
            { x: 244, y: 74 },
            { x: 402, y: 92 },
            { x: 544, y: 74 },
            { x: 710, y: 106 },
            { x: 914, y: 92 },
          ],
          camera,
        )}
        stroke={warm}
        strokeWidth={3.4}
        opacity={night ? 0.05 : rainy ? 0.09 : 0.16}
        lineCap="round"
        lineJoin="round"
      />
      <Path
        data={sandCurve(
          [
            { x: 92, y: 562 },
            { x: 238, y: 532 },
            { x: 398, y: 554 },
            { x: 574, y: 520 },
            { x: 786, y: 548 },
            { x: 944, y: 520 },
          ],
          camera,
        )}
        stroke={cool}
        strokeWidth={2.2}
        opacity={night ? 0.08 : rainy ? 0.1 : 0.11}
        lineCap="round"
        lineJoin="round"
      />
    </Group>
  );
}

function SandSculptedSurface({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const highlight = night ? "#dafbf4" : rainy ? "#f8e6b8" : "#fff3bf";
  const mid = night ? "#718e88" : rainy ? "#b39a67" : "#d7aa62";
  const shadow = night ? "#0b1f28" : rainy ? "#6e593b" : "#865d32";
  const liftOpacity = night ? 0.055 : rainy ? 0.085 : 0.13;
  const shadeOpacity = night ? 0.085 : rainy ? 0.11 : 0.12;

  const dunes = [
    { id: "soft-shoulder-left", x: 188, y: 154, rx: 148, ry: 34, rot: -8, lift: 0.92 },
    { id: "central-hand-smoothed", x: 498, y: 286, rx: 212, ry: 46, rot: -5, lift: 0.72 },
    { id: "right-back-bank", x: 834, y: 158, rx: 174, ry: 36, rot: 6, lift: 0.82 },
    { id: "front-swept-shelf", x: 332, y: 514, rx: 228, ry: 42, rot: -9, lift: 0.68 },
    { id: "water-side-shelf", x: 730, y: 426, rx: 176, ry: 38, rot: 8, lift: 0.74 },
  ];

  const furrows = [
    {
      id: "upper-sand-comb",
      opacity: 0.72,
      width: 1.5,
      points: [
        { x: 110, y: 132 },
        { x: 248, y: 112 },
        { x: 400, y: 132 },
        { x: 540, y: 108 },
        { x: 714, y: 136 },
      ],
    },
    {
      id: "middle-sand-comb",
      opacity: 0.62,
      width: 1.35,
      points: [
        { x: 188, y: 310 },
        { x: 340, y: 280 },
        { x: 494, y: 306 },
        { x: 672, y: 272 },
        { x: 884, y: 306 },
      ],
    },
    {
      id: "front-sand-comb",
      opacity: 0.56,
      width: 1.25,
      points: [
        { x: 122, y: 526 },
        { x: 288, y: 494 },
        { x: 460, y: 522 },
        { x: 636, y: 486 },
        { x: 852, y: 518 },
      ],
    },
  ];

  return (
    <Group listening={false}>
      {dunes.map((dune) => {
        const point = projectPoint({ x: dune.x, y: dune.y }, camera);
        return (
          <Group key={dune.id} listening={false}>
            <Ellipse
              x={point.x + 7}
              y={point.y + 8}
              radiusX={dune.rx}
              radiusY={dune.ry}
              fill={shadow}
              opacity={shadeOpacity * dune.lift}
              rotation={dune.rot}
            />
            <Ellipse
              x={point.x - 7}
              y={point.y - 5}
              radiusX={dune.rx * 0.86}
              radiusY={dune.ry * 0.48}
              fill={highlight}
              opacity={liftOpacity * dune.lift}
              rotation={dune.rot}
            />
            <Ellipse
              x={point.x - 1}
              y={point.y + 1}
              radiusX={dune.rx * 0.54}
              radiusY={Math.max(6, dune.ry * 0.18)}
              stroke={mid}
              strokeWidth={1.05}
              opacity={(night ? 0.045 : rainy ? 0.065 : 0.08) * dune.lift}
              rotation={dune.rot}
            />
          </Group>
        );
      })}
      {furrows.map((furrow, index) => (
        <Group key={furrow.id} listening={false}>
          <Path
            data={sandCurve(furrow.points.map((point) => ({ x: point.x + 4, y: point.y + 4 })), camera)}
            stroke={shadow}
            strokeWidth={furrow.width}
            opacity={(night ? 0.05 : rainy ? 0.07 : 0.075) * furrow.opacity}
            lineCap="round"
            lineJoin="round"
          />
          <Path
            data={sandCurve(furrow.points, camera)}
            stroke={index % 2 === 0 ? highlight : mid}
            strokeWidth={furrow.width}
            opacity={(night ? 0.055 : rainy ? 0.08 : 0.12) * furrow.opacity}
            lineCap="round"
            lineJoin="round"
          />
        </Group>
      ))}
    </Group>
  );
}

function SandRakeComb({ camera }: { camera: SandboxCameraState }): JSX.Element {
  const combs = [
    { id: "upper-left", x: 118, y: 178, length: 220, rows: 8, tilt: -15, gap: 9, opacity: 0.12 },
    { id: "upper-right", x: 604, y: 174, length: 258, rows: 9, tilt: -12, gap: 8, opacity: 0.1 },
    { id: "front-left", x: 128, y: 458, length: 318, rows: 10, tilt: -10, gap: 8, opacity: 0.1 },
  ];

  return (
    <Group listening={false}>
      {combs.flatMap((comb) =>
        Array.from({ length: comb.rows }, (_, row) => {
          const y = comb.y + row * comb.gap;
          const offset = row % 2 === 0 ? 0 : 18;
          return (
            <Path
              key={`rake-comb-${comb.id}-${row}`}
              data={sandCurve(
                [
                  { x: comb.x + offset, y },
                  { x: comb.x + comb.length * 0.3 + offset, y: y - 18 },
                  { x: comb.x + comb.length * 0.68 + offset, y: y - 2 },
                  { x: comb.x + comb.length + offset, y: y - 24 },
                ],
                camera,
              )}
              stroke={row % 3 === 0 ? "#7f6845" : "#fff4cb"}
              strokeWidth={row % 3 === 0 ? 1.1 : 1.45}
              opacity={row % 3 === 0 ? comb.opacity * 0.8 : comb.opacity}
              lineCap="round"
              lineJoin="round"
              rotation={comb.tilt * 0.02}
            />
          );
        }),
      )}
    </Group>
  );
}

function SandFootprints({ camera }: { camera: SandboxCameraState }): JSX.Element {
  return (
    <Group listening={false}>
      {footprintTrails.flatMap((trail) =>
        Array.from({ length: trail.count }, (_, step) => {
          const side = step % 2 === 0 ? -1 : 1;
          const boardPoint = {
            x: trail.startX + trail.stepX * step + side * 8 * trail.scale,
            y: trail.startY + trail.stepY * step + (step % 3) * 1.8,
          };
          const point = projectPoint(boardPoint, camera);
          const rotation = trail.rotation + side * 6;
          const key = `${trail.id}-${step}`;
          return (
            <Group key={key} listening={false}>
              <Ellipse
                x={point.x}
                y={point.y}
                radiusX={9.5 * trail.scale}
                radiusY={3.3 * trail.scale}
                fill="#806944"
                opacity={0.115}
                rotation={rotation}
              />
              <Ellipse
                x={point.x - 1.2}
                y={point.y - 1.1}
                radiusX={7.4 * trail.scale}
                radiusY={2.2 * trail.scale}
                stroke="#fff5d1"
                strokeWidth={0.9}
                opacity={0.13}
                rotation={rotation}
              />
            </Group>
          );
        }),
      )}
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

function BlueInnerLinerGloss({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const topOpacity = night ? 0.2 : rainy ? 0.3 : 0.42;
  const coolOpacity = night ? 0.16 : rainy ? 0.24 : 0.28;

  return (
    <Group listening={false}>
      <Line
        points={projectRect(16, 16, BOARD_WIDTH - 32, 20, camera)}
        closed
        fill="#94e6ff"
        opacity={topOpacity}
      />
      <Line
        points={projectRect(18, 42, BOARD_WIDTH - 36, 11, camera)}
        closed
        fill="#0a5c82"
        opacity={night ? 0.22 : 0.18}
      />
      <Line
        points={projectRect(16, BOARD_HEIGHT - 36, BOARD_WIDTH - 32, 18, camera)}
        closed
        fill="#5cc7f0"
        opacity={coolOpacity}
      />
      <Line
        points={projectRect(18, 18, 18, BOARD_HEIGHT - 36, camera)}
        closed
        fill="#a6eaff"
        opacity={night ? 0.18 : 0.32}
      />
      <Line
        points={projectRect(BOARD_WIDTH - 36, 18, 18, BOARD_HEIGHT - 36, camera)}
        closed
        fill="#063d62"
        opacity={night ? 0.26 : 0.18}
      />
      <Line
        points={projectRect(32, 32, BOARD_WIDTH - 64, BOARD_HEIGHT - 64, camera)}
        closed
        stroke={night ? "#85e8ff" : "#e8fbff"}
        strokeWidth={1.2}
        opacity={night ? 0.16 : rainy ? 0.26 : 0.34}
      />
    </Group>
  );
}

function BlueInnerLinerDepth({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const innerGlow = night ? "#a3fff5" : rainy ? "#bff6ff" : "#f4ffff";
  const edgeBlue = night ? "#49d8e7" : rainy ? "#55c9e6" : "#1b9ed2";
  const darkBlue = night ? "#042331" : "#073f61";
  const topLeft = projectPoint({ x: 38, y: 38 }, camera);
  const topRight = projectPoint({ x: BOARD_WIDTH - 38, y: 38 }, camera);
  const bottomLeft = projectPoint({ x: 38, y: BOARD_HEIGHT - 38 }, camera);
  const bottomRight = projectPoint({ x: BOARD_WIDTH - 38, y: BOARD_HEIGHT - 38 }, camera);

  return (
    <Group listening={false}>
      <Line
        points={projectRect(24, 24, BOARD_WIDTH - 48, BOARD_HEIGHT - 48, camera)}
        closed
        stroke={darkBlue}
        strokeWidth={9}
        opacity={night ? 0.26 : rainy ? 0.18 : 0.2}
        lineJoin="round"
      />
      <Line
        points={projectRect(29, 29, BOARD_WIDTH - 58, BOARD_HEIGHT - 58, camera)}
        closed
        stroke={edgeBlue}
        strokeWidth={3.4}
        opacity={night ? 0.26 : rainy ? 0.32 : 0.42}
        lineJoin="round"
      />
      <Line
        points={projectRect(37, 37, BOARD_WIDTH - 74, BOARD_HEIGHT - 74, camera)}
        closed
        stroke={innerGlow}
        strokeWidth={1.2}
        opacity={night ? 0.18 : rainy ? 0.26 : 0.34}
        dash={[42, 20]}
        lineJoin="round"
      />
      {[
        { x1: topLeft.x + 28, y1: topLeft.y + 8, x2: topRight.x - 92, y2: topRight.y + 6, width: 2.2, opacity: 0.32 },
        { x1: topLeft.x + 14, y1: topLeft.y + 26, x2: bottomLeft.x + 18, y2: bottomLeft.y - 76, width: 1.7, opacity: 0.22 },
        { x1: bottomLeft.x + 82, y1: bottomLeft.y - 6, x2: bottomRight.x - 54, y2: bottomRight.y - 5, width: 1.6, opacity: 0.18 },
      ].map((glint, index) => (
        <Line
          key={`blue-liner-depth-glint-${index}`}
          points={[glint.x1, glint.y1, glint.x2, glint.y2]}
          stroke={innerGlow}
          strokeWidth={glint.width}
          opacity={(night ? 0.55 : 1) * glint.opacity}
          lineCap="round"
        />
      ))}
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

function SandContourBands({ camera }: { camera: SandboxCameraState }): JSX.Element {
  const bands = [
    {
      points: [
        { x: 124, y: 142 },
        { x: 238, y: 128 },
        { x: 348, y: 154 },
        { x: 476, y: 134 },
        { x: 620, y: 164 },
      ],
      stroke: "#fff6d4",
      width: 2.6,
      opacity: 0.17,
    },
    {
      points: [
        { x: 176, y: 228 },
        { x: 328, y: 204 },
        { x: 480, y: 232 },
        { x: 626, y: 204 },
        { x: 812, y: 236 },
      ],
      stroke: "#8e7249",
      width: 1.6,
      opacity: 0.12,
    },
    {
      points: [
        { x: 114, y: 344 },
        { x: 250, y: 314 },
        { x: 390, y: 336 },
        { x: 544, y: 306 },
        { x: 736, y: 342 },
      ],
      stroke: "#fff1c6",
      width: 2.2,
      opacity: 0.13,
    },
    {
      points: [
        { x: 250, y: 504 },
        { x: 404, y: 476 },
        { x: 552, y: 500 },
        { x: 734, y: 468 },
        { x: 888, y: 492 },
      ],
      stroke: "#846843",
      width: 1.4,
      opacity: 0.11,
    },
  ];

  return (
    <Group listening={false}>
      {bands.map((band, index) => (
        <Path
          key={`sand-contour-band-${index}`}
          data={sandCurve(band.points, camera)}
          stroke={band.stroke}
          strokeWidth={band.width}
          opacity={band.opacity}
          lineCap="round"
          lineJoin="round"
        />
      ))}
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
  const daytime = environment.light === "day";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const washScale = daytime ? (rainy ? 0.38 : cloudy ? 0.46 : 0.54) : 0.78;
  const rimOpacity = daytime ? (rainy ? 0.06 : cloudy ? 0.07 : 0.08) : 0.07;

  return (
    <Group listening={false}>
      <Ellipse
        x={warm.x}
        y={warm.y}
        radiusX={daytime ? 230 : 310}
        radiusY={daytime ? 64 : 88}
        fill="#fff7cf"
        opacity={profile.warmWashOpacity * washScale}
        rotation={-8}
      />
      <Ellipse
        x={cool.x}
        y={cool.y}
        radiusX={daytime ? 185 : 250}
        radiusY={daytime ? 52 : 72}
        fill="#8ccfc7"
        opacity={profile.coolWashOpacity * washScale}
        rotation={-10}
      />
      <Line
        points={projectRect(42, 42, BOARD_WIDTH - 84, BOARD_HEIGHT - 84, camera)}
        closed
        stroke="#fff5ca"
        strokeWidth={5}
        opacity={rimOpacity}
      />
    </Group>
  );
}

function SandWindowLight({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const sunny = environment.weather === "sunny";
  const rainy = environment.weather === "rainy";
  const cloudy = environment.weather === "cloudy";
  const beamOpacity = night ? 0.035 : sunny ? 0.088 : rainy ? 0.028 : 0.044;
  const highlight = night ? "#bcfff5" : "#fff7cf";
  const shade = night ? "#061a23" : rainy ? "#6b6049" : "#8a6a40";
  const warmth = night ? 0.5 : rainy ? 0.52 : cloudy ? 0.62 : 0.72;

  return (
    <Group listening={false}>
      <Line
        points={projectPolygon(
          [
            { x: 88, y: 118 },
            { x: 362, y: 74 },
            { x: 526, y: 148 },
            { x: 168, y: 214 },
          ],
          camera,
        )}
        closed
        fill={highlight}
        opacity={beamOpacity}
      />
      <Line
        points={projectPolygon(
          [
            { x: 620, y: 90 },
            { x: 978, y: 138 },
            { x: 890, y: 244 },
            { x: 574, y: 188 },
          ],
          camera,
        )}
        closed
        fill={highlight}
        opacity={beamOpacity * 0.78}
      />
      <Line
        points={projectPolygon(
          [
            { x: 152, y: 486 },
            { x: 448, y: 430 },
            { x: 674, y: 520 },
            { x: 248, y: 574 },
          ],
          camera,
        )}
        closed
        fill={night ? "#7edfd6" : "#fff0b2"}
        opacity={beamOpacity * 0.55}
      />
      <Path
        data={sandCurve(
          [
            { x: 112, y: 232 },
            { x: 260, y: 196 },
            { x: 410, y: 226 },
            { x: 552, y: 186 },
            { x: 740, y: 224 },
            { x: 932, y: 190 },
          ],
          camera,
        )}
        stroke={highlight}
        strokeWidth={sunny ? 3.2 : 2.4}
        opacity={(night ? 0.05 : sunny ? 0.12 : 0.06) * warmth}
        lineCap="round"
        lineJoin="round"
      />
      <Path
        data={sandCurve(
          [
            { x: 112, y: 340 },
            { x: 282, y: 372 },
            { x: 436, y: 334 },
            { x: 624, y: 370 },
            { x: 816, y: 334 },
            { x: 992, y: 360 },
          ],
          camera,
        )}
        stroke={shade}
        strokeWidth={night ? 2.4 : 2.8}
        opacity={night ? 0.045 : rainy ? 0.075 : 0.06}
        lineCap="round"
        lineJoin="round"
      />
      {[0.18, 0.32, 0.46, 0.63, 0.78].map((offset, index) => {
        const start = projectPoint({ x: BOARD_WIDTH * offset, y: 72 + index * 18 }, camera);
        const end = projectPoint({ x: BOARD_WIDTH * (offset + 0.08), y: 128 + index * 26 }, camera);
        return (
          <Line
            key={`sand-window-glint-${offset}`}
            points={[start.x, start.y, end.x, end.y]}
            stroke={highlight}
            strokeWidth={1}
            opacity={night ? 0.04 : sunny ? 0.12 : 0.055}
            lineCap="round"
          />
        );
      })}
    </Group>
  );
}

function SandTexture({ camera }: { camera: SandboxCameraState }): JSX.Element {
  return (
    <Group listening={false}>
      {coarseGrains.map((grain) => {
        const point = projectPoint(grain, camera);
        const light = grain.tone > 0.64;
        return (
          <Ellipse
            key={grain.id}
            x={point.x}
            y={point.y}
            radiusX={1.8 + grain.tone * 2.6}
            radiusY={0.65 + grain.tone * 0.95}
            fill={light ? "#fff2c9" : "#836947"}
            opacity={light ? 0.32 : 0.14}
            rotation={grain.tone * 150}
          />
        );
      })}
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

function SandSpecularGrains({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const opacityScale = night ? 0.5 : rainy ? 0.72 : 1;

  return (
    <Group listening={false}>
      {glintGrains.map((grain, index) => {
        const point = projectPoint(grain, camera);
        const bright = grain.tone > 0.62;
        return (
          <Ellipse
            key={grain.id}
            x={point.x}
            y={point.y}
            radiusX={bright ? 2.8 + grain.tone * 2.4 : 1.8}
            radiusY={bright ? 0.55 + grain.tone * 0.8 : 0.42}
            fill={night ? "#dffff7" : bright ? "#fff9db" : "#ead2a0"}
            opacity={(bright ? 0.24 : 0.12) * opacityScale}
            rotation={-14 + ((index * 17) % 46)}
          />
        );
      })}
      <Path
        data={sandCurve([
          { x: 118, y: 118 },
          { x: 292, y: 88 },
          { x: 468, y: 106 },
          { x: 648, y: 88 },
          { x: 892, y: 136 },
        ], camera)}
        stroke={night ? "#cafff7" : "#fff8d8"}
        strokeWidth={2.8}
        opacity={(night ? 0.07 : 0.16) * opacityScale}
        lineCap="round"
        lineJoin="round"
      />
      <Path
        data={sandCurve([
          { x: 172, y: 520 },
          { x: 354, y: 488 },
          { x: 548, y: 516 },
          { x: 756, y: 476 },
          { x: 938, y: 506 },
        ], camera)}
        stroke={night ? "#729a98" : "#8d7147"}
        strokeWidth={1.8}
        opacity={night ? 0.08 : rainy ? 0.1 : 0.12}
        lineCap="round"
        lineJoin="round"
      />
    </Group>
  );
}

function SandCinematicGrainField({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const highlight = night ? "#d8fff8" : rainy ? "#f4e7bf" : "#fff5cc";
  const mid = night ? "#78938b" : rainy ? "#b99b69" : "#d7ad64";
  const shadow = night ? "#0b202a" : rainy ? "#675036" : "#8a6338";
  const glintOpacity = night ? 0.12 : rainy ? 0.16 : 0.22;
  const ridgeOpacity = night ? 0.05 : rainy ? 0.09 : 0.13;

  return (
    <Group listening={false}>
      {cinematicGrains.map((grain, index) => {
        const point = projectPoint(grain, camera);
        const bright = grain.tone > 0.62;
        const large = index % 11 === 0;
        return (
          <Group key={grain.id} listening={false}>
            <Ellipse
              x={point.x + (large ? 1.2 : 0)}
              y={point.y + (large ? 1 : 0)}
              radiusX={(large ? 4.2 : 2.2) + grain.tone * 2.2}
              radiusY={(large ? 1.28 : 0.66) + grain.tone * 0.62}
              fill={bright ? highlight : mid}
              opacity={(bright ? glintOpacity : glintOpacity * 0.46) * (large ? 1.15 : 1)}
              rotation={-18 + ((index * 23) % 68)}
            />
            {large ? (
              <Ellipse
                x={point.x + 3.8}
                y={point.y + 2.6}
                radiusX={4.4 + grain.tone * 1.6}
                radiusY={0.8 + grain.tone * 0.38}
                fill={shadow}
                opacity={night ? 0.055 : rainy ? 0.08 : 0.075}
                rotation={-18 + ((index * 23) % 68)}
              />
            ) : null}
          </Group>
        );
      })}
      {[
        {
          id: "cinematic-sweep-left",
          points: [
            { x: 122, y: 206 },
            { x: 240, y: 176 },
            { x: 380, y: 194 },
            { x: 510, y: 166 },
          ],
          width: 10,
          opacity: 0.72,
        },
        {
          id: "cinematic-sweep-lower",
          points: [
            { x: 174, y: 508 },
            { x: 322, y: 480 },
            { x: 488, y: 498 },
            { x: 646, y: 456 },
            { x: 838, y: 486 },
          ],
          width: 12,
          opacity: 0.64,
        },
        {
          id: "cinematic-sweep-right",
          points: [
            { x: 668, y: 250 },
            { x: 770, y: 224 },
            { x: 888, y: 240 },
            { x: 996, y: 214 },
          ],
          width: 8,
          opacity: 0.58,
        },
      ].map((sweep) => (
        <Group key={sweep.id} listening={false}>
          <Path
            data={sandCurve(sweep.points.map((point) => ({ x: point.x + 5, y: point.y + 5 })), camera)}
            stroke={shadow}
            strokeWidth={sweep.width * 0.86}
            opacity={(night ? 0.07 : rainy ? 0.1 : 0.085) * sweep.opacity}
            lineCap="round"
            lineJoin="round"
          />
          <Path
            data={sandCurve(sweep.points, camera)}
            stroke={highlight}
            strokeWidth={sweep.width * 0.42}
            opacity={ridgeOpacity * sweep.opacity}
            lineCap="round"
            lineJoin="round"
          />
        </Group>
      ))}
    </Group>
  );
}

function SandHighDefinitionRelief({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const highlight = night ? "#ccfff5" : rainy ? "#fff0c2" : "#fff6cb";
  const warmMid = night ? "#5e7470" : rainy ? "#a88759" : "#c79856";
  const shadow = night ? "#071a23" : rainy ? "#6c5635" : "#7e5931";
  const wetGlow = rainy ? 1.18 : 1;
  const ridgeOpacity = night ? 0.12 : rainy ? 0.18 : 0.22;
  const shadowOpacity = night ? 0.1 : rainy ? 0.13 : 0.11;

  const ridges = [
    {
      id: "upper-soft-ripple",
      points: [
        { x: 126, y: 100 },
        { x: 238, y: 86 },
        { x: 360, y: 102 },
        { x: 488, y: 82 },
        { x: 632, y: 108 },
      ],
      width: 6.4,
      offset: 7,
      opacity: 0.66,
    },
    {
      id: "center-breathing-ridge",
      points: [
        { x: 144, y: 268 },
        { x: 294, y: 238 },
        { x: 456, y: 266 },
        { x: 616, y: 226 },
        { x: 802, y: 258 },
        { x: 964, y: 232 },
      ],
      width: 7.8,
      offset: 9,
      opacity: 0.58,
    },
    {
      id: "lower-hand-smoothed-ridge",
      points: [
        { x: 108, y: 468 },
        { x: 256, y: 438 },
        { x: 426, y: 462 },
        { x: 602, y: 424 },
        { x: 820, y: 460 },
      ],
      width: 7.2,
      offset: 8,
      opacity: 0.54,
    },
  ];

  const depressions = [
    { x: 214, y: 180, rx: 56, ry: 14, rotation: -8, opacity: 0.14 },
    { x: 392, y: 354, rx: 72, ry: 17, rotation: 8, opacity: 0.12 },
    { x: 720, y: 156, rx: 52, ry: 12, rotation: -9, opacity: 0.12 },
    { x: 836, y: 452, rx: 78, ry: 18, rotation: -6, opacity: 0.11 },
  ];

  return (
    <Group listening={false}>
      {ridges.map((ridge) => (
        <Group key={ridge.id} listening={false}>
          <Path
            data={sandCurve(ridge.points.map((point) => ({ x: point.x + 5, y: point.y + ridge.offset })), camera)}
            stroke={shadow}
            strokeWidth={ridge.width}
            opacity={shadowOpacity * ridge.opacity}
            lineCap="round"
            lineJoin="round"
          />
          <Path
            data={sandCurve(ridge.points, camera)}
            stroke={highlight}
            strokeWidth={ridge.width * 0.54}
            opacity={ridgeOpacity * ridge.opacity * wetGlow}
            lineCap="round"
            lineJoin="round"
          />
          <Path
            data={sandCurve(ridge.points.map((point) => ({ x: point.x - 3, y: point.y - 3 })), camera)}
            stroke={warmMid}
            strokeWidth={ridge.width * 0.2}
            opacity={(night ? 0.06 : 0.11) * ridge.opacity}
            lineCap="round"
            lineJoin="round"
          />
        </Group>
      ))}
      {depressions.map((depression, index) => {
        const point = projectPoint({ x: depression.x, y: depression.y }, camera);
        return (
          <Group key={`sand-hd-depression-${index}`} listening={false}>
            <Ellipse
              x={point.x + 3}
              y={point.y + 4}
              radiusX={depression.rx}
              radiusY={depression.ry}
              fill={shadow}
              opacity={depression.opacity}
              rotation={depression.rotation}
            />
            <Ellipse
              x={point.x - 2}
              y={point.y - 2}
              radiusX={depression.rx * 0.82}
              radiusY={depression.ry * 0.58}
              stroke={highlight}
              strokeWidth={1.2}
              opacity={(night ? 0.07 : 0.16) * wetGlow}
              rotation={depression.rotation}
            />
          </Group>
        );
      })}
      <Path
        data={sandCurve(
          [
            { x: 92, y: 318 },
            { x: 204, y: 304 },
            { x: 330, y: 326 },
            { x: 458, y: 296 },
            { x: 588, y: 320 },
            { x: 728, y: 292 },
            { x: 884, y: 318 },
          ],
          camera,
        )}
        stroke={highlight}
        strokeWidth={1.2}
        opacity={night ? 0.07 : rainy ? 0.18 : 0.15}
        dash={[14, 12]}
        lineCap="round"
        lineJoin="round"
      />
    </Group>
  );
}

function WoodFrameHighlights({ camera }: { camera: SandboxCameraState }): JSX.Element {
  const corners = getProjectedStageCorners(camera);
  return (
    <Group listening={false}>
      <Line points={[corners.topLeft.x, corners.topLeft.y, corners.topRight.x, corners.topRight.y]} stroke="#ffe0a0" strokeWidth={7} opacity={0.28} lineCap="round" />
      <Line points={[corners.topLeft.x, corners.topLeft.y, corners.bottomLeft.x, corners.bottomLeft.y]} stroke="#ffe0a0" strokeWidth={7} opacity={0.22} lineCap="round" />
      <Line points={[corners.topLeft.x, corners.topLeft.y, corners.topRight.x, corners.topRight.y]} stroke="#deb56d" strokeWidth={4} opacity={0.84} lineCap="round" />
      <Line points={[corners.topLeft.x, corners.topLeft.y, corners.bottomLeft.x, corners.bottomLeft.y]} stroke="#e1ba76" strokeWidth={4} opacity={0.76} lineCap="round" />
      <Line points={[corners.bottomLeft.x, corners.bottomLeft.y, corners.bottomRight.x, corners.bottomRight.y]} stroke="#4b2e19" strokeWidth={6} opacity={0.54} lineCap="round" />
      <Line points={[corners.topRight.x, corners.topRight.y, corners.bottomRight.x, corners.bottomRight.y]} stroke="#4b2d18" strokeWidth={6} opacity={0.52} lineCap="round" />
      <Line points={[corners.bottomLeft.x, corners.bottomLeft.y + STAGE_THICKNESS * 0.12, corners.bottomRight.x, corners.bottomRight.y + STAGE_THICKNESS * 0.14]} stroke="#e4b36c" strokeWidth={2.2} opacity={0.42} />
      <Line points={[corners.bottomLeft.x, corners.bottomLeft.y + STAGE_THICKNESS * 0.82, corners.bottomRight.x, corners.bottomRight.y + STAGE_THICKNESS * 0.86]} stroke="#3c2414" strokeWidth={2.4} opacity={0.22} />
      <Line points={projectRect(30, 30, BOARD_WIDTH - 60, BOARD_HEIGHT - 60, camera)} closed stroke="#fff0c5" strokeWidth={2.4} opacity={0.34} />
      <Line points={projectRect(18, 18, BOARD_WIDTH - 36, BOARD_HEIGHT - 36, camera)} closed stroke="#2d1d12" strokeWidth={5} opacity={0.12} />
      <Line points={projectRect(22, 22, BOARD_WIDTH - 44, BOARD_HEIGHT - 44, camera)} closed stroke="#4b3320" strokeWidth={2.2} opacity={0.16} />
      {woodKnots.map((knot) => {
        const point = getWoodKnotPoint(knot, corners);
        return (
          <Group key={knot.id} listening={false}>
            <Ellipse
              x={point.x}
              y={point.y}
              radiusX={knot.radiusX}
              radiusY={knot.radiusY}
              fill={knot.tone > 0.52 ? "#3c2414" : "#f1c982"}
              opacity={knot.tone > 0.52 ? 0.2 : 0.13}
              rotation={knot.rotation}
            />
            <Ellipse
              x={point.x}
              y={point.y}
              radiusX={Math.max(2.2, knot.radiusX * 0.48)}
              radiusY={Math.max(0.9, knot.radiusY * 0.42)}
              stroke={knot.tone > 0.52 ? "#f2c77a" : "#5a351d"}
              strokeWidth={0.9}
              opacity={0.18}
              rotation={knot.rotation}
            />
          </Group>
        );
      })}
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

function WoodMiterDetails({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const corners = getProjectedStageCorners(camera);
  const night = environment.light === "night";
  const highlight = night ? "#9eddd2" : "#ffe5a8";
  const shadow = night ? "#071219" : "#3c2414";
  const cornerSize = 34;
  const miterOpacity = night ? 0.12 : 0.22;

  return (
    <Group listening={false}>
      {[
        { id: "tl", points: [corners.topLeft.x, corners.topLeft.y, corners.topLeft.x + cornerSize, corners.topLeft.y + 3, corners.topLeft.x + 8, corners.topLeft.y + cornerSize * 0.58] },
        { id: "tr", points: [corners.topRight.x, corners.topRight.y, corners.topRight.x - cornerSize, corners.topRight.y + 3, corners.topRight.x - 8, corners.topRight.y + cornerSize * 0.58] },
        { id: "bl", points: [corners.bottomLeft.x, corners.bottomLeft.y, corners.bottomLeft.x + cornerSize, corners.bottomLeft.y - 3, corners.bottomLeft.x + 8, corners.bottomLeft.y - cornerSize * 0.44] },
        { id: "br", points: [corners.bottomRight.x, corners.bottomRight.y, corners.bottomRight.x - cornerSize, corners.bottomRight.y - 3, corners.bottomRight.x - 8, corners.bottomRight.y - cornerSize * 0.44] },
      ].map((corner) => (
        <Line
          key={`wood-miter-fill-${corner.id}`}
          points={corner.points}
          closed
          fill={corner.id.includes("t") ? highlight : shadow}
          opacity={miterOpacity}
          lineJoin="round"
        />
      ))}
      <Line
        points={[corners.topLeft.x + 12, corners.topLeft.y + 8, corners.bottomLeft.x + 14, corners.bottomLeft.y - 8]}
        stroke={shadow}
        strokeWidth={1.2}
        opacity={night ? 0.16 : 0.22}
        dash={[18, 12]}
      />
      <Line
        points={[corners.topRight.x - 12, corners.topRight.y + 8, corners.bottomRight.x - 14, corners.bottomRight.y - 8]}
        stroke={shadow}
        strokeWidth={1.2}
        opacity={night ? 0.14 : 0.2}
        dash={[18, 12]}
      />
      <Line
        points={[corners.bottomLeft.x + 18, corners.bottomLeft.y + STAGE_THICKNESS * 0.16, corners.bottomRight.x - 18, corners.bottomRight.y + STAGE_THICKNESS * 0.18]}
        stroke={highlight}
        strokeWidth={1.2}
        opacity={night ? 0.09 : 0.26}
      />
    </Group>
  );
}

function WoodBevelCaps({
  environment,
  camera,
}: {
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
}): JSX.Element {
  const corners = getProjectedStageCorners(camera);
  const night = environment.light === "night";
  const rainy = environment.weather === "rainy";
  const lightStroke = night ? "#92d4cc" : rainy ? "#e4c78b" : "#ffe3a0";
  const darkStroke = night ? "#07141b" : "#2f1c0f";

  return (
    <Group listening={false}>
      <Line
        points={[corners.topLeft.x, corners.topLeft.y - 3, corners.topRight.x, corners.topRight.y - 3]}
        stroke={lightStroke}
        strokeWidth={3.4}
        opacity={night ? 0.12 : rainy ? 0.28 : 0.44}
        lineCap="round"
      />
      <Line
        points={[corners.topLeft.x - 2, corners.topLeft.y, corners.bottomLeft.x - 2, corners.bottomLeft.y]}
        stroke={lightStroke}
        strokeWidth={3}
        opacity={night ? 0.1 : rainy ? 0.22 : 0.34}
        lineCap="round"
      />
      <Line
        points={[
          corners.bottomLeft.x,
          corners.bottomLeft.y + STAGE_THICKNESS + 2,
          corners.bottomRight.x,
          corners.bottomRight.y + STAGE_THICKNESS + 3,
        ]}
        stroke={darkStroke}
        strokeWidth={4}
        opacity={night ? 0.28 : 0.18}
        lineCap="round"
      />
      <Line
        points={[
          corners.topRight.x + 2,
          corners.topRight.y,
          corners.bottomRight.x + 2,
          corners.bottomRight.y + STAGE_THICKNESS * 0.78,
        ]}
        stroke={darkStroke}
        strokeWidth={3.2}
        opacity={night ? 0.22 : 0.16}
        lineCap="round"
      />
      {[0.18, 0.36, 0.54, 0.72, 0.88].map((offset, index) => {
        const y = corners.bottomLeft.y + STAGE_THICKNESS * offset;
        return (
          <Line
            key={`front-bevel-grain-${offset}`}
            points={[
              corners.bottomLeft.x + 34 + index * 4,
              y,
              corners.bottomRight.x - 46 + index * 3,
              y + 4,
            ]}
            stroke={index % 2 === 0 ? "#f0c47b" : "#4b2c16"}
            strokeWidth={index % 2 === 0 ? 1.1 : 0.8}
            opacity={night ? 0.08 : 0.18}
            lineCap="round"
          />
        );
      })}
    </Group>
  );
}

function getWoodKnotPoint(
  knot: WoodKnot,
  corners: ReturnType<typeof getProjectedStageCorners>,
): { x: number; y: number } {
  if (knot.side === "front") {
    return {
      x: corners.bottomLeft.x + (corners.bottomRight.x - corners.bottomLeft.x) * knot.along,
      y: corners.bottomLeft.y + (corners.bottomRight.y - corners.bottomLeft.y) * knot.along + STAGE_THICKNESS * knot.depth,
    };
  }

  if (knot.side === "left") {
    return {
      x: corners.topLeft.x + (corners.bottomLeft.x - corners.topLeft.x) * knot.along + 7,
      y: corners.topLeft.y + (corners.bottomLeft.y - corners.topLeft.y) * knot.along + STAGE_THICKNESS * knot.depth,
    };
  }

  return {
    x: corners.topRight.x + (corners.bottomRight.x - corners.topRight.x) * knot.along - 7,
    y: corners.topRight.y + (corners.bottomRight.y - corners.topRight.y) * knot.along + STAGE_THICKNESS * knot.depth,
  };
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
        return <Line key={`x-${x}`} points={[start.x, start.y, end.x, end.y]} stroke="#8ecdc4" strokeWidth={1.15} dash={[7, 11]} opacity={0.24} />;
      })}
      {thirdsY.map((y) => {
        const start = projectPoint({ x: 40, y }, camera);
        const end = projectPoint({ x: BOARD_WIDTH - 40, y }, camera);
        return <Line key={`y-${y}`} points={[start.x, start.y, end.x, end.y]} stroke="#8ecdc4" strokeWidth={1.15} dash={[7, 11]} opacity={0.24} />;
      })}
      <Line
        points={projectRect(BOARD_WIDTH / 3, BOARD_HEIGHT / 3, BOARD_WIDTH / 3, BOARD_HEIGHT / 3, camera)}
        closed
        stroke="#7ed8c7"
        strokeWidth={1.35}
        dash={[10, 10]}
        opacity={0.34}
      />
      <Line
        points={projectRect(BOUNDARY_MARGIN, BOUNDARY_MARGIN, BOARD_WIDTH - BOUNDARY_MARGIN * 2, BOARD_HEIGHT - BOUNDARY_MARGIN * 2, camera)}
        closed
        stroke="#e0b16f"
        strokeWidth={1.15}
        dash={[6, 12]}
        opacity={0.28}
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

function projectPolygon(points: Array<{ x: number; y: number }>, camera: SandboxCameraState): number[] {
  return points.flatMap((point) => {
    const projected = projectPoint(point, camera);
    return [projected.x, projected.y];
  });
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

function createEdgeSandPoints(count: number, seed: number): EdgeSandPoint[] {
  let value = seed;
  const next = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };

  return Array.from({ length: count }, (_, index) => {
    const side = Math.floor(next() * 4);
    const along = next();
    const inward = 34 + next() * 54;
    const jitter = (next() - 0.5) * 16;
    let x = 0;
    let y = 0;

    if (side === 0) {
      x = 48 + along * (BOARD_WIDTH - 96);
      y = inward + jitter;
    } else if (side === 1) {
      x = 48 + along * (BOARD_WIDTH - 96);
      y = BOARD_HEIGHT - inward + jitter;
    } else if (side === 2) {
      x = inward + jitter;
      y = 48 + along * (BOARD_HEIGHT - 96);
    } else {
      x = BOARD_WIDTH - inward + jitter;
      y = 48 + along * (BOARD_HEIGHT - 96);
    }

    return {
      id: `edge-sand-${seed}-${index}`,
      x,
      y,
      tone: next(),
      size: 0.32 + next() * 0.9,
      rotation: next() * 180,
    };
  });
}

function createFootprintTrails(): SandFootprintTrail[] {
  return [
    {
      id: "lower-left-to-center",
      startX: 152,
      startY: 482,
      stepX: 38,
      stepY: -22,
      count: 6,
      rotation: -14,
      scale: 0.94,
    },
    {
      id: "upper-right-soft-track",
      startX: 742,
      startY: 154,
      stepX: -32,
      stepY: 18,
      count: 5,
      rotation: 15,
      scale: 0.78,
    },
    {
      id: "front-water-track",
      startX: 448,
      startY: 514,
      stepX: 30,
      stepY: -10,
      count: 4,
      rotation: -3,
      scale: 0.68,
    },
  ];
}

function createSandRimDunes(): SandRimDune[] {
  return [
    { id: "rim-top-left", x: 126, y: 58, radiusX: 72, radiusY: 11, rotation: -6, tone: "light", opacity: 0.16 },
    { id: "rim-top-mid", x: 502, y: 68, radiusX: 118, radiusY: 14, rotation: 2, tone: "dark", opacity: 0.07 },
    { id: "rim-top-right", x: 870, y: 74, radiusX: 96, radiusY: 13, rotation: 7, tone: "light", opacity: 0.14 },
    { id: "rim-left-mid", x: 70, y: 310, radiusX: 72, radiusY: 12, rotation: 72, tone: "dark", opacity: 0.08 },
    { id: "rim-right-mid", x: 972, y: 316, radiusX: 84, radiusY: 13, rotation: 78, tone: "light", opacity: 0.13 },
    { id: "rim-front-left", x: 176, y: 560, radiusX: 104, radiusY: 14, rotation: 4, tone: "dark", opacity: 0.08 },
    { id: "rim-front-right", x: 744, y: 554, radiusX: 122, radiusY: 16, rotation: -5, tone: "light", opacity: 0.14 },
  ];
}

function createWoodKnots(count: number, seed: number): WoodKnot[] {
  let value = seed;
  const next = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };

  return Array.from({ length: count }, (_, index) => {
    const sideRoll = next();
    const side: WoodKnot["side"] = sideRoll < 0.58 ? "front" : sideRoll < 0.79 ? "left" : "right";
    return {
      id: `wood-knot-${seed}-${index}`,
      side,
      along: 0.08 + next() * 0.84,
      depth: side === "front" ? 0.2 + next() * 0.64 : 0.12 + next() * 0.5,
      radiusX: 3.2 + next() * 6.2,
      radiusY: 1.1 + next() * 2.8,
      rotation: -12 + next() * 24,
      tone: next(),
    };
  });
}
