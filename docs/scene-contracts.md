# Stage Engine v2 场景合同

文档版本：v1.0  
更新日期：2026-07-18  
适用范围：Stage Engine v2 真实 3D 沙盘、Classic 2.5D 回退、数据桥接、对象交互

---

## 1. 合同目标

场景合同用于明确 Stage Engine v2 必须包含哪些结构、数据、交互和导出能力。任何渲染实现都必须满足这些合同，避免出现“画面变好但核心编辑能力丢失”的问题。

---

## 2. 引擎边界

系统进入双引擎过渡期：

| 引擎 | 职责 | 状态 |
|---|---|---|
| `Classic 2.5D Editor` | 当前 Konva 编辑器、稳定回退、旧 PNG 导出 | 保留 |
| `Stage Engine v2` | 真实 3D 沙盘、鼠标拖拽、真实光影、未来默认舞台 | 新建 |

Stage Engine v2 不得重写以下业务层：

- `SandboxObject` 数据。
- 事件流。
- 九宫格分析。
- 资产目录。
- AI 伙伴上下文摘要。
- 个人中心归档。
- 管理后台资产配置。

---

## 3. 数据合同

### 3.1 输入对象

Stage Engine v2 必须以现有 `SandboxObject` 为唯一对象数据源：

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

### 3.2 坐标合同

业务坐标继续使用二维沙盘坐标：

- `x`: 0 到 `BOARD_WIDTH`
- `y`: 0 到 `BOARD_HEIGHT`
- 左上为 `(0, 0)`
- 右下为 `(BOARD_WIDTH, BOARD_HEIGHT)`

Stage Engine v2 内部可以使用 Three.js 坐标，但必须提供稳定映射：

```text
Sandbox x -> Three X
Sandbox y -> Three Z
Object vertical -> Three Y
```

任何对象拖拽完成后，必须写回二维 `x/y`，保证分析和导出不变。

### 3.3 事件合同

所有编辑行为必须继续写入 `SandboxEvent`：

| 行为 | 事件类型 | 必须 payload |
|---|---|---|
| 新增沙具 | `add` | assetId, position, environment |
| 移动沙具 | `move` | from, to |
| 旋转沙具 | `rotate` | from, to |
| 缩放沙具 | `scale` | from, to |
| 删除沙具 | `delete` | objectId, assetId |
| 环境变化 | `environment` | weather, light |

---

## 4. 场景节点合同

Stage Engine v2 场景必须包含：

```text
StageEngineV2Scene
├── CameraRig
│   └── OrthographicCamera
├── LightingRig
│   ├── AmbientLight
│   ├── HemisphereLight
│   └── DirectionalLight
├── SandTrayRoot
│   ├── TrayFrame
│   ├── TrayInnerLiner
│   ├── SandSurface
│   ├── SandBoundaryPlane
│   └── ContactShadowReceiver
├── ObjectRoot
│   └── ToyObject3D[]
├── InteractionRoot
│   ├── RaycastPlane
│   ├── SelectionOutline
│   ├── DragGhost
│   └── TransformControls
├── WeatherRoot
│   ├── CloudLayer
│   ├── RainLayer
│   ├── StarLayer
│   └── MoonSunLayer
└── CaptureBridge
```

### 4.1 监听合同

- `RaycastPlane` 可接收 pointer events。
- 沙盘装饰背景不得拦截拖拽。
- 天气粒子不得拦截拖拽。
- AI 伙伴浮层不得阻断舞台核心操作，除非用户明确打开对话抽屉。

---

## 5. 相机合同

### 5.1 默认相机

```ts
interface Stage3DCameraState {
  targetX: number;
  targetZ: number;
  zoom: number;
  azimuth: number;
  polar: number;
}
```

默认范围：

| 参数 | 建议范围 |
|---|---|
| `zoom` | 0.75 到 1.55 |
| `azimuth` | -18 到 18 度 |
| `polar` | 48 到 58 度 |
| `targetX` | 不得让沙盘主体完全离屏 |
| `targetZ` | 不得让沙盘主体完全离屏 |

### 5.2 相机操作

- 鼠标滚轮：缩放。
- 空格 + 左键或中键：平移。
- Shift + 滚轮或专用按钮：轻量旋转。
- 双击空白：回到默认视角。
- 全屏模式保留所有相机操作。

---

