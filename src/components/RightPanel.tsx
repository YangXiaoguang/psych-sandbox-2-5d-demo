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
  onTabChange: (tab: RightPanelTab) => void;
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
  onTabChange,
  onPatchSelected,
  onDeleteSelected,
}: RightPanelProps): JSX.Element {
  return (
    <aside className="right-panel" aria-label="作品与 AI 伙伴面板">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{activeTab === "ai" ? "AI Companion" : "Scene Data"}</p>
          <h1>{activeTab === "ai" ? "AI 伙伴" : "作品面板"}</h1>
        </div>
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
