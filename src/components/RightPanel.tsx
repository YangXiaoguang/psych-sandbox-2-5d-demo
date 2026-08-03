import type { CSSProperties } from "react";
import { useMemo } from "react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  LayoutDashboard,
  MessageCircleQuestion,
  MousePointer2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { createCurrentSandboxSnapshotPayload } from "../api/currentSandboxSnapshotApi";
import { RISK_COLORS, RISK_LABELS } from "../data/assets";
import { buildCurrentSandboxInsight } from "../analysis/currentSandboxInsight";
import type { CurrentSandboxInsight } from "../analysis/currentSandboxInsight";
import type { LlmProviderConfig, RiskTag, SandboxAnalysis, SandboxEnvironment, SandboxEvent, SandboxObject } from "../types";
import { AiCompanionPanel } from "./AiCompanionPanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { EventStream } from "./EventStream";
import { ObjectInspector } from "./ObjectInspector";
import { StructuredDataPanel } from "./StructuredDataPanel";

export type RightPanelTab = "scene" | "ai";

const riskOrder: RiskTag[] = ["normal", "conflict", "death", "fantasy"];

interface RightPanelProps {
  objects: SandboxObject[];
  selectedObject: SandboxObject | null;
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
  environment: SandboxEnvironment;
  llmProviders: LlmProviderConfig[];
  activeTab: RightPanelTab;
  collapsed: boolean;
  onTabChange: (tab: RightPanelTab) => void;
  onToggleCollapsed: () => void;
  onPatchSelected: (patch: Partial<SandboxObject>, label: string) => void;
  onDeleteSelected: () => void;
}

export function RightPanel({
  objects,
  selectedObject,
  events,
  analysis,
  environment,
  llmProviders,
  activeTab,
  collapsed,
  onTabChange,
  onToggleCollapsed,
  onPatchSelected,
  onDeleteSelected,
}: RightPanelProps): JSX.Element {
  if (collapsed) {
    return (
      <aside className="right-panel collapsed" aria-label="右侧面板快捷栏">
        <button
          className="rail-toggle"
          type="button"
          onClick={onToggleCollapsed}
          aria-label="展开右侧作品面板"
          title="展开面板"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className={activeTab === "scene" ? "rail-tab active" : "rail-tab"}
          onClick={() => {
            onTabChange("scene");
            onToggleCollapsed();
          }}
          aria-label="打开作品数据"
          title="作品数据"
        >
          <LayoutDashboard size={18} />
          <span className="rail-count">{objects.length}</span>
        </button>
        <button
          type="button"
          className={activeTab === "ai" ? "rail-tab active" : "rail-tab"}
          onClick={() => {
            onTabChange("ai");
            onToggleCollapsed();
          }}
          aria-label="打开 AI 伙伴"
          title="AI 伙伴"
        >
          <Bot size={18} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="right-panel" aria-label="作品与 AI 伙伴面板">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{activeTab === "ai" ? "COMPANION" : "LIVE MAP"}</p>
          <h1>{activeTab === "ai" ? "AI 伙伴" : "洞察仪表"}</h1>
        </div>
        <button
          className="small-icon-button"
          type="button"
          onClick={onToggleCollapsed}
          aria-label="隐藏右侧作品面板"
          title="隐藏面板"
        >
          <ChevronRight size={17} />
        </button>
      </div>
      <div className="panel-tabs" role="tablist" aria-label="右侧面板视图">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "scene"}
          className={activeTab === "scene" ? "active" : ""}
          onClick={() => onTabChange("scene")}
        >
          作品数据
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ai"}
          className={activeTab === "ai" ? "active" : ""}
          onClick={() => onTabChange("ai")}
        >
          AI 伙伴
        </button>
      </div>

      {activeTab === "scene" ? (
        <SceneInsightDrawer
          objects={objects}
          selectedObject={selectedObject}
          events={events}
          analysis={analysis}
          environment={environment}
          onPatchSelected={onPatchSelected}
          onDeleteSelected={onDeleteSelected}
        />
      ) : (
        <div className="right-panel-scroll">
          <AiCompanionPanel
            objects={objects}
            selectedObject={selectedObject}
            environment={environment}
            llmProviders={llmProviders}
          />
        </div>
      )}
    </aside>
  );
}

