# Stage Engine v2 Release Candidate Plan

Document version: v2.0 RC
Updated: 2026-07-24
Project: 2.5D psychological sandplay collaboration system

---

## 1. RC Goal

Stage Engine v2 must become a stable, high-quality 3D sandplay stage that can be evaluated, extended, and safely improved. The goal is not another isolated visual patch. The goal is a release candidate with explicit contracts, repeatable QA, clear module boundaries, and preserved product behavior.

### Visual Thesis

A warm, premium miniature sand island surrounded by animated water: tactile yellow sand, soft toy props, readable therapeutic workspace UI, and calm motion that supports expression instead of distracting from it.

### Interaction Thesis

Users should feel they can directly touch the sandplay scene: drag toys with the mouse, move the view with the mouse, zoom/rotate safely, and open context panels only when needed.

---

## 2. Current Baseline

Checkpoint commit:

```text
d1480a7 feat: stabilize stage engine v2 visual baseline
tag: checkpoint/stage-v2-visual-rc-baseline-2026-07-21
```

The baseline includes:

- Borderless 3D sand island.
- Animated surrounding ocean and shoreline treatment.
- Textured sand details.
- Weather and day/night integration.
- Mouse-based object dragging.
- Camera pan, zoom, rotate, and reset.
- Higher quality hero toy models.
- Stage v2 PNG export bridge.
- Favicon and app polish.

This baseline is the rollback point for the RC work.

---

## 3. Product Boundaries

Stage v2 may improve the central scene, but these capabilities must remain intact:

- Left asset library.
- Drag/add asset workflow.
- Select, move, rotate, scale, delete.
- 3x3 region analysis.
- Event stream.
- JSON export.
- PNG export.
- Right insight panel.
- AI companion.
- Agent dialogue.
- Memory OS.
- Admin console.
- Classic 2.5D fallback.

Any change that improves visuals while breaking these behaviors is not considered progress.

---

## 4. Success Criteria

### 4.1 Visual Quality

The RC must show:

- Sand that reads as granular, warm, and tactile.
- Ocean that has motion, highlights, foam, and depth.
- Weather that changes atmosphere without making the scene unclear.
- Toys that read as 3D objects, not flat icons.
- Consistent lighting across sand, ocean, and toys.
- No oversized, cluttered, or overlapping toolbar regions.

### 4.2 Interaction Quality

The RC must support:

- Mouse dragging toys on the sand plane.
- Mouse/camera movement for stage viewing.
- Zoom and rotate controls.
- Transform controls for selected toys.
- Fullscreen editing with clear access to asset and insight drawers.
- A single clear AI companion interaction pattern.

### 4.3 Engineering Quality

The RC must provide:

- Updated scene contract.
- Repeatable QA command.
- Passing production build.
- No uncaught browser console errors during smoke test.
- Reduced risk around toy model growth.
- Clear next-step decomposition for 300+ assets.

---

## 5. Architecture

Current module:

```text
src/stage3d/
├── components/
│   ├── StageEngineV2Shell.tsx
│   ├── StageCanvas3D.tsx
│   ├── StageCameraControls.tsx
│   ├── StageObjectsLayer3D.tsx
│   ├── StageWeatherSystem.tsx
│   ├── SandTrayMesh.tsx
│   ├── ToyObject3D.tsx
│   ├── RoundedBoxMesh.tsx
│   └── toys/
│       ├── toyPrimitives.tsx
│       ├── toyRegistry.tsx
│       ├── PersonToy.tsx
│       ├── AnimalToys.tsx
│       ├── EnvironmentToys.tsx
│       ├── NatureToys.tsx
│       └── SymbolToys.tsx
└── utils/
    └── stageMapping.ts
```

Target module direction:

```text
src/stage3d/
├── components/
│   ├── StageEngineV2Shell.tsx
│   ├── StageCanvas3D.tsx
│   ├── StageCameraControls.tsx
│   ├── StageObjectsLayer3D.tsx
│   ├── StageWeatherSystem.tsx
│   ├── environment/
│   │   ├── SandIslandMesh.tsx
│   │   ├── OceanSurface.tsx
│   │   └── ShorelineDetails.tsx
│   └── toys/
│       ├── ToyObject3D.tsx
│       ├── PersonToy.tsx
│       ├── AnimalToys.tsx
│       ├── EnvironmentToys.tsx
│       ├── SymbolToys.tsx
│       └── toyMaterials.ts
├── utils/
│   └── stageMapping.ts
└── qa/
    └── stageV2Smoke.ts
```

