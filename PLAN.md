# PLAN.md

Current execution plan for the 2.5D psychological sandplay collaboration system.

Updated: 2026-08-05

## Current Stable Checkpoints

| Area | Commit / Tag | Meaning |
|---|---|---|
| Stage v2 RC accepted | `7088bf6`, `checkpoint/stage-v2-rc-accepted-2026-08-03` | Full Stage v2 acceptance chain passed. |
| AI analysis layer boundary | `b95febd`, `checkpoint/ai-analysis-layer-boundary-2026-08-03` | Snapshot/Insight moved to `src/analysis`; LLM layer is prompt/provider focused. |
| AI analysis architecture hardening | `checkpoint/ai-analysis-architecture-v1-2026-08-05` | AI analysis technical architecture expanded with DTO guidance, service boundaries, policy gates, LLM proxy migration, audit, and QA rules. |
| Standalone analysis engine Phase 0 | `checkpoint/sandbox-analysis-engine-phase-0-2026-08-05` | Module charter, expert rubric, 24-case calibration plan, privacy boundaries, and machine-readable specification QA frozen. |
| Agentic engineering protocol | `d30e75e`, `checkpoint/agentic-engineering-protocol-2026-08-03` | Root `AGENTS.md` and `TEST_MATRIX.md` added. |
| Stage v2 polish sprint | `checkpoint/stage-v2-polish-v1-2026-08-04` | Sand tactile material, shoreline foam, calmer ocean, and night/rain readability refined. |
| Backend-ready contract | `checkpoint/backend-contract-v1-2026-08-04` | API service boundaries, task migration domain, mock reports, and backend handoff QA added. |
| Product experience compact HUD | `checkpoint/product-experience-hud-v1-2026-08-04` | Engine selector moved into the ambient stage HUD; UI QA now verifies an integrated, unobstructed game capsule. |
| Product experience backpack polish | `checkpoint/product-experience-backpack-v1-2026-08-04` | Asset backpack idle copy reduced, duplicate favorite control removed, category badges shortened, and card text/readability guards stay green. |
| Product experience insight drawer | `checkpoint/product-experience-insight-drawer-v1-2026-08-04` | Right scene/AI drawer copy and chrome reduced into compact game instrument panels while preserving insight, AI, and export workflows. |
| Product experience agent dialogue | `checkpoint/product-experience-agent-dialogue-v1-2026-08-04` | Agent dialogue page polished into a compact sandplay dialogue cockpit with smaller message typography, lighter rails, and readable night-mode controls. |

## Completed In This Stabilization Track

- Stage Engine v2 release candidate stabilized with repeatable QA.
- Stage v2 interaction QA covers add, drag, rotate, scale, duplicate, delete, camera pan, right-drag rotate, wheel zoom, PNG/JSON export, weather/light switching, and Classic fallback.
- UI shell QA covers navigation, fullscreen AI single-drawer behavior, asset backpack readability, insight drawer fit, major app surfaces, and night-mode text/form contrast.
- Toy asset QA covers 19 built-in Three.js toy sprites.
- Current Sandbox Snapshot and derived Insight contracts are separated from LLM provider code.
- AI analysis architecture is now documented as a backend-ready service design with Snapshot/Insight, Prompt, LLM Gateway, Context Policy, audit, fallback, and future Context Packet boundaries.
- Standalone analysis engine Phase 0 freezes Fact/Feature/Hypothesis separation, snapshot-only process limitations, expert acceptance rules, and the 24-case calibration portfolio without fabricating expert labels.
- Root agent protocol and regression matrix are available for future tasks.
- Phase 2 visual review completed with the 2026-08-04 baseline and human gap brief in `docs/stage-v2-visual-review-2026-08-04.md`.
- Phase 3 focused Stage v2 polish completed with sand/ocean/night-rain refinements in `docs/stage-v2-polish-2026-08-04.md`.
- Phase 4 backend-ready contract track completed with service boundary DTOs and handoff notes in `docs/backend-ready-contract-2026-08-04.md`.
- Phase 5A compact HUD completed: the Classic/Stage v2 engine switch is now part of the topbar game capsule instead of a separate floating row.
- Phase 5B asset backpack polish completed: the left drawer now behaves more like a game inventory, with lower copy density, single-path favorites access, stable toy cards, shortened category badges, and no idle drag instruction occupying layout space.
- Phase 5C insight drawer polish completed: the right scene/AI drawer now uses shorter instrument labels, compact metrics, lighter collapsible rows, and reduced AI companion chrome.
- Phase 5D agent dialogue polish completed: the dedicated Agent surface now uses a tighter dialogue cockpit, smaller Markdown/message typography, compact context chips, and reduced helper copy while preserving the centralized Snapshot/Insight prompt path.

## Next Recommended Sequence

### Phase 1: Specification Hardening

Status: complete.

Goal: make product goals, contracts, and rollback points machine-readable enough that future 3D/visual work does not drift.

Deliverables:

- `AGENTS.md`
- `TEST_MATRIX.md`
- `GAME_SPEC.md`
- `PLAN.md`

Minimum validation:

```bash
git diff --check
npm run build
```

