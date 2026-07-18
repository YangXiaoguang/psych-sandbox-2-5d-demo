import type { CSSProperties } from "react";
import type { SandboxAsset } from "../types";
import { useToyAssetSprite } from "../hooks/useToyAssetSprite";

interface AssetPreviewProps {
  asset: SandboxAsset;
}

export function AssetPreview({ asset }: AssetPreviewProps): JSX.Element {
  const footprintKind = asset.footprint.kind;
  const footprintPreviewScale = {
    compact: 1.03,
    flat: 1,
    tall: 0.96,
    wide: 0.94,
  }[footprintKind];
  const thumbnailScale = clamp(asset.thumbnailScale * footprintPreviewScale, 0.86, 1.2);
  const requestWidth = Math.max(92, Math.round(Math.max(asset.defaultWidth, asset.footprint.width) * 1.1));
  const requestHeight = Math.max(92, Math.round(Math.max(asset.defaultHeight, asset.footprint.height) * 1.08));
  const sprite = useToyAssetSprite({
    assetId: asset.assetId,
    width: requestWidth,
    height: requestHeight,
    riskTag: asset.riskTag,
  });

  return (
    <span
      className={`asset-preview asset-preview-${footprintKind} asset-preview-${asset.riskTag}`}
      style={{ "--asset-thumbnail-scale": thumbnailScale } as CSSProperties}
      aria-hidden="true"
    >
      {sprite ? (
        <img src={sprite.frame.dataUrl} alt="" draggable={false} />
      ) : (
        <span className="asset-preview-loading" />
      )}
    </span>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
