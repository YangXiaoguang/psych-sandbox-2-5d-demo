import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Clock3,
  Home,
  PawPrint,
  Search,
  Sparkles,
  Star,
  Trees,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ASSET_CATEGORIES, RISK_LABELS } from "../data/assets";
import type { RiskTag, SandboxAsset } from "../types";
import { AssetPreview } from "./AssetPreview";
import { RiskTagBadge } from "./RiskTagBadge";

interface AssetLibraryProps {
  assets: SandboxAsset[];
  onAddAsset: (asset: SandboxAsset) => void;
  onBeginDragAsset?: (asset: SandboxAsset) => void;
  onEndDragAsset?: () => void;
}

const DRAG_MIME = "application/x-sandbox-asset";
const FAVORITES_KEY = "psych-sandbox:favorite-assets";
const RECENT_KEY = "psych-sandbox:recent-assets";
const COLLAPSED_KEY = "psych-sandbox:collapsed-asset-categories";
const VIEW_MODE_KEY = "psych-sandbox:asset-library-view-mode";
const RISK_OPTIONS: Array<RiskTag | "all"> = ["all", "normal", "conflict", "death", "fantasy"];
type AssetLibraryViewMode = "large" | "compact";
type AssetShelfId = "all" | "recent" | "favorites" | string;

interface AssetSection {
  id: string;
  title: string;
  assets: SandboxAsset[];
  collapsible: boolean;
}

interface ShelfItem {
  id: AssetShelfId;
  label: string;
  count: number;
  icon: LucideIcon;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  人物: UserRound,
  动物: PawPrint,
  建筑与环境: Home,
  自然元素: Trees,
  特殊象征: Sparkles,
};

export function AssetLibrary({
  assets,
  onAddAsset,
  onBeginDragAsset,
  onEndDragAsset,
}: AssetLibraryProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskTag | "all">("all");
  const [activeShelf, setActiveShelf] = useState<AssetShelfId>("all");
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
        return matchesQuery && matchesRisk;
      }),
    [assets, query, riskFilter],
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
  const favoriteAssets = useMemo(
    () => filteredAssets.filter((asset) => favoriteIdSet.has(asset.assetId)),
    [favoriteIdSet, filteredAssets],
  );
  const shelfItems = useMemo<ShelfItem[]>(
    () => [
      { id: "all", label: "全部", count: filteredAssets.length, icon: Boxes },
      { id: "recent", label: "最近", count: recentAssets.length, icon: Clock3 },
      { id: "favorites", label: "收藏", count: favoriteAssets.length, icon: Star },
      ...categories.map((category) => ({
        id: category,
        label: category,
        count: filteredAssets.filter((asset) => asset.category === category).length,
        icon: CATEGORY_ICONS[category] ?? Boxes,
      })),
    ],
    [categories, favoriteAssets.length, filteredAssets, recentAssets.length],
  );
  const activeSections = useMemo<AssetSection[]>(() => {
    if (activeShelf === "recent") {
      return [{ id: "最近使用", title: "最近使用", assets: recentAssets, collapsible: false }];
    }

    if (activeShelf === "favorites") {
      return [{ id: "收藏", title: "收藏", assets: favoriteAssets, collapsible: false }];
    }

    const categorySections = categories.map((category) => ({
      id: category,
      title: category,
      assets: filteredAssets.filter((asset) => asset.category === category),
      collapsible: true,
    }));

    if (activeShelf !== "all") {
      return categorySections.filter((section) => section.id === activeShelf);
    }

    return [
      ...(recentAssets.length > 0
        ? [{ id: "最近使用", title: "最近使用", assets: recentAssets, collapsible: true }]
        : []),
      ...categorySections,
    ];
  }, [activeShelf, categories, favoriteAssets, filteredAssets, recentAssets]);
  const visibleAssetCount = activeSections.reduce((sum, section) => sum + section.assets.length, 0);

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
            className={activeShelf === "favorites" ? "asset-tool-toggle active" : "asset-tool-toggle"}
            onClick={() => setActiveShelf((current) => (current === "favorites" ? "all" : "favorites"))}
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

      <div className="asset-backpack">
        <AssetShelfRail items={shelfItems} activeShelf={activeShelf} onChange={setActiveShelf} />
        <div className={`asset-category-list ${viewMode === "compact" ? "compact" : ""}`}>
          <div className="asset-shelf-status" aria-live="polite">
            <strong>{getShelfLabel(activeShelf, shelfItems)}</strong>
            <span>{visibleAssetCount} 个可用沙具</span>
          </div>
          {activeSections.map((section) => {
            const collapsed = section.collapsible && collapsedSet.has(section.id);
            return (
              <section
                key={section.id}
                className={section.id === "最近使用" ? "asset-category recent" : "asset-category"}
                aria-labelledby={`asset-category-${section.id}`}
              >
                <AssetCategoryHeader
                  id={`asset-category-${section.id}`}
                  title={section.title}
                  count={section.assets.length}
                  collapsed={collapsed}
                  collapsible={section.collapsible}
                  onToggle={() => section.collapsible && toggleCategory(section.id)}
                />
                {!collapsed ? (
                  <AssetGrid
                    assets={section.assets}
                    favoriteIds={favoriteIdSet}
                    onAddAsset={handleAddAsset}
                    onToggleFavorite={toggleFavorite}
                    onBeginDragAsset={onBeginDragAsset}
                    onEndDragAsset={onEndDragAsset}
                  />
                ) : null}
              </section>
            );
          })}
          {visibleAssetCount === 0 ? (
            <p className="empty-state">没有匹配的沙具，试试清空搜索、切换分类或标签。</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function AssetShelfRail({
  items,
  activeShelf,
  onChange,
}: {
  items: ShelfItem[];
  activeShelf: AssetShelfId;
  onChange: (id: AssetShelfId) => void;
}): JSX.Element {
  return (
    <nav className="asset-shelf-rail" aria-label="沙具背包分类">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={activeShelf === item.id ? "active" : ""}
            onClick={() => onChange(item.id)}
            aria-label={`${item.label}，${item.count} 个沙具`}
            title={`${item.label} · ${item.count}`}
          >
            <Icon size={16} />
            <em>{item.count}</em>
          </button>
        );
      })}
    </nav>
  );
}

function getShelfLabel(activeShelf: AssetShelfId, items: ShelfItem[]): string {
  return items.find((item) => item.id === activeShelf)?.label ?? "全部";
}

function AssetCategoryHeader({
  id,
  title,
  count,
  collapsed,
  collapsible,
  onToggle,
}: {
  id: string;
  title: string;
  count: number;
  collapsed: boolean;
  collapsible: boolean;
  onToggle: () => void;
}): JSX.Element {
  const Icon = !collapsible ? Boxes : collapsed ? ChevronRight : ChevronDown;
  return (
    <button
      type="button"
      className={!collapsible ? "asset-category-header fixed" : "asset-category-header"}
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
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
  onBeginDragAsset,
  onEndDragAsset,
}: {
  assets: SandboxAsset[];
  favoriteIds: Set<string>;
  onAddAsset: (asset: SandboxAsset) => void;
  onToggleFavorite: (assetId: string) => void;
  onBeginDragAsset?: (asset: SandboxAsset) => void;
  onEndDragAsset?: () => void;
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
            event.dataTransfer.setDragImage(event.currentTarget, event.currentTarget.clientWidth / 2, 42);
            onBeginDragAsset?.(asset);
          }}
          onDragEnd={() => onEndDragAsset?.()}
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
