import {
  SANDBOX_CORE_SAFETY_POLICY_V1,
  SANDBOX_SAFETY_EVALUATION_V1,
  type CreateSafetyPolicyOptions,
  type SafetyAction,
  type SafetyDecision,
  type SafetyEvaluationInputV1,
  type SafetyEvaluationReportV1,
  type SafetyFindingV1,
  type SafetyPolicy,
  type SafetyRule,
  type SafetyRuleFindingDraft,
  type SafetySeverity,
} from "../contracts/safety.js";
import type { HypothesisPromptContextV1, SandboxHypothesisDraftV1 } from "../contracts/hypothesis.js";
import { compareStrings, deepFreeze } from "../internal/deterministic.js";
import { collectDraftTextSegments } from "./collectTextSegments.js";
import { CORE_SAFETY_RULES } from "./rules.js";

const SEVERITY_RANK: Record<SafetySeverity, number> = { info: 0, warning: 1, high: 2, critical: 3 };
const VALID_ACTIONS = new Set<SafetyAction>(["allow", "flag_for_review", "block"]);
const VALID_SEVERITIES = new Set<SafetySeverity>(["info", "warning", "high", "critical"]);
const VALID_CATEGORIES = new Set([
  "diagnostic_claim",
  "crisis_inference",
  "personality_certainty",
  "unsupported_process_claim",
  "leading_question",
  "unsupported_object_claim",
  "unsupported_spatial_claim",
  "unsupported_semantic_claim",
  "symbolic_overreach",
  "evidence_conflict",
  "custom",
]);

export function createSandboxSafetyPolicy(options: CreateSafetyPolicyOptions = {}): SafetyPolicy {
  const mode = options.ruleMode ?? "append";
  if (mode !== "append" && mode !== "replace") throw new Error(`Unsupported safety rule mode ${String(mode)}.`);
  const customRules = options.rules ?? [];
  if (!Array.isArray(customRules)) throw new Error("Safety policy rules must be an array.");
  const rules = mode === "replace" ? [...customRules] : [...CORE_SAFETY_RULES, ...customRules];
  if (rules.length === 0) throw new Error("A safety policy must contain at least one rule.");
  validateRules(rules);
  const version = options.version ?? (customRules.length > 0 ? `${SANDBOX_CORE_SAFETY_POLICY_V1}.extended` : SANDBOX_CORE_SAFETY_POLICY_V1);
  if (typeof version !== "string" || !version.trim()) throw new Error("Safety policy version must be non-empty.");

  return deepFreeze({
    version,
    rules: rules.map((rule) => ({ id: rule.id, version: rule.version })),
    evaluate(draft: SandboxHypothesisDraftV1, promptContext: HypothesisPromptContextV1): SafetyEvaluationReportV1 {
      const textSegments = collectDraftTextSegments(draft);
      const input: SafetyEvaluationInputV1 = { draft, promptContext, textSegments };
      const findings: SafetyFindingV1[] = [];

      for (const rule of rules) {
        try {
          const drafts = rule.evaluate(input);
          if (!Array.isArray(drafts)) throw new Error("rule result must be an array");
          const normalized = drafts.map((finding, index) => normalizeFinding(finding, rule, index));
          findings.push(...normalized);
        } catch (error) {
          findings.push(normalizeFinding({
            category: "custom",
            severity: "critical",
            action: "block",
            path: "/",
            matchedText: "",
            message: `Safety rule ${rule.id} failed closed: ${error instanceof Error ? error.message : "unknown rule error"}`,
          }, rule, 0));
        }
      }

      findings.sort(compareFindings);
      const decision = decisionFor(findings);
      return deepFreeze({
        schemaVersion: SANDBOX_SAFETY_EVALUATION_V1,
        policyVersion: version,
        decision,
        maxSeverity: findings.reduce<SafetySeverity>((maximum, finding) => SEVERITY_RANK[finding.severity] > SEVERITY_RANK[maximum] ? finding.severity : maximum, "info"),
        evaluatedTextSegments: textSegments.length,
        findings,
        summary: {
          allowCount: findings.filter((finding) => finding.action === "allow").length,
          reviewCount: findings.filter((finding) => finding.action === "flag_for_review").length,
          blockCount: findings.filter((finding) => finding.action === "block").length,
        },
      });
    },
  });
}

function validateRules(rules: readonly SafetyRule[]): void {
  const ids = new Set<string>();
  for (const rule of rules) {
    if (typeof rule.id !== "string" || typeof rule.version !== "string" || typeof rule.evaluate !== "function" || !rule.id.trim() || !rule.version.trim()) {
      throw new Error("Safety rule ID, version, and evaluate function are required.");
    }
    if (ids.has(rule.id)) throw new Error(`Duplicate safety rule ID ${rule.id}.`);
    ids.add(rule.id);
  }
}

function normalizeFinding(finding: SafetyRuleFindingDraft, rule: SafetyRule, index: number): SafetyFindingV1 {
  if (!finding || typeof finding !== "object") throw new Error("rule finding must be an object");
  if (!VALID_CATEGORIES.has(finding.category)) throw new Error("rule finding category is invalid");
  if (!VALID_SEVERITIES.has(finding.severity)) throw new Error("rule finding severity is invalid");
  if (!VALID_ACTIONS.has(finding.action)) throw new Error("rule finding action is invalid");
  if (typeof finding.path !== "string" || !finding.path.startsWith("/")) throw new Error("rule finding path must be a JSON Pointer");
  if (typeof finding.matchedText !== "string" || typeof finding.message !== "string" || !finding.message) throw new Error("rule finding text and message must be strings");
  if (!isStringArray(finding.evidenceIds ?? []) || !isStringArray(finding.hypothesisIds ?? [])) throw new Error("rule finding references must be string arrays");
  return {
    id: `safety:${encodeURIComponent(rule.id)}:${index}:${encodeURIComponent(finding.path)}`,
    ruleId: rule.id,
    ruleVersion: rule.version,
    category: finding.category,
    severity: finding.severity,
    action: finding.action,
    path: finding.path,
    matchedText: finding.matchedText.slice(0, 240),
    message: finding.message || `Safety rule ${rule.id} produced a finding.`,
    evidenceIds: uniqueSorted(finding.evidenceIds ?? []),
    hypothesisIds: uniqueSorted(finding.hypothesisIds ?? []),
  };
}

function decisionFor(findings: readonly SafetyFindingV1[]): SafetyDecision {
  if (findings.some((finding) => finding.action === "block")) return "block";
  if (findings.some((finding) => finding.action === "flag_for_review")) return "review";
  return "allow";
}

function compareFindings(left: SafetyFindingV1, right: SafetyFindingV1): number {
  return SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity]
    || compareStrings(left.ruleId, right.ruleId)
    || compareStrings(left.path, right.path)
    || compareStrings(left.id, right.id);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
