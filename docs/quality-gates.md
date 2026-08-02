# Stage Engine v2 质量门

文档版本：v1.4
更新日期：2026-08-02
适用范围：所有 Stage Engine v2 相关开发、视觉改动、交互改动、UI 主题改动

---

## 1. 质量门目标

质量门用于把“看起来更高级”“不要破坏功能”转化成可执行检查。Stage Engine v2 的任何功能提交，都必须先通过质量门，再声明完成。

---

## 2. 必跑命令

### 2.1 构建

```bash
npm run build
```

通过标准：

- TypeScript 无错误。
- Vite build 成功。
- 允许暂时存在 chunk size warning，但不得新增阻断错误。

### 2.2 Git 状态

```bash
git status --short --branch
```

通过标准：

- 本轮修改范围清晰。
- 不包含无关文件。
- 不包含临时截图、debug dump、构建产物，除非任务明确要求。

### 2.3 当前沙盘 Snapshot 合同

```bash
npm run qa:snapshot-contract
```

通过标准：

- `CurrentSandboxSnapshot` schema 固定为 `sandbox.current-snapshot.v1`。
- 输出只包含当前沙盘状态，不包含事件流、个人身份、个人记忆、授权上下文、截图或 API Key。
- 右侧结构化数据面板、AI 伙伴和 Agent 对话都必须通过 `createCurrentSandboxSnapshotPayload` 使用同一份 builder。
- AI 伙伴和 Agent 对话必须通过 `createSandboxSnapshotChatMessages` 注入 LLM 上下文，不得在组件中散落拼接 Snapshot prompt，也不得向 LLM 注入 `CurrentSandboxSnapshotPolicy JSON`。
- API 契约、Mock Adapter、文档说明和运行时样例保持一致。

### 2.4 API 契约导出

```bash
npm run qa:api-contract
```

通过标准：

- 生成 `artifacts/api-contract/api-contract-report.json` 和 `api-contract-summary.md`。
- 报告来自 `src/api/contracts.ts` 与 `src/api/mockApiAdapter.ts`，不手写复制 DTO。
- 端点、分页协议、错误码、认证上下文和样例分页响应齐全。
- LLM provider 样例只包含 `apiKeyConfigured` 与 `apiKeyPreview`，不得输出明文 API Key、密码或密钥字段。
- 当前沙盘 Snapshot 样例仍只表达当前状态，不把事件流、个人记忆或截图混进 LLM 输入。

如果只是给后端同学重新生成交付文件，也可以运行：

```bash
npm run api:contract
```

### 2.5 API Client 行为检查

```bash
npm run qa:api-client
```

通过标准：

- HTTP Client 正确拼接 Base URL、路径、普通查询参数、字段筛选参数和数组参数。
- 请求必须携带 `X-Api-Contract-Version`、`X-Request-ID`，并在有认证上下文时携带 actor、active user、role、workspace scope。
- POST/PATCH 等带 body 请求必须设置 `Content-Type: application/json` 并序列化 JSON body。
- 服务端标准 `ApiResponseDto` 错误必须抛出 `ApiClientError`，并保留 status、code、requestId。
- 非标准 HTTP 错误必须映射到统一错误码；网络失败和超时必须分别归一化为 `INTERNAL_ERROR` 与 `REQUEST_TIMEOUT`。
- API Client 不能依赖浏览器专属 `window` 对象，确保 Node QA 和后续 SSR/测试环境也可验证。

输出：

```text
artifacts/api-client-qa/api-client-report.json
```

### 2.6 Mock API 行为检查

```bash
npm run qa:mock-api
```

通过标准：

- Mock API Adapter 的用户、资产、LLM provider、Agent、沙盘档案和记忆候选查询可用。
- 分页必须是一页起算，支持 `page/pageSize`，超出范围返回 `PAGE_OUT_OF_RANGE`。
- 关键词搜索、字段筛选、数组筛选和排序都要有可验证样例。
- LLM provider 只返回 `apiKeyConfigured` 与遮罩后的 `apiKeyPreview`，不得暴露明文 API Key 或密钥字段。
- 当前沙盘 Snapshot response 仍使用 `sandbox.current-snapshot.v1`，并保持事件流排除策略。

