# Stage Engine v2 开发目标与任务书

文档版本：v1.0  
更新日期：2026-07-18  
适用项目：2.5D 心理沙盘协作系统  
核心转向：从“Konva 伪 3D 合成 polish”转向“真实 3D 微缩沙盘编辑舞台”

---

## 1. 重新设定的总目标

当前项目的下一阶段目标不再是继续在现有 Konva 合成层上叠加视觉补丁，而是建立一个可长期演进的 `Stage Engine v2`：以 Three.js / React Three Fiber 为核心渲染层，保留现有 React 状态、事件流、资产管理、AI 对话、个人中心和管理后台，把中央沙盘升级为真实 3D 微缩玩具沙盘编辑器。

### 1.1 一句话目标

构建一个真实 3D、可交互、可分析、可导出的心理沙盘舞台，让沙盘主体、沙具、光影、天气、相机和拖拽编辑都在同一个空间系统中工作。

### 1.2 视觉 Thesis

温暖、清澈、可触摸的桌面微缩沙盘：浅色木框、细腻沙面、Q 版玩具沙具、柔和日光/夜光、低噪声 UI，让用户感到安全、专注和愿意表达。

### 1.3 交互 Thesis

- 鼠标直接抓取沙具，在真实沙面平面上移动。
- 相机可平移、缩放、轻量旋转，但始终保持沙盘作品可读。
- UI 只服务当前任务：编辑时少干扰，分析时清晰展开，对话时温和陪伴。

---

## 2. 战略判断

### 2.1 为什么必须重设目标

现有系统已经证明了产品方向是成立的：沙具库、沙盘摆放、事件流、区域分析、AI 对话、个人记忆、后台管理等能力都已经可运行。但视觉品质长期达不到设计目标，根因不是单个组件没调好，而是技术路径与目标品质不匹配。

当前中央舞台由以下层叠构成：

- Konva Stage 承载对象交互。
- Three.js 离屏渲染背景图。
- Canvas pass 绘制沙面、木框、光影。
- 沙具由 Three.js 离屏渲染成 sprite。
- 天气、选中框、接触阴影继续叠加。

这个方式适合快速原型，却很难稳定达到真实 3D 微缩世界的空间质量。继续堆叠补丁会增加样式和交互风险。

### 2.2 新方向

保留当前系统作为 `Classic 2.5D Editor`，同时引入 `Stage Engine v2`：

| 层级 | 当前方式 | 新方式 |
|---|---|---|
| 沙盘主体 | Canvas/Konva 合成图 | Three.js 真实 mesh |
| 沙具 | 离屏 3D sprite | 真实 3D object |
| 光照 | 贴图和透明层模拟 | 环境光、方向光、软阴影 |
| 深度 | y 坐标排序 | 真实 z/depth + raycasting |
| 拖拽 | Konva 坐标反投影 | 鼠标 raycast 到沙面平面 |
| 相机 | 伪 2.5D 投影 | Orthographic Camera + 受控 Orbit/Pan/Zoom |
| PNG 导出 | Konva canvas | WebGL canvas + UI 可选合成 |

---

## 3. 不变的产品边界

以下能力必须保留，不因渲染层升级而丢失：

- 方形木框浅沙色沙盘。
- 左侧沙具库、收藏、最近使用、分类和搜索。
- 拖拽摆放、选择、移动、旋转、缩放、删除。
- 作品对象数据结构。
- 事件流记录。
- 九宫格、中心区域、边界区域分析。
- JSON 导出。
- PNG 导出。
- AI 伙伴对话。
- Agent 对话界面。
- 个人中心 / Memory OS。
- 管理后台。
- localStorage 原型数据。
- 后端 API 契约预留。

---

## 4. 新的成功标准

### 4.1 视觉标准

第一阶段不追求 300 个沙具全部高质量，而是先用 12 个 hero 沙具达到可展示质量：

- 儿童
- 成人
- 老人
- 狗
- 鸟
- 鱼
- 树
- 水域
- 房子
- 围栏
- 机器人
- 光源

每个 hero 沙具必须满足：

- Q 版玩具比例，头身或体块比例清晰。
- 圆润边缘，不能像二维图标。
- 有统一材质体系：软塑料、粘土、木质、玻璃水体等。
- 能接收统一灯光影响。
- 能在沙面产生接触阴影。
- 缩略图和舞台中都清晰可辨。

### 4.2 交互标准

