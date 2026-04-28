import { ASSET_CATEGORIES, RISK_LABELS, SANDBOX_ASSETS } from "../data/assets";
import type { SandboxAsset } from "../types";
import { AssetPreview } from "./AssetPreview";
import { RiskTagBadge } from "./RiskTagBadge";

interface AssetLibraryProps {
  onAddAsset: (asset: SandboxAsset) => void;
}

const DRAG_MIME = "application/x-sandbox-asset";

export function AssetLibrary({ onAddAsset }: AssetLibraryProps): JSX.Element {
  return (
    <aside className="asset-library" aria-label="沙具资产库">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Asset Library</p>
          <h1>沙具库</h1>
        </div>
        <span className="asset-count">{SANDBOX_ASSETS.length}</span>
      </div>

      <div className="asset-category-list">
        {ASSET_CATEGORIES.map((category) => {
          const assets = SANDBOX_ASSETS.filter((asset) => asset.category === category);
          return (
            <section key={category} className="asset-category" aria-labelledby={`asset-category-${category}`}>
              <h2 id={`asset-category-${category}`}>{category}</h2>
              <div className="asset-grid">
                {assets.map((asset) => (
                  <button
                    key={asset.assetId}
                    className="asset-card"
                    type="button"
                    draggable
                    onClick={() => onAddAsset(asset)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_MIME, asset.assetId);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    title={`${asset.name} · ${RISK_LABELS[asset.riskTag]}`}
                  >
                    <AssetPreview asset={asset} />
                    <span className="asset-card-main">
                      <span className="asset-card-name">{asset.name}</span>
                      <RiskTagBadge riskTag={asset.riskTag} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

export { DRAG_MIME };