输出：

```text
artifacts/mock-api-behavior-qa/mock-api-behavior-report.json
```

### 2.7 Repository Adapter 模式检查

```bash
npm run qa:repository
```

通过标准：

- `localStorage`、`mockApi`、`remoteApi` 三种模式都能生成 `SystemArchitectureReport`。
- 报告覆盖身份、工作区、权限、沙盘、记忆、会话、资产和 LLM 八个迁移域。
- `mockApi` 模式必须能完成 DTO 分页与当前沙盘 Snapshot 样例 round trip。
- `remoteApi` 仍必须明确标记为占位模式：`transport=http`，`remoteReady=false`，不得误报为已接入真实服务。
- 报告不得暴露明文 API Key、密码或密钥字段。

输出：

```text
artifacts/repository-adapter-qa/repository-adapter-report.json
```

### 2.8 固定视觉基线

```bash
npm run qa:visual-baseline
```

通过标准：

- 能启动或连接本地 Vite 服务。
- 能生成固定场景截图和 `manifest.json`。
- 截图过程无 Vite error overlay、无浏览器 runtime error。
- 每个固定场景无水平页面溢出，关键根节点可见。
- 输出目录默认为 `artifacts/visual-regression/YYYY-MM-DD/`，该目录不提交到 Git，只作为本地设计评审、截图对比和回归证据。

### 2.9 视觉评审报告

```bash
npm run qa:visual-report
```

通过标准：

- 能读取最新 `artifacts/visual-regression/YYYY-MM-DD/manifest.json`。
- 12 个固定场景全部存在。
- 截图 manifest 中无浏览器 console error 和 page error。
- 在同一目录写入 `visual-review.md`，作为人工视觉评审索引。

如需指定 manifest：

```bash
VISUAL_REVIEW_MANIFEST=artifacts/visual-regression/2026-08-01/manifest.json npm run qa:visual-report
```

推荐顺序：

1. 先运行 `npm run qa:visual-baseline` 生成最新截图。
2. 再运行 `npm run qa:visual-report` 生成评审报告。
3. 打开 `visual-review.md`，按报告里的场景顺序检查 Stage v2 主视觉、雨夜可读性、背包抽屉、AI 抽屉和全局主题副作用。

### 2.10 完整验收链路

```bash
npm run qa:acceptance
```

该命令用于阶段收口或 checkpoint 前，按顺序执行：

1. `npm run build`
2. `npm run qa:snapshot-contract`
3. `npm run qa:api-contract`
4. `npm run qa:api-client`
5. `npm run qa:mock-api`
6. `npm run qa:repository`
7. `npm run qa:stage-v2`
8. `npm run qa:ui-shell`
9. `npm run qa:visual-baseline`
10. `npm run qa:visual-report`

如果只是局部修改，可以先运行对应单项；但任何影响 Stage v2、LLM 数据输出、全局主题或主要导航的提交，都必须至少运行相关单项 QA。

---

## 3. 浏览器运行检查

开发服务器：

```bash
npm run dev
```

检查地址以 Vite 输出为准，通常为：

```text
http://localhost:5174/
```

### 3.1 页面入口

必须检查：

- 沙盘编辑。
- 对话 Agent。
- 个人中心。
- 管理后台。

### 3.2 Console

通过标准：

- 无 Vite error overlay。
- 无 React runtime error。
- 无 WebGL context 反复创建导致的明显警告。
- 无交互时持续刷屏日志。

---

## 4. 固定视觉场景

后续 Playwright 截图必须覆盖这些状态：

