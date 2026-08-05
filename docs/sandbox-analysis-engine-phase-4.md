# 沙盘心理分析引擎 Phase 4 工程说明

版本：v1.0  
日期：2026-08-05  
模块：`@psych-sandbox/analysis-engine` v0.4.0

## 1. 阶段目标

Phase 4 在 Phase 3 的结构、引用和置信度校验之后增加独立安全策略层。它不替代心理专家，也不尝试用关键词完成心理诊断；它负责在模型草稿进入正式分析结果前，提供确定性、可版本化、可审计的最低安全质量门。

本阶段解决五类工程问题：

1. 把散落在草稿校验器中的语言规则拆成可组合 `SafetyRule`；
2. 区分 `allow`、`review`、`block`，避免所有问题只有通过/失败两种结果；
3. 检查对象、空间、语义和过程陈述是否得到所引用证据支持；
4. 保存规则 ID、规则版本、严重度、命中路径、命中文本、证据和候选主题引用；
5. 通过中英文红队语料建立可重复回归基线。

## 2. 数据流

```text
Phase 2 Fact / Feature / Evidence Graph
  -> Phase 3 LLM Hypothesis Draft
  -> 结构、引用、置信度校验
  -> 文本片段采集（JSON Pointer + Evidence IDs）
  -> Versioned SafetyPolicy
  -> allow  : 生成分析结果
  -> review : 生成分析结果，并附专家复核提示
  -> block  : 返回 safety 阶段错误，不生成分析结果
```

安全策略不读取原始 Snapshot、用户身份、记忆、事件流、截图或 API Key。它只消费已经受约束的 `SandboxHypothesisDraftV1` 和 `HypothesisPromptContextV1`。

## 3. 模块结构

```text
packages/sandbox-analysis-engine/
  src/contracts/safety.ts
  src/safety/collectTextSegments.ts
  src/safety/rules.ts
  src/safety/createSafetyPolicy.ts
  schemas/safety-evaluation.v1.schema.json
  tests/safety-policy.test.mjs
  tests/red-team/safety-corpus.v1.json
```

| 文件 | 职责 |
|---|---|
| `contracts/safety.ts` | 安全规则、Finding、Policy、Decision 和 Evaluation Report 公共合同。 |
| `collectTextSegments.ts` | 把候选主题、解释、限制、问题和 warning 转成带 JSON Pointer 的统一片段。 |
| `rules.ts` | 核心诊断、危机、确定性、过程、诱导、证据支持、象征过度解释和证据冲突规则。 |
| `createSafetyPolicy.ts` | 组合规则，执行 fail-closed，规范化 Finding，计算严重度和最终处置。 |
| `safety-evaluation.v1.schema.json` | 可持久化安全审计结果的 JSON Schema。 |
| `safety-corpus.v1.json` | 不含真实用户数据的中英文攻击与边界表达。 |

## 4. 公共 API

```ts
const policy = createSandboxSafetyPolicy();
const report = policy.evaluate(draft, promptContext);

report.decision;       // allow | review | block
report.policyVersion;  // sandbox.safety-policy.core.v1
report.findings;       // 规则、严重度、路径、命中文本和证据
```

机构可以追加规则：

```ts
const policy = createSandboxSafetyPolicy({
  version: "organization.safety.v1",
  rules: [organizationRule],
  ruleMode: "append",
});
```

也可以使用 `replace` 构建完整替代策略，但替代策略不能为空，规则 ID 不能重复。自定义规则抛出异常时策略会 fail-closed，生成 `critical + block` Finding，防止安全组件异常被静默绕过。

## 5. 处置与严重度

| Action | Analyzer 行为 | 典型场景 |
|---|---|---|
| `allow` | 继续生成结果 | 没有命中安全规则。 |
| `flag_for_review` | 继续生成结果，写入 warning 和安全报告 | 问题涉及 Snapshot 未提供的过程信息，需要专家确认提问方式。 |
| `block` | 返回 `stage: safety`，不生成结果 | 诊断、危机推断、人格确定性、诱导问题或证据越界。 |

严重度从低到高为 `info`、`warning`、`high`、`critical`。最终 `decision` 由最严格 Action 决定，不以严重度替代处置动作。

