import { useMemo } from "react";
import type { SandboxAnalysis, SandboxObject } from "../types";

interface StructuredDataPanelProps {
  objects: SandboxObject[];
  analysis: SandboxAnalysis;
  selectedObject: SandboxObject | null;
}

export function StructuredDataPanel({
  objects,
  analysis,
  selectedObject,
}: StructuredDataPanelProps): JSX.Element {
  const dataPreview = useMemo(
    () => ({
      selectedObject: selectedObject
        ? {
            id: selectedObject.id,
            assetId: selectedObject.assetId,
            name: selectedObject.name,
            x: Math.round(selectedObject.x),
            y: Math.round(selectedObject.y),
            rotation: selectedObject.rotation,
            scale: selectedObject.scale,
          }
        : null,
      objects: objects.map((object) => ({
        id: object.id,
        assetId: object.assetId,
        name: object.name,
        x: Math.round(object.x),
        y: Math.round(object.y),
        rotation: object.rotation,
        scale: object.scale,
        riskTag: object.riskTag,
      })),
      analysis: {
        riskCounts: analysis.riskCounts,
        centerObjects: analysis.centerObjects.length,
        boundaryObjects: analysis.boundaryObjects.length,
        grid: analysis.grid.map((cell) => ({
          id: cell.id,
          count: cell.count,
        })),
      },
    }),
    [analysis, objects, selectedObject],
  );

  return (
    <section className="side-section data-panel" aria-label="结构化数据">
      <h2>结构化数据</h2>
      <pre>{JSON.stringify(dataPreview, null, 2)}</pre>
    </section>
  );
}
