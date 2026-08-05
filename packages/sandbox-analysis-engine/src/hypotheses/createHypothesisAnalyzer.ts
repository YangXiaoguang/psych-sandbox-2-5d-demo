import {
  SANDBOX_ANALYSIS_RESULT_V1,
  type AnalysisEvidenceReference,
  type SandboxAnalysisResultV1,
} from "../contracts/analysis.js";
import type { EvidenceGraphV1 } from "../contracts/features.js";
import {
  SANDBOX_ANALYSIS_ENGINE_VERSION,
  SANDBOX_HYPOTHESIS_PROMPT_V1,
  type AnalysisKnowledgeBase,
  type CreateSandboxHypothesisAnalyzerOptions,
  type HypothesisAnalysisIssue,
  type HypothesisPromptContextV1,
  type SandboxHypothesisAnalyzer,
} from "../contracts/hypothesis.js";
import { createSandboxAnalysisEngine } from "../engine.js";
import { compareStrings, deepFreeze } from "../internal/deterministic.js";
import { hashCanonicalJson } from "../internal/sha256.js";
import { buildHypothesisPromptContext, DEFAULT_RELATION_FEATURE_LIMIT } from "./buildPromptContext.js";
import { SANDBOX_HYPOTHESIS_DRAFT_SCHEMA } from "./schema.js";
import { parseAndValidateHypothesisDraft } from "./validateDraft.js";

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_OUTPUT_TOKENS = 2400;
const MAX_KNOWLEDGE_GUIDANCE_ITEMS = 32;
const MAX_KNOWLEDGE_GUIDANCE_LENGTH = 500;
let defaultIdSequence = 0;

export function createSandboxHypothesisAnalyzer(
  options: CreateSandboxHypothesisAnalyzerOptions,
): SandboxHypothesisAnalyzer {
  const deterministicEngine = createSandboxAnalysisEngine({ migrations: options.migrations ? [...options.migrations] : undefined });
  const clock = options.clock ?? { now: () => new Date().toISOString() };
  const idGenerator = options.idGenerator ?? createDefaultIdGenerator();

  return {
    async analyze(input, analyzeOptions = {}) {
      const deterministic = deterministicEngine.analyzeDeterministically(input);
      if (!deterministic.ok) {
        return {
          ok: false,
          stage: "input",
          issues: deterministic.migration.issues.map<HypothesisAnalysisIssue>((current) => ({
            code: "INPUT_INVALID",
            path: current.path,
            message: current.message,
          })),
        };
      }

      let knowledgeBase: AnalysisKnowledgeBase | undefined;
      if (options.knowledgeBase) {
        try {
          knowledgeBase = await options.knowledgeBase.loadAnalysisGuidance();
          if (
            !knowledgeBase.version.trim()
            || knowledgeBase.guidance.length > MAX_KNOWLEDGE_GUIDANCE_ITEMS
            || knowledgeBase.guidance.some((item) => !item.trim() || item.length > MAX_KNOWLEDGE_GUIDANCE_LENGTH)
          ) {
            throw new Error(`Knowledge guidance requires a version, at most ${MAX_KNOWLEDGE_GUIDANCE_ITEMS} items, and at most ${MAX_KNOWLEDGE_GUIDANCE_LENGTH} characters per item.`);
          }
        } catch (error) {
          return {
            ok: false,
            stage: "knowledge-base",
            issues: [{
              code: "KNOWLEDGE_BASE_ERROR",
              path: "/knowledgeBase",
              message: errorMessage(error, "Failed to load analysis guidance."),
            }],
          };
        }
      }

      const promptContext = buildHypothesisPromptContext(
        deterministic.value,
        analyzeOptions.relationFeatureLimit ?? options.relationFeatureLimit ?? DEFAULT_RELATION_FEATURE_LIMIT,
      );
      const requestId = idGenerator.createId("llm-request");
      let llmResponse;
      try {
        llmResponse = await options.llm.generateStructured({
          requestId,
          promptVersion: SANDBOX_HYPOTHESIS_PROMPT_V1,
          messages: buildMessages(promptContext, knowledgeBase),
          responseSchema: SANDBOX_HYPOTHESIS_DRAFT_SCHEMA,
          temperature: options.temperature ?? DEFAULT_TEMPERATURE,
          maxOutputTokens: options.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          metadata: {
            sourceSnapshotId: promptContext.sourceSnapshotId,
            featureAlgorithmVersion: deterministic.value.featureBundle.algorithmVersion,
            relationFeaturesOmitted: promptContext.contextPolicy.omittedRelationFeatures,
          },
        });
      } catch (error) {
        return {
          ok: false,
          stage: "llm",
          promptContext,
          issues: [{
            code: "LLM_PORT_ERROR",
            path: "/llm",
            message: errorMessage(error, "LLM adapter failed."),
          }],
        };
      }

      if (!llmResponse.provider.trim() || !llmResponse.model.trim()) {
        return {
          ok: false,
          stage: "llm",
          promptContext,
          issues: [{
            code: "LLM_OUTPUT_SCHEMA_INVALID",
            path: "/llm",
            message: "LLM adapter response requires non-empty provider and model identifiers.",
          }],
        };
      }

      const validatedDraft = parseAndValidateHypothesisDraft(llmResponse.content, promptContext);
      if (!validatedDraft.ok) {
        return {
          ok: false,
          stage: "output",
          promptContext,
          issues: validatedDraft.issues,
        };
      }

      const featureBundle = deterministic.value.featureBundle;
      const warnings = [
        ...featureBundle.warnings,
        ...validatedDraft.value.warnings,
        ...(promptContext.contextPolicy.omittedRelationFeatures > 0
          ? [`Prompt context omitted ${promptContext.contextPolicy.omittedRelationFeatures} distant relation features by deterministic limit.`]
          : []),
      ];
      const value: SandboxAnalysisResultV1 = {
        schemaVersion: SANDBOX_ANALYSIS_RESULT_V1,
        analysisId: idGenerator.createId("analysis"),
        generatedAt: clock.now(),
        snapshotId: deterministic.snapshot.snapshotId,
        snapshotHash: hashCanonicalJson(deterministic.snapshot),
        snapshotSchemaVersion: deterministic.snapshot.schemaVersion,
        engineVersion: SANDBOX_ANALYSIS_ENGINE_VERSION,
        featureAlgorithmVersion: featureBundle.algorithmVersion,
        ...(knowledgeBase ? { knowledgeBaseVersion: knowledgeBase.version } : {}),
        promptVersion: SANDBOX_HYPOTHESIS_PROMPT_V1,
        model: { provider: llmResponse.provider, name: llmResponse.model },
        processEvidence: {
          fidelity: featureBundle.processEvidence.fidelity,
          availableSignals: [...featureBundle.processEvidence.availableSignals],
          unavailableSignals: [...featureBundle.processEvidence.unavailableSignals],
        },
        reconstructedScene: {
          objectCount: deterministic.value.scene.objects.length,
          objectIds: deterministic.value.scene.objects.map((object) => object.id),
          occupiedZones: [...deterministic.value.scene.aggregates.occupiedZones],
          selectedObjectId: deterministic.value.scene.selectedObjectId,
        },
        evidence: buildAnalysisEvidence(featureBundle.evidenceGraph),
        features: featureBundle.features.map((feature) => ({
          id: feature.id,
          kind: feature.kind,
          label: feature.label,
          value: feature.value,
          ...(feature.unit ? { unit: feature.unit } : {}),
          fidelity: feature.fidelity,
          evidenceIds: [...feature.evidenceIds],
        })),
        hypotheses: validatedDraft.value.hypotheses.map((hypothesis) => ({
          ...hypothesis,
          supportingEvidenceIds: [...hypothesis.supportingEvidenceIds],
          contradictingEvidenceIds: [...hypothesis.contradictingEvidenceIds],
          alternativeExplanations: [...hypothesis.alternativeExplanations],
          questionsToVerify: [...hypothesis.questionsToVerify],
          status: "candidate",
        })),
        interviewQuestions: validatedDraft.value.interviewQuestions.map((question) => ({
          ...question,
          evidenceIds: [...question.evidenceIds],
          hypothesisIds: [...question.hypothesisIds],
        })),
        warnings,
        guardrails: {
          notDiagnosis: true,
          requiresUserConfirmation: true,
          requiresExpertReviewForClinicalUse: true,
        },
      };
      return deepFreeze({ ok: true, value, promptContext, llm: llmResponse });
    },
  };
}