| 场景 ID | 状态 | 目的 |
|---|---|---|
| `sandbox-day-sunny` | 沙盘编辑 / 晴天 / 白天 | 默认品质基准 |
| `sandbox-day-cloudy` | 沙盘编辑 / 阴天 / 白天 | 低对比光照检查 |
| `sandbox-night-clear` | 沙盘编辑 / 晴天 / 黑夜 | 夜间 UI 可读性 |
| `sandbox-night-rainy` | 沙盘编辑 / 雨天 / 黑夜 | 最困难可读性场景 |
| `inventory-expanded` | 左侧沙具库展开 | 背包抽屉、缩略图、名称、标签不重叠 |
| `right-panel-collapsed` | 右侧折叠 | 舞台宽度和操作可用 |
| `sandbox-insight-drawer` | 作品洞察抽屉打开 | 右侧抽屉可读，不压住沙盘主体 |
| `sandbox-fullscreen` | 全屏编辑 | 工具与浮层不遮挡 |
| `sandbox-ai-drawer` | AI 伙伴打开 | 单一抽屉，不重复窗口 |
| `agent-chat` | Agent 对话 | 对话文字、输入框、头像 |
| `personal-memory` | 个人中心 | 个人档案、记忆仪表盘、表单可读性 |
| `admin-users` | 管理后台用户列表 | 表格/抽屉信息架构 |

截图输出建议：

```text
artifacts/visual-regression/YYYY-MM-DD/<scene-id>.png
```

当前项目已提供固定截图命令：

```bash
npm run qa:visual-baseline
```

该命令会同时写入 `manifest.json`，记录截图时间、场景 ID、环境状态、视口尺寸和关键节点位置。后续视觉 polish 必须先生成新基线，再与上一个 checkpoint 的截图人工或工具化对比。

---

## 5. 核心交互回归

### 5.1 沙盘对象

必须验证：

- 新增沙具。
- 点击选择沙具。
- 鼠标拖拽已有沙具。
- 旋转沙具。
- 缩放沙具。
- 复制沙具。
- 删除沙具。
- 取消选择。

通过标准：

- 对象数据写回。
- 右侧属性面板同步。
- 事件流新增正确事件。
- 九宫格统计更新。
- 没有坐标漂移。

当前自动化覆盖：

- `npm run qa:stage-v2` 会在 Stage v2 中从沙具背包拖入新沙具，拖动已有沙具，并验证选中态底部工具带。
- 该脚本会点击选中沙具的右转、放大、复制和删除按钮，并直接检查 localStorage 场景对象与事件流是否更新。
- 相机右键旋转会额外验证对象 transform 未被误改，防止“转动视角”误伤沙具位置、旋转或缩放。

### 5.2 资产库

必须验证：

- 搜索。
- 分类切换。
- 收藏。
- 最近使用。
- 大图/紧凑模式。
- 拖拽拿取视觉反馈。

通过标准：

- 沙具名称可读。
- 缩略图不裁切主体。
- 标签不遮挡名称。
- 不出现卡片重叠。
- 大图和紧凑模式都使用稳定的底部名称牌。

当前自动化覆盖：

- `npm run qa:ui-shell` 会在夜间沙盘中打开沙具背包抽屉，验证抽屉不遮挡 Stage v2 模式切换、不破坏舞台优先布局。
- 该脚本会分别检查大图模式与紧凑模式，确保完整露出的卡片名称可读、名称牌稳定、风险标签不压住名称、预览区不挤压到底部标签区。
- QA 只对名称牌完整进入抽屉可视区的卡片做遮挡断言，避免把滚动区域底部半露出的下一行卡片误判为真实遮挡。

### 5.2.1 Toy Sprite 渲染快照

默认沙具必须验证：

- 每个内置资产都有 `ToyAssetSpec`。
- 默认资产不能落到 `fallback` recipe。
- `anchor`、`footprint`、`thumbnailScale`、语义标签和象征候选完整。
- Three.js 离屏 sprite 能在浏览器中真实渲染为非空透明 PNG。
- 透明裁剪不能切掉主体边缘。
- 主体像素范围、锚点和构图中心保持合理。
- 19 个内置 sprite 具有足够差异，避免多个资产误渲染成同一个模型。

当前自动化覆盖：

