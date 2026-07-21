# Stage Engine v2 Scene Contracts

Document version: v2.0 RC
Updated: 2026-07-21
Scope: Stage Engine v2 3D sandplay editor, classic fallback, shared data, interaction, export, and visual QA.

---

## 1. Purpose

This contract defines the non-negotiable structure and behavior of Stage Engine v2. It exists to prevent the recurring failure mode where visual upgrades accidentally remove editing, export, or analysis features.

Stage Engine v2 is the premium 3D stage for the sandplay product. It is not a standalone game and must keep the existing product shell, React state, object model, event stream, insight panel, AI companion, Memory OS, and admin configuration compatible.

---

## 2. Product Boundary

Stage Engine v2 may replace the central rendering surface, but it must not replace these product systems:

- `SandboxObject` data model.
- Asset catalog and managed asset directory.
- Event stream.
- 3x3 region analysis.
- JSON export.
- AI companion context summary.
- Agent conversation system.
- Personal Memory OS archive.
- Admin console.
- `Classic 2.5D` fallback.

Classic 2.5D remains the stable fallback until Stage v2 passes the RC quality gates.

---

## 3. Current Visual Contract

Stage v2 no longer uses the old rectangular wood-frame tray as its primary visual target. The current RC direction is:

- Borderless miniature sand island.
- Textured yellow sand with height, grain, shells, stones, ridges, and contact darkening.
- Animated surrounding seawater with waves, highlights, foam, and shoreline motion.
- Warm toy-like 3D props with soft plastic, clay, wood, ceramic, glass-water, and toy-metal materials.
- Orthographic camera with controlled pan, zoom, and rotate.
- Weather and light modes that affect the scene without preventing object reading or dragging.

The scene should feel like a premium, touchable miniature diorama inside a professional sandplay editor.

---

## 4. Data Contract

### 4.1 Input Objects

Stage v2 must use existing `SandboxObject` instances as the authoritative source:

```ts
interface SandboxObject {
  id: string;
  assetId: string;
  name: string;
  category: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  riskTag: RiskTag;
  symbolicCandidates: string[];
  footprint?: SandboxFootprint;
  createdAt: number;
}
```

Three.js runtime objects are render-only projections of this data. They must never become a second source of truth.

### 4.2 Coordinate Mapping

Business coordinates remain 2D:

- `x`: `0..BOARD_WIDTH`
- `y`: `0..BOARD_HEIGHT`
- top-left is `(0, 0)`
- bottom-right is `(BOARD_WIDTH, BOARD_HEIGHT)`

Stage v2 mapping:

```text
Sandbox x -> Three X
Sandbox y -> Three Z
Object vertical -> Three Y
```

After moving an object in 3D, Stage v2 must write the final 2D `x/y` back to React state.

### 4.3 Event Contract

Every edit must continue to record a `SandboxEvent`.

| Behavior | Event label requirement |
|---|---|
| Add asset | include asset name and target position |
| Move asset | include old and new position when available |
| Rotate asset | include object name and new rotation |
| Scale asset | include object name and new scale |
| Delete asset | include object name |
| Change weather/light | include weather and light mode |

Event labels may be localized Chinese UI text, but they must remain searchable and understandable.

---

## 5. Scene Structure Contract

The runtime scene must contain these logical layers:

```text
StageEngineV2Scene
├── CameraRig
│   └── OrthographicCamera
├── LightingRig
│   ├── AmbientLight
│   ├── HemisphereLight
│   └── DirectionalLight
├── EnvironmentRoot
│   ├── OceanSurface
│   ├── ShorelineFoam
│   ├── SandIsland
│   ├── SandGrainDetails
│   ├── ShellStoneDetails
│   └── ContactShadowReceivers
├── ObjectRoot
│   └── ToyObject3D[]
├── InteractionRoot
│   ├── RaycastSandPlane
│   ├── DragPreview
│   ├── SelectionIndicator
│   └── TransformActionBridge
├── WeatherRoot
│   ├── RainLayer
│   ├── CloudLayer
│   ├── StarLayer
│   └── SunMoonLayer
└── CaptureBridge
```

