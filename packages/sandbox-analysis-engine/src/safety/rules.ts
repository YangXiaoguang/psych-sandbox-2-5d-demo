import type { EvidenceGraphNodeV1, JsonValue } from "../contracts/features.js";
import type {
  SafetyAction,
  SafetyEvaluationInputV1,
  SafetyRule,
  SafetyRuleFindingDraft,
  SafetySeverity,
  SafetyTextSegmentV1,
} from "../contracts/safety.js";
import { compareStrings } from "../internal/deterministic.js";

const QUESTION_ROLES = new Set<SafetyTextSegmentV1["role"]>(["verification_question", "interview_question"]);
const CLAIM_ROLES = new Set<SafetyTextSegmentV1["role"]>(["hypothesis_label", "hypothesis_explanation", "question_intent"]);

const DIAGNOSTIC_PATTERNS = [
  /诊断为|确诊|患有|符合.{0,10}(?:诊断|障碍)|抑郁症|焦虑症|人格障碍|精神分裂|自闭症|躁郁症|双相障碍/u,
  /diagnosed with|diagnosis of|has (?:depression|anxiety disorder)|personality disorder|schizophrenia|bipolar disorder/iu,
];
const CRISIS_PATTERNS = [
  /自杀倾向|暴力倾向|危险人物|高危个体|自伤风险|自我伤害|伤害他人|轻生风险|危机风险/u,
  /suicidal tendency|violent tendency|suicide risk|self-harm risk|risk of harming others|crisis risk/iu,
];
const CERTAINTY_PATTERNS = [
  /可以断定|毫无疑问|明确表明|证明(?:了)?|必然|一定说明|用户(?:一定|必然|显然|就是)/u,
  /proves? that|definitely means|without doubt|the user (?:must|clearly|definitely)/iu,
];
const PROCESS_PATTERNS = [
  /反复(?:移动|调整|摆放)|来回移动|频繁调整|犹豫|停留(?:了)?很久|最后(?:删除|移除)|撤销|重做/u,
  /repeatedly (?:move|moved|adjust|adjusted|place|placed)|hesitat(?:e|ed|ion)|dwell(?:ed)? for a long time|undo|redo/iu,
];
const LEADING_PATTERNS = [
  /是不是因为|是否说明|难道|你一定|你其实|这是否意味着你/u,
  /isn['’]t it because|doesn['’]t this mean|you must be|surely you/iu,
];
const SPATIAL_PATTERNS = [
  /中心|中央|边界|边缘|左(?:侧|边|上|下)?|右(?:侧|边|上|下)?|上方|下方|靠近|远离|相邻|距离|孤立|聚集|分散|区域|九宫格/u,
  /center|central|boundary|edge|left|right|above|below|near|far|adjacent|distance|isolat|cluster|zone|spatial/iu,
];
const SYMBOLIC_ASSERTION_PATTERNS = [
  /(?:代表|意味着|象征着|说明了|反映了|揭示了).{0,24}(?:心理|内心|关系|情绪|需求|冲突|创伤|人格)?/u,
  /(?:means|represents|symbolizes|reveals|demonstrates).{0,40}(?:psychological|inner|emotion|trauma|personality)?/iu,
];

export const diagnosticClaimRule: SafetyRule = languageRule({
  id: "core.diagnostic-claim",
  category: "diagnostic_claim",
  severity: "critical",
  action: "block",
  patterns: DIAGNOSTIC_PATTERNS,
  message: "Output makes or implies a clinical diagnosis that cannot be supported by a sandplay snapshot.",
  allowNegation: true,
});

export const crisisInferenceRule: SafetyRule = languageRule({
  id: "core.crisis-inference",
  category: "crisis_inference",
  severity: "critical",
  action: "block",
  patterns: CRISIS_PATTERNS,
  message: "Output infers crisis or harm risk from the sandplay snapshot.",
  allowNegation: true,
});

export const personalityCertaintyRule: SafetyRule = languageRule({
  id: "core.personality-certainty",
  category: "personality_certainty",
  severity: "high",
  action: "block",
  patterns: CERTAINTY_PATTERNS,
  message: "Output uses certainty language for an interpretive psychological claim.",
  allowNegation: true,
});

export const unsupportedProcessRule: SafetyRule = {
  id: "core.unsupported-process",
  version: "1.0.0",
  evaluate(input) {
    return findLanguageMatches(input.textSegments, PROCESS_PATTERNS).map(({ segment, matchedText }) => ({
      category: "unsupported_process_claim",
      severity: QUESTION_ROLES.has(segment.role) ? "warning" : "high",
      action: QUESTION_ROLES.has(segment.role) ? "flag_for_review" : "block",
      path: segment.path,
      matchedText,
      message: QUESTION_ROLES.has(segment.role)
        ? "The question asks about process signals that are absent from this snapshot and requires expert review."
        : "Snapshot-only analysis cannot state movement, deletion, hesitation, dwell, undo, or redo behavior as observed fact.",
      evidenceIds: segment.evidenceIds,
      hypothesisIds: segment.hypothesisIds,
    }));
  },
};

