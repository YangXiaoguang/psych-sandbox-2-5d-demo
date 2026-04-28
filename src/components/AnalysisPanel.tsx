import { RISK_COLORS, RISK_LABELS } from "../data/assets";
import type { RiskTag, SandboxAnalysis, SandboxObject } from "../types";

interface AnalysisPanelProps {
  analysis: SandboxAnalysis;
  objects: SandboxObject[];
}

const riskOrder: RiskTag[] = ["normal", "conflict", "death", "fantasy"];

export function AnalysisPanel({ analysis, objects }: AnalysisPanelProps): JSX.Element {
  const objectNames = new Map(objects.map((object) => [object.id, object.name]));

  return (
    <section className="side-section analysis-panel" aria-label="区域分析">
      <h2>区域分析</h2>

      <div className="metric-row">
        <Metric label="中心区域" value={analysis.centerObjects.length} />
        <Metric label="边界区域" value={analysis.boundaryObjects.length} />
        <Metric label="对象总数" value={analysis.totalObjects} />
      </div>

      <div className="risk-bars" aria-label="风险标签统计">
        {riskOrder.map((riskTag) => (
          <div key={riskTag} className="risk-bar">
            <span>{RISK_LABELS[riskTag]}</span>
            <div className="risk-track">
              <div
                className="risk-fill"
                style={{
                  width: `${analysis.totalObjects ? (analysis.riskCounts[riskTag] / analysis.totalObjects) * 100 : 0}%`,
                  background: RISK_COLORS[riskTag],
                }}
              />
            </div>
            <strong>{analysis.riskCounts[riskTag]}</strong>
          </div>
        ))}
      </div>

      <div className="mini-grid" aria-label="九宫格对象数量">
        {analysis.grid.map((cell) => (
          <div key={cell.id} className={cell.id === "middle-center" ? "mini-grid-cell center" : "mini-grid-cell"}>
            <span>{cell.label}</span>
            <strong>{cell.count}</strong>
          </div>
        ))}
      </div>

      <div className="depth-list">
        <h3>空间层级</h3>
        <ol>
          {analysis.depthOrder.map((objectId) => (
            <li key={objectId}>{objectNames.get(objectId) ?? objectId.slice(0, 8)}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
