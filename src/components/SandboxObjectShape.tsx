import { Ellipse, Group, Image as KonvaImage, Line, Rect } from "react-konva";
import { getEnvironmentProfile } from "../data/environment";
import type { RiskTag, SandboxCameraState, SandboxEnvironment, ToyAssetFootprint } from "../types";
import { useToyAssetSprite } from "../hooks/useToyAssetSprite";

interface SandboxObjectShapeProps {
  assetId: string;
  width: number;
  height: number;
  riskTag: RiskTag;
  environment: SandboxEnvironment;
  camera: SandboxCameraState;
  rotation: number;
  footprint: ToyAssetFootprint;
}

export function SandboxObjectShape({
  assetId,
  width,
  height,
  riskTag,
  environment,
  camera,
  rotation,
  footprint,
}: SandboxObjectShapeProps): JSX.Element {
  const sprite = useToyAssetSprite({ assetId, width, height, riskTag });
  const profile = getEnvironmentProfile(environment).object;
  const footprintWidth = clamp(footprint.width, width * 0.48, width * 1.45);
  const footprintDepth = clamp(footprint.depth, height * 0.2, height * 0.95);
  const kindSpread =
    footprint.kind === "wide" ? 1.22 : footprint.kind === "flat" ? 1.08 : footprint.kind === "tall" ? 0.86 : 1;
  const kindDepth =
    footprint.kind === "flat" ? 0.74 : footprint.kind === "wide" ? 0.92 : footprint.kind === "tall" ? 1.12 : 1;
  const heightWeight = clamp(footprint.height / Math.max(footprint.depth, 1), 0.52, 1.42);
  const shadowWidth = clamp(Math.max(width * 0.52, footprintWidth * 0.68) * kindSpread, width * 0.46, width * 0.98);
  const shadowHeight = clamp(Math.max(7, footprintDepth * 0.2) * kindDepth, 7, height * 0.26);
  const contactWidth = clamp(shadowWidth * (footprint.kind === "tall" ? 0.58 : 0.72), width * 0.26, width * 0.78);
  const contactHeight = clamp(shadowHeight * (footprint.kind === "flat" ? 0.36 : 0.5), 3.5, Math.max(5, height * 0.12));
  const castOffsetX = Math.max(4, width * profile.castOffsetX);
  const castOffsetY = Math.max(4, height * profile.castOffsetY * heightWeight);
  const rainy = environment.weather === "rainy";
  const night = environment.light === "night";
  const dentOpacity = night ? 0.07 : rainy ? 0.105 : 0.09;
  const warmEdgeOpacity = night ? 0.095 : rainy ? 0.12 : 0.17;
  const sandLipFill = night ? "#91aaa3" : rainy ? "#cab58b" : "#f1d99e";
  const sandGrainFill = night ? "#d9eee8" : "#fff3ca";
  const contactScatterOpacity = night ? 0.06 : rainy ? 0.08 : 0.11;
  const contactInkFill = night ? "#071923" : rainy ? "#453828" : "#2e2116";
  const topRimFill = night ? "#d8fff9" : rainy ? "#f8f7e5" : "#fff9dc";
  const sideRimFill = night ? "#8df4ea" : rainy ? "#fff2ca" : "#ffe1a2";
  const contactY = height * (footprint.kind === "flat" ? 0.105 : 0.145);
  const pressY = height * (footprint.kind === "flat" ? 0.09 : 0.12);
  const isWaterAsset = assetId === "nature_water";
  const sculptedBackLipOpacity = night ? 0.065 : rainy ? 0.1 : 0.13;
  const sculptedFrontLipOpacity = night ? 0.08 : rainy ? 0.115 : 0.15;
  const contactGrainScale = footprint.kind === "wide" ? 1.08 : footprint.kind === "tall" ? 0.88 : 1;
  const pressureWeight = clamp(
    (footprint.height / Math.max(footprint.depth, 1)) * (footprint.kind === "tall" ? 1.15 : footprint.kind === "flat" ? 0.72 : 0.92),
    0.58,
    1.42,
  );
  const pressureWidth = clamp(
    contactWidth * (footprint.kind === "wide" ? 1.34 : footprint.kind === "flat" ? 1.26 : 1.08),
    width * 0.34,
    width * 1.08,
  );
  const pressureHeight = clamp(
    contactHeight * (footprint.kind === "tall" ? 1.3 : footprint.kind === "flat" ? 0.74 : 1.05),
    Math.max(3.2, height * 0.035),
    Math.max(6, height * 0.18),
  );
  const pressureY = pressY + pressureHeight * (footprint.kind === "flat" ? 0.15 : 0.28);
  const ridgeStrokeWidth = clamp(width * 0.018, 1.1, 2.8);
  const pressureFill = night ? "#101c22" : rainy ? "#4e4131" : "#6c4c28";
  const compressedSandFill = night ? "#dff6e9" : rainy ? "#f5e9c2" : "#ffe7ad";
  const wetRimFill = night ? "#8ee8df" : rainy ? "#b9e0d6" : "#fff2c2";
  const ridgeParticleOpacity = night ? 0.12 : rainy ? 0.16 : 0.2;
  const pressureRidgeOffsets = [-0.56, -0.39, -0.2, -0.04, 0.15, 0.34, 0.53];
  const projectedLightAngle = (night ? -16 : rainy ? -11 : -9) + camera.yaw * 0.38;
  const worldShadowRotation = projectedLightAngle - rotation;
  const pitchShadowStretch = 1 + clamp(0.7 - camera.pitch, 0, 0.22) * 2.3;
  const tallnessCast = clamp(footprint.height / Math.max(footprint.depth, 1), 0.72, 2.15);
  const worldCastLength = clamp(
    (height * 0.08 + footprint.height * 0.18) * (footprint.kind === "tall" ? 1.26 : footprint.kind === "flat" ? 0.54 : 0.92) * pitchShadowStretch,
    width * 0.12,
    width * 0.58,
  );
  const castWeatherFactor = rainy ? 0.72 : night ? 0.62 : 1;
  const worldCastOpacity = clamp(
    profile.castOpacity * castWeatherFactor * (0.95 + (tallnessCast - 0.72) * 0.16),
    night ? 0.06 : 0.07,
    night ? 0.16 : rainy ? 0.15 : 0.24,
  );
  const worldCastColor = night ? "#061722" : rainy ? "#33434a" : "#4e3217";
  const worldCastBlur = profile.shadowBlur + (night ? 15 : rainy ? 11 : 8);
  const ambientLiftOpacity = night ? 0.05 : rainy ? 0.045 : 0.035;

  return (
    <Group>
      <Ellipse
        x={castOffsetX * 0.82}
        y={height * 0.16 + castOffsetY}
        radiusX={shadowWidth * 1.28}
        radiusY={shadowHeight * 1.42}
        fill={profile.shadowColor}
        opacity={0}
        rotation={-7}
        shadowColor={profile.shadowColor}
        shadowBlur={0}
        shadowOpacity={0}
        listening={false}
      />
      <Group rotation={worldShadowRotation} listening={false} opacity={worldCastOpacity}>
        <Ellipse
          x={worldCastLength * 0.74}
          y={worldCastLength * 0.12}
          radiusX={shadowWidth * (footprint.kind === "wide" ? 1.12 : footprint.kind === "tall" ? 0.84 : 0.96)}
          radiusY={shadowHeight * (footprint.kind === "flat" ? 0.58 : 0.86) * pitchShadowStretch}
          fill={worldCastColor}
          opacity={night ? 0.38 : rainy ? 0.34 : 0.42}
          rotation={-5}
          shadowColor={worldCastColor}
          shadowBlur={worldCastBlur * 0.5}
          shadowOpacity={night ? 0.12 : rainy ? 0.105 : 0.14}
        />
        <Ellipse
          x={worldCastLength * 0.34}
          y={-worldCastLength * 0.02}
          radiusX={contactWidth * (footprint.kind === "tall" ? 0.72 : 0.86)}
          radiusY={Math.max(3.2, contactHeight * (footprint.kind === "flat" ? 0.42 : 0.68))}
          fill={night ? "#01090f" : rainy ? "#202b2f" : "#24170c"}
          opacity={0.32 + (tallnessCast - 0.72) * 0.062}
          rotation={-4}
          shadowColor={worldCastColor}
          shadowBlur={worldCastBlur * 0.32}
          shadowOpacity={night ? 0.12 : rainy ? 0.1 : 0.13}
        />
      </Group>
      <Group listening={false} opacity={night ? 0.74 : rainy ? 0.86 : 0.92}>
        <Ellipse
          x={width * 0.02}
          y={pressureY}
          radiusX={pressureWidth * 0.86}
          radiusY={pressureHeight * 0.78}
          fill={pressureFill}
          opacity={(night ? 0.12 : rainy ? 0.105 : 0.075) * pressureWeight}
          rotation={-5}
          shadowColor={pressureFill}
          shadowBlur={0}
          shadowOpacity={0}
        />
        <Ellipse
          x={-width * 0.03}
          y={pressureY - pressureHeight * 0.72}
          radiusX={pressureWidth * 0.72}
          radiusY={Math.max(2.4, pressureHeight * 0.28)}
          fill={compressedSandFill}
          opacity={(night ? 0.08 : rainy ? 0.12 : 0.16) * pressureWeight}
          rotation={-7}
        />
        <Line
          points={[
            -pressureWidth * 0.6,
            pressureY - pressureHeight * 0.42,
            -pressureWidth * 0.18,
            pressureY - pressureHeight * 0.82,
            pressureWidth * 0.18,
            pressureY - pressureHeight * 0.66,
            pressureWidth * 0.58,
            pressureY - pressureHeight * 0.25,
          ]}
          stroke={wetRimFill}
          strokeWidth={ridgeStrokeWidth}
          tension={0.46}
          lineCap="round"
          lineJoin="round"
          opacity={(night ? 0.16 : rainy ? 0.2 : 0.24) * pressureWeight}
        />
        <Line
          points={[
            -pressureWidth * 0.55,
            pressureY + pressureHeight * 0.6,
            -pressureWidth * 0.1,
            pressureY + pressureHeight * 0.92,
            pressureWidth * 0.3,
            pressureY + pressureHeight * 0.82,
            pressureWidth * 0.62,
            pressureY + pressureHeight * 0.48,
          ]}
          stroke={contactInkFill}
          strokeWidth={ridgeStrokeWidth * 1.2}
          tension={0.44}
          lineCap="round"
          lineJoin="round"
          opacity={(night ? 0.09 : rainy ? 0.105 : 0.085) * pressureWeight}
        />
        {pressureRidgeOffsets.map((offset, index) => (
          <Ellipse
            key={`pressure-ridge-grain-${index}`}
            x={pressureWidth * offset}
            y={pressureY + pressureHeight * (0.42 + (index % 2) * 0.42)}
            radiusX={Math.max(1.15, width * (0.012 + index * 0.0018))}
            radiusY={Math.max(0.46, height * 0.0055)}
            fill={index % 3 === 0 ? compressedSandFill : index % 3 === 1 ? wetRimFill : contactInkFill}
            opacity={index % 3 === 2 ? ridgeParticleOpacity * 0.38 : ridgeParticleOpacity}
            rotation={-18 + index * 8}
          />
        ))}
      </Group>
      <Ellipse
        x={-width * 0.01}
        y={pressY + shadowHeight * 0.34}
        radiusX={shadowWidth * 1.08}
        radiusY={Math.max(5, shadowHeight * 0.44)}
        fill={sandLipFill}
        opacity={night ? 0.045 : rainy ? 0.058 : 0.07}
        rotation={-5}
        listening={false}
      />
      <Ellipse
        x={width * 0.02}
        y={pressY + shadowHeight * 0.1}
        radiusX={shadowWidth * 0.78}
        radiusY={Math.max(4, shadowHeight * 0.34)}
        fill={contactInkFill}
        opacity={night ? 0.1 : rainy ? 0.12 : 0.085}
        rotation={-4}
        shadowColor={contactInkFill}
        shadowBlur={profile.shadowBlur + 4}
        shadowOpacity={0.1}
        listening={false}
      />
      <Ellipse
        x={width * 0.02}
        y={pressY}
        radiusX={shadowWidth * 0.98}
        radiusY={shadowHeight * 0.86}
        fill={night ? "#20313a" : rainy ? "#816f51" : "#8b744f"}
        opacity={dentOpacity}
        rotation={-4}
        listening={false}
      />
      <Ellipse
        x={-width * 0.01}
        y={pressY - shadowHeight * 0.22}
        radiusX={shadowWidth * 0.78}
        radiusY={shadowHeight * 0.48}
        stroke={night ? "#b8fff5" : "#fff0c4"}
        strokeWidth={Math.max(0.8, width * 0.008)}
        opacity={warmEdgeOpacity}
        rotation={-4}
        listening={false}
      />
      <Group listening={false} opacity={contactScatterOpacity}>
        {[-0.34, -0.16, 0.08, 0.29].map((offset, index) => (
          <Ellipse
            key={`contact-grain-${index}`}
            x={contactWidth * offset}
            y={pressY + shadowHeight * (index % 2 === 0 ? 0.04 : 0.22)}
            radiusX={Math.max(1.6, width * (0.018 + index * 0.002))}
            radiusY={Math.max(0.7, height * 0.009)}
            fill={index % 2 === 0 ? sandGrainFill : profile.shadowColor}
            rotation={-8 + index * 7}
          />
        ))}
      </Group>
      <Group listening={false}>
        <Ellipse
          x={-width * 0.1}
          y={pressY - shadowHeight * 0.28}
          radiusX={contactWidth * 0.8}
          radiusY={Math.max(2.6, contactHeight * 0.34)}
          fill={topRimFill}
          opacity={sculptedBackLipOpacity}
          rotation={-7}
        />
        <Ellipse
          x={width * 0.11}
          y={pressY + shadowHeight * 0.5}
          radiusX={contactWidth * 0.92}
          radiusY={Math.max(2.8, contactHeight * 0.3)}
          fill={contactInkFill}
          opacity={night ? 0.055 : rainy ? 0.07 : 0.064}
          rotation={-5}
        />
        {[-0.46, -0.3, -0.08, 0.16, 0.38].map((offset, index) => (
          <Ellipse
            key={`sculpted-contact-grain-${index}`}
            x={contactWidth * offset}
            y={pressY + shadowHeight * (0.2 + (index % 2) * 0.28)}
            radiusX={Math.max(1.2, width * (0.014 + index * 0.0018)) * contactGrainScale}
            radiusY={Math.max(0.52, height * 0.006)}
            fill={index % 2 === 0 ? sideRimFill : contactInkFill}
            opacity={index % 2 === 0 ? sculptedBackLipOpacity * 0.68 : 0.048}
            rotation={-15 + index * 11}
          />
        ))}
      </Group>
      <Ellipse
        x={castOffsetX}
        y={height * 0.13 + castOffsetY}
        radiusX={shadowWidth * 1.04}
        radiusY={shadowHeight * 1.18}
        fill={profile.shadowColor}
        opacity={0}
        shadowColor={profile.shadowColor}
        shadowBlur={0}
        shadowOpacity={0}
        listening={false}
      />
      <Ellipse
        x={-width * 0.02}
        y={contactY + contactHeight * 0.4}
        radiusX={contactWidth * 0.98}
        radiusY={contactHeight * 0.42}
        fill={night ? "#132731" : "#4a3722"}
        opacity={night ? 0.075 : rainy ? 0.09 : 0.08}
        rotation={-4}
        listening={false}
      />
      <Ellipse
        x={width * 0.02}
        y={contactY}
        radiusX={contactWidth * 0.76}
        radiusY={contactHeight}
        fill={profile.shadowColor}
        opacity={profile.contactOpacity * (night ? 0.7 : rainy ? 0.66 : 0.78)}
        shadowColor={profile.shadowColor}
        shadowBlur={0}
        shadowOpacity={0}
        listening={false}
      />
      <Group listening={false} opacity={night ? 0.78 : rainy ? 0.9 : 1}>
        <Ellipse
          x={width * 0.03}
          y={contactY + contactHeight * 0.54}
          radiusX={contactWidth * (footprint.kind === "tall" ? 0.38 : 0.46)}
          radiusY={Math.max(2.2, contactHeight * 0.26)}
          fill={night ? "#06151d" : rainy ? "#3f3021" : "#2b1c10"}
          opacity={night ? 0.145 : rainy ? 0.155 : 0.16}
          rotation={-5}
          shadowColor={night ? "#02090d" : "#25160b"}
          shadowBlur={night ? 8 : 6}
          shadowOpacity={night ? 0.14 : 0.12}
        />
        <Ellipse
          x={-contactWidth * 0.3}
          y={contactY + contactHeight * 0.08}
          radiusX={Math.max(1.4, width * 0.014)}
          radiusY={Math.max(0.58, height * 0.005)}
          fill={compressedSandFill}
          opacity={night ? 0.115 : rainy ? 0.16 : 0.2}
          rotation={-16}
        />
        <Ellipse
          x={contactWidth * 0.34}
          y={contactY + contactHeight * 0.68}
          radiusX={Math.max(1.2, width * 0.012)}
          radiusY={Math.max(0.5, height * 0.0045)}
          fill={sideRimFill}
          opacity={night ? 0.1 : rainy ? 0.13 : 0.17}
          rotation={11}
        />
      </Group>

      {isWaterAsset ? (
        <Group listening={false}>
          <Ellipse
            x={0}
            y={pressY - shadowHeight * 0.1}
            radiusX={shadowWidth * 1.18}
            radiusY={Math.max(7, shadowHeight * 0.96)}
            fill={night ? "#3ec7d1" : rainy ? "#53cbd4" : "#78d8cf"}
            opacity={night ? 0.14 : rainy ? 0.17 : 0.14}
            rotation={-5}
            shadowColor={night ? "#8affef" : "#9cf2e6"}
            shadowBlur={night ? 12 : 8}
            shadowOpacity={night ? 0.14 : 0.1}
          />
          <Ellipse
            x={width * 0.04}
            y={pressY - shadowHeight * 0.08}
            radiusX={shadowWidth * 0.72}
            radiusY={Math.max(4.5, shadowHeight * 0.52)}
            fill={night ? "#0a698a" : "#148bb0"}
            opacity={night ? 0.12 : rainy ? 0.12 : 0.1}
            rotation={-5}
          />
          <Ellipse
            x={-width * 0.03}
            y={pressY - shadowHeight * 0.46}
            radiusX={shadowWidth * 0.86}
            radiusY={Math.max(3.2, shadowHeight * 0.28)}
            stroke={night ? "#d6fff8" : "#f6ffff"}
            strokeWidth={Math.max(1.2, width * 0.012)}
            opacity={night ? 0.16 : rainy ? 0.24 : 0.22}
            rotation={-8}
          />
        </Group>
      ) : null}

      {sprite ? (
        <KonvaImage
          image={sprite.image}
          x={-sprite.frame.anchorX}
          y={-sprite.frame.anchorY}
          width={sprite.frame.width}
          height={sprite.frame.height}
          opacity={profile.spriteOpacity}
          shadowColor={night ? "#051823" : rainy ? "#26383f" : "#3a2412"}
          shadowBlur={night ? 8 : rainy ? 6 : 5.5}
          shadowOffsetX={night ? 1.8 : rainy ? 2 : 2.4}
          shadowOffsetY={night ? 2.5 : rainy ? 2.4 : 3}
          shadowOpacity={night ? 0.24 : rainy ? 0.2 : 0.24}
          listening={false}
        />
      ) : (
        <ToySpriteFallback assetId={assetId} width={width} height={height} riskTag={riskTag} />
      )}

      <Group listening={false} opacity={ambientLiftOpacity}>
        <Ellipse
          x={-width * 0.18}
          y={-height * 0.28}
          radiusX={width * 0.42}
          radiusY={height * 0.2}
          fill={night ? "#a8fff2" : "#fff8d5"}
          rotation={-16}
          shadowColor={night ? "#8affef" : "#fff2c4"}
          shadowBlur={night ? 9 : 6}
          shadowOpacity={0.18}
        />
      </Group>

      {!isWaterAsset ? (
        <Group listening={false}>
          <Ellipse
            x={-width * 0.03}
            y={contactY + contactHeight * 1.04}
            radiusX={contactWidth * 0.84}
            radiusY={Math.max(2.8, contactHeight * 0.36)}
            fill={sideRimFill}
            opacity={sculptedFrontLipOpacity}
            rotation={-4}
          />
          <Ellipse
            x={width * 0.04}
            y={contactY + contactHeight * 1.2}
            radiusX={contactWidth * 0.54}
            radiusY={Math.max(1.8, contactHeight * 0.2)}
            fill={contactInkFill}
            opacity={night ? 0.055 : rainy ? 0.06 : 0.048}
            rotation={-5}
          />
          <Line
            points={[
              -contactWidth * 0.62,
              contactY + contactHeight * 1.33,
              -contactWidth * 0.18,
              contactY + contactHeight * 1.58,
              contactWidth * 0.22,
              contactY + contactHeight * 1.5,
              contactWidth * 0.62,
              contactY + contactHeight * 1.18,
            ]}
            stroke={sideRimFill}
            strokeWidth={Math.max(1.1, width * 0.014)}
            tension={0.48}
            lineCap="round"
            opacity={night ? 0.105 : rainy ? 0.13 : 0.18}
          />
          {[-0.45, -0.24, -0.02, 0.2, 0.42].map((offset, index) => (
            <Ellipse
              key={`front-lip-grain-${index}`}
              x={contactWidth * offset}
              y={contactY + contactHeight * (1.32 + (index % 2) * 0.22)}
              radiusX={Math.max(1, width * (0.012 + index * 0.002))}
              radiusY={Math.max(0.5, height * 0.005)}
              fill={index % 2 === 0 ? sideRimFill : contactInkFill}
              opacity={index % 2 === 0 ? (night ? 0.1 : rainy ? 0.13 : 0.18) : 0.05}
              rotation={-12 + index * 9}
            />
          ))}
        </Group>
      ) : null}

      <Ellipse
        x={-width * 0.17}
        y={-height * 0.48}
        radiusX={width * 0.18}
        radiusY={height * 0.08}
        fill={topRimFill}
        opacity={night ? 0.07 : rainy ? 0.045 : 0.06}
        rotation={-14}
        listening={false}
      />
      <Ellipse
        x={width * 0.18}
        y={-height * 0.2}
        radiusX={width * 0.08}
        radiusY={height * 0.18}
        fill={sideRimFill}
        opacity={night ? 0.06 : rainy ? 0.038 : 0.045}
        rotation={-18}
        listening={false}
      />

      {!night ? (
        <Ellipse
          x={-width * 0.2}
          y={-height * 0.35}
          radiusX={width * 0.28}
          radiusY={height * 0.18}
          fill="#fff7d1"
          opacity={rainy ? 0.035 : 0.055}
          rotation={-12}
          listening={false}
        />
      ) : null}

      {night ? (
        <Ellipse
          x={-width * 0.04}
          y={-height * 0.36}
          radiusX={width * 0.32}
          radiusY={height * 0.2}
          fill="#c8fff8"
          opacity={rainy ? 0.08 : 0.055}
          shadowColor="#8affef"
          shadowBlur={rainy ? 10 : 7}
          shadowOpacity={0.16}
          listening={false}
        />
      ) : null}

      {rainy ? (
        <Group opacity={night ? 0.34 : 0.24} listening={false}>
          <Line
            points={[-width * 0.22, -height * 0.48, width * 0.14, -height * 0.38]}
            stroke="#f3fffb"
            strokeWidth={Math.max(1.4, width * 0.018)}
            lineCap="round"
          />
          <Line
            points={[-width * 0.08, -height * 0.26, width * 0.24, -height * 0.17]}
            stroke={night ? "#9ff7ee" : "#ffffff"}
            strokeWidth={Math.max(1, width * 0.012)}
            lineCap="round"
            opacity={0.72}
          />
        </Group>
      ) : null}
    </Group>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ToySpriteFallback({
  assetId,
  width,
  height,
  riskTag,
}: {
  assetId: string;
  width: number;
  height: number;
  riskTag: RiskTag;
}): JSX.Element {
  const palette = getFallbackToyPalette(assetId, riskTag);
  const family = getFallbackToyFamily(assetId);
  const scale = Math.min(width, height) / 72;

  return (
    <Group opacity={0.94} listening={false}>
      <Rect
        x={-width * 0.34}
        y={-height * 0.56}
        width={width * 0.68}
        height={height * 0.58}
        cornerRadius={Math.min(width, height) * 0.22}
        fill={palette.back}
        stroke={palette.stroke}
        strokeWidth={Math.max(1.2, scale * 1.8)}
        shadowColor={palette.shadow}
        shadowBlur={Math.max(7, scale * 8)}
        shadowOffsetY={Math.max(1.6, scale * 3)}
        shadowOpacity={0.24}
      />
      <Ellipse
        x={-width * 0.16}
        y={-height * 0.43}
        radiusX={width * 0.2}
        radiusY={height * 0.09}
        fill="#fff8df"
        opacity={0.38}
        rotation={-14}
      />
      {family === "house" ? (
        <FallbackHouse width={width} height={height} palette={palette} />
      ) : family === "tree" ? (
        <FallbackTree width={width} height={height} palette={palette} />
      ) : family === "animal" ? (
        <FallbackAnimal width={width} height={height} palette={palette} />
      ) : family === "water" ? (
        <FallbackWater width={width} height={height} palette={palette} />
      ) : family === "robot" ? (
        <FallbackRobot width={width} height={height} palette={palette} />
      ) : (
        <FallbackPerson width={width} height={height} palette={palette} />
      )}
      <Ellipse
        x={0}
        y={height * 0.06}
        radiusX={width * 0.34}
        radiusY={height * 0.055}
        fill={palette.shadow}
        opacity={0.17}
      />
    </Group>
  );
}

interface FallbackPalette {
  back: string;
  main: string;
  accent: string;
  pale: string;
  stroke: string;
  shadow: string;
}

function getFallbackToyPalette(assetId: string, riskTag: RiskTag): FallbackPalette {
  if (assetId.includes("water") || assetId.includes("fish") || assetId.includes("bird")) {
    return {
      back: "#dff6ef",
      main: "#86d8df",
      accent: "#2e9db8",
      pale: "#f6ffff",
      stroke: "#6aaeb0",
      shadow: "#356e70",
    };
  }
  if (assetId.includes("tree") || assetId.includes("nature")) {
    return {
      back: "#eef5d6",
      main: "#8fd39a",
      accent: "#4f9d69",
      pale: "#faffde",
      stroke: "#7da66f",
      shadow: "#526d42",
    };
  }
  if (assetId.includes("house") || assetId.includes("bridge") || assetId.includes("fence") || assetId.includes("tower")) {
    return {
      back: "#fff0cf",
      main: "#f0b56d",
      accent: "#c96d49",
      pale: "#fff8e8",
      stroke: "#a97844",
      shadow: "#7a5737",
    };
  }
  if (assetId.includes("robot")) {
    return {
      back: "#e5f3f2",
      main: "#b9cbd0",
      accent: "#5dbcc0",
      pale: "#f8ffff",
      stroke: "#78939b",
      shadow: "#465c64",
    };
  }
  if (riskTag === "fantasy" || assetId.includes("monster")) {
    return {
      back: "#f0e3ff",
      main: "#a98add",
      accent: "#6f57ba",
      pale: "#fff8ff",
      stroke: "#7c68a7",
      shadow: "#4e426d",
    };
  }
  return {
    back: "#fff0cf",
    main: "#efbd83",
    accent: "#5aaad0",
    pale: "#fff8e8",
    stroke: "#a97b52",
    shadow: "#6d4a2d",
  };
}

function getFallbackToyFamily(assetId: string): "person" | "animal" | "house" | "tree" | "water" | "robot" {
  if (assetId.includes("house") || assetId.includes("bridge") || assetId.includes("fence") || assetId.includes("tower")) {
    return "house";
  }
  if (assetId.includes("tree") || assetId.includes("sun") || assetId.includes("light") || assetId.includes("rock")) {
    return "tree";
  }
  if (assetId.includes("water")) {
    return "water";
  }
  if (assetId.includes("robot")) {
    return "robot";
  }
  if (assetId.includes("animal") || assetId.includes("dog") || assetId.includes("bird") || assetId.includes("fish") || assetId.includes("lion")) {
    return "animal";
  }
  return "person";
}

function FallbackPerson({ width, height, palette }: { width: number; height: number; palette: FallbackPalette }): JSX.Element {
  return (
    <Group>
      <Ellipse x={0} y={-height * 0.31} radiusX={width * 0.2} radiusY={height * 0.22} fill={palette.main} stroke={palette.stroke} strokeWidth={1.4} />
      <Rect x={-width * 0.21} y={-height * 0.14} width={width * 0.42} height={height * 0.22} cornerRadius={width * 0.08} fill={palette.accent} />
      <Ellipse x={-width * 0.07} y={-height * 0.32} radiusX={width * 0.025} radiusY={height * 0.032} fill="#2b3332" />
      <Ellipse x={width * 0.08} y={-height * 0.32} radiusX={width * 0.025} radiusY={height * 0.032} fill="#2b3332" />
      <Line points={[-width * 0.08, -height * 0.24, 0, -height * 0.21, width * 0.09, -height * 0.24]} stroke="#734832" strokeWidth={1.8} tension={0.45} lineCap="round" />
    </Group>
  );
}

function FallbackAnimal({ width, height, palette }: { width: number; height: number; palette: FallbackPalette }): JSX.Element {
  return (
    <Group>
      <Ellipse x={-width * 0.08} y={-height * 0.22} radiusX={width * 0.28} radiusY={height * 0.17} fill={palette.main} stroke={palette.stroke} strokeWidth={1.5} />
      <Ellipse x={width * 0.18} y={-height * 0.26} radiusX={width * 0.16} radiusY={height * 0.14} fill={palette.main} />
      <Ellipse x={width * 0.24} y={-height * 0.27} radiusX={width * 0.024} radiusY={height * 0.028} fill="#22302f" />
      <Ellipse x={width * 0.08} y={-height * 0.38} radiusX={width * 0.052} radiusY={height * 0.08} fill={palette.accent} rotation={-18} />
      <Line points={[-width * 0.34, -height * 0.22, -width * 0.5, -height * 0.35, -width * 0.42, -height * 0.43]} stroke={palette.accent} strokeWidth={3} tension={0.6} lineCap="round" />
      {[-0.25, -0.05, 0.14].map((x, index) => (
        <Rect key={x} x={width * x} y={-height * 0.08} width={width * 0.055} height={height * 0.11} cornerRadius={width * 0.02} fill={index === 1 ? palette.accent : palette.stroke} />
      ))}
    </Group>
  );
}

function FallbackHouse({ width, height, palette }: { width: number; height: number; palette: FallbackPalette }): JSX.Element {
  return (
    <Group>
      <Line points={[-width * 0.26, -height * 0.26, 0, -height * 0.49, width * 0.28, -height * 0.26]} closed fill={palette.accent} stroke={palette.stroke} strokeWidth={1.6} />
      <Rect x={-width * 0.24} y={-height * 0.27} width={width * 0.48} height={height * 0.34} cornerRadius={width * 0.045} fill={palette.pale} stroke={palette.stroke} strokeWidth={1.4} />
      <Rect x={-width * 0.06} y={-height * 0.11} width={width * 0.12} height={height * 0.18} cornerRadius={width * 0.025} fill="#8a5b36" />
      <Rect x={width * 0.1} y={-height * 0.2} width={width * 0.09} height={height * 0.08} cornerRadius={width * 0.015} fill="#aee4e2" />
    </Group>
  );
}

function FallbackTree({ width, height, palette }: { width: number; height: number; palette: FallbackPalette }): JSX.Element {
  return (
    <Group>
      <Rect x={-width * 0.045} y={-height * 0.17} width={width * 0.09} height={height * 0.24} cornerRadius={width * 0.03} fill="#b07b45" />
      <Ellipse x={0} y={-height * 0.38} radiusX={width * 0.22} radiusY={height * 0.18} fill={palette.main} stroke={palette.stroke} strokeWidth={1.5} />
      <Ellipse x={-width * 0.15} y={-height * 0.26} radiusX={width * 0.16} radiusY={height * 0.13} fill={palette.accent} opacity={0.82} />
      <Ellipse x={width * 0.15} y={-height * 0.25} radiusX={width * 0.16} radiusY={height * 0.13} fill="#a9df88" opacity={0.86} />
    </Group>
  );
}

function FallbackWater({ width, height, palette }: { width: number; height: number; palette: FallbackPalette }): JSX.Element {
  return (
    <Group>
      <Ellipse x={0} y={-height * 0.18} radiusX={width * 0.34} radiusY={height * 0.18} fill={palette.main} stroke={palette.stroke} strokeWidth={1.4} />
      <Line points={[-width * 0.18, -height * 0.2, -width * 0.04, -height * 0.24, width * 0.13, -height * 0.19]} stroke={palette.pale} strokeWidth={2.2} tension={0.5} lineCap="round" />
      <Line points={[-width * 0.08, -height * 0.1, width * 0.05, -height * 0.14, width * 0.2, -height * 0.11]} stroke="#eaffff" strokeWidth={1.4} tension={0.5} lineCap="round" />
    </Group>
  );
}

function FallbackRobot({ width, height, palette }: { width: number; height: number; palette: FallbackPalette }): JSX.Element {
  return (
    <Group>
      <Rect x={-width * 0.22} y={-height * 0.43} width={width * 0.44} height={height * 0.5} cornerRadius={width * 0.09} fill={palette.main} stroke={palette.stroke} strokeWidth={1.6} />
      <Rect x={-width * 0.12} y={-height * 0.18} width={width * 0.24} height={height * 0.11} cornerRadius={width * 0.025} fill={palette.accent} />
      <Ellipse x={-width * 0.075} y={-height * 0.31} radiusX={width * 0.032} radiusY={height * 0.035} fill="#263130" />
      <Ellipse x={width * 0.075} y={-height * 0.31} radiusX={width * 0.032} radiusY={height * 0.035} fill="#263130" />
      <Line points={[0, -height * 0.43, 0, -height * 0.57]} stroke={palette.stroke} strokeWidth={2} lineCap="round" />
      <Ellipse x={0} y={-height * 0.6} radiusX={width * 0.035} radiusY={height * 0.035} fill={palette.accent} />
    </Group>
  );
}