function SceneInsightDrawer({
  objects,
  selectedObject,
  events,
  analysis,
  environment,
  onPatchSelected,
  onDeleteSelected,
}: {
  objects: SandboxObject[];
  selectedObject: SandboxObject | null;
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
  environment: SandboxEnvironment;
  onPatchSelected: (patch: Partial<SandboxObject>, label: string) => void;
  onDeleteSelected: () => void;
}): JSX.Element {
  const insight = useMemo(() => {
    const payload = createCurrentSandboxSnapshotPayload({
      objects,
      environment,
      selectedObjectId: selectedObject?.id ?? null,
    });
    return buildCurrentSandboxInsight(payload.snapshot);
  }, [environment, objects, selectedObject?.id]);

  return (
    <div className="insight-drawer" aria-label="作品洞察抽屉">
      <section className="insight-overview" aria-label="作品概览">
        <div className="insight-overview-item primary">
          <strong>{analysis.totalObjects}</strong>
          <span>沙具</span>
        </div>
        <div className="insight-overview-item">
          <strong>{analysis.centerObjects.length}</strong>
          <span>中心</span>
        </div>
        <div className="insight-overview-item">
          <strong>{events.length}</strong>
          <span>事件</span>
        </div>
      </section>

      <SelectedObjectSnapshot selectedObject={selectedObject} onDeleteSelected={onDeleteSelected} />

      <details className="insight-section ai-observation-section">
        <summary>
          <span>
            <Sparkles size={15} />
            观察线索
          </span>
          <em>{insight.observations.length} 条</em>
        </summary>
        <div className="insight-section-body">
          <AiObservationPanel insight={insight} />
        </div>
      </details>

      <details className="insight-section">
        <summary>
          <span>
            <MousePointer2 size={15} />
            沙具编辑
          </span>
          <em>{selectedObject?.name ?? "未选择"}</em>
        </summary>
        <ObjectInspector
          selectedObject={selectedObject}
          onPatchSelected={onPatchSelected}
          onDeleteSelected={onDeleteSelected}
        />
      </details>

      <details className="insight-section">
        <summary>
          <span>
            <LayoutDashboard size={15} />
            空间地图
          </span>
          <em>中心 {analysis.centerObjects.length}</em>
        </summary>
        <div className="insight-section-body">
          <InsightHeatmapSummary analysis={analysis} />
          <details className="insight-advanced-section">
            <summary>
              <span>完整区域分析</span>
              <em>分类 / 层级</em>
            </summary>
            <AnalysisPanel analysis={analysis} objects={objects} />
          </details>
        </div>
      </details>

      <details className="insight-section">
        <summary>
          <span>
            <Clock3 size={15} />
            动作记录
          </span>
          <em>{events.length} 条</em>
        </summary>
        <div className="insight-section-body">
          <RecentEventPreview events={events} />
          <details className="insight-advanced-section">
            <summary>
              <span>查看完整事件流</span>
              <em>最多 14 条</em>
            </summary>
            <EventStream events={events} />
          </details>
        </div>
      </details>

      <details className="insight-section">
        <summary>
          <span>
            <Database size={15} />
            数据快照
          </span>
          <em>当前状态</em>
        </summary>
        <StructuredDataPanel objects={objects} environment={environment} selectedObject={selectedObject} />
      </details>
    </div>
  );
}