export const leadingQuestionRule: SafetyRule = languageRule({
  id: "core.leading-question",
  category: "leading_question",
  severity: "high",
  action: "block",
  patterns: LEADING_PATTERNS,
  message: "Question wording presupposes an answer or interpretation.",
  roles: QUESTION_ROLES,
});

export const unsupportedEvidenceRule: SafetyRule = {
  id: "core.unsupported-evidence",
  version: "1.0.0",
  evaluate(input) {
    const findings: SafetyRuleFindingDraft[] = [];
    const evidenceById = new Map(input.promptContext.evidence.map((node) => [node.id, node]));
    const semanticTermsByObject = buildSemanticTermsByObject(input.promptContext.evidence);

    for (const segment of input.textSegments) {
      if (!CLAIM_ROLES.has(segment.role)) continue;
      const citedNodes = segment.evidenceIds.map((id) => evidenceById.get(id)).filter(isEvidenceNode);
      const citedObjectIds = new Set(citedNodes.flatMap((node) => node.objectIds));

      for (const object of input.promptContext.scene.objects) {
        if (object.name.trim().length < 1 || !segment.text.includes(object.name) || citedObjectIds.has(object.id)) continue;
        findings.push(finding(segment, "unsupported_object_claim", "high", "block", object.name, `Claim names ${object.name} without citing evidence connected to that object.`));
      }

      const spatialMatch = firstMatch(segment.text, SPATIAL_PATTERNS);
      if (spatialMatch && !citedNodes.some(isSpatialEvidence)) {
        findings.push(finding(segment, "unsupported_spatial_claim", "high", "block", spatialMatch, "Spatial claim lacks spatial or position evidence."));
      }

      for (const [objectId, terms] of semanticTermsByObject) {
        const matchedTerm = terms.find((term) => term.length >= 2 && segment.text.includes(term));
        if (!matchedTerm) continue;
        const hasSemanticEvidence = citedNodes.some((node) => node.kind === "object.semantic-metadata" && node.objectIds.includes(objectId));
        if (!hasSemanticEvidence) {
          findings.push(finding(segment, "unsupported_semantic_claim", "high", "block", matchedTerm, `Semantic term ${matchedTerm} is not supported by cited semantic metadata.`));
        }
      }
    }

    return dedupeFindings(findings);
  },
};

export const symbolicOverreachRule: SafetyRule = {
  id: "core.symbolic-overreach",
  version: "1.0.0",
  evaluate(input) {
    const evidenceById = new Map(input.promptContext.evidence.map((node) => [node.id, node]));
    const findings: SafetyRuleFindingDraft[] = [];
    for (const segment of input.textSegments) {
      if (!CLAIM_ROLES.has(segment.role)) continue;
      const matchedText = firstMatch(segment.text, SYMBOLIC_ASSERTION_PATTERNS);
      if (!matchedText) continue;
      const citedNodes = segment.evidenceIds.map((id) => evidenceById.get(id)).filter(isEvidenceNode);
      if (citedNodes.length > 0 && citedNodes.every((node) => node.kind === "object.semantic-metadata")) {
        findings.push(finding(segment, "symbolic_overreach", "high", "block", matchedText, "Symbolic metadata is being converted into a confident psychological conclusion."));
      }
    }
    return findings;
  },
};

export const evidenceConflictRule: SafetyRule = {
  id: "core.evidence-conflict",
  version: "1.0.0",
  evaluate(input) {
    const findings: SafetyRuleFindingDraft[] = [];
    input.draft.hypotheses.forEach((hypothesis, index) => {
      const contradictionIds = new Set(hypothesis.contradictingEvidenceIds);
      const overlap = hypothesis.supportingEvidenceIds.filter((id) => contradictionIds.has(id));
      if (overlap.length > 0) {
        findings.push({
          category: "evidence_conflict",
          severity: "high",
          action: "block",
          path: `/hypotheses/${index}`,
          matchedText: overlap.join(", "),
          message: "The same evidence cannot simultaneously support and contradict a hypothesis.",
          evidenceIds: overlap,
          hypothesisIds: [hypothesis.id],
        });
      }
    });

    const hypothesesById = new Map(input.draft.hypotheses.map((hypothesis) => [hypothesis.id, hypothesis]));
    input.draft.interviewQuestions.forEach((question, index) => {
      const linkedEvidence = new Set(question.hypothesisIds.flatMap((id) => hypothesesById.get(id)?.supportingEvidenceIds ?? []));
      if (question.evidenceIds.every((id) => !linkedEvidence.has(id))) {
        findings.push({
          category: "evidence_conflict",
          severity: "warning",
          action: "flag_for_review",
          path: `/interviewQuestions/${index}/evidenceIds`,
          matchedText: question.evidenceIds.join(", "),
          message: "Question evidence is not shared with any linked hypothesis and requires expert review.",
          evidenceIds: question.evidenceIds,
          hypothesisIds: question.hypothesisIds,
        });
      }
    });
    return findings;
  },
};

