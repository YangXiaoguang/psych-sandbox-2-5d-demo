import type { SandboxAnalysis, SandboxEvent, SandboxObject } from "../types";
import { AnalysisPanel } from "./AnalysisPanel";
import { EventStream } from "./EventStream";
import { ObjectInspector } from "./ObjectInspector";
import { StructuredDataPanel } from "./StructuredDataPanel";

interface RightPanelProps {
  objects: SandboxObject[];
  selectedObject: SandboxObject | null;
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
  onPatchSelected: (patch: Partial<SandboxObject>, label: string) => void;
  onDeleteSelected: () => void;
}

export function RightPanel({
  objects,
  selectedObject,
  events,
  analysis,
  onPatchSelected,
  onDeleteSelected,
}: RightPanelProps): JSX.Element {
  return (
    <aside className="right-panel" aria-label="作品数据面板">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Scene Data</p>
          <h1>作品面板</h1>
        </div>
      </div>
      <ObjectInspector
        selectedObject={selectedObject}
        onPatchSelected={onPatchSelected}
        onDeleteSelected={onDeleteSelected}
      />
      <AnalysisPanel analysis={analysis} objects={objects} />
      <EventStream events={events} />
      <StructuredDataPanel objects={objects} analysis={analysis} selectedObject={selectedObject} />
    </aside>
  );
}
