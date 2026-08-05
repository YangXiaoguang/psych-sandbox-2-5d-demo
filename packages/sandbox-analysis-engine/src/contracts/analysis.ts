import type { CurrentSandboxSnapshotVersion } from "./snapshot.js";
import type { JsonValue } from "./features.js";

export const SANDBOX_ANALYSIS_RESULT_V1 = "sandbox.analysis-result.v1" as const;

export type AnalysisEvidenceLayer = "fact" | "feature";
export type AnalysisConfidenceLevel = "low" | "medium" | "high";
export type AnalysisHypothesisStatus = "candidate" | "rejected_by_user" | "accepted_for_exploration";

export interface AnalysisEvidenceReference {
  id: string;
  layer: AnalysisEvidenceLayer;
  kind: string;
  description: string;
  sourcePaths: string[];
  objectIds: string[];
}

export interface AnalysisFeatureRecord {
  id: string;
  kind: string;
  label: string;
  value: JsonValue;
  unit?: string;
  fidelity: "deterministic" | "weak";
  evidenceIds: string[];
}

export interface PsychologicalThemeCandidate {
  id: string;
  label: string;
  status: AnalysisHypothesisStatus;
  confidence: number;
  confidenceLevel: AnalysisConfidenceLevel;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  alternativeExplanations: string[];
  explanation: string;
  questionsToVerify: string[];
  interpretiveLimit: string;
}

export interface AnalysisInterviewQuestion {
  id: string;
  text: string;
  intent: string;
  leading: false;
  evidenceIds: string[];
  hypothesisIds: string[];
}

export interface SandboxAnalysisResultV1 {
  schemaVersion: typeof SANDBOX_ANALYSIS_RESULT_V1;
  analysisId: string;
  generatedAt: string;
  snapshotId: string;
  snapshotHash: string;
  snapshotSchemaVersion: CurrentSandboxSnapshotVersion;
  engineVersion: string;
  featureAlgorithmVersion: string;
  knowledgeBaseVersion?: string;
  promptVersion?: string;
  model?: {
    provider: string;
    name: string;
  };
  processEvidence: {
    fidelity: "weak" | "full";
    availableSignals: string[];
    unavailableSignals: string[];
  };
  reconstructedScene: {
    objectCount: number;
    objectIds: string[];
    occupiedZones: string[];
    selectedObjectId: string | null;
  };
  evidence: AnalysisEvidenceReference[];
  features: AnalysisFeatureRecord[];
  hypotheses: PsychologicalThemeCandidate[];
  interviewQuestions: AnalysisInterviewQuestion[];
  warnings: string[];
  guardrails: {
    notDiagnosis: true;
    requiresUserConfirmation: true;
    requiresExpertReviewForClinicalUse: true;
  };
}