- 鼠标拖拽沙具必须自然，不得出现坐标漂移。
- 选中对象后可旋转、缩放、删除。
- 相机平移/缩放/旋转不能让沙盘主体丢失。
- 全屏模式仍可操作 AI 伙伴、资产库和作品面板。
- 夜间模式文字、按钮、输入框必须满足可读性。

### 4.3 工程标准

- `npm run build` 必须通过。
- 不允许新增明显 console error。
- 不允许核心文件继续无限膨胀。
- `styles.css` 不再作为主要新增样式堆积区。
- 新增功能必须配套浏览器截图验证和核心交互回归。

---

## 5. 目标架构

### 5.1 双引擎过渡架构

```text
App.tsx
├── ClassicSandboxEditor        # 当前 Konva 2.5D 编辑器，作为稳定回退
├── StageEngineV2Shell          # 新 3D 沙盘工作台
│   ├── StageCanvas3D           # R3F/Three.js Canvas
│   ├── SandTrayMesh            # 木框、蓝色内衬、沙面、水域
│   ├── ToyObject3D             # 真实 3D 沙具
│   ├── StageCameraRig          # 正交相机、平移、缩放、受控旋转
│   ├── StageInteractionLayer   # raycast、拖拽、选择、transform
│   ├── StageWeatherSystem      # 晴/阴/雨、昼/夜
│   └── StageCaptureBridge      # PNG 导出
├── AssetLibrary
├── RightPanel
├── AiCompanionPanel
├── AgentChatView
├── PersonalCenter
└── AdminDashboard
```

### 5.2 新目录建议

```text
src/
├── stage3d/
│   ├── components/
│   │   ├── StageEngineV2Shell.tsx
│   │   ├── StageCanvas3D.tsx
│   │   ├── SandTrayMesh.tsx
│   │   ├── ToyObject3D.tsx
│   │   ├── StageCameraRig.tsx
│   │   ├── StageTransformControls.tsx
│   │   ├── StageWeatherSystem.tsx
│   │   └── StageCaptureBridge.tsx
│   ├── assets/
│   │   ├── toyModelRegistry.ts
│   │   ├── heroToyRecipes.ts
│   │   └── materialPresets.ts
│   ├── interaction/
│   │   ├── raycastPlacement.ts
│   │   ├── dragController.ts
│   │   └── transformController.ts
│   ├── camera/
│   │   ├── cameraLimits.ts
│   │   └── cameraStore.ts
│   ├── analysis/
│   │   └── stage3dAnalysisBridge.ts
│   └── qa/
│       └── visualScenarios.ts
```

---

## 6. 分阶段任务

## Phase 0：冻结当前基线

目标：保留当前系统作为稳定回退点，停止在旧舞台上继续大规模视觉堆叠。

任务：

- 创建 checkpoint commit。
- 创建 tag：`checkpoint/before-stage-engine-v2`。
- 记录当前可用能力：拖拽、旋转、缩放、删除、JSON/PNG、AI 伙伴。
- 标记旧引擎为 `Classic 2.5D`。

验收：

- `npm run build` 通过。
- 当前沙盘核心交互回归通过。
- Git 工作区清晰。

---

## Phase 1：建立质量契约

目标：先定义“什么叫达到目标”，再进入开发。

任务：

- 新增 `docs/visual-bible.md`。
- 新增 `docs/scene-contracts.md`。
- 新增 `docs/quality-gates.md`。
- 定义固定验收视角：
  - 日间晴天标准视角。
  - 日间阴天标准视角。
  - 夜间晴天标准视角。
  - 夜间雨天标准视角。
  - 全屏编辑视角。
  - AI 伙伴打开视角。
- 定义 UI 对比度检查范围：
  - 顶部导航。
  - 左侧沙具库。
  - 中央舞台工具栏。
  - 右侧面板。
  - 对话输入框。
  - 后台表格和表单。

验收：

- 每个视觉目标有可执行描述，而不是只有“更高级”。
- 每个核心交互有自动或半自动验证路径。

---

## Phase 2：Stage Engine v2 技术切片

目标：在不替换现有编辑器的情况下，做一个独立真实 3D 沙盘最小切片。

任务：

- 引入或确认 `@react-three/fiber`、`@react-three/drei` 是否加入依赖。
- 新建 `/stage3d` 模块。
- 渲染真实 3D 方形沙盘：
  - 木框。
  - 蓝色内衬。
  - 细沙材质。
  - 桌面环境。
