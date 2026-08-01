# Stage v2 Visual Gap Audit

Date: 2026-07-25

## Visual Thesis

Stage v2 should read as a premium miniature sand island surrounded by animated water: warm tactile yellow sand, clear toy-scale 3D props, calm weather, and a sparse game-like operation layer.

## Baseline Evidence

Current visual baseline artifacts:

- `artifacts/visual-regression/2026-07-25/sandbox-day-sunny.png`
- `artifacts/visual-regression/2026-07-25/sandbox-night-rainy.png`
- `artifacts/visual-regression/2026-07-25/sandbox-fullscreen.png`
- `artifacts/visual-regression/2026-07-25/inventory-expanded.png`

## Gaps Against Target

1. Stage composition
   - The island occupies too little of the available stage in default and fullscreen views.
   - Toys lose detail because the default orthographic zoom leaves too much ocean as the dominant visual.

2. Sand material
   - Day sand is warm but still reads partly like a flat painted board.
   - Night/rain sand shifts too far into olive-gray, reducing the tactile yellow sand identity.

3. Night and rainy readability
   - Rainy night is atmospheric but too dark for therapeutic editing.
   - Toy silhouettes and sand texture need stronger fill light so users can still inspect and move objects.

4. Weather layer
   - Night rainy cloud puffs read as stacked placeholder circles.
   - Rain streaks should support atmosphere without covering the sandplay subject.

5. Operation chrome
   - The UI has improved, but toolbar clusters still compete with the scene.
   - Future work should keep only primary scene controls visible and move secondary operations behind drawers or compact icon menus.

## This Sprint Scope

Low-risk calibration only:

- Increase default Stage v2 camera zoom so the sand island becomes the primary subject.
- Warm and brighten night/rain sand and ocean materials.
- Increase night fill light while preserving the night mood.
- Reduce weather-layer dominance and make clouds less placeholder-like.

Out of scope for this sprint:

- Rebuilding every toy model.
- Replacing the toolbar system.
- Changing data, drag, export, analysis, or AI companion flows.

## Acceptance

- `npm run build` passes.
- `npm run qa:stage-v2` passes.
- `npm run qa:visual-baseline` captures all scenes without browser errors.
- In rainy night mode, toys remain visually readable and draggable.
- Default Stage v2 composition shows the island as the main subject, not a small object in a large ocean.

## Next Sprint: Sand And Shoreline Polish

Goal:

- Make the yellow sand read as tactile material instead of a flat colored island.
- Make the shoreline feel alive through small foam beads, moving lace, and shallow-water highlights.
- Keep the scene readable in day, night, rain, and fullscreen states.

Implemented direction:

- Add procedural rake/combing marks to the sand texture.
- Add lightweight 3D sand-surface rake mark meshes so close camera views show physical detail.
- Add small shoreline foam flecks with subtle breathing motion.
- Add more bead detail to the foam texture while preserving the existing ocean animation.

Non-regression:

- These changes must not change object data, drag behavior, camera controls, export logic, or analysis logic.
- Validation still relies on `npm run build`, `npm run qa:stage-v2`, and `npm run qa:visual-baseline`.

## Next Sprint: Toy Detail Language V1

Goal:

- Make Stage v2 toys read as individual handcrafted miniatures rather than generic primitives.
- Add visible close-up detail while preserving the low-poly / soft toy performance envelope.
- Keep inventory thumbnails and stage models consistent in silhouette and symbolic identity.

Implemented direction:

- Add reusable tiny toy details: studs, short stripes, and bead rows.
- Add face, clothing, collar, scale, roof, wood, leaf, water, stone, robot, skull, and light details across existing model families.
- Use small geometry only; no external textures, GLB files, CDN assets, or schema changes.

Non-regression:

- Toy details are purely visual mesh children. They must not change sandbox object data, transform handles, hit testing, exports, localStorage, or analysis.
- Validation still relies on `npm run build`, `npm run qa:stage-v2`, and `npm run qa:visual-baseline`.

## Next Sprint: Hero Toy Detail Language V2

Goal:

- Move from one-off toy decoration to a reusable handcrafted miniature detail language.
- Improve the first 12 hero toys without changing `ToyModelRecipe`, saved object data, drag handles, hit testing, analysis, or export formats.
- Make close camera views and inventory thumbnails show more deliberate toy craft: clothing straps, tiny bows, roof stitches, wood grain, water foam stitches, robot screen LEDs, and lamp base details.

Implemented direction:

- Add shared primitives in `toyPrimitives.tsx`: `ToyBow`, `ToyInsetPlate`, `ToyWoodGrain`, and `ToyStitchRow`.
- Apply these primitives to the person family, dog, bird, fish, house, bridge, fence, tree, water, sun, robot, and light.
- Keep every detail as lightweight child geometry so object transforms, selection halos, and Stage v2 drag math stay unchanged.

Non-regression:

- No changes to sandbox object schema or asset recipe schema.
- No external images, GLB assets, CDN files, or backend calls.
- No changes to Stage v2 camera, export, analysis, AI companion, Agent, Memory OS, or Admin logic.
- Validation must include `npm run build`, `npm run qa:stage-v2`, `npm run qa:ui-shell`, `npm run qa:visual-baseline`, and `npm run qa:visual-report`.
