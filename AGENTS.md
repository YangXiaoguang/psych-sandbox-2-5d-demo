# AGENTS.md

This file is the project operating protocol for Codex and other coding agents. Read it before changing code.

Also read `PLAN.md` to understand the current checkpoint and next phase before starting non-trivial work.

## Project Identity

This is a 2.5D psychological sandplay collaboration system, not a generic game and not an office dashboard. The product must preserve a warm, professional, game-like sandplay editing experience with AI companion support, personal memory boundaries, and a migration path to real backend services.

Primary stack:

- Vite + React + TypeScript
- React-Konva for the Classic 2.5D editor
- Three.js / React Three Fiber for Stage Engine v2
- localStorage and mock API adapters for the current frontend-only prototype

## Non-Negotiable Product Invariants

Never ship a change that breaks these flows:

- Add toys from the asset library.
- Drag placed toys with the mouse.
- Move, rotate, scale, duplicate, and delete selected toys.
- Preserve `SandboxObject` as the source of truth.
- Keep y/depth ordering or the Stage v2 3D equivalent coherent.
- Keep 3x3 region analysis, center/boundary counts, risk distribution, and event timeline usable.
- Export JSON and PNG.
- Keep Classic 2.5D fallback available.
- Keep Stage v2 mouse camera pan, zoom, and right-drag rotate.
- Keep AI companion as one clear panel, especially in fullscreen.
- Do not send event flow, personal memory, user identity, screenshots, or API keys into the current LLM snapshot context.

## Required Context By Task Type

| Task Type | Read First |
|---|---|
| Any non-trivial task | `PLAN.md`, `GAME_SPEC.md`, `TEST_MATRIX.md` |
| Stage v2 visual or interaction | `docs/scene-contracts.md`, `docs/visual-bible.md`, `docs/stage-engine-v2-goals-and-tasks.md`, `docs/quality-gates.md` |
| Toy model / asset rendering | `docs/visual-bible.md`, `docs/scene-contracts.md`, `src/stage3d/components/toys/` |
| AI analysis / LLM context | `docs/ai-analysis-layer-technical-architecture.md`, `docs/sandbox-llm-data-output-spec.md` |
| Standalone psychological analysis engine | `docs/sandbox-analysis-engine-charter.md`, `docs/sandbox-analysis-engine-phase-1.md`, `docs/sandbox-analysis-engine-phase-2.md`, `docs/sandbox-analysis-expert-rubric.md`, `docs/sandbox-analysis-calibration-dataset.md` |
| API / backend contract | `docs/development-and-technical-spec.md`, `src/api/contracts.ts`, `src/platform/` |
| Personal Memory OS | `docs/development-and-technical-spec.md`, `src/personal/`, `src/auth/` |
| Admin console / user management | `docs/development-and-technical-spec.md`, `src/admin/`, `src/components/AdminDashboard.tsx` |
| Global UI / theme | `docs/visual-bible.md`, `docs/quality-gates.md`, `src/styles/`, `src/styles.css` |

## Engineering Rules

- Keep edits scoped to the requested phase.
- Prefer existing data models and helper APIs over new parallel state.
- Do not use external image CDNs, GLB downloads, or backend services unless explicitly requested.
- Do not introduce production claims around diagnosis, therapy, or medical advice.
- Do not store or expose plaintext API keys in reports, fixtures, docs, or UI output.
- New LLM entry points must use `createSandboxSnapshotChatMessages`.
- New Snapshot/Insight code should live under `src/analysis`, not `src/llm`.
- Stage v2 Three.js objects are render projections only; write back to React state after edits.
- Visual polish must not weaken interaction, export, analysis, fallback, or QA coverage.

## QA Commands

Use the smallest command set that covers the changed surface:

| Change Surface | Minimum Commands |
|---|---|
| Any TypeScript/runtime code | `npm run build` |
| Snapshot, Insight, LLM prompt, AI companion, Agent context | `npm run build`, `npm run qa:snapshot-contract` |
| Standalone analysis engine contracts, reconstruction, features, evidence graph, rubric, calibration | `npm run build`, `npm run qa:analysis-spec`, `npm run qa:analysis-engine`, `npm run qa:analysis-features`, `npm run qa:snapshot-contract` |
| API DTO, mock API, repository adapters | `npm run build`, `npm run qa:api-contract`, `npm run qa:api-client`, `npm run qa:mock-api`, `npm run qa:repository` |
| Toy asset renderer or Stage v2 toy models | `npm run build`, `npm run qa:toy-assets`, `npm run qa:stage-v2` |
| Stage v2 interaction, shell, fullscreen, right/left drawers | `npm run build`, `npm run qa:stage-v2`, `npm run qa:ui-shell` |
| Global theme, night mode, navigation, admin/agent/memory pages | `npm run build`, `npm run qa:ui-shell` |
| Release checkpoint or broad visual change | `npm run qa:acceptance` |

## Visual Quality Rules

- The sandplay stage is the hero. UI chrome must be sparse, compact, and secondary.
- Stage v2 should read as a premium miniature sand island with tactile yellow sand and animated surrounding water.
- Toys should read as handcrafted 3D miniatures, not flat icons with shadows.
- Night and rain can change mood but must not reduce text, toy, or drag-target readability.
- Asset cards must keep toy names and risk tags legible in large and compact modes.
- Avoid large explanatory copy blocks in the main work surface.

## Failure Handling

When a quality gate fails:

1. Do not claim completion.
2. Identify whether the failure is build, data contract, interaction, UI shell, visual capture, or theme readability.
3. Fix only the failing surface.
4. Re-run the relevant command.
5. If the fix grows beyond the intended phase, stop and checkpoint before continuing.

## Commit Discipline

- Check `git status --short --branch` before and after work.
- Do not revert user changes unless explicitly asked.
- Keep commits descriptive and scoped.
- Use checkpoint tags for phase boundaries and accepted release candidates.