- 使用正交相机。
- 加入环境光、方向光、软阴影。
- 支持鼠标平移和缩放。
- 先只放置一个测试方块和一个测试小人。

验收：

- 独立 demo 可以在当前页面通过开关显示。
- 相机操作不卡顿。
- WebGL canvas 无黑屏。
- 不影响 Classic 编辑器。

---

## Phase 3：对象数据桥接

目标：让现有 `SandboxObject` 数据驱动 3D 场景。

任务：

- 建立 `SandboxObject -> StageObject3D` 映射。
- 复用现有对象属性：
  - `id`
  - `assetId`
  - `x`
  - `y`
  - `rotation`
  - `scale`
  - `riskTag`
  - `symbolicCandidates`
  - `footprint`
- 用 Three.js 坐标系表达沙盘坐标。
- 保留九宫格分析使用原来的二维数据。
- 保留事件流写入。

验收：

- Classic 和 v2 显示同一组对象数据。
- 修改对象位置后，右侧面板同步更新。
- JSON 导出结果不变。

---

## Phase 4：鼠标拖拽与 Transform

目标：把核心编辑体验迁移到真实 3D。

任务：

- raycast 到沙面平面。
- 鼠标拖拽对象在沙面移动。
- 点击选中对象。
- 支持删除。
- 支持旋转。
- 支持缩放。
- 提供底部精简工具栏：
  - 选择
  - 移动
  - 旋转
  - 缩放
  - 复制
  - 删除
- 拖拽时显示接触阴影增强和落点提示。

验收：

- 鼠标移动沙具无明显漂移。
- 旋转/缩放后数据写回。
- 删除后对象、事件流、分析面板同步。
- 和旧版交互能力等价或更好。

---

## Phase 5：12 个 Hero 沙具重建

目标：先做少量高质量资产，建立可复制的资产系统。

任务：

- 建立 `ToyModelRecipe3D`。
- 建立材质 preset：
  - softPlastic
  - claySkin
  - paintedWood
  - warmCeramic
  - toyMetal
  - glassWater
  - sandMatte
- 建立 12 个 hero 模型：
  - 儿童
  - 成人
  - 老人
  - 狗
  - 鸟
  - 鱼
  - 树
  - 水域
  - 房子
  - 围栏
  - 机器人
  - 光源
- 每个资产同时输出：
  - 3D 舞台模型。
  - 左侧缩略图。
  - footprint。
  - anchor。
  - semantic tags。

验收：

- 每个沙具在舞台和缩略图中可辨。
- 沙具共享光照与阴影。
- 不再依赖“大图标 + 阴影”来假装立体。

---

## Phase 6：天气与昼夜系统重建

目标：天气成为真实 3D 场景光照的一部分，而不是仅覆盖一层滤镜。

任务：

- 晴天：
  - 暖日光。
  - 柔和短阴影。
  - 背景浅色窗光和轻云。
- 阴天：
  - 低对比环境光。
  - 云层背景。
  - 沙具阴影变软。
- 雨天：
  - 雨线位于背景和前景不同层。
  - 沙面轻微湿润高光。
  - 保证沙具仍清晰。
- 夜间：
  - 系统 UI 同步进入深色主题。
  - 月亮、星点、云层在背景出现。
  - 沙盘主体保持可读。
  - 光源沙具能产生局部视觉反馈。

验收：

- 每种天气至少一张固定截图。
- 夜间输入框、按钮、表格、标签可读。
- 天气不阻挡拖拽和选择。

---

## Phase 7：替换中央舞台

目标：让 v2 成为默认舞台，Classic 作为可切换回退。

任务：

- 增加舞台引擎切换：
  - `Stage v2`
  - `Classic 2.5D`
- 默认启用 `Stage v2`。
- 左侧沙具库拖拽进入 v2 舞台。
- 右侧面板读取 v2 选择状态。
- PNG 导出从 WebGL canvas 生成。
- 全屏模式适配：
  - 左侧浮动背包。
  - 右侧洞察抽屉。
  - AI 伙伴为单一抽屉，不重复出现双窗口。

验收：

- 普通模式和全屏模式都可完成完整创作流程。
- AI 伙伴打开后不会遮挡关键操作。
- 导出 PNG 与当前画面一致。

---

## Phase 8：UI 系统瘦身

目标：减少样式堆叠，建立可维护的产品 UI 系统。

