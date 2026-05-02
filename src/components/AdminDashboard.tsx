import {
  Bot,
  Boxes,
  KeyRound,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ASSET_CATEGORIES, RISK_LABELS } from "../data/assets";
import { getToyAssetSpec } from "../data/toyAssetSpecs";
import { getProviderLabel, getProviderPreset, PROVIDER_PRESETS } from "../llm/providerPresets";
import type {
  AgentAvatarStyle,
  LlmProviderConfig,
  LlmProviderKind,
  ManagedAsset,
  PsychAgentProfile,
  RiskTag,
  ToyModelRecipe,
} from "../types";
import { createId } from "../utils/id";
import { AgentPortrait } from "./AgentPortrait";
import { AssetPreview } from "./AssetPreview";
import { RiskTagBadge } from "./RiskTagBadge";

type AdminTab = "assets" | "llm" | "agents";
type ToyRecipeKind = ToyModelRecipe["kind"];
type AssetStatusFilter = "all" | "enabled" | "disabled" | "deleted";
type AssetOriginFilter = "all" | "builtin" | "custom";
type AssetViewMode = "table" | "grid";
type AssetSortKey = "updatedAt" | "name" | "category" | "riskTag" | "status";

interface AdminDashboardProps {
  managedAssets: ManagedAsset[];
  llmProviders: LlmProviderConfig[];
  agents: PsychAgentProfile[];
  onManagedAssetsChange: (assets: ManagedAsset[]) => void;
  onLlmProvidersChange: (providers: LlmProviderConfig[]) => void;
  onAgentsChange: (agents: PsychAgentProfile[]) => void;
  onResetAssets: () => void;
}

const RISK_OPTIONS: RiskTag[] = ["normal", "conflict", "death", "fantasy"];
const MODEL_KINDS: ToyRecipeKind[] = [
  "person",
  "dog",
  "bird",
  "fish",
  "lion",
  "house",
  "bridge",
  "fence",
  "tower",
  "tree",
  "water",
  "rock",
  "sun",
  "monster",
  "robot",
  "skull",
  "light",
  "fallback",
];
const PROVIDER_KINDS = Object.keys(PROVIDER_PRESETS) as LlmProviderKind[];
const AVATAR_STYLES: AgentAvatarStyle[] = ["warm", "dream", "analyst", "sage", "mentor"];

export function AdminDashboard({
  managedAssets,
  llmProviders,
  agents,
  onManagedAssetsChange,
  onLlmProvidersChange,
  onAgentsChange,
  onResetAssets,
}: AdminDashboardProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<AdminTab>("assets");

  return (
    <main className="admin-shell" aria-label="管理后台">
      <section className="admin-hero">
        <div>
          <p className="eyebrow">Local Admin Console</p>
          <h2>管理后台</h2>
          <p>本地管理沙具资产、LLM 厂商配置和心理学家 Agent。当前 Demo 不会向第三方发送任何密钥或对话。</p>
        </div>
        <div className="admin-tabbar" role="tablist" aria-label="管理类型">
          <TabButton id="assets" label="沙具资产" activeTab={activeTab} onSelect={setActiveTab} icon={<Boxes size={16} />} />
          <TabButton id="llm" label="LLM 配置" activeTab={activeTab} onSelect={setActiveTab} icon={<KeyRound size={16} />} />
          <TabButton id="agents" label="Agent 配置" activeTab={activeTab} onSelect={setActiveTab} icon={<Bot size={16} />} />
        </div>
      </section>

      {activeTab === "assets" ? (
        <AssetAdminPanel
          assets={managedAssets}
          onAssetsChange={onManagedAssetsChange}
          onResetAssets={onResetAssets}
        />
      ) : null}
      {activeTab === "llm" ? (
        <LlmAdminPanel providers={llmProviders} onProvidersChange={onLlmProvidersChange} />
      ) : null}
      {activeTab === "agents" ? (
        <AgentAdminPanel
          agents={agents}
          providers={llmProviders}
          onAgentsChange={onAgentsChange}
        />
      ) : null}
    </main>
  );
}

function TabButton({
  id,
  label,
  activeTab,
  onSelect,
  icon,
}: {
  id: AdminTab;
  label: string;
  activeTab: AdminTab;
  onSelect: (tab: AdminTab) => void;
  icon: JSX.Element;
}): JSX.Element {
  return (
    <button type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} onClick={() => onSelect(id)}>
      {icon}
      {label}
    </button>
  );
}