## 6. 沙盘合同

### 6.1 方形木框

必须具备：

- 真实厚度。
- 倒角。
- 外侧木纹。
- 内侧蓝色衬边。
- 前沿可见厚度。

### 6.2 沙面

必须具备：

- 独立 mesh 或可接收 raycast 的 plane。
- 程序化材质。
- 可接收阴影。
- 可提供对象落点。
- 可叠加足迹和接触暗部。

### 6.3 沙盘区域

九宫格分析仍使用二维业务坐标。Stage Engine v2 需要能显示：

- 3x3 辅助线。
- 中心区域。
- 边界区域。
- 选中区域提示。

辅助线默认可关闭，不能压过沙具。

---

## 7. 沙具合同

### 7.1 资产模型

每个 v2 资产必须提供：

```ts
interface StageToyAssetSpec {
  assetId: string;
  name: string;
  category: string;
  riskTag: RiskTag;
  semanticTags: string[];
  symbolicCandidates: string[];
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
  modelRecipe: ToyModelRecipe3D;
}
```

### 7.2 12 个 Hero 沙具

第一批必须优先完成：

- `person_child`
- `person_adult`
- `person_elder`
- `animal_dog`
- `animal_bird`
- `animal_fish`
- `nature_tree`
- `nature_water`
- `building_house`
- `building_fence`
- `special_robot`
- `nature_light`

### 7.3 交互边界

每个沙具必须有：

- 可点击 hit area。
- 可拖拽根节点。
- 可计算 footprint。
- 可显示 selection outline。
- 可生成接触阴影。

---

## 8. 拖拽合同

### 8.1 拖拽新增

从左侧资产库拖到沙盘：

1. 资产库发出 `draggingAsset`。
2. Stage Engine v2 通过 raycast 计算沙面落点。
3. 显示放置预览。
4. drop 后调用现有 `onDropAsset(assetId, { x, y })`。

### 8.2 拖拽移动

移动已有沙具：

1. pointer down 命中对象。
2. 锁定对象 id。
3. pointer move raycast 到沙面。
4. 更新预览位置。
5. pointer up 写回 `x/y`。
6. 记录 `move` 事件。

### 8.3 禁止行为

- 不允许拖拽时对象跳到错误区域。
- 不允许拖拽结束后 UI 面板状态不同步。
- 不允许天气层或背景层抢 pointer。
- 不允许选中框阻止对象继续拖拽。

---

## 9. Transform 合同

选中对象后必须支持：

- 删除。
- 旋转。
- 缩放。
- 复制。
- 查看属性。

第一版可以使用底部工具栏和快捷按钮实现，不强制实现完整三轴 gizmo。

快捷键建议：

| 快捷键 | 功能 |
|---|---|
| Delete / Backspace | 删除 |
| R | 旋转模式 |
| S | 缩放模式 |
| V | 选择/移动模式 |
| Cmd/Ctrl + D | 复制 |
| Esc | 取消选择 |

---

## 10. 天气与昼夜合同

### 10.1 天气

必须支持：

- 晴天
- 阴天
- 雨天

### 10.2 光照

必须支持：

- 白天
- 黑夜

### 10.3 UI 同步

黑夜模式必须同步切换 UI 主题，不允许出现浅色卡片配浅色文字、输入内容不可见、按钮 disabled 不可辨认等问题。

---

## 11. 导出合同

### 11.1 JSON

JSON 导出继续使用现有作品数据，不应包含 Three.js 内部临时对象。

### 11.2 PNG

Stage Engine v2 PNG 导出必须至少支持：

- 导出当前 WebGL 沙盘画面。
- 保持透明/背景策略一致。
- 不导出控制框，除非用户开启“包含编辑辅助线”。
- 不导出 AI 浮层和管理 UI。

---

## 12. 回退合同

任何 Stage Engine v2 开发阶段都必须保留：

- Classic 2.5D 可切换。
- 当前数据可在 Classic 和 v2 间共享。
- v2 出现错误时不破坏 localStorage 数据。

---

## 13. 完成定义

一个 Stage Engine v2 任务只有同时满足以下条件才算完成：

- 构建通过。
- 场景合同未破坏。
- 核心交互回归通过。
- 固定截图输出。
- 日夜主题可读性通过。
- 没有新增明显 console error。
- 旧 Classic 编辑器仍可用。

