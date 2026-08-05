# 沙盘心理分析引擎 Phase 2 工程说明

版本：v1.0

日期：2026-08-05

算法版本：`sandbox.feature-algorithm.v1`

## 1. 数据链路

```text
CurrentSandboxSnapshotV1
  -> Phase 1 校验/迁移
  -> ReconstructedSceneV1
  -> FeatureBundleV1
  -> EvidenceGraphV1 (Fact -> Feature)
```

Phase 2 是纯确定性计算，不调用 LLM、不读取个人身份或记忆、不生成心理主题。

## 2. 场景重建

`reconstructScene(snapshot)` 执行以下操作：

- 对象按 ID 升序规范排列；
- 深度顺序按 `depthRank + objectId` 排列；
- 创建顺序按 `createdOrder + objectId` 排列；
- 旋转角归一到 `[0, 360)`；
- 坐标、尺寸和派生数值统一保留六位小数；
- 每两个对象生成一条规范关系；
- 重新计算九宫格、类别、风险、中心和边界聚合；
- 对完整结果执行深度冻结。

对象对关系使用归一化放置点：

```text
distance = sqrt((x2Norm-x1Norm)^2 + (y2Norm-y1Norm)^2)
near     = distance <= 0.18
middle   = 0.18 < distance <= 0.38
far      = distance > 0.38
```

方向采用画布坐标的八方向分类，Y 轴向下。

## 3. Footprint 限制

真实样本中 `footprint` 同时出现模型单位和近似像素单位，Snapshot v1 没有单位字段。因此 Phase 2：

- 完整保留 footprint 原值；
- 标记 `measurementPolicy=preserved-only`；
- 禁止用 footprint 计算物理距离、碰撞、包围盒或占地比例；
- 空间关系只使用 `xNorm/yNorm`；
- 投影面积只使用 `transform.width/height/scale + canvas`。

未来如需物理占地，必须升级 Snapshot Schema 并声明单位，不能静默修改 v1 算法。

## 4. 特征清单

| 范围 | 特征 | 计算方式 | 解释限制 |
|---|---|---|---|
| 场景 | 质心 | 归一化位置算术平均 | 只描述构图中心。 |
| 场景 | 离散度 | 到质心的 RMS 距离除以 `sqrt(2)` | 不等同心理分散。 |
| 场景 | 中心/边界/占区比例 | 计数除以对象数或九宫格数 | 不解释人格或情绪。 |
| 场景 | 水平/垂直平衡 | `1-两侧计数差/对象总数` | 仅为构图平衡。 |
| 场景 | 投影面积总和 | 每个对象投影矩形比例求和 | 不消除重叠，不是物理占地。 |
| 类别 | 类别分布 | 类别计数与比例 | 不能直接转为心理主题。 |
| 风险 | 风险标签分布 | 资产 riskTag 计数与比例 | 不是用户风险评估。 |
| 对象 | 中心/边界接近度 | 到中心和最近边界的归一化距离 | 不解释心理中心或防御。 |
| 对象 | 最近邻/邻居数/孤立度 | 放置点距离与 0.18 阈值 | 不代表现实关系亲疏。 |
| 对象 | 视觉构图显著度 | 面积 0.45 + 中心接近 0.35 + 缩放 0.20 | 不是心理重要性。 |
| 关系 | 距离/方向/分带 | 对象对归一化几何计算 | 不表示心理因果。 |
| 过程 | 创建顺序百分位 | `createdOrder` 规范排序 | `weak`，不是完整过程。 |

选中状态仅保存为 `selectedOperationFocus`，不参与视觉显著度指数。

## 5. 证据图谱

Evidence Graph 当前只有两类节点：

```text
Fact 节点
  <- derived_from -
Feature 节点
```

Fact 节点保存：

- Snapshot JSON Pointer 路径；
- 相关对象 ID；
- 客观字段值；
- 证据真实性等级。

Feature 节点保存确定性结果。每条 Feature 必须至少连接一个已存在 Fact；缺失证据节点时构建立即失败。Hypothesis 节点属于 Phase 3，不允许在 Phase 2 出现。

## 6. 公共 API

```ts
const engine = createSandboxAnalysisEngine();
const result = engine.analyzeDeterministically(input);

if (result.ok) {
  result.value.scene;
  result.value.featureBundle.features;
  result.value.featureBundle.evidenceGraph;
}
```

也可使用纯函数：

```ts
const scene = reconstructScene(validatedSnapshot);
const featureBundle = extractFeatures(scene);
```

## 7. 输出协议

- `sandbox.reconstructed-scene.v1`
- `sandbox.feature-bundle.v1`
- `sandbox.evidence-graph.v1`
- `sandbox.feature-algorithm.v1`

对应 JSON Schema 位于 `packages/sandbox-analysis-engine/schemas/`。

## 8. 确定性与测试

确定性策略：

- 不读取当前时间、随机数、网络或 LLM；
- 对象、关系、节点、边和特征均按稳定 ID 排序；
- 字符串排序使用固定 JavaScript 二进制词法比较，不依赖系统 locale/ICU；
- 浮点数统一六位小数；
- 输出深度冻结；
- 算法阈值和权重随 FeatureBundle 一起输出。

自动验收：

```bash
npm run qa:analysis-engine
npm run qa:analysis-features
```

单元测试覆盖 9 类行为：规范重建、已知公式、邻近阈值、显著度选中隔离、弱过程边界、图谱完整性、字节稳定性、空场景和 Phase 1 校验不可绕过。

## 9. Phase 3 输入边界

Phase 3 只能读取 Phase 2 的 Scene、FeatureBundle 和 Evidence Graph。LLM 生成的候选主题：

- 只能引用现有 evidence ID；
- 不能回写或修改 Fact/Feature；
- 不能把 visual salience、riskTag、symbolicCandidates 当成诊断；
- 不能虚构 Snapshot 不存在的过程行为；
- 必须提供替代解释和开放式核实问题。
