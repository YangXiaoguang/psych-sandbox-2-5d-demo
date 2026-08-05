# GAME_SPEC.md

This is the durable product and interaction specification for the 2.5D psychological sandplay collaboration system.

## Product Goal

Build a personal sandplay workspace where users can create a symbolic sand tray, inspect the current composition, export the work, and optionally talk with a warm AI companion. The system should feel like a premium tactile sandplay studio with game-like direct manipulation, not like a generic office dashboard.

## Primary User Jobs

1. Select a toy from the asset library.
2. Place the toy into the sand tray.
3. Move, rotate, scale, duplicate, and delete toys.
4. Change weather and light while keeping the tray readable.
5. Inspect spatial structure through region/risk/category analysis.
6. Export JSON and PNG snapshots.
7. Ask the AI companion or Agent to discuss the current composition using bounded Snapshot/Insight context.
8. Archive personal sandplay sessions and manage local personal memory boundaries.
9. Manage users, assets, LLM providers, and Agent profiles in a scalable admin console.
10. Let authorized psychological experts inspect evidence, score AI analysis, revise hypotheses, and preserve the original output for audit.

## Core Surfaces

| Surface | Role |
|---|---|
| Sandbox Editor | Main creation workspace with Classic 2.5D fallback and Stage Engine v2. |
| Asset Library | Toy backpack for search, categories, favorites, recent use, and drag placement. |
| Insight Panel | Current work summary, selected object, spatial/risk/category analysis, event timeline, JSON preview. |
| AI Companion | Lightweight, contextual sandplay conversation. Must never duplicate in fullscreen. |
| Agent Dialogue | Dedicated conversation stage for theory-oriented companion roles. |
| Personal Center | Local identity, sandplay archives, memory candidates, Context Packet preview. |
| Admin Console | Large-scale management for users, permissions, assets, LLM providers, and Agent profiles. |
| Analysis Workbench | Future expert-facing surface for evidence inspection, rubric scoring, revisions, rejection, and model comparison. |

## Data Source Of Truth

`SandboxObject[]` in React state remains the source of truth for the current sand tray.

Stage Engine v2 Three.js meshes are render projections. After a user drags or transforms an object in 3D, the result must write back to the saved `SandboxObject` fields.

Current AI context starts from:

```text
SandboxObject[] + SandboxEnvironment
  -> CurrentSandboxSnapshot
  -> CurrentSandboxInsight
  -> LLM Prompt
```

The current Snapshot/Insight context intentionally excludes:

- Event flow.
- Personal identity.
- Personal memory.
- Authorization context.
- Screenshots or raw images.
- API keys.

The standalone analysis engine must keep three different meanings in separate contracts:

```text
Fact -> Feature -> Hypothesis
```

Facts describe the snapshot, features are deterministic calculations, and hypotheses are evidence-grounded candidates that require user dialogue or expert review. Snapshot-only input exposes `createdOrder` but not a full interaction history, so process fidelity must remain `weak` until a separately authorized event protocol exists.

## Interaction Requirements

| Interaction | Requirement |
|---|---|
| Add toy | Click or drag from asset library creates a new object and records an event. |
| Drag toy | Mouse drag changes object position and writes back to React state. |
| Rotate toy | Toolbelt/control updates object rotation and records an event. |
| Scale toy | Toolbelt/control updates object scale and records an event. |
| Duplicate toy | Creates a new object with distinct ID and records an event. |
| Delete toy | Removes selected object and records an event. |
| Camera pan | Mouse pan changes Stage v2 view, not object coordinates. |
| Camera rotate | Right-drag changes Stage v2 viewing angle safely. |
| Camera zoom | Mouse wheel or control changes Stage v2 zoom. |
| Fullscreen | Stage remains the hero; drawers open on demand; AI companion opens once. |
| Export PNG | Captures current visible sandplay stage without debug UI. |
| Export JSON | Outputs structured current work data. |

## Visual Requirements

- Stage Engine v2 should read as a premium miniature sand island surrounded by animated water.
- Sand should be warm yellow, tactile, granular, and readable in day/night/rain.
- Toys should be handcrafted 3D miniatures with distinct silhouettes, not flat icons.
- Weather and light may change mood but must not block selection, dragging, or reading.
- Main UI chrome should be sparse, compact, and secondary to the sandplay stage.
- Admin and personal management screens may be denser, but should still use the same warm studio language.

## Safety And Interpretation Boundaries

- The product is not a medical diagnostic system.
- The standalone analysis engine produces candidate themes and interview material, not privileged access to a user's inner world.
- AI responses must use observation, reflection, and open questions.
- Symbolic candidates are prompts for dialogue, not fixed meanings.
- Personal memory must be user-visible, user-controlled, and source-traceable.
- API keys and secrets must never appear in exported reports, QA artifacts, docs, or prompt context.
- Death, conflict, fantasy, or other symbolic toys must not independently trigger crisis conclusions.
- Expert corrections must preserve the original model output and remain versioned and auditable.

## Definition Of Done

A feature is done only when:

- It preserves the core sandplay interactions.
- It keeps current data contracts and privacy boundaries intact.
- Relevant QA commands in `TEST_MATRIX.md` pass.
- Visual or interaction changes have a checkpoint or clear rollback point.
- Documentation is updated when the behavior, data shape, or quality gate changes.