function buildMessages(context: HypothesisPromptContextV1, knowledgeBase?: AnalysisKnowledgeBase) {
  const guidance = knowledgeBase?.guidance.length
    ? `\nApproved guidance (${knowledgeBase.version}):\n${knowledgeBase.guidance.map((item) => `- ${item}`).join("\n")}`
    : "\nNo external psychological knowledge base was supplied. Stay descriptive and conservative.";
  return [
    {
      role: "system" as const,
      content: [
        "You generate evidence-constrained psychological interview hypotheses for a digital sandplay prototype.",
        "Return only JSON matching the supplied schema. Do not return markdown or prose outside JSON.",
        "Facts and features are immutable. Cite only IDs listed in allowedEvidenceIds.",
        "Use tentative language. Never diagnose, infer crisis from symbols, or state personality certainty.",
        "Do not claim moves, deletions, hesitation, dwell time, undo, or redo because those signals are unavailable.",
        "Every hypothesis needs an alternative explanation and an open, non-leading verification question.",
        "Medium or high confidence requires at least two distinct evidence IDs. Symbolic metadata alone stays low confidence.",
        guidance,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: `Generate candidate themes and interview questions from this Phase 2 context only:\n${JSON.stringify(context)}`,
    },
  ];
}

function buildAnalysisEvidence(graph: EvidenceGraphV1): AnalysisEvidenceReference[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const sourcePathsByNode = new Map<string, string[]>();
  graph.nodes.forEach((node) => {
    if (node.sourcePaths.length > 0) {
      sourcePathsByNode.set(node.id, [...node.sourcePaths]);
      return;
    }
    const sourcePaths = graph.edges
      .filter((edge) => edge.fromNodeId === node.id)
      .flatMap((edge) => nodeById.get(edge.toNodeId)?.sourcePaths ?? []);
    sourcePathsByNode.set(node.id, [...new Set(sourcePaths)].sort(compareStrings));
  });
  return graph.nodes.map((node) => {
    const sourcePaths = sourcePathsByNode.get(node.id) ?? [];
    return {
      id: node.id,
      layer: node.layer,
      kind: node.kind,
      description: node.label,
      sourcePaths: sourcePaths.length > 0 ? sourcePaths : ["/"],
      objectIds: [...node.objectIds],
    };
  });
}

function createDefaultIdGenerator() {
  return {
    createId(prefix: string) {
      const randomUuid = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
      defaultIdSequence += 1;
      return randomUuid
        ? `${prefix}-${randomUuid}`
        : `${prefix}-${Date.now().toString(36)}-${defaultIdSequence.toString(36)}`;
    },
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
