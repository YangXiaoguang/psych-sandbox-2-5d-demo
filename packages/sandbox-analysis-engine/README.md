# @psych-sandbox/analysis-engine

Framework-independent TypeScript contracts and ingestion runtime for digital psychological sandplay analysis.

Phase 1 includes:

- `sandbox.current-snapshot.v1` TypeScript contracts;
- JSON Schema for Snapshot, analysis result, and expert review;
- deterministic runtime validation with JSON Pointer issue paths;
- semantic consistency checks for IDs, references, counts, and depth order;
- explicit version migration registry;
- a small public engine facade.

Phase 2 adds deterministic scene reconstruction, pairwise spatial relations, a versioned feature bundle, and an evidence graph. It still does not generate psychological hypotheses or call an LLM.

Phase 3 adds a provider-neutral, evidence-constrained LLM adapter boundary. The model may draft candidate themes and non-leading interview questions, but it cannot create or rewrite facts and features. Runtime validation rejects unknown evidence, unsupported confidence, leading questions, diagnostic certainty, symbol-only crisis claims, and process claims that are not present in the Snapshot.

Phase 4 adds a versioned, composable safety policy. Core rules separate allow, expert-review, and block decisions; detect diagnostic/crisis certainty, unsupported process and evidence claims, leading questions, symbolic overreach, and evidence conflicts; and emit a schema-valid audit report. Custom rules can be appended or used as a complete replacement policy, with fail-closed behavior on rule errors.

Phase 5 adds a framework-independent expert-supervision workflow. Reviews are bound to a canonical analysis hash; weighted status is computed by the trusted core; experts may revise only hypotheses and interview questions; every revision is revalidated against the Phase 3 evidence contract and Phase 4 safety policy. Gold eligibility requires two accepted, independent reviews of the exact final analysis plus independent adjudication.

Phase 6 adds governed evaluation datasets and reproducible model benchmarks. Admission requires an exact Snapshot hash, a gold-eligible adjudication bundle, de-identification attestations and purpose restrictions. Source groups cannot cross train/dev/test partitions, frozen test cases remain blind to model subjects, revocation by Snapshot hash overrides dataset freeze, and automated metrics explicitly do not score psychological truth.

Phase 7 adds infrastructure-neutral evaluation job orchestration and tamper-evident audit delivery. Jobs use idempotency keys, optimistic revisions, expiring worker leases, ordered progress events, cooperative cancellation and bounded retries. Audit bundles bind the frozen dataset manifest, job, event stream, run and report with canonical hashes while excluding raw cases, Gold analyses, API keys and direct identity.

## Usage

```ts
import { createSandboxAnalysisEngine } from "@psych-sandbox/analysis-engine";

const engine = createSandboxAnalysisEngine();
const parsed = engine.parseSnapshot(jsonValue);

if (!parsed.ok) {
  console.log(parsed.issues);
} else {
  console.log(parsed.value.snapshotId);
}
```

## Deterministic reconstruction and features

```ts
const result = engine.analyzeDeterministically(jsonValue);

if (result.ok) {
  console.log(result.value.scene.objects);
  console.log(result.value.featureBundle.features);
  console.log(result.value.featureBundle.evidenceGraph);
}
```

The same validated Snapshot and algorithm version produce canonically ordered, precision-normalized, deeply frozen output. Ordering uses a locale-independent binary lexical comparator. Process features use only `createdOrder` and are explicitly marked as `weak`.

## Registering an explicit migration

```ts
engine.registerMigration({
  fromVersion: "sandbox.current-snapshot.legacy-approved",
  toVersion: "sandbox.current-snapshot.v1",
  description: "Approved legacy mapping",
  migrate(input) {
    return mapApprovedLegacySnapshot(input);
  },
});
```

Unversioned data is rejected. The engine does not infer or guess a historical schema.

## Evidence-constrained hypothesis generation

```ts
import { createSandboxHypothesisAnalyzer } from "@psych-sandbox/analysis-engine";

const analyzer = createSandboxHypothesisAnalyzer({
  llm: {
    async generateStructured(request) {
      // Call a provider adapter outside this package and return parsed JSON or JSON text.
      return {
        content: await myAdapter.generate(request),
        provider: "my-provider",
        model: "my-model",
      };
    },
  },
});

const result = await analyzer.analyze(snapshot);
if (!result.ok) {
  console.log(result.stage, result.issues);
} else {
  console.log(result.value.hypotheses);
  console.log(result.value.interviewQuestions);
}
```

The current analyzer evaluates the validated draft with the core safety policy before assembling a successful result. A blocked draft returns `stage: "safety"`. Review findings remain available in `result.safetyEvaluation` and `result.value.safetyEvaluation`.

## Extending the safety policy

```ts
import { createSandboxHypothesisAnalyzer, createSandboxSafetyPolicy } from "@psych-sandbox/analysis-engine";

const safetyPolicy = createSandboxSafetyPolicy({
  version: "organization.safety.v1",
  ruleMode: "append",
  rules: [organizationSafetyRule],
});

const analyzer = createSandboxHypothesisAnalyzer({ llm, safetyPolicy });
```

