import { ChevronDown, ChevronRight, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ASSET_CATEGORIES, RISK_LABELS } from "../data/assets";
import type { RiskTag, SandboxAsset } from "../types";
import { AssetPreview } from "./AssetPreview";
import { RiskTagBadge } from "./RiskTagBadge";

interface AssetLibraryProps {
  assets: SandboxAsset[];
  onAddAsset: (asset: SandboxAsset) => void;
}

const DRAG_MIME = "application/x-sandbox-asset";
const FAVORITES_KEY = "psych-sandbox:favorite-assets";
const RECENT_KEY = "psych-sandbox:recent-assets";
const COLLAPSED_KEY = "psych-sandbox:collapsed-asset-categories";
const VIEW_MODE_KEY = "psych-sandbox:asset-library-view-mode";
const RISK_OPTIONS: Array<RiskTag | "all"> = ["all", "normal", "conflict", "death", "fantasy"];
type AssetLibraryViewMode = "large" | "compact";

export function AssetLibrary({ assets, onAddAsset }: AssetLibraryProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskTag | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [viewMode, setViewMode] = useState<AssetLibraryViewMode>(() => loadViewMode());
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadStringList(FAVORITES_KEY));
  const [recentIds, setRecentIds] = useState<string[]>(() => loadStringList(RECENT_KEY));
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>(() => loadStringList(COLLAPSED_KEY));
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const collapsedSet = useMemo(() => new Set(collapsedCategories), [collapsedCategories]);
  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const keyword = query.trim().toLowerCase();
        const matchesQuery =
          !keyword ||
          [asset.name, asset.category, asset.assetId, ...asset.symbolicCandidates, ...asset.semanticTags]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        const matchesRisk = riskFilter === "all" || asset.riskTag === riskFilter;
        const matchesFavorite = !favoritesOnly || favoriteIdSet.has(asset.assetId);
        return matchesQuery && matchesRisk && matchesFavorite;
      }),
    [assets, favoriteIdSet, favoritesOnly, query, riskFilter],
  );
  const categories = useMemo(
    () =>
      Array.from(new Set([...ASSET_CATEGORIES, ...assets.map((asset) => asset.category)])).filter(Boolean),
    [assets],
  );
  const recentAssets = useMemo(
    () =>
      recentIds
        .map((assetId) => filteredAssets.find((asset) => asset.assetId === assetId))
        .filter((asset): asset is SandboxAsset => Boolean(asset))
        .slice(0, 8),
    [filteredAssets, recentIds],
  );

  useEffect(() => saveStringList(FAVORITES_KEY, favoriteIds), [favoriteIds]);
  useEffect(() => saveStringList(RECENT_KEY, recentIds), [recentIds]);
  useEffect(() => saveStringList(COLLAPSED_KEY, collapsedCategories), [collapsedCategories]);
  useEffect(() => window.localStorage.setItem(VIEW_MODE_KEY, viewMode), [viewMode]);

  const handleAddAsset = (asset: SandboxAsset) => {
    setRecentIds((current) => [asset.assetId, ...current.filter((assetId) => assetId !== asset.assetId)].slice(0, 24));
    onAddAsset(asset);
  };

  const toggleFavorite = (assetId: string) => {
    setFavoriteIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [assetId, ...current],
    );
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
  };

  return (
    <aside className="asset-library" aria-label="沙具资产库">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Asset Library</p>
          <h1>沙具库</h1>
        </div>
        <span className="asset-count">{assets.length}</span>
      </div>

      <div className="asset-library-tools" aria-label="沙具筛选工具">
        <label className="asset-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、象征、标签..."
          />
        </label>
        <div className="asset-filter-row">
          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskTag | "all")}
            aria-label="风险标签筛选"
          >
            {RISK_OPTIONS.map((risk) => (
              <option key={risk} value={risk}>
                {risk === "all" ? "全部标签" : RISK_LABELS[risk]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={favoritesOnly ? "asset-tool-toggle active" : "asset-tool-toggle"}
            onClick={() => setFavoritesOnly((current) => !current)}
          >
            <Star size={13} />
            收藏
          </button>
        </div>
        <div className="segmented-mini" role="group" aria-label="资产库显示模式">
          <button type="button" className={viewMode === "large" ? "active" : ""} onClick={() => setViewMode("large")}>
            大图
          </button>
          <button type="button" className={viewMode === "compact" ? "active" : ""} onClick={() => setViewMode("compact")}>
            紧凑
          </button>
        </div>
      </div>

      <div className={`asset-category-list ${viewMode === "compact" ? "compact" : ""}`}>
        {recentAssets.length > 0 ? (
          <section className="asset-category recent" aria-labelledby="asset-category-recent">
            <AssetCategoryHeader
              id="asset-category-recent"
              title="最近使用"
              count={recentAssets.length}
              collapsed={collapsedSet.has("最近使用")}
              onToggle={() => toggleCategory("最近使用")}
            />
            {!collapsedSet.has("最近使用") ? (
              <AssetGrid
                assets={recentAssets}
                favoriteIds={favoriteIdSet}
                onAddAsset={handleAddAsset}
                onToggleFavorite={toggleFavorite}
              />
            ) : null}
          </section>
        ) : null}

        {categories.map((category) => {
          const categoryAssets = filteredAssets.filter((asset) => asset.category === category);
          const collapsed = collapsedSet.has(category);
          return (
            <section key={category} className="asset-category" aria-labelledby={`asset-category-${category}`}>
              <AssetCategoryHeader
                id={`asset-category-${category}`}
                title={category}
                count={categoryAssets.length}
                collapsed={collapsed}
                onToggle={() => toggleCategory(category)}
              />
              {!collapsed ? (
                <AssetGrid
                  assets={categoryAssets}
                  favoriteIds={favoriteIdSet}
                  onAddAsset={handleAddAsset}
                  onToggleFavorite={toggleFavorite}
                />
              ) : null}
            </section>
          );
        })}
        {filteredAssets.length === 0 ? <p className="empty-state">没有匹配的沙具，试试清空搜索或切换标签。</p> : null}
      </div>
    </aside>
  );
}

function AssetCategoryHeader({
  id,
  title,
  count,
  collapsed,
  onToggle,
}: {
  id: string;
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}): JSX.Element {
  const Icon = collapsed ? ChevronRight : ChevronDown;
  return (
    <button type="button" className="asset-category-header" onClick={onToggle} aria-expanded={!collapsed}>
      <span>
        <Icon size={14} />
        <strong id={id}>{title}</strong>
      </span>
      <em>{count}</em>
    </button>
  );
}

function AssetGrid({
  assets,
  favoriteIds,
  onAddAsset,
  onToggleFavorite,
}: {
  assets: SandboxAsset[];
  favoriteIds: Set<string>;
  onAddAsset: (asset: SandboxAsset) => void;
  onToggleFavorite: (assetId: string) => void;
}): JSX.Element {
  return (
    <div className="asset-grid">
      {assets.map((asset) => (
        <article
          key={asset.assetId}
          className="asset-card"
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData(DRAG_MIME, asset.assetId);
            event.dataTransfer.effectAllowed = "copy";
          }}
          title={`${asset.name} · ${RISK_LABELS[asset.riskTag]}`}
        >
          <button className="asset-card-action" type="button" onClick={() => onAddAsset(asset)}>
            <AssetPreview asset={asset} />
            <span className="asset-card-main">
              <span className="asset-card-name">{asset.name}</span>
              <RiskTagBadge riskTag={asset.riskTag} />
            </span>
          </button>
          <button
            type="button"
            className={favoriteIds.has(asset.assetId) ? "asset-favorite active" : "asset-favorite"}
            onClick={() => onToggleFavorite(asset.assetId)}
            aria-label={favoriteIds.has(asset.assetId) ? `取消收藏 ${asset.name}` : `收藏 ${asset.name}`}
          >
            <Star size={13} />
          </button>
        </article>
      ))}
      {assets.length === 0 ? <p className="empty-category">暂无可用沙具</p> : null}
    </div>
  );
}

function loadStringList(key: string): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveStringList(key: string, values: string[]): void {
  window.localStorage.setItem(key, JSON.stringify(values));
}

function loadViewMode(): AssetLibraryViewMode {
  return window.localStorage.getItem(VIEW_MODE_KEY) === "compact" ? "compact" : "large";
}

export { DRAG_MIME };