The RC does not need the full final split, but it must stop the single-file toy model from becoming the long-term architecture.

---

## 6. RC Work Plan

### Phase RC-0: Baseline and Rollback

Status: complete.

Deliverables:

- Commit current Stage v2 baseline.
- Tag the checkpoint.
- Verify production build once before continuing.

### Phase RC-1: Contracts and Documentation

Status: in progress.

Deliverables:

- Update `docs/scene-contracts.md`.
- Update this RC plan.
- Document current visual direction and non-regression rules.

Acceptance:

- Docs no longer describe old wood-frame-only tray as the Stage v2 target.
- Docs name current Stage v2 gates and rollback baseline.

### Phase RC-2: Repeatable QA

Deliverables:

- Add a script such as `scripts/qa-stage-v2.mjs`.
- Add an npm command such as `npm run qa:stage-v2`.
- The script should boot or connect to the local app, switch to Stage v2, and verify:
  - render readiness
  - object drag
  - camera motion
  - water animation
  - weather/light switching
  - PNG export
  - console error absence

Acceptance:

- One command produces a pass/fail result and useful diagnostic output.

### Phase RC-3: Toy Model Boundary

Status: complete.

Deliverables:

- Extract shared toy materials/helpers from `ToyObject3D.tsx`.
- Move at least one model family into a separate module.
- Keep public behavior identical.

Acceptance:

- `ToyObject3D.tsx` becomes an orchestrator/registry rather than the only place future assets can live.
- Build stays green.

Evidence:

- `ToyObject3D.tsx` now owns interaction wrapper behavior, selection halo, and drop shadow only.
- `toyRegistry.tsx` maps `ToyModelRecipe` to model families and centralizes footprint shadow radius.
- Person, animal, environment, nature, and symbol toy families live under `src/stage3d/components/toys/`.
- `npm run build` passed after the split.

### Phase RC-4: Product UI Stabilization

Deliverables:

- Check Stage v2 toolbar wrapping/overlap.
- Check night-mode panel text and card contrast.
- Check asset library card name/risk tag visibility.
- Check AI companion single-panel behavior in fullscreen.

Acceptance:

- No known text clipping or unreadable controls in the main Stage v2 path.

### Phase RC-5: Final Verification

Deliverables:

- `npm run build`.
- `npm run qa:stage-v2`.
- Manual smoke note for Classic, Agent, Memory OS, and Admin navigation.
- Final commit and tag.

Suggested final tag:

```text
checkpoint/stage-v2-rc-accepted-2026-07-21
```

---

## 7. Non-Regression Checklist

Before marking the RC complete, verify:

- Stage v2 renders in the app.
- The sand island and ocean are visible.
- Ocean animation changes over time.
- Existing toys are visible and selectable.
- Dragging a toy with the mouse changes its position.
- Camera view can be moved with the mouse.
- Zoom and rotate controls work.
- Weather and light controls work.
- Right panel selection data updates.
- JSON export works.
- PNG export works.
- Asset library item names remain visible.
- AI companion does not duplicate in fullscreen.
- Night mode text, buttons, inputs, and tags are readable.
- Classic 2.5D can still be selected.

---

## 8. Explicitly Deferred

These are important but not required for the RC:

- Full 300+ toy asset rebuild.
- Real backend persistence.
- Multiplayer collaboration.
- Full visual regression baseline image comparison.
- Advanced 3D gizmo.
- Production-grade auth and encrypted key storage.

The RC should leave these easier to do later, not pretend they are complete.

---

## 9. Working Rule

For the rest of Stage v2 work:

```text
No visual polish is accepted unless interaction, export, analysis, and fallback behavior remain verified.
```

This rule is stricter than ordinary UI polish because the project has already experienced regressions where visual changes removed core sandplay editing features.