## 6. 核心规则

| 规则 | 默认结果 | 说明 |
|---|---|---|
| `core.diagnostic-claim` | critical / block | 禁止从沙盘输出临床诊断或疾病结论。 |
| `core.crisis-inference` | critical / block | 禁止从沙具或构图推断自伤、他伤或危机风险。 |
| `core.personality-certainty` | high / block | 禁止“证明、必然、一定说明”等确定性心理结论。 |
| `core.unsupported-process` | high / block 或 warning / review | 陈述不存在的移动、删除、停留、犹豫历史会阻断；开放询问过程会转人工复核。 |
| `core.leading-question` | high / block | 禁止预设原因、答案或心理结论的问题。 |
| `core.unsupported-evidence` | high / block | 对象、空间或语义陈述必须由相应证据节点支持。 |
| `core.symbolic-overreach` | high / block | 单一资产象征元数据不能被转换成确定心理结论。 |
| `core.evidence-conflict` | high / block 或 warning / review | 同一证据不能同时支持和反驳；问题证据应与关联主题保持关系。 |

否定式安全说明会被保留，例如“这不是抑郁症诊断”“不能据此判断自伤风险”。“不排除”不视为安全否定。

## 7. Evidence Entailment 边界

当前 entailment 是保守的确定性规则，不是通用自然语言推理模型：

- 文本点名某个现有沙具时，引用证据必须连接该对象；
- 文本陈述中心、边界、相邻、距离等空间关系时，必须引用空间 Feature 或位置 Fact；
- 文本复用资产 `symbolicCandidates` 或 `semanticTags` 时，必须引用对应对象的 `object.semantic-metadata`；
- 象征证据只能形成待用户解释的低置信线索，不能直接证明心理含义。

Phase 4 不声称这些规则可以判断所有中文或英文表达。其目标是提供可测试的最低保护层，并把不确定边界送入专家复核，而不是伪装成临床判断器。

## 8. 安全审计结果

成功的 Analyzer 结果总是包含 `safetyEvaluation`：

```json
{
  "schemaVersion": "sandbox.safety-evaluation.v1",
  "policyVersion": "sandbox.safety-policy.core.v1",
  "decision": "review",
  "maxSeverity": "warning",
  "evaluatedTextSegments": 9,
  "findings": [
    {
      "id": "safety:...",
      "ruleId": "core.unsupported-process",
      "ruleVersion": "1.0.0",
      "category": "unsupported_process_claim",
      "severity": "warning",
      "action": "flag_for_review",
      "path": "/interviewQuestions/0/text",
      "matchedText": "反复移动",
      "message": "...",
      "evidenceIds": ["feature:scene:spatial-distribution"],
      "hypothesisIds": ["hypothesis-1"]
    }
  ],
  "summary": { "allowCount": 0, "reviewCount": 1, "blockCount": 0 }
}
```

`SandboxAnalysisResultV1.safetyEvaluation` 在类型与 Schema 中保持 optional，以继续读取历史 v1 结果；由 v0.4.0 Analyzer 新生成的成功结果必定写入该字段。

## 9. 红队与自动验收

红队基线当前包含 26 条中英文样本，覆盖：

- 诊断和疾病标签；
- 危机与伤害风险推断；
- 人格/心理确定性；
- 无依据过程陈述；
- 诱导问题；
- 过程提问的人工复核分流；
- 否定式安全说明；
- 正常开放问题。

额外单元测试覆盖证据越界、象征过度解释、支持/反证冲突、自定义策略、重复规则、空策略、不可变报告和规则异常 fail-closed。

```bash
npm run qa:analysis-safety
```

本阶段测试语料是工程回归集，不是临床有效性数据，也不能替代 24 例专家校准集。

## 10. Phase 5 入口条件

Phase 5 在不改变 Phase 4 安全决策的前提下增加专家监督闭环：

1. 专家量表评分与逐项意见；
2. 候选主题和访谈问题修订；
3. 原始输出、修订稿和差异历史；
4. 双专家与仲裁状态；
5. 只允许已接受/已仲裁数据进入评测金标准；
6. 可导出的专家复核记录。
