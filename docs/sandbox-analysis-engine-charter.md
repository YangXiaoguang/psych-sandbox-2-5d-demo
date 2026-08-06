# 独立沙盘心理分析引擎章程

版本：v1.0
日期：2026-08-05
阶段：Phase 6 受治理数据集与可复现实验已完成

## 1. 模块定位

模块暂定名为 `@psych-sandbox/analysis-engine`。它是一个可复用、可拆分、与 React、Konva、Three.js 和具体 LLM 厂商解耦的 TypeScript 分析模块。

模块用于验证大语言模型能否：

1. 准确读取并重建数字心理沙盘的客观状态；
2. 确定性提取空间、类别、显著性和有限过程特征；
3. 生成有证据支持、可被否定的候选心理主题；
4. 解释每个候选主题来自哪些事实和特征；
5. 生成开放、非诱导、适合专业访谈的追问；
6. 支持心理专家评分、修订、驳回和版本追踪。

本模块不是诊断系统、自动治疗系统、危机判定系统或心理测验计分系统。

## 2. 不可混淆的三层输出

```text
Fact 客观事实
  -> Feature 可复算特征
  -> Hypothesis 待确认心理假设
```

| 层级 | 允许内容 | 禁止内容 |
|---|---|---|
| Fact | 沙具、位置、类别、旋转、缩放、环境、九宫格、选中项 | 动机、人格、情绪、诊断 |
| Feature | 距离、密度、质心、边界距离、孤立度、显著度、类别比例 | 把统计特征直接解释为心理事实 |
| Hypothesis | 候选主题、证据、反证、替代解释、核实问题 | “说明用户一定……”“证明用户存在……” |

任何面向用户或专家的解释都必须能从 Hypothesis 回溯到 Feature，再回溯到 Snapshot 中的 JSON 路径或对象 ID。

## 3. 输入边界

Phase 1 首个支持的输入协议为：

```text
sandbox.current-snapshot.v1
```

允许读取：

- 当前沙盘画布与坐标系；
- 天气、光照等当前环境；
- 当前全部沙具及其位置、变换、占地和标签；
- 当前确定性场景统计；
- 当前选中对象。

默认禁止读取：

- 用户身份、联系方式和账号信息；
- 个人记忆、历史会话和历史作品；
- API Key 或任何密钥；
- 未经独立授权的截图、音视频和自由文本病史；
- 当前 Snapshot 之外的事件流。

## 4. 过程特征的真实性等级

当前 Snapshot 只有 `createdOrder`，因此过程特征必须标记：

```json
{
  "fidelity": "weak",
  "availableSignals": ["createdOrder"],
  "unavailableSignals": ["moveHistory", "deletionHistory", "dwellTime", "hesitation", "undoRedo"]
}
```

在没有事件流时，模块不得生成“反复移动”“犹豫很久”“最后删除”等过程结论。未来事件流必须作为独立、可选且单独授权的输入协议接入，不能扩宽当前 Snapshot 合同。

## 5. 候选主题最低证据规则

- 中、高置信候选主题至少需要两个相互独立的证据项。
- 单个沙具的 `symbolicCandidates` 只能形成低置信访谈线索。
- 每个候选主题必须包含至少一个替代解释。
- 缺少反向证据时必须明确写为“当前未发现”，不能写成“不存在”。
- 象征词典只能提供提问方向，不能作为固定含义表。
- 用户否认某个主题时，系统必须允许标记为 `rejected_by_user`，后续不得继续强化。

## 6. 公共接口目标

Phase 1 需要实现以下稳定入口：

```ts
validateSnapshot(input): ValidationResult
reconstructScene(snapshot): ReconstructedScene
extractFeatures(scene): FeatureBundle
analyze(input, options): Promise<SandboxAnalysisResult>
submitExpertReview(review): Promise<ExpertReviewRecord>
applyExpertRevision(analysis, revision): RevisedAnalysisResult
```

核心包只依赖端口接口：

