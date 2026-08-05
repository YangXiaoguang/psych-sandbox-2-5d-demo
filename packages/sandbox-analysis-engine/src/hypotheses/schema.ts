import { SANDBOX_HYPOTHESIS_DRAFT_V1 } from "../contracts/hypothesis.js";

export const SANDBOX_HYPOTHESIS_DRAFT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "hypotheses", "interviewQuestions", "warnings"],
  properties: {
    schemaVersion: { const: SANDBOX_HYPOTHESIS_DRAFT_V1 },
    hypotheses: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "confidence", "confidenceLevel", "supportingEvidenceIds", "contradictingEvidenceIds", "alternativeExplanations", "explanation", "questionsToVerify", "interpretiveLimit"],
        properties: {
          id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          confidenceLevel: { enum: ["low", "medium", "high"] },
          supportingEvidenceIds: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true },
          contradictingEvidenceIds: { type: "array", items: { type: "string" }, uniqueItems: true },
          alternativeExplanations: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
          explanation: { type: "string", minLength: 1 },
          questionsToVerify: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
          interpretiveLimit: { type: "string", minLength: 1 },
        },
      },
    },
    interviewQuestions: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "intent", "leading", "evidenceIds", "hypothesisIds"],
        properties: {
          id: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 },
          intent: { type: "string", minLength: 1 },
          leading: { const: false },
          evidenceIds: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true },
          hypothesisIds: { type: "array", items: { type: "string" }, minItems: 1, uniqueItems: true },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
} as const);