Every finding records its rule/version, severity, action, JSON Pointer path, matched text, evidence IDs, and hypothesis IDs. Safety policy exceptions fail closed instead of silently bypassing the gate.

## Expert review and gold-data gate

```ts
import { createExpertReviewWorkflow } from "@psych-sandbox/analysis-engine";

const workflow = createExpertReviewWorkflow({ repository: myReviewRepository });
const source = { analysis: analysisResult, promptContext };

const review = await workflow.submitExpertReview(source, {
  reviewerPseudonym: "expert-a",
  scores: allRubricScores,
  automaticRejectConditions: [],
  recommendation: "needs_revision",
  summary: "Evidence is sound; one question needs more open wording.",
  revisions: [{
    path: "/interviewQuestions/0/text",
    operation: "replace",
    proposedValue: "Which part would you like to introduce first?",
    reason: "Use a more open question.",
  }],
});

if (review.ok) {
  const revision = await workflow.applyExpertRevision(source, review.value.reviewId);
}
```

`InMemoryReviewRepository` is provided for tests and prototypes. Production systems should implement `ReviewRepositoryPort` with transactional persistence and authorization outside this package. Reviewer and adjudicator identifiers must be pseudonyms; email addresses and personal identity are intentionally rejected.

Experts cannot revise reconstructed scene data, evidence, deterministic features, guardrails, or safety reports. A revised version is immutable, hash-linked to its parent, and must be independently reviewed again before it can enter a gold dataset.

## Governed evaluation datasets and blind benchmarks

```ts
import {
  createBenchmarkRunner,
  createEvaluationDatasetService,
} from "@psych-sandbox/analysis-engine";

const datasets = createEvaluationDatasetService({ repository: myDatasetRepository });
const admitted = await datasets.admitCase(candidate);

if (admitted.ok) {
  const frozen = await datasets.buildDataset({
    datasetId: "sandbox-calibration",
    datasetVersion: "1.0.0",
    targetPlan,
    freeze: true,
  });

  if (frozen.ok) {
    const run = await createBenchmarkRunner().run(frozen.value, modelSubject, "seed-2026-08");
  }
}
```

`EvaluationSubjectPort` receives only the case ID, partition, run seed and Snapshot. Gold analyses, expert reviews and adjudication are never included in model input. The objective report covers Snapshot binding, exact scene/features, evidence traceability, question structure and safety. Candidate psychological quality remains a separate blind-expert judgment.

Only the Phase 2 scene, feature bundle, and evidence graph enter the prompt context. The raw Snapshot, user identity, personal memory, events, images, and API keys remain excluded. Provider SDKs, networking, retries, rate limits, and secret handling belong in external adapters.

## Resilient evaluation jobs and audit bundles

```ts
import {
  InMemoryEvaluationRuntimeRepository,
  createEvaluationJobOrchestrator,
  createExperimentAuditService,
} from "@psych-sandbox/analysis-engine";

const repository = new InMemoryEvaluationRuntimeRepository();
const jobs = createEvaluationJobOrchestrator({ repository, workerId: "worker-a" });
const submitted = await jobs.submit(request);

if (submitted.ok) {
  const completed = await jobs.execute(submitted.value.jobId, frozenDataset, modelSubject);
  if (completed.ok && completed.value.status === "succeeded") {
    const audit = await createExperimentAuditService({ repository })
      .exportBundle(completed.value.jobId, frozenDataset);
  }
}
```

`InMemoryEvaluationRuntimeRepository` is not a production queue or database. Production adapters must make job revision updates and event appends transactional. Runtime retries repeat a failed benchmark attempt; provider-level backoff, request timeouts and secrets remain responsibilities of the injected model adapter.

## Published schemas

- `schemas/current-sandbox-snapshot.v1.schema.json`
- `schemas/sandbox-analysis-result.v1.schema.json`
- `schemas/expert-review.v1.schema.json`
- `schemas/revised-analysis.v1.schema.json`
- `schemas/review-adjudication.v1.schema.json`
- `schemas/review-case-bundle.v1.schema.json`
- `schemas/evaluation-case.v1.schema.json`
- `schemas/evaluation-dataset-manifest.v1.schema.json`
- `schemas/data-revocation.v1.schema.json`
- `schemas/model-evaluation-run.v1.schema.json`
- `schemas/benchmark-report.v1.schema.json`
- `schemas/evaluation-job.v1.schema.json`
- `schemas/evaluation-job-event.v1.schema.json`
- `schemas/experiment-audit-bundle.v1.schema.json`
- `schemas/reconstructed-scene.v1.schema.json`
- `schemas/evidence-graph.v1.schema.json`
- `schemas/feature-bundle.v1.schema.json`
- `schemas/sandbox-hypothesis-draft.v1.schema.json`
- `schemas/safety-evaluation.v1.schema.json`

The package has no dependency on React, Konva, Three.js, browser DOM APIs, or any LLM provider SDK.