function AiObservationPanel({ insight }: { insight: CurrentSandboxInsight }): JSX.Element {
  const topObservations = insight.observations.slice(0, 2);
  const topThemes = insight.themeCandidates.slice(0, 5);
  const leadingQuestion = insight.suggestedQuestions[0];

  return (
    <section className="insight-ai-panel" aria-label="AI 观察材料">
      <p className="insight-ai-brief">{insight.brief}</p>

      {topObservations.length > 0 ? (
        <ul className="insight-ai-observations" aria-label="主要观察线索">
          {topObservations.map((observation) => (
            <li key={observation.id}>
              <strong>{observation.title}</strong>
              <span>{observation.detail}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state compact">当前还没有可稳定观察的空间线索。</p>
      )}

      {topThemes.length > 0 ? (
        <div className="insight-ai-themes" aria-label="主题候选">
          {topThemes.map((theme) => (
            <span key={theme.theme}>{theme.theme}</span>
          ))}
        </div>
      ) : null}

      {leadingQuestion ? (
        <div className="insight-ai-question">
          <MessageCircleQuestion size={15} />
          <span>{leadingQuestion.text}</span>
        </div>
      ) : null}
    </section>
  );
}

function SelectedObjectSnapshot({
  selectedObject,
  onDeleteSelected,
}: {
  selectedObject: SandboxObject | null;
  onDeleteSelected: () => void;
}): JSX.Element {
  if (!selectedObject) {
    return (
      <section className="insight-selected-snapshot empty" aria-label="当前选中沙具摘要">
        <MousePointer2 size={18} />
        <div>
          <span className="eyebrow">当前选中</span>
          <strong>未选择沙具</strong>
          <em>点选后显示快捷编辑。</em>
        </div>
      </section>
    );
  }

  return (
    <section className="insight-selected-snapshot" aria-label="当前选中沙具摘要">
      <div>
        <span className="eyebrow">当前选中</span>
        <strong>{selectedObject.name}</strong>
        <em>
          X {Math.round(selectedObject.x)} / Y {Math.round(selectedObject.y)} · {RISK_LABELS[selectedObject.riskTag]}
        </em>
      </div>
      <button type="button" onClick={onDeleteSelected} aria-label={`删除 ${selectedObject.name}`}>
        <Trash2 size={16} />
      </button>
    </section>
  );
}

function InsightHeatmapSummary({ analysis }: { analysis: SandboxAnalysis }): JSX.Element {
  const maxGridCount = Math.max(1, ...analysis.grid.map((cell) => cell.count));

  return (
    <section className="insight-snapshot-panel" aria-label="九宫格与风险摘要">
      <div className="insight-snapshot-header">
        <div>
          <span className="eyebrow">实时地图</span>
          <h2>空间热力与风险</h2>
        </div>
        <span>{analysis.totalObjects} 个对象</span>
      </div>

      <div className="insight-snapshot-grid">
        <div className="insight-heatmap" aria-label="九宫格热力图">
          {analysis.grid.map((cell) => {
            const heat = cell.count / maxGridCount;

            return (
              <div
                key={cell.id}
                className={cell.id === "middle-center" ? "insight-heat-cell center" : "insight-heat-cell"}
                style={{ "--heat": `${Math.round(heat * 84)}%` } as CSSProperties}
              >
                <span>{cell.label.replace("中", "")}</span>
                <strong>{cell.count}</strong>
              </div>
            );
          })}
        </div>

        <div className="insight-risk-mini" aria-label="风险标签分布">
          {riskOrder.map((riskTag) => (
            <div key={riskTag}>
              <span>{RISK_LABELS[riskTag]}</span>
              <i>
                <b
                  style={{
                    width: `${analysis.totalObjects ? (analysis.riskCounts[riskTag] / analysis.totalObjects) * 100 : 0}%`,
                    background: RISK_COLORS[riskTag],
                  }}
                />
              </i>
              <strong>{analysis.riskCounts[riskTag]}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecentEventPreview({ events }: { events: SandboxEvent[] }): JSX.Element {
  const recentEvents = [...events].reverse().slice(0, 3);

  return (
    <section className="insight-event-preview" aria-label="最近事件摘要">
      <div className="insight-snapshot-header compact">
        <div>
          <span className="eyebrow">事件时间线</span>
          <h2>最近事件</h2>
        </div>
        <span>{events.length} 条</span>
      </div>
      {recentEvents.length > 0 ? (
        <ol>
          {recentEvents.map((event) => (
            <li key={event.id}>
              <time>{formatEventPreviewTime(event.timestamp)}</time>
              <strong>{event.label}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p>开始摆放沙具后，这里会记录最近动作。</p>
      )}
    </section>
  );
}

function formatEventPreviewTime(timestamp: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}
