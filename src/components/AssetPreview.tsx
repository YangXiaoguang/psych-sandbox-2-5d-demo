import type { CSSProperties } from "react";
import type { SandboxAsset } from "../types";
import { useToyAssetSprite } from "../hooks/useToyAssetSprite";

interface AssetPreviewProps {
  asset: SandboxAsset;
}

export function AssetPreview({ asset }: AssetPreviewProps): JSX.Element {
  const sprite = useToyAssetSprite({
    assetId: asset.assetId,
    width: Math.max(64, asset.defaultWidth),
    height: Math.max(64, asset.defaultHeight),
    riskTag: asset.riskTag,
  });

  return (
    <span
      className="asset-preview"
      style={{ "--asset-thumbnail-scale": asset.thumbnailScale } as CSSProperties}
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
