import { useEffect, useState } from "react";
import type { RiskTag } from "../types";
import { renderToyAssetSprite, type ToyAssetSprite } from "../rendering/toyAssetRenderer";

export interface ToyAssetSpriteRequest {
  assetId: string;
  width: number;
  height: number;
  riskTag: RiskTag;
}

export interface LoadedToySprite {
  image: HTMLImageElement;
  frame: ToyAssetSprite;
}

export function useToyAssetSprite({
  assetId,
  width,
  height,
  riskTag,
}: ToyAssetSpriteRequest): LoadedToySprite | null {
  const [sprite, setSprite] = useState<LoadedToySprite | null>(null);

  useEffect(() => {
    let isActive = true;
    setSprite(null);

    renderToyAssetSprite({ assetId, width, height, riskTag })
      .then((frame) => loadImage(frame))
      .then((loaded) => {
        if (isActive) {
          setSprite(loaded);
        }
      })
      .catch(() => {
        if (isActive) {
          setSprite(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [assetId, height, riskTag, width]);

  return sprite;
}

function loadImage(frame: ToyAssetSprite): Promise<LoadedToySprite> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ image, frame });
    image.onerror = () => reject(new Error("Failed to load rendered toy sprite"));
    image.src = frame.dataUrl;
  });
}
