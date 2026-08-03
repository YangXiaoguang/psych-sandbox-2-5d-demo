# Stage v2 Visual Review - 2026-08-04

## Scope

This review closes Phase 2 of the current stabilization track. It records human visual QA notes from the generated visual baseline and turns them into a focused Phase 3 polish brief.

No runtime code changed in this phase.

## Evidence

Visual baseline artifacts were generated under:

```text
artifacts/visual-regression/2026-08-04
```

Machine report:

```text
artifacts/visual-regression/2026-08-04/visual-review.md
```

Gate result:

| Check | Result |
|---|---|
| Required scenes | 12 |
| Captured scenes | 12 |
| Console errors | 0 |
| Page errors | 0 |
| Request failures | 0 |
| Visual report gate | PASS |

Reviewed scenes:

- `sandbox-day-sunny`
- `sandbox-night-rainy`
- `sandbox-fullscreen`
- `inventory-expanded`
- `sandbox-ai-drawer`
- `admin-users`

## Review Findings

### 1. Stage Composition

Current state:

- Stage v2 now reads as a borderless sand island surrounded by water.
- The stage is clearly the hero in fullscreen mode.
- Main editing controls no longer blanket the sand area.

Gaps:

- In day mode, the bright ocean still competes with the sand island.
- The island shape is readable, but the sand area needs stronger tactile identity so users read it as a sandplay surface first and an island second.
- The bottom toolbelt is usable but still visually heavy for a game-like creative surface.

Phase 3 direction:

- Reduce ocean dominance through calmer water contrast and stronger shoreline hierarchy.
- Increase sand surface micro-detail before adding more UI polish.
- Keep toolbelt behavior unchanged; only refine visual weight if time remains.

### 2. Sand Material

Current state:

- Sand is warm and yellow in day mode.
- Sand has stones, small marks, and surface variation.

Gaps:

- Large sand patches still read partly as smooth painted terrain instead of granular sand.
- Night/rain mode pushes sand toward muted olive green, which weakens the sandplay identity.
- Current texture detail is visible at close range, but the stage still lacks small granular noise, soft dunes, and local compression around object footprints.

Phase 3 direction:

- Add procedural fine grain, subtle dune relief, and stronger rake/combing variation.
- Keep night sand warm enough to remain identifiable as sand.
- Use lightweight geometry or shader-safe texture work; do not change object schemas or interaction math.

### 3. Ocean And Shoreline

Current state:

- Ocean has animated current lines and glints.
- The island has a clear outer edge and shadow.

Gaps:

- Day ocean is too saturated and can become the strongest visual element.
- Shoreline lacks enough foam lace and shallow-water detail to make the island feel physically embedded in water.
- Night ocean is atmospheric, but some low-contrast wave detail disappears.

Phase 3 direction:

- Add soft shoreline foam beads and shallow-water highlights.
- Tone down day-water saturation near the horizon and stage edges.
- Preserve water motion as ambience, not a distraction from editing.

### 4. Toy Readability

Current state:

- House, trees, person, robot, fence, pond, dog, fish, and bird are recognizable.
- Contact shadows and object scale are coherent enough for editing.

Gaps:

- Small toys around the pond compress visually when camera is zoomed out.
- Some hero toys still read as low-poly placeholders rather than handcrafted miniatures.
- Inventory thumbnails are usable, but toy materials need more intentional highlights and per-asset identity.

Phase 3 direction:

- Polish the first 12 hero toys rather than spreading tiny changes across all assets.
- Add visible toy-craft detail: bevel emphasis, face/material accents, stitches, small props, foam/ripples, wood grain, and clothing/collar details.
- Keep all improvements as render-only children; no changes to saved object data.

### 5. Weather And Night Readability

Current state:

- Rainy night is coherent and no longer makes the app unusable.
- Moon, rain, and dark water create clear atmosphere.
- Controls remain reachable in fullscreen.

Gaps:

- Rain/night still reduces toy contrast, especially for small or pale objects.
- Some UI labels and inactive elements are readable but close to the lower contrast boundary.
- Moon/cloud decoration should remain background-only and not pull attention away from the sand area.

Phase 3 direction:

- Add local fill light or material lift for toys under night/rain conditions.
- Keep rain opacity capped over the sand island.
- Treat all night-mode UI changes as regression-sensitive and run `qa:ui-shell`.

### 6. Asset Backpack

Current state:

- The fullscreen backpack drawer is compact and does not destroy the stage layout.
- Asset names and tags are readable in large mode.
- Category navigation is more game-like than the previous office-style panel.

Gaps:

- Drawer still feels panel-heavy compared with the scene.
- Inventory toy thumbnails need stronger material detail and more consistent framing.
- Category rail and card borders compete with the toy images in night mode.

Phase 3 direction:

- Do not rebuild backpack behavior yet.
- If touched, reduce border weight and improve thumbnail lighting only.

### 7. AI Companion Drawer

Current state:

- Fullscreen AI companion opens as one right drawer.
- It no longer creates two competing conversation panels.
- Context cards and prompt shortcuts fit without covering the sand island.

Gaps:

- The drawer is functional but still closer to a productivity sidebar than a calm in-scene companion.
- Text density is acceptable but should not grow.

Phase 3 direction:

- Do not expand AI companion scope during visual polish.
- Preserve single-drawer behavior as a hard invariant.

### 8. Admin And Non-Stage Surfaces

Current state:

- Admin user management is list-first and avoids the earlier overloaded three-column detail layout.
- Night-mode table text is readable.

Gaps:

- Empty table space is large when the demo has few users.
- The admin page is acceptable for tooling, but it should remain secondary to Stage v2 polish.

Phase 3 direction:

- No admin work in the next visual sprint unless a global theme regression appears.

## Phase 3 Recommended Scope

Name:

```text
Stage v2 Sand / Shoreline / Hero Toy Polish
```

Priority order:

1. Sand tactile material calibration.
2. Ocean and shoreline visual hierarchy.
3. Night/rain toy readability.
4. First 12 hero toy detail pass.
5. Minor operation chrome weight reduction.

Explicitly out of scope:

- Rewriting the editor.
- Changing `SandboxObject`, Snapshot, Insight, export, analysis, AI companion, Memory OS, Admin, or LLM contracts.
- Adding external image, GLB, CDN, backend, or shader-heavy dependencies.
- Changing mouse drag, selected transform, camera pan, right-drag rotate, wheel zoom, JSON export, PNG export, or Classic fallback.

## Required Validation For Phase 3

Minimum:

```bash
npm run build
npm run qa:stage-v2
npm run qa:ui-shell
```

For any broad visual change:

```bash
npm run qa:visual-baseline
npm run qa:visual-report
```

If toy model rendering changes:

```bash
npm run qa:toy-assets
```

## Acceptance Notes

Phase 3 can be accepted only if:

- The sand island is the primary visual subject in day and fullscreen modes.
- Yellow sand remains identifiable in night/rain mode.
- Water supports immersion without overpowering the sandplay surface.
- Hero toys remain readable while dragging and after transform operations.
- AI companion still opens as one clear drawer in fullscreen.
- No interaction, export, analysis, or AI context regression is introduced.