- `npm run qa:toy-assets` 会构建一个临时浏览器 harness，调用真实 `renderToyAssetSprite` 渲染全部内置沙具。
- 该脚本会输出 `artifacts/toy-asset-render-qa/toy-asset-render-report.json` 和每个沙具的 PNG 快照。
- 默认输出只显示摘要和失败项；需要完整 gate 日志时可运行 `TOY_ASSET_QA_VERBOSE=1 npm run qa:toy-assets`。

### 5.3 导出

必须验证：

- JSON 导出。
- PNG 导出。

通过标准：

- JSON 包含对象、事件、环境、分析所需字段。
- PNG 是当前沙盘画面。
- PNG 不包含不应出现的调试 UI。

---

## 6. 夜间模式专项检查

夜间模式是当前高风险区域，所有 UI 改动都必须检查。

### 6.1 文本

检查：

- 标题。
- 正文。
- 次级文字。
- 表格文字。
- 标签文字。
- placeholder。
- disabled 文字。

通过标准：

- 输入内容可见。
- placeholder 可辨但不抢正文。
- disabled 状态可辨，不像不可读 bug。

### 6.2 控件

检查：

- 按钮。
- icon button。
- select。
- input。
- textarea。
- checkbox。
- tab。
- chip。

通过标准：

- 默认、hover、active、selected、disabled 都有明确状态。
- 危险按钮和主按钮不混淆。
- 按钮不会被顶部栏或分组边框遮挡。

### 6.3 面板

检查：

- 左侧资产库。
- 中央工具栏。
- 右侧作品面板。
- AI 伙伴抽屉。
- 管理后台表格。
- 用户详情抽屉。

通过标准：

- 没有浅色卡片叠浅色字。
- 没有深色卡片叠低透明字。
- 滚动区域边界清楚。

---

## 7. 视觉品质检查

### 7.1 沙盘

必须检查：

- 木框厚度。
- 沙面颗粒。
- 内衬蓝边。
- 桌面投影。
- 沙具接触阴影。
- 九宫格辅助线。

通过标准：

- 沙盘主体第一眼清楚。
- 沙面不脏、不灰、不噪。
- 沙具没有漂浮感。

### 7.2 沙具

必须检查：

- 体积感。
- 轮廓。
- 表情。
- 阴影。
- 与沙面接触。
- 缩略图可读。

通过标准：

- 不像扁平图标。
- 不靠描边和阴影硬撑立体感。
- 12 个 hero 沙具能在截图中清晰辨认。

---

## 8. 性能预算

Stage Engine v2 第一版性能目标：

| 指标 | 目标 |
|---|---|
| 默认对象数 | 30 个稳定可用 |
| 目标对象数 | 100 个可编辑 |
| 首屏可交互 | 2 秒内 |
| 拖拽反馈 | 无肉眼明显延迟 |
| WebGL renderer | 避免无意义重复创建 |
| 纹理 | 程序化纹理复用 |

允许第一版不做极限优化，但禁止为了视觉一次性创建大量不可控 mesh、光源和动态阴影。

---

## 9. 提交前清单

每次提交前必须确认：

- [ ] 修改范围符合当前 Phase。
- [ ] 没有无关重构。
- [ ] `npm run build` 通过。
- [ ] 如修改 LLM 上下文、结构化数据、API 契约或 AI 对话入口，`npm run qa:snapshot-contract` 通过。
- [ ] 核心沙盘交互未丢失。
- [ ] 日间和夜间至少各检查一次。
- [ ] 资产库没有缩略图/文字重叠。
- [ ] 右侧面板没有遮挡舞台。
- [ ] 全屏模式可退出。
- [ ] AI 伙伴不重复弹出多个窗口。
- [ ] Git diff 可解释。

---

## 10. 不通过时的处理

如果质量门不通过：

1. 不得声明任务完成。
2. 先定位是视觉、交互、数据、构建还是主题问题。
3. 只修复当前失败项。
4. 重新运行相关检查。
5. 如果连续修复导致范围扩大，回到最近 checkpoint。

---

## 11. 完成声明格式

最终汇报必须包含：

```text
完成内容：
- ...

验证：
- npm run build 通过
- 浏览器检查 ...
- 交互回归 ...

风险：
- ...

下一步：
- ...
```