Implementation file names may differ, but these responsibilities must be present.

---

## 6. Pointer and Camera Contract

### 6.1 Object Interaction

- Pointer down on a toy selects it.
- Dragging a selected or hit toy moves it across the sand plane.
- Weather, ocean, background, labels, and decorative particles must not steal object drag events.
- Drag end writes back 2D `x/y` and records an event.
- Selection state must stay synchronized with the right panel.

### 6.2 Camera Interaction

The stage must support:

- Mouse wheel zoom.
- Mouse drag pan for moving the sandbox view.
- Controlled rotate action by UI button or modified gesture.
- Reset camera button.

Camera limits must prevent the sand island from being completely lost offscreen.

### 6.3 Fullscreen Interaction

Fullscreen mode must keep:

- Object drag.
- Camera pan/zoom/rotate.
- Asset drawer access.
- Insight drawer access.
- A single AI companion panel.

It must not show duplicate AI panels or create unclear two-person conversation surfaces inside the editor.

---

## 7. Transform Contract

When an object is selected, users must be able to:

- Move by direct mouse drag.
- Rotate.
- Scale.
- Delete.
- Inspect properties.

The first RC may use toolbar buttons and panel controls instead of a full 3D gizmo. However, the feature surface must remain equivalent to the classic editor.

---

## 8. Weather and Lighting Contract

Required weather:

- Sunny
- Cloudy
- Rainy

Required light modes:

- Day
- Night

Scene impact:

- Day mode: higher saturation, readable toy materials, visible warm highlights.
- Night mode: darker environment, visible stars/moon when appropriate, readable toys, no unreadable UI.
- Cloudy mode: softer shadows and cloud presence.
- Rainy mode: rain motion and wet atmosphere, but toys remain selectable and readable.

UI impact:

- Night mode must synchronize the system theme.
- Text, placeholders, disabled buttons, tags, tables, and inputs must remain readable.

---

## 9. Export Contract

### 9.1 JSON

JSON export remains based on product data, not Three.js internals.

### 9.2 PNG

Stage v2 PNG export must capture the current WebGL stage canvas. It must not include:

- AI companion floating card.
- Admin panels.
- Browser UI.
- Debug overlays.

Selection indicators may be excluded by default unless an explicit future option says otherwise.

---

## 10. Asset Contract

Each Stage v2 toy asset should be represented by a stable recipe:

```ts
interface StageToyAssetSpec {
  assetId: string;
  visualFamily: "person" | "animal" | "environment" | "nature" | "symbol";
  materialFamily: "softPlastic" | "clay" | "paintedWood" | "ceramic" | "toyMetal" | "glassWater";
  footprint: {
    type: "ellipse" | "rect" | "wide" | "small";
    width: number;
    depth: number;
  };
  anchor: {
    x: number;
    z: number;
  };
  thumbnailScale: number;
  semanticTags: string[];
}
```

The source code should move toward separate model families instead of one ever-growing `ToyObject3D.tsx`.

---

## 11. RC Quality Gates

Stage v2 RC is not acceptable until all gates pass:

- `npm run build` succeeds.
- Stage v2 renders without a blank WebGL canvas.
- Ocean animation has visible frame-to-frame movement.
- Object drag updates position and records an event.
- Camera pan, zoom, rotate, and reset are usable.
- Weather and light switching updates scene appearance.
- Night UI is readable.
- PNG export downloads a valid image.
- JSON export remains compatible.
- Classic editor remains switchable.
- Browser console has no uncaught errors during smoke QA.

---

## 12. Regression Rules

Future changes are not allowed to:

- Remove existing object drag, rotate, scale, delete, JSON export, or PNG export.
- Hide asset card names or risk tags.
- Reintroduce duplicate AI companion panels.
- Make weather layers intercept pointer events.
- Make the right panel cover the playable stage in fullscreen.
- Increase visual complexity without preserving readability and performance.

If any rule is violated, fix it before adding new polish.