```text
LlmPort
KnowledgeBasePort
ReviewRepositoryPort
ClockPort
IdGeneratorPort
```

具体模型、数据库和网络调用放在 Adapter 中。

## 7. 版本与复现

每次分析必须记录：

- `snapshotId` 与 Snapshot SHA-256；
- Snapshot Schema 版本；
- 特征算法版本；
- 知识库版本；
- Prompt 模板版本；
- LLM 厂商与模型版本；
- 输出 Schema 版本；
- 专家量表版本；
- 分析时间与请求 ID。

相同 Snapshot、相同确定性算法版本必须生成相同 FeatureBundle。LLM 输出允许变化，但必须保留完整调用版本和结构化验证结果。

## 8. 人类监督与安全

- 输出统一称为“观察”“候选主题”“访谈线索”，不能称为诊断结果。
- 死亡、冲突、怪兽等沙具不能单独触发危机结论。
- 如果未来接入用户自由文本并出现直接危机表达，应交给独立安全协议处理，不能由沙具象征含义代替风险评估。
- 专家必须能够查看证据、评分、修订、驳回和导出差异。
- 未经专家接受的输出不得进入微调或正式评测金标准。

## 9. Phase 0 完成定义

- 模块目标、非目标、输入边界和禁止项已经冻结。
- 专家评分量表具备机器可读版本。
- 24 例校准集的采集结构和覆盖分层已经冻结。
- 不伪造专家标签；当前校准集状态明确为待采集。
- `npm run qa:analysis-spec` 能自动验证规格的一致性。

## 10. Phase 1 实现状态

- 独立包位置：`packages/sandbox-analysis-engine/`。
- 当前公开输入版本：`sandbox.current-snapshot.v1`。
- 已提供 Snapshot、分析结果、专家复核三份 JSON Schema。
- 已提供确定性运行时校验，包括对象 ID、引用、聚合计数和深度顺序一致性。
- 已提供显式迁移注册表；无版本数据与无迁移路径数据会被拒绝。
- 已提供 `createSandboxAnalysisEngine()` 公共入口。
- 包内不依赖 React、Konva、Three.js、DOM 或任何 LLM SDK。
- Phase 1 不生成心理假设；下一阶段只实现确定性重建、特征与证据图。

详细说明见 `docs/sandbox-analysis-engine-phase-1.md`，自动验收命令为：

```bash
npm run qa:analysis-engine
```

## 11. Phase 2 实现状态

- `reconstructScene()` 把已校验 Snapshot 转换为规范排序、深度冻结的场景。
- 对象关系使用归一化放置点计算，不使用单位不稳定的 `footprint`。
- `extractFeatures()` 输出版本化 FeatureBundle 和 Fact/Feature Evidence Graph。
- 已实现空间分布、投影面积、类别、风险标签、对象邻域、视觉构图显著度、对象对关系和创建顺序特征。
- 所有特征包含 `method`、`interpretiveLimit`、`objectIds` 和 `evidenceIds`。
- `createdOrder` 相关特征统一标记为 `weak`，不推断移动、删除、停留、犹豫或撤销。
- 同一 Snapshot 和算法版本输出经过规范排序与六位小数归一，可进行字节级回归比较。
- 单元测试覆盖空场景、规范排序、关系分带、显著度、证据图完整性、不可变性和重复性。

详细说明见 `docs/sandbox-analysis-engine-phase-2.md`：

```bash
npm run qa:analysis-features
```

## 12. Phase 3 实现状态