任务：

- 从 `styles.css` 拆出：
  - `styles/tokens.css`
  - `styles/layout.css`
  - `styles/sandbox.css`
  - `styles/inventory.css`
  - `styles/panels.css`
  - `styles/admin.css`
  - `styles/dark-mode.css`
- 删除重复或过期的 `!important` 覆盖。
- 建立统一组件状态：
  - default
  - hover
  - active
  - disabled
  - selected
  - danger
- 管理后台转为列表主导 + 详情抽屉。
- 左侧资产库转为游戏背包风格，但减少常驻说明文字。

验收：

- 夜间模式没有低对比文本。
- 顶部工具栏不遮挡。
- 资产卡片文字不丢失。
- 管理后台不在一个页面堆过多功能。

---

## Phase 9：质量门和回归体系

目标：让后续修改不再反复破坏已有功能。

任务：

- Playwright 固定截图。
- 核心交互脚本：
  - 拖拽已有对象。
  - 新增沙具。
  - 选择对象。
  - 旋转对象。
  - 缩放对象。
  - 删除对象。
  - 导出 JSON。
  - 导出 PNG。
- UI 状态脚本：
  - 日间。
  - 夜间。
  - 晴天。
  - 阴天。
  - 雨天。
  - 全屏。
  - AI 抽屉。
  - 左库展开。
  - 右面板折叠。
- 建立截图输出目录：
  - `artifacts/visual-regression/`

验收：

- 每次视觉任务都能输出截图对比。
- 不通过交互回归不得提交。

---

## 7. 任务优先级

### P0：必须先做

- 冻结旧版本。
- 编写视觉圣经和场景合同。
- 新建 v2 独立技术切片。
- 验证真实 3D 沙盘、相机和 raycast 拖拽可行。

### P1：决定质量上限

- 12 个 hero 沙具。
- 真实灯光、阴影、材质。
- 天气和昼夜系统。
- PNG 导出。

### P2：决定产品可用性

- 全屏模式。
- AI 伙伴单一抽屉。
- 左侧背包。
- 右侧洞察面板。
- 夜间 UI 对比度。

### P3：长期工程化

- CSS 拆分。
- 管理后台信息架构重构。
- 自动视觉 QA。
- 后端接入准备。

---

## 8. 明确暂停的工作

在 Stage Engine v2 技术切片完成前，暂停以下工作：

- 不再继续大规模修改 `ThreeSandboxStageLayer.tsx` 的 Canvas pass。
- 不再继续为旧 Konva 舞台添加复杂视觉效果。
- 不再为所有 300+ 沙具平均做美术 polish。
- 不再继续堆叠新的管理后台复杂页面。
- 不再把全局 CSS 作为主要解决方案。

只允许对旧系统做：

- bug 修复。
- 数据兼容。
- 回退能力维护。
- 必要的安全修复。

---

## 9. 里程碑定义

| 里程碑 | 名称 | 目标 |
|---|---|---|
| M0 | 当前系统冻结 | Classic 编辑器稳定可回退 |
| M1 | v2 技术切片 | 真实 3D 方形沙盘可显示 |
| M2 | v2 可编辑 | 可鼠标拖拽、选择、旋转、缩放、删除 |
| M3 | Hero 沙具可展示 | 12 个核心沙具达到玩具级 3D 风格 |
| M4 | v2 默认启用 | 替换中央舞台，左右面板保持可用 |
| M5 | 视觉 QA 稳定 | 截图和交互回归成为常规流程 |

---

## 10. 下一步推荐执行

下一步不要直接继续做视觉 patch。建议按以下顺序执行：

1. `git status` 确认当前工作区。
2. 提交当前目标文档。
3. 创建 `checkpoint/before-stage-engine-v2`。
4. 新增 `docs/visual-bible.md`。
5. 新增 `docs/scene-contracts.md`。
6. 新增 `docs/quality-gates.md`。
7. 创建 `src/stage3d/` 技术切片。

完成以上 7 步后，再进入真实 3D 沙盘开发。

---

## 11. 最终判断

项目的新目标不是“把旧画面再修得更像参考图”，而是“建立一个真实 3D 沙盘编辑引擎，让参考图级别的空间质量成为架构自然结果”。

旧系统继续作为产品壳、数据层和稳定回退；新系统承担视觉和交互上限。这样既保护已完成的功能，也让后续投入真正朝目标收敛。