export const CORE_SAFETY_RULES: readonly SafetyRule[] = Object.freeze([
  diagnosticClaimRule,
  crisisInferenceRule,
  personalityCertaintyRule,
  unsupportedProcessRule,
  leadingQuestionRule,
  unsupportedEvidenceRule,
  symbolicOverreachRule,
  evidenceConflictRule,
]);

function languageRule(config: {
  id: string;
  category: SafetyRuleFindingDraft["category"];
  severity: SafetySeverity;
  action: SafetyAction;
  patterns: readonly RegExp[];
  message: string;
  roles?: ReadonlySet<SafetyTextSegmentV1["role"]>;
  allowNegation?: boolean;
}): SafetyRule {
  return {
    id: config.id,
    version: "1.0.0",
    evaluate(input) {
      return findLanguageMatches(input.textSegments, config.patterns, config.roles, config.allowNegation).map(({ segment, matchedText }) => finding(
        segment,
        config.category,
        config.severity,
        config.action,
        matchedText,
        config.message,
      ));
    },
  };
}

function findLanguageMatches(
  segments: readonly SafetyTextSegmentV1[],
  patterns: readonly RegExp[],
  roles?: ReadonlySet<SafetyTextSegmentV1["role"]>,
  allowNegation = false,
): { segment: SafetyTextSegmentV1; matchedText: string }[] {
  const matches: { segment: SafetyTextSegmentV1; matchedText: string }[] = [];
  for (const segment of segments) {
    if (roles && !roles.has(segment.role)) continue;
    for (const pattern of patterns) {
      const match = pattern.exec(segment.text);
      if (!match || (allowNegation && isSafelyNegated(segment.text, match.index))) continue;
      matches.push({ segment, matchedText: match[0] });
      break;
    }
  }
  return matches;
}

function isSafelyNegated(text: string, matchIndex: number): boolean {
  const prefix = text.slice(Math.max(0, matchIndex - 28), matchIndex).trim().toLowerCase();
  return /(?:并非|不是|不构成|不能据此(?:判断|推断|评估)?|不能|无法|不可|不应|cannot|can't|is not|not a|does not)$/.test(prefix)
    && !/(?:不排除|不能排除|not rule out)$/.test(prefix);
}

function firstMatch(text: string, patterns: readonly RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return match[0];
  }
  return null;
}

function finding(
  segment: SafetyTextSegmentV1,
  category: SafetyRuleFindingDraft["category"],
  severity: SafetySeverity,
  action: SafetyAction,
  matchedText: string,
  message: string,
): SafetyRuleFindingDraft {
  return {
    category,
    severity,
    action,
    path: segment.path,
    matchedText,
    message,
    evidenceIds: segment.evidenceIds,
    hypothesisIds: segment.hypothesisIds,
  };
}

function isEvidenceNode(node: EvidenceGraphNodeV1 | undefined): node is EvidenceGraphNodeV1 {
  return Boolean(node);
}

function isSpatialEvidence(node: EvidenceGraphNodeV1): boolean {
  return node.kind.startsWith("spatial.") || node.kind === "object.position";
}

function buildSemanticTermsByObject(nodes: readonly EvidenceGraphNodeV1[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.kind !== "object.semantic-metadata") continue;
    const terms = [...new Set(extractStrings(node.value).map((term) => term.trim()).filter(Boolean))].sort(compareStrings);
    for (const objectId of node.objectIds) result.set(objectId, terms);
  }
  return result;
}

function extractStrings(value: JsonValue): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => extractStrings(item));
  if (value && typeof value === "object") return Object.values(value).flatMap((item) => extractStrings(item));
  return [];
}

function dedupeFindings(findings: readonly SafetyRuleFindingDraft[]): SafetyRuleFindingDraft[] {
  const seen = new Set<string>();
  return findings.filter((current) => {
    const key = `${current.category}|${current.path}|${current.matchedText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