- 新增厂商无关 `LlmPort`，核心包不依赖任何模型 SDK、网络框架或密钥系统。
- LLM 只能返回 `sandbox.hypothesis-draft.v1`，该协议不包含 Fact 或 Feature 字段。
- Prompt Context 只消费 Phase 2 场景、特征和证据图；不包含原始 Snapshot、身份、记忆、事件、图像或密钥。
- 模型引用的每个证据 ID 和候选主题 ID 都必须在本次上下文存在。
- 中、高置信候选主题至少需要两个不同证据 ID；单一资产象征元数据只能形成低置信线索。
- 诊断、危机确定性、人格确定性、诱导式问题和无事件依据的过程描述会被运行时拒绝。
- 最终 `sandbox.analysis-result.v1` 的事实、特征、证据图、审计字段和 guardrails 全部由核心包组装，LLM 无法回写。
- Snapshot 使用规范 JSON 和纯 TypeScript SHA-256 生成可复现审计哈希。

详细说明见 `docs/sandbox-analysis-engine-phase-3.md`：

```bash
npm run qa:analysis-hypotheses
```

## 13. Phase 4 实现状态

- 新增可版本化 `SafetyPolicy` 和可组合 `SafetyRule`，与草稿结构校验器解耦。
- 每段模型文本都关联 JSON Pointer、Evidence IDs 和 Hypothesis IDs。
- 核心策略区分 `allow`、`review`、`block`，并记录严重度、命中规则和处置原因。
- 诊断、危机推断、人格确定性、诱导问题、无依据过程陈述、对象/空间/语义证据越界、象征过度解释和证据冲突具备独立规则。
- 自定义规则支持追加或完整替换；规则异常时 fail-closed。
- 新生成的成功分析结果包含 `sandbox.safety-evaluation.v1` 审计报告；被阻断草稿返回 `stage: safety`。
- 中英文红队语料和单元测试覆盖允许、人工复核和阻断三条路径。

详细说明见 `docs/sandbox-analysis-engine-phase-4.md`：

```bash
npm run qa:analysis-safety
```

## 14. Phase 5 实现状态

- 新增 `ExpertReviewWorkflow`，把评分、修订、仲裁和导出封装为厂商无关领域接口。
- 专家复核同时绑定分析结果 SHA-256 与 Prompt Context SHA-256，防止复核对象或证据上下文被替换。
- 加权分、关键维度阈值、自动驳回和最终状态由核心计算，不接受 UI 手填最终结论。
- 修订白名单只包含候选主题和访谈问题；Fact、Feature、Evidence、Guardrails 与 Safety Report 不可修改。
- 每版修订重新执行 Phase 3 结构/证据校验和 Phase 4 安全策略，并保留父版本、前后哈希和字段差异。
- Gold 候选至少需要两名独立专家接受同一最终版本，并由未参与评分的第三方完成仲裁。
- 不满足准入条件的记录仍可导出，但必须携带明确的 `goldIneligibilityReasons`。
- 内存仓库用于测试与原型，生产持久化通过 `ReviewRepositoryPort` 注入。

详细说明见 `docs/sandbox-analysis-engine-phase-5.md`：

```bash
npm run qa:analysis-review
```

## 15. Phase 6 实现状态

- 新增 `EvaluationDatasetService`，统一执行脱敏案例准入、分区防泄漏、目标计划核对、冻结和撤回。
- 案例必须绑定同一 Snapshot SHA-256、Gold 合格复核包和仲裁最终分析哈希。
- `deidentified_real` 来源必须提供同意记录与伦理审批引用；所有案例固定 `trainingUseAllowed: false`。
- 同一 `sourceGroupId` 不得跨 `train/dev/test`，避免同一作品或同一来源的变体污染评测。
- 冻结数据集使用规范 JSON 生成稳定哈希；测试分区只把 Snapshot 暴露给模型执行端。
- 自动指标只检查场景、特征、证据、问题结构和安全边界，`automatedPsychologicalCorrectness` 永远为 `null`。
- 横向报告包含模型版本、Prompt/Adapter/知识库版本、运行种子、完成率、工程指标和专家一致性。
- Snapshot 哈希撤回优先于冻结状态；撤回生成不可变 tombstone，并使旧冻结数据集失效。

详细说明见 `docs/sandbox-analysis-engine-phase-6.md`：

```bash
npm run qa:analysis-dataset
```
