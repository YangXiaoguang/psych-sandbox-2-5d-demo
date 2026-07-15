import type { CSSProperties } from "react";
import { Bot, ChevronLeft, ChevronRight, Clock3, Database, LayoutDashboard, MousePointer2 } from "lucide-react";
import { RISK_COLORS, RISK_LABELS } from "../data/assets";
import type { LlmProviderConfig, RiskTag, SandboxAnalysis, SandboxEvent, SandboxObject } from "../types";
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
  llmProviders: LlmProviderConfig[];
  personalMemoryContext: string[];
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
  llmProviders,
  personalMemoryContext,
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
          <p className="eyebrow">{activeTab === "ai" ? "AI Companion" : "Scene Data"}</p>
          <h1>{activeTab === "ai" ? "AI 伙伴" : "作品面板"}</h1>
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
          onPatchSelected={onPatchSelected}
          onDeleteSelected={onDeleteSelected}
        />
      ) : (
        <div className="right-panel-scroll">
          <AiCompanionPanel
            objects={objects}
            selectedObject={selectedObject}
            events={events}
            analysis={analysis}
            llmProviders={llmProviders}
            personalMemoryContext={personalMemoryContext}
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
  onPatchSelected,
  onDeleteSelected,
}: {
  objects: SandboxObject[];
  selectedObject: SandboxObject | null;
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
  onPatchSelected: (patch: Partial<SandboxObject>, label: string) => void;
  onDeleteSelected: () => void;
}): JSX.Element {
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

      <InsightHeatmapSummary analysis={analysis} />
      <RecentEventPreview events={events} />

      <details className="insight-section" open={Boolean(selectedObject)}>
        <summary>
          <span>
            <MousePointer2 size={15} />
            当前选中
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
            作品洞察
          </span>
          <em>九宫格 / 风险</em>
        </summary>
        <AnalysisPanel analysis={analysis} objects={objects} />
      </details>

      <details className="insight-section">
        <summary>
          <span>
            <Clock3 size={15} />
            事件时间线
          </span>
          <em>{events.length} 条</em>
        </summary>
        <EventStream events={events} />
      </details>

      <details className="insight-section">
        <summary>
          <span>
            <Database size={15} />
            结构化数据
          </span>
          <em>JSON 预览</em>
        </summary>
        <StructuredDataPanel objects={objects} analysis={analysis} selectedObject={selectedObject} />
      </details>
    </div>
  );
}

function InsightHeatmapSummary({ analysis }: { analysis: SandboxAnalysis }): JSX.Element {
  const maxGridCount = Math.max(1, ...analysis.grid.map((cell) => cell.count));

  return (
    <section className="insight-snapshot-panel" aria-label="九宫格与风险摘要">
      <div className="insight-snapshot-header">
        <div>
          <span className="eyebrow">Live Map</span>
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
          <span className="eyebrow">Timeline</span>
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
