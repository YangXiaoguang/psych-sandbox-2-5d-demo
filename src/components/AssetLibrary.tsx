import { ASSET_CATEGORIES, RISK_LABELS } from "../data/assets";
import type { SandboxAsset } from "../types";
import { AssetPreview } from "./AssetPreview";
import { RiskTagBadge } from "./RiskTagBadge";

interface AssetLibraryProps {
  assets: SandboxAsset[];
  onAddAsset: (asset: SandboxAsset) => void;
}

const DRAG_MIME = "application/x-sandbox-asset";

export function AssetLibrary({ assets, onAddAsset }: AssetLibraryProps): JSX.Element {
  return (
    <aside className="asset-library" aria-label="沙具资产库">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Asset Library</p>
          <h1>沙具库</h1>
        </div>
        <span className="asset-count">{assets.length}</span>
      </div>

      <div className="asset-category-list">
        {ASSET_CATEGORIES.map((category) => {
          const categoryAssets = assets.filter((asset) => asset.category === category);
          return (
            <section key={category} className="asset-category" aria-labelledby={`asset-category-${category}`}>
              <h2 id={`asset-category-${category}`}>{category}</h2>
              <div className="asset-grid">
                {categoryAssets.map((asset) => (
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
                {categoryAssets.length === 0 ? <p className="empty-category">暂无可用沙具</p> : null}
              </div>
            </section>
          );
        })}
        {assets.filter((asset) => !ASSET_CATEGORIES.includes(asset.category as (typeof ASSET_CATEGORIES)[number])).length >
        0 ? (
          <section className="asset-category" aria-labelledby="asset-category-custom">
            <h2 id="asset-category-custom">自定义</h2>
            <div className="asset-grid">
              {assets
                .filter((asset) => !ASSET_CATEGORIES.includes(asset.category as (typeof ASSET_CATEGORIES)[number]))
                .map((asset) => (
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
        ) : null}
      </div>
    </aside>
  );
}

export { DRAG_MIME };
