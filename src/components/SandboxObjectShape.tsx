import { Ellipse, Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";
import { getEnvironmentProfile } from "../data/environment";
import type { RiskTag, SandboxEnvironment } from "../types";
import { useToyAssetSprite } from "../hooks/useToyAssetSprite";

interface SandboxObjectShapeProps {
  assetId: string;
  width: number;
  height: number;
  riskTag: RiskTag;
  environment: SandboxEnvironment;
}

export function SandboxObjectShape({
  assetId,
  width,
  height,
  riskTag,
  environment,
}: SandboxObjectShapeProps): JSX.Element {
  const sprite = useToyAssetSprite({ assetId, width, height, riskTag });
  const profile = getEnvironmentProfile(environment).object;
  const shadowWidth = width * 0.54;
  const shadowHeight = Math.max(8, height * 0.13);
  const castOffsetX = Math.max(4, width * profile.castOffsetX);
  const castOffsetY = Math.max(4, height * profile.castOffsetY);
  const rainy = environment.weather === "rainy";
  const night = environment.light === "night";

  return (
    <Group>
      <Ellipse
        x={castOffsetX}
        y={height * 0.13 + castOffsetY}
        radiusX={shadowWidth * 1.04}
        radiusY={shadowHeight * 1.18}
        fill={profile.shadowColor}
        opacity={profile.castOpacity}
        shadowColor={profile.shadowColor}
        shadowBlur={profile.shadowBlur + 8}
        shadowOpacity={0.2}
        listening={false}
      />
      <Ellipse
        x={width * 0.02}
        y={height * 0.11}
        radiusX={shadowWidth * 0.78}
        radiusY={shadowHeight * 0.72}
        fill={profile.shadowColor}
        opacity={profile.contactOpacity}
        shadowColor={profile.shadowColor}
        shadowBlur={profile.shadowBlur}
        shadowOpacity={0.24}
        listening={false}
      />

      {sprite ? (
        <KonvaImage
          image={sprite.image}
          x={-sprite.frame.anchorX}
          y={-sprite.frame.anchorY}
          width={sprite.frame.width}
          height={sprite.frame.height}
          opacity={profile.spriteOpacity}
          listening={false}
        />
      ) : (
        <ToySpriteFallback width={width} height={height} />
      )}

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

function ToySpriteFallback({ width, height }: { width: number; height: number }): JSX.Element {
  return (
    <Group>
      <Rect
        x={-width * 0.3}
        y={-height * 0.62}
        width={width * 0.6}
        height={height * 0.62}
        cornerRadius={Math.min(width, height) * 0.16}
        fill="#f1d59f"
        stroke="#9c7b4d"
        strokeWidth={2}
        shadowColor="#6c5739"
        shadowBlur={8}
        shadowOpacity={0.18}
      />
      <Text
        x={-width * 0.28}
        y={-height * 0.38}
        width={width * 0.56}
        align="center"
        text="3D"
        fill="#8a6738"
        fontSize={Math.max(12, Math.round(width * 0.22))}
        fontStyle="bold"
        listening={false}
      />
    </Group>
  );
}
