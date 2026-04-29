import { Ellipse, Group, Image as KonvaImage, Rect, Text } from "react-konva";
import type { RiskTag } from "../types";
import { useToyAssetSprite } from "../hooks/useToyAssetSprite";

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
  const sprite = useToyAssetSprite({ assetId, width, height, riskTag });

  return (
    <Group>
      <Ellipse
        x={0}
        y={height * 0.12}
        radiusX={width * 0.48}
        radiusY={height * 0.12}
        fill="#2c2117"
        opacity={0.2}
        shadowColor="#2c2117"
        shadowBlur={14}
        shadowOpacity={0.2}
        listening={false}
      />

      {sprite ? (
        <KonvaImage
          image={sprite.image}
          x={-sprite.frame.anchorX}
          y={-sprite.frame.anchorY}
          width={sprite.frame.width}
          height={sprite.frame.height}
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
