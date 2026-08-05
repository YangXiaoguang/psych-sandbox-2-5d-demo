# TEST_MATRIX.md

This matrix maps product areas to the evidence required before a change can be considered safe.

## Command Index

| Command | Covers |
|---|---|
| `npm run build` | TypeScript and Vite production build. |
| `npm run qa:snapshot-contract` | Current Sandbox Snapshot, derived Insight, LLM context boundaries, visual supplement policy. |
| `npm run qa:analysis-spec` | Standalone analysis engine charter, expert rubric weights, calibration coverage, privacy and safety boundaries. |
| `npm run qa:analysis-engine` | Standalone package ESM build, public API, Snapshot validation, semantic consistency, migration audit, and versioned JSON Schemas. |
| `npm run qa:analysis-features` | Scene reconstruction, pair relations, deterministic features, evidence graph integrity, weak process fidelity, immutability, and byte stability. |
| `npm run qa:analysis-hypotheses` | Provider-neutral LLM boundary, prompt privacy, structured draft validation, evidence references, confidence rules, non-leading questions, forbidden claims, and audit hashing. |
| `npm run qa:api-contract` | API DTO export, endpoint inventory, pagination/error/auth contracts, safe sample reports. |
| `npm run qa:api-client` | HTTP client request building, headers, auth context, errors, timeout handling. |
| `npm run qa:mock-api` | Mock API pagination, filtering, sorting, sample Snapshot response, secret masking. |
| `npm run qa:repository` | localStorage/mockApi/remoteApi repository modes and migration diagnostics. |
| `npm run qa:toy-assets` | Three.js toy sprite rendering, transparent cropping, anchors, semantics, recipe diversity. |
| `npm run qa:stage-v2` | Stage v2 render, object drag, transform toolbelt, camera controls, export, environment switching, Classic fallback. |
| `npm run qa:ui-shell` | Navigation, responsive shell, fullscreen drawers, AI companion, night-mode readability, major app surfaces. |
| `npm run qa:visual-baseline` | Fixed visual screenshots and browser error capture. |
| `npm run qa:visual-report` | Visual review index and manifest gate result. |
| `npm run qa:acceptance` | Full checkpoint chain. |

## Product Regression Matrix

| Product Area | Core Requirements | Minimum Evidence |
|---|---|---|
| Classic 2.5D editor | Existing Konva add/select/move/rotate/scale/delete and fallback access remain intact. | `npm run build`, `npm run qa:stage-v2` because it switches back to Classic fallback. |
| Stage v2 editing | Mouse toy drag writes back to React state; selected toolbelt rotates, scales, duplicates, deletes; camera pan/zoom/right-drag rotate work. | `npm run build`, `npm run qa:stage-v2`. |
| Stage v2 visual polish | Sand, ocean, shoreline, weather, toy details improve without blocking interaction or export. | `npm run build`, `npm run qa:stage-v2`, `npm run qa:ui-shell`, `npm run qa:visual-baseline`, `npm run qa:visual-report`. |
| Asset library / backpack | Search, category shelves, favorites, recent use, large/compact cards, names, tags, drag placement remain usable. | `npm run build`, `npm run qa:ui-shell`, `npm run qa:stage-v2`. |
| Toy assets | Built-in toys render as non-empty, cropped, identifiable 3D toy sprites with anchors and semantic metadata. | `npm run build`, `npm run qa:toy-assets`. |
| Right insight panel | Selected object, metrics, heatmap, risk distribution, event timeline, JSON preview, AI materials stay readable. | `npm run build`, `npm run qa:ui-shell`, `npm run qa:snapshot-contract` if Snapshot/Insight changes. |
| AI companion | One clear companion panel, no duplicate fullscreen dialogs, prompt uses Snapshot/Insight only. | `npm run build`, `npm run qa:ui-shell`, `npm run qa:snapshot-contract`. |
| Agent dialogue | Conversations persist locally, stream output works, Markdown renders, sandplay context uses centralized prompt builder. | `npm run build`, `npm run qa:ui-shell`, `npm run qa:snapshot-contract`. |
| Current Snapshot / Insight | Only current state is output; no events, identity, memory, authorization context, images, screenshots, or API keys. | `npm run build`, `npm run qa:snapshot-contract`. |
| Standalone analysis engine | Fact/Feature/Hypothesis stay separate; current Snapshot is validated independently; scene and features are deterministic and traceable; model drafts cite existing evidence only; schema versions and migrations are explicit; process fidelity is honest. | `npm run build`, `npm run qa:analysis-spec`, `npm run qa:analysis-engine`, `npm run qa:analysis-features`, `npm run qa:analysis-hypotheses`, `npm run qa:snapshot-contract`. |
| API / backend contract | DTOs, pagination, error codes, auth context, mock adapters, repository adapters remain consistent and secret-safe. | `npm run build`, `npm run qa:api-contract`, `npm run qa:api-client`, `npm run qa:mock-api`, `npm run qa:repository`. |
| Personal Memory OS | User-scoped workspaces, archives, memory candidates, Context Packet preview, and audit boundaries stay isolated. | `npm run build`, `npm run qa:ui-shell`, plus repository/API QA if storage contracts change. |
| Admin console | Large-scale user/asset/LLM/Agent management remains navigable, readable, and not overstuffed on one screen. | `npm run build`, `npm run qa:ui-shell`, API QA if DTOs or mock data change. |
| Night mode / global theme | Text, placeholders, inputs, buttons, disabled states, tags, tables, cards, and drawers remain readable. | `npm run build`, `npm run qa:ui-shell`, visual baseline for broad theme changes. |

## Manual Visual Review Checklist

Use this after `npm run qa:visual-baseline && npm run qa:visual-report`:

- `sandbox-day-sunny`: sand should be warm and tactile; ocean should not dominate the island.
- `sandbox-night-rainy`: toys, sand, controls, and panel text must remain readable.
- `sandbox-fullscreen`: stage should be the hero; asset and insight drawers should not cover primary controls.
- `inventory-expanded`: toy names and tags must not overlap cards.
- `focus-ai-drawer`: only one AI companion interaction surface should be visible.
- `agent-chat`: bubbles and Markdown text must be smaller, readable, and not office-like.
- `admin-console`: list-first management should not overload one page with too many panels.

## Completion Rule

A green test is evidence only for the surface it covers. Broad visual, Stage v2, LLM, or navigation changes require the combined evidence listed above. If evidence is missing, the task is not complete.
