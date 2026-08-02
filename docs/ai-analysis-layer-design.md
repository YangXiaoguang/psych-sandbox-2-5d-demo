# AI 分析层设计与工程落地方案

版本：v1.0  
适用对象：前端工程、LLM 调用层、后续后端服务与算法模块

## 1. 设计结论

当前项目不应优先做“让 AI 看截图再分析”的图像识别路线。

原因很简单：沙盘编辑器已经掌握每个沙具的结构化状态，包括类型、位置、旋转、缩放、九宫格区域、风险标签和象征候选。直接从编辑器状态生成数据，比截图识别更稳定、更可解释，也更容易验收。

因此第一阶段 AI 分析层采用：

```text
CurrentSandboxSnapshot
  -> CurrentSandboxInsight
  -> LLM 对话与报告草稿
```

## 2. 分层职责

| 层级 | 输入 | 输出 | 职责 |
|---|---|---|---|
| 沙盘编辑器 | 用户摆放行为 | 当前对象状态 | 负责拖拽、移动、旋转、缩放、删除和舞台渲染。 |
| Snapshot 层 | 沙盘对象、环境、选中项 | `CurrentSandboxSnapshot` | 只表达当前沙盘状态，不包含事件流、个人记忆、截图或用户身份。 |
| Insight 层 | `CurrentSandboxSnapshot` | `CurrentSandboxInsight` | 确定性提取空间观察、关系线索、主题候选和开放问题。 |
| LLM 层 | Snapshot + Insight + 用户输入 | 温和回复 | 负责表达、追问和整理，不做诊断。 |

## 3. CurrentSandboxInsight 的定位

`CurrentSandboxInsight` 不是心理诊断结果，也不是模型预测结果。

它是从当前沙盘状态中派生出的“观察材料”：

- 哪些区域更集中。
- 哪些区域为空。
- 哪些沙具靠得较近。
- 哪些沙具相对独立。
- 当前选中沙具在哪里。
- 沙具语义标签中出现了哪些主题候选。
- 可以向用户提出哪些开放问题。

代码入口：

```ts
src/llm/currentSandboxInsight.ts -> buildCurrentSandboxInsight
```

LLM 注入入口：

```ts
src/llm/sandboxPromptContext.ts -> buildCurrentSnapshotPromptBlock
```

## 4. 输出边界

Insight 层必须遵守以下边界：

| 项目 | 规则 |
|---|---|
| 事件流 | 不读取、不输出。 |
| 个人记忆 | 不读取、不输出。 |
| 用户身份 | 不读取、不输出。 |
| 截图图像 | 不读取、不输出。 |
| 诊断结论 | 禁止输出。 |
| 象征解释 | 只能作为候选主题与开放问题。 |

允许输出：

- 空间分布。
- 关系距离。
- 区域密度。
- 选中对象上下文。
- 沙具标签候选主题。
- 引导式问题。

## 5. LLM 使用方式

LLM 可以使用：

```text
CurrentSandboxSnapshot JSON
CurrentSandboxInsight JSON
```

LLM 不可以假设：

- 用户过去发生了什么。
- 用户为什么这样摆放。
- 某个沙具一定代表某种心理含义。
- 当前作品能够支持诊断。

推荐回复方式：

```text
我先把它当作一个画面来陪你看，而不是急着解释。
我注意到……
也许可以从……开始聊。
如果这个说法不贴近你的感受，我们可以换一个角度。
```

## 6. 示例

输入来自当前 snapshot：

```json
{
  "objects": [
    { "name": "房子", "position": { "zoneLabel": "上中" }, "semanticTags": ["家庭", "安全感"] },
    { "name": "鱼", "position": { "zoneLabel": "下中" }, "symbolicCandidates": ["流动", "生命力"] }
  ]
}
```

派生 insight 示例：

```json
{
  "schemaVersion": "sandbox.current-insight.v1",
  "source": "derived_from_current_sandbox_snapshot",
  "observations": [
    {
      "kind": "zone-density",
      "title": "主要聚集区域",
      "detail": "上中是当前沙具最多的区域。"
    }
  ],
  "themeCandidates": [
    {
      "theme": "安全感",
      "sourceObjectNames": ["房子"],
      "reason": "来自语义标签和象征候选。"
    }
  ],
  "suggestedQuestions": [
    {
      "text": "如果先从房子开始看，它在这个位置给你的第一感觉是什么？"
    }
  ]
}
```

## 7. 后续阶段

| 阶段 | 目标 |
|---|---|
| Phase A | 已完成：基于当前 snapshot 派生 `CurrentSandboxInsight`。 |
| Phase B | 在右侧洞察面板增加“AI 观察材料”折叠区，展示可解释的观察与问题。 |
| Phase C | 让 Agent 对话引用 insight brief，减少直接读取长对象列表。 |
| Phase D | 后端化后，将 Snapshot 和 Insight 作为可版本化 DTO 保存。 |
| Phase E | 如确实需要图像识别，再把截图识别作为补充校验，而不是主数据源。 |

## 8. 验收要求

每次修改 AI 分析层后至少运行：

```bash
npm run build
npm run qa:snapshot-contract
```

验收标准：

- `CurrentSandboxSnapshot` 仍只包含当前状态。
- `CurrentSandboxInsight` 只从 snapshot 派生。
- LLM prompt 不注入事件流、个人记忆、用户身份或截图。
- 输出语言保持观察式、开放式，不做诊断。
