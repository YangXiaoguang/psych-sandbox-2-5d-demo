import { Ellipse, Group, Image as KonvaImage, Rect, Text } from "react-konva";
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
        />
      ) : (
        <ToySpriteFallback width={width} height={height} />
      )}
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
