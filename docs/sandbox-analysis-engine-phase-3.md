# 沙盘心理分析引擎 Phase 3 工程说明

版本：v1.0  
日期：2026-08-05  
模块：`@psych-sandbox/analysis-engine` v0.3.0

## 1. 阶段目标

Phase 3 验证大语言模型能否在严格证据边界内生成：

1. 可核实的候选心理主题；
2. 与候选主题对应的受约束解释；
3. 至少一个替代解释；
4. 开放、非诱导的专业访谈追问；
5. 可追溯的模型、Prompt、知识库和 Snapshot 审计信息。

本阶段不把模型变成事实提取器。Fact、Feature 和 Evidence Graph 继续由 Phase 2 的确定性引擎生成，模型只能产生 Hypothesis 草稿。

## 2. 数据流

```text
CurrentSandboxSnapshotV1
  -> Phase 1 校验与迁移
  -> Phase 2 ReconstructedScene + FeatureBundle + EvidenceGraph
  -> Phase 3 HypothesisPromptContext
  -> 外部 LlmPort Adapter
  -> SandboxHypothesisDraftV1
  -> 结构、引用、置信度与语言校验
  -> SandboxAnalysisResultV1
```

失败发生在任何一步时返回结构化 `issues`，不会生成半有效分析结果。

## 3. 模块结构

```text
packages/sandbox-analysis-engine/
  src/contracts/hypothesis.ts
  src/hypotheses/buildPromptContext.ts
  src/hypotheses/createHypothesisAnalyzer.ts
  src/hypotheses/schema.ts
  src/hypotheses/validateDraft.ts
  src/internal/sha256.ts
  schemas/sandbox-hypothesis-draft.v1.schema.json
  tests/hypothesis-analysis.test.mjs
```

职责说明：

| 文件 | 职责 |
|---|---|
| `contracts/hypothesis.ts` | 公共端口、Prompt Context、草稿、错误和分析器类型。 |
| `buildPromptContext.ts` | 只从 Phase 2 输出构建模型上下文，并执行确定性关系裁剪。 |
| `createHypothesisAnalyzer.ts` | 编排校验、特征、模型调用、草稿校验和最终结果组装。 |
| `validateDraft.ts` | 严格结构校验与证据、置信度、访谈、安全基线校验。 |
| `schema.ts` | 提供给支持 Structured Output 的 Adapter 使用的响应 Schema。 |
| `sha256.ts` | 规范 JSON 序列化和跨 Node/浏览器的纯 TypeScript SHA-256。 |

## 4. 模型端口

核心包只定义：

```ts
interface LlmPort {
  generateStructured(request: LlmStructuredRequest): Promise<LlmStructuredResponse>;
}
```

Adapter 负责：

- 网络连接与超时；
- API Key 的安全读取；
- OpenAI-compatible、Anthropic、Gemini 等厂商协议转换；
- 重试、限流、熔断与调用计量；
- 把响应整理为 JSON 文本或已解析对象。

核心包负责：

- 生成受限 Prompt Context；
- 提供响应 JSON Schema；
- 验证模型输出；
- 组装可信的最终分析结果。

这种拆分使同一个引擎可以在浏览器 Demo、Node 服务、队列任务或测试环境复用。

## 5. Prompt Context 边界

`sandbox.hypothesis-context.v1` 只包含：

- 场景对象的最小识别信息；
- 当前环境与区域占用；
- Phase 2 Fact/Feature 证据节点；
- 特征值、真实性等级和解释限制；
- 当前过程证据可用/不可用信号；
- 本次允许引用的 evidence ID 白名单；
- 关系特征裁剪审计。

明确不包含：

- 原始 Snapshot 对象；
- 事件流；
- 个人身份；
- 个人记忆；
- 图像或截图；
- API Key。

对象对关系可能按 `relationFeatureLimit` 裁剪。排序规则为距离升序，再按稳定 ID 升序；省略数量写入 `contextPolicy.omittedRelationFeatures` 和最终 warnings。

## 6. 模型草稿协议

模型只能输出 `sandbox.hypothesis-draft.v1`：

