# 独立沙盘心理分析引擎章程

版本：v1.0
日期：2026-08-05
阶段：Phase 0 规格冻结

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
