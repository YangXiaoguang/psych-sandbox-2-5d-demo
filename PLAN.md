# PLAN.md

Current execution plan for the 2.5D psychological sandplay collaboration system.

Updated: 2026-08-04

## Current Stable Checkpoints

| Area | Commit / Tag | Meaning |
|---|---|---|
| Stage v2 RC accepted | `7088bf6`, `checkpoint/stage-v2-rc-accepted-2026-08-03` | Full Stage v2 acceptance chain passed. |
| AI analysis layer boundary | `b95febd`, `checkpoint/ai-analysis-layer-boundary-2026-08-03` | Snapshot/Insight moved to `src/analysis`; LLM layer is prompt/provider focused. |
| Agentic engineering protocol | `d30e75e`, `checkpoint/agentic-engineering-protocol-2026-08-03` | Root `AGENTS.md` and `TEST_MATRIX.md` added. |
| Stage v2 polish sprint | `checkpoint/stage-v2-polish-v1-2026-08-04` | Sand tactile material, shoreline foam, calmer ocean, and night/rain readability refined. |

## Completed In This Stabilization Track

- Stage Engine v2 release candidate stabilized with repeatable QA.
- Stage v2 interaction QA covers add, drag, rotate, scale, duplicate, delete, camera pan, right-drag rotate, wheel zoom, PNG/JSON export, weather/light switching, and Classic fallback.
- UI shell QA covers navigation, fullscreen AI single-drawer behavior, asset backpack readability, insight drawer fit, major app surfaces, and night-mode text/form contrast.
- Toy asset QA covers 19 built-in Three.js toy sprites.
- Current Sandbox Snapshot and derived Insight contracts are separated from LLM provider code.
- Root agent protocol and regression matrix are available for future tasks.
- Phase 2 visual review completed with the 2026-08-04 baseline and human gap brief in `docs/stage-v2-visual-review-2026-08-04.md`.
- Phase 3 focused Stage v2 polish completed with sand/ocean/night-rain refinements in `docs/stage-v2-polish-2026-08-04.md`.

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

### Phase 5: Product Experience Track

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
```

## Deferred Work

- Full 300+ asset production pipeline.
- Production backend and encrypted secret storage.
- Real long-running background task workers.
- Multiplayer collaboration.
- Full image-based psychological analysis.
- Pixel-diff visual regression thresholds.

## Working Rule

No visual or product polish is accepted unless the relevant tests in `TEST_MATRIX.md` prove that editing, export, analysis, AI context, and fallback behavior still work.