```json
{
  "schemaVersion": "sandbox.hypothesis-draft.v1",
  "hypotheses": [],
  "interviewQuestions": [],
  "warnings": []
}
```

该协议故意不提供 `facts`、`features`、`evidenceGraph`、`audit` 或 `guardrails` 字段。任何额外字段都会触发 `LLM_OUTPUT_SCHEMA_INVALID`。

## 7. 运行时质量门

### 7.1 证据规则

- 所有 supporting、contradicting 和 question evidence ID 必须出现在本次上下文。
- 所有 question hypothesis ID 必须指向本次草稿中的候选主题。
- ID 数组必须非空且不能重复。
- 中、高置信候选主题至少需要两个不同 supporting evidence ID。
- 单一 `object.semantic-metadata` 只能支持低置信访谈线索。

### 7.2 置信度规则

| 数值 | 等级 |
|---|---|
| `0 <= confidence < 0.4` | `low` |
| `0.4 <= confidence < 0.75` | `medium` |
| `0.75 <= confidence <= 1` | `high` |

数值与等级不一致时返回 `CONFIDENCE_MISMATCH`，系统不会替模型静默修正。

### 7.3 访谈规则

- `leading` 必须为 `false`。
- 问题不能预设“是不是因为”“是否说明”“你一定”等结论。
- 每个候选主题至少包含一个核实问题。
- 每个独立访谈问题必须引用证据和候选主题。

### 7.4 基础安全规则

Phase 3 直接拒绝：

- 医疗诊断和疾病标签结论；
- 仅由沙具象征推出的自杀、暴力或危险结论；
- “证明”“必然”“可以断定”等人格/心理确定性表达；
- 当前 Snapshot 不支持的反复移动、删除、犹豫、停留、撤销或重做描述。

Phase 4 将继续把这些基础正则扩展为分层安全策略、严重度、红队语料和更完整的 unsupported-claim 检测。

## 8. 最终结果可信边界

`SandboxAnalysisResultV1` 由核心包组装：

- `evidence` 和 `features` 直接来自 Phase 2；
- `hypotheses` 和 `interviewQuestions` 来自已验证草稿；
- 所有候选主题初始状态固定为 `candidate`；
- guardrails 固定为非诊断、需要用户确认、临床使用需要专家复核；
- `snapshotHash` 使用规范 JSON 的 SHA-256；
- 记录 engine、feature algorithm、Prompt、知识库、provider 和 model 版本。

模型不能通过草稿修改上述字段。

## 9. 使用示例

```ts
const analyzer = createSandboxHypothesisAnalyzer({
  llm: providerAdapter,
  knowledgeBase: approvedGuidanceRepository,
  relationFeatureLimit: 48,
  temperature: 0.2,
  maxOutputTokens: 2400,
});

const result = await analyzer.analyze(snapshot);
if (!result.ok) {
  logger.warn({ stage: result.stage, issues: result.issues });
  return;
}

await analysisRepository.save(result.value);
```

生产 Adapter 必须放在核心包外，且不得把 API Key 写入 request metadata、日志或分析结果。

## 10. 自动验收

```bash
npm run qa:analysis-hypotheses
```

测试覆盖：

- 有效结构化草稿生成完整审计结果；
- 代码围栏 JSON 兼容；
- 非法 JSON 与 Adapter 失败；
- 模型注入 Fact/Feature；
- 不存在的 evidence/hypothesis 引用；
- 置信度分带与最低证据数；
- 单一象征元数据低置信上限；
- 诱导式问题；
- 诊断确定性语言；
- 无依据过程描述；
- 确定性关系裁剪；
- SHA-256 标准向量和规范 JSON 稳定性；
- 非法 Snapshot 不得触发模型调用。

## 11. Phase 4 入口条件

Phase 4 不重写 Phase 3 数据流，只增加可组合的安全策略：

1. `SafetyPolicy` 端口和规则版本；
2. unsupported claim 与 evidence entailment 检查；
3. 输出严重度、阻断与人工复核分流；
4. 中英文红队语料；
5. 安全决策审计；
6. 对专家可见的被拒绝原因。
