# 独立沙盘心理分析引擎 Phase 6

版本：`@psych-sandbox/analysis-engine 0.6.0`  
范围：受治理评测数据集、盲法模型运行、客观工程指标、专家一致性与数据撤回

## 1. 阶段目标

Phase 6 把 Phase 5 的专家复核包变成可审计、可冻结、可撤回的评测数据集，并支持多个模型版本在完全相同的输入上重复运行。

本阶段只用于评测与 Prompt 校准，不授权模型训练，不宣称临床验证，也不使用自动分数判断心理主题“是否真实”。

## 2. 核心链路

```text
Snapshot
  -> Phase 3/4 Analysis
  -> Phase 5 双专家 + 独立仲裁
  -> EvaluationCase admission
  -> train/dev/test group split
  -> frozen Dataset + SHA-256
  -> blind EvaluationSubject
  -> objective metrics
  -> BenchmarkReport + expert agreement
```

## 3. 数据治理门

每个案例必须同时满足：

1. Snapshot 通过当前运行时校验；
2. Snapshot ID、Snapshot hash、原分析和仲裁最终分析完全一致；
3. 至少两名独立专家接受同一最终分析，且存在独立仲裁；
4. 通过保守的身份、手机号、邮箱和密钥扫描；
5. 真实去身份案例具有同意记录与伦理审批引用；
6. 用途明确包含 `evaluation`，且 `trainingUseAllowed` 固定为 `false`；
7. 同一来源组不跨数据分区；
8. 具备可定位全部派生案例的撤回 Snapshot hash。

扫描器只是补充防线，不能替代人工去身份复核、同意管理和伦理审批。

## 4. 分区与层级

`partition` 和 `tier` 是两个独立维度：

- `partition`: `train | dev | test`，控制开发可见性和最终评测边界；
- `tier`: `gold | validation | challenge`，表达专家标注成熟度或挑战用途。

不能把 `gold` 等同于 `test`。Gold 案例可以位于不同分区，但模型执行端始终只收到 Snapshot，不收到 Gold 分析。

## 5. 自动指标边界

允许自动计算：

- Snapshot 绑定正确性；
- 场景摘要精确一致性；
- 确定性特征精确一致性；
- 证据引用可追溯率；
- 访谈问题结构有效率；
- 安全门通过率。

禁止自动计算：

- 心理主题真实性；
- 诊断准确率；
- 治疗效果；
- 危机风险概率。

因此指标合同固定包含：

```json
{ "automatedPsychologicalCorrectness": null }
```

## 6. 数据撤回

撤回以 Snapshot SHA-256 为定位键，删除同一 Snapshot 的全部评测案例并生成 `sandbox.data-revocation.v1` 记录。撤回权优先于数据集冻结；发生撤回后，原 dataset hash 不再代表当前有效数据，必须重新构建并冻结新版本。

## 7. 公共入口

```ts
createEvaluationDatasetService(options)
computeEvaluationDatasetHash(input)
scanEvaluationCasePrivacy(value)
createBenchmarkRunner(options)
computeObjectiveCaseMetrics(output, gold, snapshotHash)
computeExpertAgreement(dataset)
```

内存仓库只用于测试和原型。生产系统通过 `EvaluationDatasetRepositoryPort` 提供事务、授权、加密、备份和删除证明。

## 8. 验收

```bash
npm run qa:analysis-dataset
npm run qa:analysis-engine
npm run qa:analysis-spec
```

Phase 6 测试覆盖 Gold 伪造、Snapshot 篡改、隐私泄漏、真实案例缺少授权、重复案例、同源跨分区、未满足目标冻结、冻结后准入、撤回、模型盲测、模型失败、指标边界、排行榜、一致性和存储异常。

## 9. Phase 7 入口

下一阶段在冻结合同上增加运行编排与可观测交付：

1. 幂等评测任务和状态机；
2. 进度事件、取消、失败重试与恢复；
3. 运行/报告仓储端口；
4. 审计包导出、导入与哈希校验；
5. 任务级日志与不含敏感数据的可观测元数据；
6. 可替换后台队列和数据库 Adapter。