### Phase 2: Stage v2 Visual Review Loop

Status: complete.

Goal: use existing visual baseline tooling to evaluate Stage v2 against the target reference language before more code polish.

Tasks:

- Run `npm run qa:visual-baseline && npm run qa:visual-report`.
- Review `artifacts/visual-regression/YYYY-MM-DD/visual-review.md`.
- Produce a short gap list focused on composition, sand, ocean, toy silhouettes, night readability, and UI chrome.
- Do not change runtime code until the gap list is explicit.

Minimum validation:

```bash
npm run qa:visual-baseline
npm run qa:visual-report
```

Evidence:

- `artifacts/visual-regression/2026-08-04/visual-review.md`
- `docs/stage-v2-visual-review-2026-08-04.md`

### Phase 3: Focused Stage v2 Polish Sprint

Status: complete.

Goal: improve only the highest-value visual gap without weakening interactions.

Likely candidates:

- Sand tactile material calibration.
- Ocean/shoreline motion detail.
- Hero toy silhouette/detail improvements.
- Compact in-scene operation chrome.

Minimum validation:

```bash
npm run build
npm run qa:stage-v2
npm run qa:ui-shell
```

For broad visual changes:

```bash
npm run qa:visual-baseline
npm run qa:visual-report
```

Evidence:

- `docs/stage-v2-polish-2026-08-04.md`
- `artifacts/visual-regression/2026-08-04/visual-review.md`

### Phase 4: Backend-Ready Contract Track

Status: complete.

Goal: prepare for real backend integration without breaking local demo mode.

Tasks:

- Keep API DTOs aligned with mock adapter reports.
- Define service boundaries for auth, users, workspaces, sandtray sessions, memory candidates, assets, LLM proxy, and tasks.
- Preserve localStorage mode as an offline prototype.

Minimum validation:

```bash
npm run build
npm run qa:api-contract
npm run qa:api-client
npm run qa:mock-api
npm run qa:repository
```

Evidence:

- `docs/backend-ready-contract-2026-08-04.md`
- `artifacts/api-contract/api-contract-report.json`
- `artifacts/repository-adapter-qa/repository-adapter-report.json`

### Phase 5: Product Experience Track

Status: in progress. Phase 5A compact HUD, Phase 5B asset backpack, Phase 5C insight drawer, and Phase 5D agent dialogue checkpoints complete.

Goal: continue reducing office-like chrome and make the system feel like a refined sandplay studio.

Tasks:

- Keep the stage as the hero.
- Move secondary operations into drawers or compact menus.
- Keep admin pages list-first and avoid piling every function into one screen.
- Keep text smaller, clearer, and less explanatory in primary work areas.

Minimum validation:

```bash
npm run build
npm run qa:ui-shell
npm run qa:stage-v2
```

Evidence:

- Engine switch embedded in `TopBar` ambient HUD.
- Asset backpack idle copy removed from the visible drawer, favorites live in the rail/card affordances, and toy card names/risk tags have fixed readable plates.
- Right scene/AI drawer reduced to compact instrument metrics, a small selected-object strip, collapsed detail rows, and shorter AI companion quick prompts.
- Agent dialogue page now reads as a compact sandplay companion cockpit instead of a generic chat admin view, with smaller bubbles, concise controls, and night-mode readability coverage.
- `npm run qa:ui-shell` passes 91/91 gates.
- `npm run qa:stage-v2` passes 29/29 gates.

## Deferred Work

- Full 300+ asset production pipeline.
- Production backend and encrypted secret storage.
- Real long-running background task workers.
- Multiplayer collaboration.
- Full image-based psychological analysis.
- Pixel-diff visual regression thresholds.

## Standalone Sandbox Analysis Engine Track

### Phase 0: Scope, Rubric, And Calibration Specification

Status: complete at the specification level. Expert data collection remains an external research activity and is explicitly reported as 0/24 labeled cases.

Deliverables:

- `docs/sandbox-analysis-engine-charter.md`
- `docs/sandbox-analysis-expert-rubric.md`
- `docs/sandbox-analysis-calibration-dataset.md`
- `specs/sandbox-analysis/*.json`
- `npm run qa:analysis-spec`

### Phase 1: Independent Package And Contracts

Status: next.

Goal: scaffold `@psych-sandbox/analysis-engine` as a framework-independent TypeScript package with versioned JSON schemas, migrations, validation, public ports, and zero React/Konva/Three.js dependencies.

Minimum validation:

```bash
npm run build
npm run qa:analysis-spec
npm run qa:snapshot-contract
```

### Later Phases

- Phase 2: deterministic reconstruction, feature extraction, and evidence graph.
- Phase 3: structured LLM hypotheses, explanations, and interview questions.
- Phase 4: safety gates, unsupported-claim detection, and diagnostic-language rejection.
- Phase 5: expert scoring, revision history, adjudication, and export.
- Phase 6: multi-model benchmark, frozen test set, and regression reporting.
- Phase 7: adapter-based integration into the current product and future backend service.

## Working Rule

No visual or product polish is accepted unless the relevant tests in `TEST_MATRIX.md` prove that editing, export, analysis, AI context, and fallback behavior still work.
