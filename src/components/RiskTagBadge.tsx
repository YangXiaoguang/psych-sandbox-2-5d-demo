import type { CSSProperties } from "react";
import { RISK_COLORS, RISK_LABELS } from "../data/assets";
import type { RiskTag } from "../types";

interface RiskTagBadgeProps {
  riskTag: RiskTag;
}

export function RiskTagBadge({ riskTag }: RiskTagBadgeProps): JSX.Element {
  return (
    <span
      className={`risk-badge risk-badge-${riskTag}`}
      style={{ "--risk-color": RISK_COLORS[riskTag] } as CSSProperties}
    >
      {RISK_LABELS[riskTag]}
    </span>
  );
}