function AssetAdminPanel({
  assets,
  onAssetsChange,
  onResetAssets,
}: {
  assets: ManagedAsset[];
  onAssetsChange: (assets: ManagedAsset[]) => void;
  onResetAssets: () => void;
}): JSX.Element {
  const [selectedId, setSelectedId] = useState(() => assets[0]?.assetId ?? "");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState<RiskTag | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AssetStatusFilter>("all");
  const [originFilter, setOriginFilter] = useState<AssetOriginFilter>("all");
  const [viewMode, setViewMode] = useState<AssetViewMode>("table");
  const [sortKey, setSortKey] = useState<AssetSortKey>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const selected = assets.find((asset) => asset.assetId === selectedId) ?? assets[0] ?? null;
  const selectedAssetSet = useMemo(() => new Set(selectedAssetIds), [selectedAssetIds]);
  const categories = useMemo(
    () =>
      Array.from(new Set([...ASSET_CATEGORIES, ...assets.map((asset) => asset.category), "自定义"]))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
    [assets],
  );
  const filteredAssets = useMemo(
    () =>
      assets
        .filter((asset) =>
          matchesAssetFilters(asset, {
            query,
            categoryFilter,
            riskFilter,
            statusFilter,
            originFilter,
          }),
        )
        .sort((a, b) => compareAssets(a, b, sortKey, sortDirection)),
    [assets, categoryFilter, originFilter, query, riskFilter, sortDirection, sortKey, statusFilter],
  );
  const pageSize = viewMode === "table" ? 50 : 48;
  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedAssets = filteredAssets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const enabledCount = assets.filter((asset) => asset.enabled && !asset.deletedAt).length;
  const hiddenCount = assets.filter((asset) => !asset.enabled || asset.deletedAt).length;
  const issueCount = assets.reduce((total, asset) => total + getAssetIssueCount(asset, assets), 0);
  const pageAllSelected = pagedAssets.length > 0 && pagedAssets.every((asset) => selectedAssetSet.has(asset.assetId));

  useEffect(() => {
    if (assets.length > 0 && !assets.some((asset) => asset.assetId === selectedId)) {
      setSelectedId(assets[0].assetId);
    }
  }, [assets, selectedId]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, originFilter, query, riskFilter, statusFilter, viewMode]);

  useEffect(() => {
    const assetIds = new Set(assets.map((asset) => asset.assetId));
    setSelectedAssetIds((current) => current.filter((assetId) => assetIds.has(assetId)));
  }, [assets]);

  const updateAssetById = (assetId: string, patch: Partial<ManagedAsset>) => {
    const updatedAt = new Date().toISOString();
    onAssetsChange(
      assets.map((asset) => (asset.assetId === assetId ? { ...asset, ...patch, updatedAt } : asset)),
    );
  };

  const updateAsset = (patch: Partial<ManagedAsset>) => {
    if (selected) {
      updateAssetById(selected.assetId, patch);
    }
  };

  const addAsset = () => {
    const now = new Date().toISOString();
    const assetId = createId("asset");
    const spec = getToyAssetSpec(assetId, "normal");
    const asset: ManagedAsset = {
      assetId,
      name: "新沙具",
      category: "自定义",
      defaultWidth: 82,
      defaultHeight: 82,
      symbolicCandidates: ["待定义"],
      riskTag: "normal",
      anchor: spec.anchor,
      footprint: spec.footprint,
      thumbnailScale: spec.thumbnailScale,
      semanticTags: ["自定义"],
      modelRecipe: { kind: "fallback" },
      isBuiltIn: false,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    onAssetsChange([asset, ...assets]);
    setSelectedId(asset.assetId);
  };

  const markDeleted = () => {
    if (!selected) {
      return;
    }
    markAssetsDeleted([selected.assetId]);
  };

  const restoreAsset = () => updateAsset({ enabled: true, deletedAt: undefined });
  const bulkTargets = selectedAssetIds;

  const updateManyAssets = (assetIds: string[], patch: Partial<ManagedAsset>) => {
    if (assetIds.length === 0) {
      return;
    }
    const updatedAt = new Date().toISOString();
    const targetSet = new Set(assetIds);
    onAssetsChange(
      assets.map((asset) => (targetSet.has(asset.assetId) ? { ...asset, ...patch, updatedAt } : asset)),
    );
  };

  const markAssetsDeleted = (assetIds: string[]) => {
    updateManyAssets(assetIds, { enabled: false, deletedAt: new Date().toISOString() });
  };

  const restoreAssets = (assetIds: string[]) => {
    updateManyAssets(assetIds, { enabled: true, deletedAt: undefined });
  };

  const toggleAssetSelection = (assetId: string, checked: boolean) => {
    setSelectedAssetIds((current) =>
      checked ? Array.from(new Set([...current, assetId])) : current.filter((id) => id !== assetId),
    );
  };

  const togglePageSelection = (checked: boolean) => {
    const pageIds = pagedAssets.map((asset) => asset.assetId);
    setSelectedAssetIds((current) =>
      checked
        ? Array.from(new Set([...current, ...pageIds]))
        : current.filter((assetId) => !pageIds.includes(assetId)),
    );
  };

  const changeSort = (key: AssetSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "updatedAt" ? "desc" : "asc");
    }
  };

  const clearFilters = () => {
    setQuery("");
    setCategoryFilter("all");
    setRiskFilter("all");
    setStatusFilter("all");
    setOriginFilter("all");
    setSelectedAssetIds([]);
  };

  return (
    <section className="asset-admin-layout">
      <aside className="admin-card asset-filter-panel" aria-label="沙具筛选">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Asset Filters</p>
            <h3>筛选与统计</h3>
          </div>
        </div>
        <div className="asset-filter-body">
          <label className="asset-search-field">
            搜索
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="名称 / ID / 标签 / 象征词"
            />
          </label>
          <label>
            分类
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">全部分类</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <label>
            风险标签
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskTag | "all")}>
              <option value="all">全部风险</option>
              {RISK_OPTIONS.map((riskTag) => (
                <option key={riskTag} value={riskTag}>
                  {RISK_LABELS[riskTag]}
                </option>
              ))}
            </select>
          </label>
          <label>
            状态
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AssetStatusFilter)}>
              <option value="all">全部状态</option>
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
              <option value="deleted">已隐藏/删除</option>
            </select>
          </label>
          <label>
            来源
            <select value={originFilter} onChange={(event) => setOriginFilter(event.target.value as AssetOriginFilter)}>
              <option value="all">全部来源</option>
              <option value="builtin">内置</option>
              <option value="custom">自定义</option>
            </select>
          </label>
          <div className="asset-stat-grid" aria-label="资产统计">
            <AssetStat label="总数" value={assets.length} />
            <AssetStat label="启用" value={enabledCount} />
            <AssetStat label="隐藏" value={hiddenCount} />
            <AssetStat label="问题" value={issueCount} tone={issueCount > 0 ? "warn" : "ok"} />
          </div>
          <div className="asset-category-pills" aria-label="快速分类">
            <button type="button" className={categoryFilter === "all" ? "active" : ""} onClick={() => setCategoryFilter("all")}>
              全部
            </button>
            {categories.slice(0, 9).map((category) => (
              <button
                key={category}
                type="button"
                className={categoryFilter === category ? "active" : ""}
                onClick={() => setCategoryFilter(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <button type="button" className="asset-clear-filters" onClick={clearFilters}>
            清除筛选
          </button>
        </div>
      </aside>

      <section className="admin-card asset-catalog-panel" aria-label="沙具资产目录">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Asset Catalog</p>
            <h3>沙具目录</h3>
          </div>
          <div className="admin-actions">
            <button type="button" className="icon-button" onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}>
              {viewMode === "table" ? "网格" : "表格"}
            </button>
            <button type="button" className="small-icon-button" onClick={addAsset} aria-label="新增沙具">
              <Plus size={16} />
            </button>
            <button type="button" className="small-icon-button" onClick={onResetAssets} aria-label="恢复默认沙具目录">
              <RefreshCcw size={16} />
            </button>
          </div>
        </div>
        <div className="asset-catalog-toolbar">
          <span>
            显示 {filteredAssets.length} / {assets.length} 个沙具
          </span>
          <div>
            <label>
              排序
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as AssetSortKey)}>
                <option value="updatedAt">更新时间</option>
                <option value="name">名称</option>
                <option value="category">分类</option>
                <option value="riskTag">风险</option>
                <option value="status">状态</option>
              </select>
            </label>
            <button type="button" onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}>
              {sortDirection === "asc" ? "升序" : "降序"}
            </button>
          </div>
        </div>

        {bulkTargets.length > 0 ? (
          <div className="asset-bulk-bar">
            <strong>{selectedAssetIds.length > 0 ? selectedAssetIds.length : 1} 个已选择</strong>
            <button type="button" onClick={() => updateManyAssets(bulkTargets, { enabled: true, deletedAt: undefined })}>
              启用
            </button>
            <button type="button" onClick={() => updateManyAssets(bulkTargets, { enabled: false })}>
              停用
            </button>
            <button type="button" onClick={() => markAssetsDeleted(bulkTargets)}>
              隐藏
            </button>
            <button type="button" onClick={() => restoreAssets(bulkTargets)}>
              恢复
            </button>
            <select
              aria-label="批量设置风险标签"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  updateManyAssets(bulkTargets, { riskTag: event.target.value as RiskTag });
                  event.target.value = "";
                }
              }}
            >
              <option value="">批量风险</option>
              {RISK_OPTIONS.map((riskTag) => (
                <option key={riskTag} value={riskTag}>
                  {RISK_LABELS[riskTag]}
                </option>
              ))}
            </select>
            {selectedAssetIds.length > 0 ? (
              <button type="button" onClick={() => setSelectedAssetIds([])}>
                取消选择
              </button>
            ) : null}
          </div>
        ) : null}

        {viewMode === "table" ? (
          <div className="asset-table-wrap">
            <table className="asset-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={pageAllSelected}
                      onChange={(event) => togglePageSelection(event.target.checked)}
                      aria-label="选择当前页沙具"
                    />
                  </th>
                  <th>预览</th>
                  <th>
                    <button type="button" onClick={() => changeSort("name")}>
                      名称
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => changeSort("category")}>
                      分类
                    </button>
                  </th>
                  <th>
                    <button type="button" onClick={() => changeSort("riskTag")}>
                      风险
                    </button>
                  </th>
                  <th>模型</th>
                  <th>
                    <button type="button" onClick={() => changeSort("status")}>
                      状态
                    </button>
                  </th>
                  <th>问题</th>
                </tr>
              </thead>
              <tbody>
                {pagedAssets.map((asset) => (
                  <tr key={asset.assetId} className={selected?.assetId === asset.assetId ? "active" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedAssetSet.has(asset.assetId)}
                        onChange={(event) => toggleAssetSelection(asset.assetId, event.target.checked)}
                        aria-label={`选择 ${asset.name}`}
                      />
                    </td>
                    <td>
                      <AssetPreview asset={asset} />
                    </td>
                    <td>
                      <button type="button" className="asset-name-button" onClick={() => setSelectedId(asset.assetId)}>
                        <strong>{asset.name}</strong>
                        <em>{asset.assetId}</em>
                      </button>
                    </td>
                    <td>{asset.category}</td>
                    <td>
                      <RiskTagBadge riskTag={asset.riskTag} />
                    </td>
                    <td>{asset.modelRecipe.kind}</td>
                    <td>
                      <AssetStatusPill asset={asset} />
                    </td>
                    <td>
                      <span className={getAssetIssueCount(asset, assets) > 0 ? "asset-issue-count warn" : "asset-issue-count"}>
                        {getAssetIssueCount(asset, assets)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="asset-admin-grid-view">
            {pagedAssets.map((asset) => (
              <article key={asset.assetId} className={selected?.assetId === asset.assetId ? "active" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedAssetSet.has(asset.assetId)}
                    onChange={(event) => toggleAssetSelection(asset.assetId, event.target.checked)}
                  />
                  选择
                </label>
                <AssetPreview asset={asset} />
                <button type="button" onClick={() => setSelectedId(asset.assetId)}>
                  <strong>{asset.name}</strong>
                  <em>{asset.category}</em>
                </button>
                <div>
                  <RiskTagBadge riskTag={asset.riskTag} />
                  <AssetStatusPill asset={asset} />
                </div>
              </article>
            ))}
          </div>
        )}

        {filteredAssets.length === 0 ? <p className="empty-state">没有符合筛选条件的沙具。</p> : null}

        <div className="asset-pagination">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
            上一页
          </button>
          <span>
            第 {currentPage} / {totalPages} 页
          </span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>
            下一页
          </button>
        </div>
      </section>

      <aside className="admin-card asset-detail-panel" aria-label="沙具详情">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Asset Detail</p>
            <h3>{selected ? selected.name : "请选择沙具"}</h3>
          </div>
          {selected ? (
            <div className="admin-actions">
              {selected.deletedAt || !selected.enabled ? (
                <button type="button" className="icon-button" onClick={restoreAsset}>
                  <Undo2 size={15} />
                  恢复
                </button>
              ) : (
                <button type="button" className="icon-button danger" onClick={markDeleted}>
                  <Trash2 size={15} />
                  删除
                </button>
              )}
            </div>
          ) : null}
        </div>
        {selected ? (
          <div className="admin-form">
            <div className="asset-detail-preview">
              <AssetPreview asset={selected} />
              <div>
                <strong>{selected.assetId}</strong>
                <span>{selected.isBuiltIn ? "内置资产" : "自定义资产"}</span>
                <AssetStatusPill asset={selected} />
              </div>
            </div>
            <AssetHealthList asset={selected} allAssets={assets} />
            <label>
              名称
              <input value={selected.name} onChange={(event) => updateAsset({ name: event.target.value })} />
            </label>
            <label>
              分类
              <input list="asset-category-options" value={selected.category} onChange={(event) => updateAsset({ category: event.target.value })} />
              <datalist id="asset-category-options">
                {[...ASSET_CATEGORIES, "自定义"].map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
            <div className="form-grid-2">
              <label>
                宽度
                <input type="number" min={24} value={selected.defaultWidth} onChange={(event) => updateAsset({ defaultWidth: Number(event.target.value) })} />
              </label>
              <label>
                高度
                <input type="number" min={24} value={selected.defaultHeight} onChange={(event) => updateAsset({ defaultHeight: Number(event.target.value) })} />
              </label>
            </div>
            <div className="form-grid-2">
              <label>
                风险标签
                <select value={selected.riskTag} onChange={(event) => updateAsset({ riskTag: event.target.value as RiskTag })}>
                  {RISK_OPTIONS.map((riskTag) => (
                    <option key={riskTag} value={riskTag}>
                      {RISK_LABELS[riskTag]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                模型模板
                <select
                  value={selected.modelRecipe.kind}
                  onChange={(event) => updateAsset(createModelPatch(event.target.value as ToyRecipeKind))}
                >
                  {MODEL_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              象征候选
              <textarea value={selected.symbolicCandidates.join("\n")} onChange={(event) => updateAsset({ symbolicCandidates: splitLines(event.target.value) })} />
            </label>
            <label>
              语义标签
              <textarea value={selected.semanticTags.join("\n")} onChange={(event) => updateAsset({ semanticTags: splitLines(event.target.value) })} />
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={selected.enabled && !selected.deletedAt} onChange={(event) => updateAsset({ enabled: event.target.checked, deletedAt: event.target.checked ? undefined : new Date().toISOString() })} />
              在沙具库中启用
            </label>
            <div className="asset-meta-block">
              <span>创建：{formatDateTime(selected.createdAt)}</span>
              <span>更新：{formatDateTime(selected.updatedAt)}</span>
              <span>
                尺寸：{selected.defaultWidth} × {selected.defaultHeight}
              </span>
              <span>
                足迹：{selected.footprint.kind} / {selected.footprint.width}×{selected.footprint.depth}
              </span>
            </div>
          </div>
        ) : (
          <p className="empty-state">暂无沙具。</p>
        )}
      </aside>
    </section>
  );
}

function AssetStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "ok" | "warn";
}): JSX.Element {
  return (
    <span className={`asset-stat ${tone}`}>
      <strong>{value}</strong>
      <em>{label}</em>
    </span>
  );
}

function AssetStatusPill({ asset }: { asset: ManagedAsset }): JSX.Element {
  const isDeleted = Boolean(asset.deletedAt);
  const label = isDeleted ? "已隐藏" : asset.enabled ? "启用" : "停用";
  const className = isDeleted ? "deleted" : asset.enabled ? "enabled" : "";
  return <span className={`asset-status-pill ${className}`}>{label}</span>;
}

function AssetHealthList({
  asset,
  allAssets,
}: {
  asset: ManagedAsset;
  allAssets: ManagedAsset[];
}): JSX.Element {
  const issues = getAssetIssues(asset, allAssets);
  return (
    <div className={`asset-health ${issues.length > 0 ? "warn" : "ok"}`}>
      <strong>{issues.length > 0 ? `发现 ${issues.length} 个配置问题` : "资产配置完整"}</strong>
      {issues.length > 0 ? (
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : (
        <p>基础字段、语义标签与渲染配置都可用。</p>
      )}
    </div>
  );
}

function matchesAssetFilters(
  asset: ManagedAsset,
  filters: {
    query: string;
    categoryFilter: string;
    riskFilter: RiskTag | "all";
    statusFilter: AssetStatusFilter;
    originFilter: AssetOriginFilter;
  },
): boolean {
  const normalizedQuery = filters.query.trim().toLowerCase();
  const searchText = [
    asset.assetId,
    asset.name,
    asset.category,
    asset.riskTag,
    asset.modelRecipe.kind,
    ...asset.symbolicCandidates,
    ...asset.semanticTags,
  ]
    .join(" ")
    .toLowerCase();
  const matchesQuery = !normalizedQuery || searchText.includes(normalizedQuery);
  const matchesCategory = filters.categoryFilter === "all" || asset.category === filters.categoryFilter;
  const matchesRisk = filters.riskFilter === "all" || asset.riskTag === filters.riskFilter;
  const matchesOrigin =
    filters.originFilter === "all" ||
    (filters.originFilter === "builtin" && asset.isBuiltIn) ||
    (filters.originFilter === "custom" && !asset.isBuiltIn);
  const matchesStatus =
    filters.statusFilter === "all" ||
    (filters.statusFilter === "enabled" && asset.enabled && !asset.deletedAt) ||
    (filters.statusFilter === "disabled" && !asset.enabled && !asset.deletedAt) ||
    (filters.statusFilter === "deleted" && Boolean(asset.deletedAt));
  return matchesQuery && matchesCategory && matchesRisk && matchesOrigin && matchesStatus;
}

function compareAssets(
  a: ManagedAsset,
  b: ManagedAsset,
  sortKey: AssetSortKey,
  direction: "asc" | "desc",
): number {
  const multiplier = direction === "asc" ? 1 : -1;
  if (sortKey === "updatedAt") {
    return multiplier * a.updatedAt.localeCompare(b.updatedAt);
  }
  if (sortKey === "status") {
    return multiplier * getAssetStatusText(a).localeCompare(getAssetStatusText(b), "zh-Hans-CN");
  }
  return multiplier * String(a[sortKey]).localeCompare(String(b[sortKey]), "zh-Hans-CN");
}

function getAssetStatusText(asset: ManagedAsset): string {
  if (asset.deletedAt) {
    return "hidden";
  }
  return asset.enabled ? "enabled" : "disabled";
}

function getAssetIssueCount(asset: ManagedAsset, allAssets: ManagedAsset[]): number {
  return getAssetIssues(asset, allAssets).length;
}

function getAssetIssues(asset: ManagedAsset, allAssets: ManagedAsset[]): string[] {
  const issues: string[] = [];
  if (!asset.name.trim()) {
    issues.push("名称为空");
  }
  if (!asset.assetId.trim()) {
    issues.push("assetId 为空");
  }
  if (allAssets.filter((item) => item.assetId === asset.assetId).length > 1) {
    issues.push("assetId 重复");
  }
  if (!asset.category.trim()) {
    issues.push("分类为空");
  }
  if (asset.defaultWidth < 24 || asset.defaultHeight < 24) {
    issues.push("默认尺寸过小");
  }
  if (asset.symbolicCandidates.length === 0) {
    issues.push("缺少象征候选词");
  }
  if (asset.semanticTags.length === 0) {
    issues.push("缺少语义标签");
  }
  if (!asset.modelRecipe?.kind) {
    issues.push("缺少模型模板");
  }
  return issues;
}

function formatDateTime(value: string): string {
  if (!value) {
    return "未知";
  }
  return new Date(value).toLocaleString();
}

function LlmAdminPanel({
  providers,
  onProvidersChange,
}: {
  providers: LlmProviderConfig[];
  onProvidersChange: (providers: LlmProviderConfig[]) => void;
}): JSX.Element {
  const [selectedId, setSelectedId] = useState(() => providers[0]?.id ?? "");
  const selected = providers.find((provider) => provider.id === selectedId) ?? providers[0] ?? null;

  useEffect(() => {
    if (providers.length > 0 && !providers.some((provider) => provider.id === selectedId)) {
      setSelectedId(providers[0].id);
    }
  }, [providers, selectedId]);

  const updateProvider = (patch: Partial<LlmProviderConfig>) => {
    if (!selected) {
      return;
    }
    const updatedAt = new Date().toISOString();
    onProvidersChange(
      providers.map((provider) => (provider.id === selected.id ? { ...provider, ...patch, updatedAt } : provider)),
    );
  };

  const addProvider = () => {
    const now = new Date().toISOString();
    const provider: LlmProviderConfig = {
      id: createId("provider"),
      name: "新 LLM 配置",
      provider: "openai-compatible",
      baseUrl: "",
      model: "",
      apiKey: "",
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    onProvidersChange([provider, ...providers]);
    setSelectedId(provider.id);
  };

  const removeProvider = () => {
    if (!selected) {
      return;
    }
    onProvidersChange(providers.filter((provider) => provider.id !== selected.id));
  };

  return (
    <section className="admin-grid two-col">
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Providers</p>
            <h3>LLM 厂商配置</h3>
          </div>
          <button type="button" className="small-icon-button" onClick={addProvider} aria-label="新增 LLM 配置">
            <Plus size={16} />
          </button>
        </div>
        <p className="admin-note">发送对话时会优先使用启用且已配置 API Key 的 provider 进行浏览器直连流式调用；若被 CORS、网络或密钥问题阻断，会自动回退本地模拟。生产环境建议改为后端代理保存密钥。</p>
        <div className="admin-list">
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={`admin-list-row ${selected?.id === provider.id ? "active" : ""}`}
              onClick={() => setSelectedId(provider.id)}
            >
              <span className="provider-dot" />
              <span>
                <strong>{provider.name}</strong>
                <em>
                  {getProviderLabel(provider.provider)} · {provider.model || "未设置模型"} · {maskKey(provider.apiKey)}
                </em>
              </span>
              <span className={`status-pill ${provider.enabled ? "enabled" : ""}`}>{provider.enabled ? "启用" : "停用"}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Edit Provider</p>
            <h3>{selected ? selected.name : "请选择配置"}</h3>
          </div>
          {selected ? (
            <button type="button" className="icon-button danger" onClick={removeProvider}>
              <Trash2 size={15} />
              删除
            </button>
          ) : null}
        </div>
        {selected ? (
          <div className="admin-form">
            <label>
              配置名称
              <input value={selected.name} onChange={(event) => updateProvider({ name: event.target.value })} />
            </label>
            <label>
              厂商
              <select
                value={selected.provider}
                onChange={(event) => {
                  const provider = event.target.value as LlmProviderKind;
                  const preset = getProviderPreset(provider);
                  updateProvider({ provider, baseUrl: preset.baseUrl, model: preset.model });
                }}
              >
                {PROVIDER_KINDS.map((provider) => (
                  <option key={provider} value={provider}>
                    {getProviderLabel(provider)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Base URL
              <input value={selected.baseUrl} onChange={(event) => updateProvider({ baseUrl: event.target.value })} />
            </label>
            <label>
              模型
              <input list="llm-model-hints" value={selected.model} onChange={(event) => updateProvider({ model: event.target.value })} />
              <datalist id="llm-model-hints">
                {getProviderPreset(selected.provider).modelHints.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </label>
            <label>
              API Key
              <input
                type="password"
                value={selected.apiKey}
                onChange={(event) =>
                  updateProvider({
                    apiKey: event.target.value,
                    enabled: event.target.value.trim() ? true : selected.enabled,
                  })
                }
              />
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={selected.enabled} onChange={(event) => updateProvider({ enabled: event.target.checked })} />
              启用该配置
            </label>
          </div>
        ) : (
          <p className="empty-state">暂无 LLM 配置。</p>
        )}
      </div>
    </section>
  );
}

function AgentAdminPanel({
  agents,
  providers,
  onAgentsChange,
}: {
  agents: PsychAgentProfile[];
  providers: LlmProviderConfig[];
  onAgentsChange: (agents: PsychAgentProfile[]) => void;
}): JSX.Element {
  const [selectedId, setSelectedId] = useState(() => agents[0]?.id ?? "");
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftText, setDraftText] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null;

  useEffect(() => {
    if (agents.length > 0 && !agents.some((agent) => agent.id === selectedId)) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  const updateAgent = (patch: Partial<PsychAgentProfile>) => {
    if (!selected) {
      return;
    }
    const updatedAt = new Date().toISOString();
    onAgentsChange(agents.map((agent) => (agent.id === selected.id ? { ...agent, ...patch, updatedAt } : agent)));
  };

  const addAgent = () => {
    const now = new Date().toISOString();
    const agent: PsychAgentProfile = {
      id: createId("agent"),
      name: "新的沙盘 Agent",
      school: "整合支持取向",
      description: "以温和、非评判的方式陪伴用户整理沙盘体验。",
      avatarStyle: "warm",
      openingMessage: "我会陪你慢慢看这个沙盘。你可以从最有感觉的地方开始。",
      systemPrompt: "你是一个心理沙盘对话伙伴，不做诊断，不替代专业咨询，只帮助用户表达和整理体验。",
      providerId: providers[0]?.id,
      temperature: 0.7,
      enabled: true,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    };
    onAgentsChange([agent, ...agents]);
    setSelectedId(agent.id);
  };

  const removeAgent = () => {
    if (!selected) {
      return;
    }
    onAgentsChange(agents.filter((agent) => agent.id !== selected.id));
  };

  const draftAgent = () => {
    const source = draftPrompt.trim() || "创建一个温暖、支持、适合沙盘结束后对话的心理陪伴 Agent";
    const profile = buildDraftProfile(source, providers[0]?.id);
    const response = `我会把这个 Agent 草拟为：${profile.name}。\n\n定位：${profile.school}\n\n描述：${profile.description}\n\n开场白：${profile.openingMessage}\n\n系统提示词已经生成并填入右侧表单，你可以继续手动调整。`;
    let cursor = 0;

    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    setDraftText("");
    setIsDrafting(true);
    timerRef.current = window.setInterval(() => {
      cursor += 4;
      setDraftText(response.slice(0, cursor));
      if (cursor >= response.length) {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
        }
        setIsDrafting(false);
        upsertDraftAgent(profile);
      }
    }, 28);
  };

  const upsertDraftAgent = (profile: PsychAgentProfile) => {
    if (selected) {
      const updatedAt = new Date().toISOString();
      onAgentsChange(agents.map((agent) => (agent.id === selected.id ? { ...agent, ...profile, id: selected.id, isBuiltIn: agent.isBuiltIn, createdAt: agent.createdAt, updatedAt } : agent)));
    } else {
      onAgentsChange([profile, ...agents]);
      setSelectedId(profile.id);
    }
  };

  return (
    <section className="admin-grid agent-admin-grid">
      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Agents</p>
            <h3>心理学家 Agent</h3>
          </div>
          <button type="button" className="small-icon-button" onClick={addAgent} aria-label="新增 Agent">
            <Plus size={16} />
          </button>
        </div>
        <div className="admin-list">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className={`admin-list-row ${selected?.id === agent.id ? "active" : ""}`}
              onClick={() => setSelectedId(agent.id)}
            >
              <AgentPortrait agent={agent} size="mini" />
              <span>
                <strong>{agent.name}</strong>
                <em>
                  {agent.school} · {agent.enabled ? "启用" : "停用"}
                </em>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">Configure</p>
            <h3>{selected ? selected.name : "请选择 Agent"}</h3>
          </div>
          {selected ? (
            <button type="button" className="icon-button danger" onClick={removeAgent}>
              <Trash2 size={15} />
              删除
            </button>
          ) : null}
        </div>
        {selected ? (
          <div className="admin-form">
            <label>
              名称
              <input value={selected.name} onChange={(event) => updateAgent({ name: event.target.value })} />
            </label>
            <label>
              理论取向
              <input value={selected.school} onChange={(event) => updateAgent({ school: event.target.value })} />
            </label>
            <label>
              描述
              <textarea value={selected.description} onChange={(event) => updateAgent({ description: event.target.value })} />
            </label>
            <div className="form-grid-2">
              <label>
                头像风格
                <select value={selected.avatarStyle} onChange={(event) => updateAgent({ avatarStyle: event.target.value as AgentAvatarStyle })}>
                  {AVATAR_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                关联 LLM
                <select value={selected.providerId ?? ""} onChange={(event) => updateAgent({ providerId: event.target.value || undefined })}>
                  <option value="">本地模拟</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              开场白
              <textarea value={selected.openingMessage} onChange={(event) => updateAgent({ openingMessage: event.target.value })} />
            </label>
            <label>
              系统提示词
              <textarea className="tall-textarea" value={selected.systemPrompt} onChange={(event) => updateAgent({ systemPrompt: event.target.value })} />
            </label>
            <label>
              温度 {selected.temperature.toFixed(2)}
              <input type="range" min={0} max={1} step={0.01} value={selected.temperature} onChange={(event) => updateAgent({ temperature: Number(event.target.value) })} />
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={selected.enabled} onChange={(event) => updateAgent({ enabled: event.target.checked })} />
              启用该 Agent
            </label>
          </div>
        ) : (
          <p className="empty-state">暂无 Agent。</p>
        )}
      </div>

      <div className="admin-card agent-draft-card">
        <div className="admin-card-header">
          <div>
            <p className="eyebrow">AI Draft</p>
            <h3>用对话草拟 Agent</h3>
          </div>
          <button type="button" className="icon-button" onClick={draftAgent} disabled={isDrafting}>
            <Sparkles size={15} />
            草拟
          </button>
        </div>
        <div className="admin-form">
          <label>
            描述你想创建的 Agent
            <textarea
              className="tall-textarea"
              value={draftPrompt}
              onChange={(event) => setDraftPrompt(event.target.value)}
              placeholder="例如：我想要一个荣格取向、温柔、善于提问梦和象征的 Agent..."
            />
          </label>
        </div>
        <div className="draft-output" aria-live="polite">
          {draftText || "输入一段自然语言描述后，点击“草拟”，系统会用本地模拟流式输出生成配置草稿。"}
        </div>
      </div>
    </section>
  );
}

function createRecipe(kind: ToyRecipeKind): ToyModelRecipe {
  if (kind === "person") {
    return { kind: "person", cloth: "#5fb4e4", skin: "#e0a778", bodyScale: 1 };
  }
  return { kind };
}

function createModelPatch(kind: ToyRecipeKind): Pick<
  ManagedAsset,
  "anchor" | "footprint" | "modelRecipe" | "thumbnailScale"
> {
  const spec = getToyAssetSpec(getSpecAssetId(kind), "normal");
  return {
    anchor: spec.anchor,
    footprint: spec.footprint,
    modelRecipe: kind === "person" ? createRecipe(kind) : spec.modelRecipe,
    thumbnailScale: spec.thumbnailScale,
  };
}

function getSpecAssetId(kind: ToyRecipeKind): string {
  const ids: Record<ToyRecipeKind, string> = {
    person: "person_adult",
    dog: "animal_dog",
    bird: "animal_bird",
    fish: "animal_fish",
    lion: "animal_lion",
    house: "env_house",
    bridge: "env_bridge",
    fence: "env_fence",
    tower: "env_tower",
    tree: "nature_tree",
    water: "nature_water",
    rock: "nature_rock",
    sun: "nature_sun",
    monster: "symbol_monster",
    robot: "symbol_robot",
    skull: "symbol_skull",
    light: "symbol_light",
    fallback: "fallback",
  };
  return ids[kind];
}

function splitLines(value: string): string[] {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function maskKey(apiKey: string): string {
  if (!apiKey) {
    return "未配置 key";
  }
  return apiKey.length <= 8 ? "••••••" : `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

function buildDraftProfile(prompt: string, providerId?: string): PsychAgentProfile {
  const now = new Date().toISOString();
  const isJung = /荣格|象征|原型|梦/.test(prompt);
  const isFreud = /弗洛伊德|精神分析|潜意识|防御|冲突/.test(prompt);
  const name = isJung ? "象征探索伙伴" : isFreud ? "动力倾听伙伴" : "温暖沙盘伙伴";
  const school = isJung ? "分析心理学取向" : isFreud ? "精神分析取向" : "整合支持取向";
  const avatarStyle: AgentAvatarStyle = isJung ? "dream" : isFreud ? "analyst" : "warm";

  return {
    id: createId("agent"),
    name,
    school,
    description: `根据“${prompt.slice(0, 52)}”草拟的沙盘对话 Agent，适合温和陪伴用户整理作品、情绪和意象线索。`,
    avatarStyle,
    openingMessage: "我会陪你慢慢看这个沙盘。你可以从最有感觉的地方开始，也可以只说一句现在的感受。",
    systemPrompt: `你是一个${school}的心理沙盘对话伙伴。用户希望：${prompt}。你不能诊断，不能替代专业咨询；你需要用温柔、开放、非评判的语言进行流式回应。`,
    providerId,
    temperature: isFreud ? 0.64 : 0.74,
    enabled: true,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
  };
}
