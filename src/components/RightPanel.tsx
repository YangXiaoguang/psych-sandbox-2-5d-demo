import { Bot, ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import type { LlmProviderConfig, SandboxAnalysis, SandboxEvent, SandboxObject } from "../types";
import { AiCompanionPanel } from "./AiCompanionPanel";
import { AnalysisPanel } from "./AnalysisPanel";
import { EventStream } from "./EventStream";
import { ObjectInspector } from "./ObjectInspector";
import { StructuredDataPanel } from "./StructuredDataPanel";

export type RightPanelTab = "scene" | "ai";

interface RightPanelProps {
  objects: SandboxObject[];
  selectedObject: SandboxObject | null;
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
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
        <>
          <ObjectInspector
            selectedObject={selectedObject}
            onPatchSelected={onPatchSelected}
            onDeleteSelected={onDeleteSelected}
          />
          <AnalysisPanel analysis={analysis} objects={objects} />
          <EventStream events={events} />
          <StructuredDataPanel objects={objects} analysis={analysis} selectedObject={selectedObject} />
        </>
      ) : (
        <AiCompanionPanel
          objects={objects}
          selectedObject={selectedObject}
          events={events}
          analysis={analysis}
          llmProviders={llmProviders}
        />
      )}
    </aside>
  );
}
