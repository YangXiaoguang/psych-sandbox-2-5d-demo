# 沙盘心理分析引擎 Phase 1 工程说明

版本：v1.0

日期：2026-08-05

包名：`@psych-sandbox/analysis-engine`

## 1. 本阶段目标

Phase 1 建立可复用的分析引擎输入层。它把应用输出的当前沙盘 Snapshot 变成经过版本识别、迁移和校验的可信数据，再交给后续重建与分析阶段。

本阶段不调用 LLM，也不输出心理解释。

```text
未知 JSON
  -> 读取 schemaVersion
  -> 执行已注册迁移
  -> 结构校验
  -> 引用与统计一致性校验
  -> CurrentSandboxSnapshotV1
```

## 2. 目录结构

```text
packages/sandbox-analysis-engine/
├── src/
│   ├── contracts/       # Snapshot、分析结果、专家复核和错误合同
│   ├── migrations/      # 显式版本迁移注册表
│   ├── validation/      # 确定性运行时校验
│   ├── engine.ts        # 公共 facade
│   └── index.ts         # 唯一包导出入口
├── schemas/             # Draft 2020-12 JSON Schema
├── package.json
└── README.md
```

## 3. 公共 API

```ts
import { createSandboxAnalysisEngine } from "@psych-sandbox/analysis-engine";

const engine = createSandboxAnalysisEngine();
const result = engine.parseSnapshot(input);

if (!result.ok) {
  // issues 使用 JSON Pointer path 定位字段。
  console.error(result.issues);
} else {
  // 后续阶段只接收这里的已校验 value。
  consume(result.value);
}
```

| API | 作用 |
|---|---|
| `validateSnapshot(input)` | 只校验当前 v1，不执行迁移。 |
| `migrateSnapshot(input)` | 按已注册迁移链升级并校验。 |
| `parseSnapshot(input)` | 应用和服务端推荐入口，等价于“迁移后校验”。 |
| `registerMigration(migration)` | 注册一条经过批准的确定性迁移。 |
| `listMigrations()` | 返回迁移元数据，不暴露实现细节。 |
| `getSupportedSnapshotVersions()` | 返回当前可接收的版本。 |

## 4. JSON Schema

| Schema | 用途 |
|---|---|
| `current-sandbox-snapshot.v1.schema.json` | 当前沙盘状态输入。 |
| `sandbox-analysis-result.v1.schema.json` | 后续分析结果输出合同。 |
| `expert-review.v1.schema.json` | 专家评分、修订和驳回合同。 |

Schema 使用 JSON Schema Draft 2020-12。Snapshot 根对象及主要嵌套对象禁止额外字段，避免上游静默扩大个人信息或事件流边界。

## 5. 运行时校验

除字段类型和范围外，还检查：

- 沙具实例 ID 唯一；
- `selectedObjectId` 必须引用当前沙具；
- `depthOrder` 不重复且覆盖全部沙具；
- `totalObjects` 等于沙具数量；
- 九宫格、类别和风险计数总和等于沙具数量；
- 标准光照、风险、占地和九宫格值合法；
- 扩展天气保留兼容性，但输出 warning 提醒业务适配。

所有问题包含 `code`、`severity`、`path` 和中文 `message`。`path` 使用 JSON Pointer，可直接映射到管理工具、日志和专家检查界面。

## 6. 版本迁移规则

迁移必须显式注册：

```ts
engine.registerMigration({
  fromVersion: "sandbox.current-snapshot.approved-legacy",
  toVersion: "sandbox.current-snapshot.v1",
  description: "已批准的历史字段映射",
  migrate: migrateApprovedLegacySnapshot,
});
```

规则：

- 无 `schemaVersion` 的数据直接拒绝，禁止猜测。
- 没有可达迁移路径的数据直接拒绝。
- 每条已执行迁移记录在 `appliedMigrations` 中。
- 迁移完成后必须再次通过当前版本校验。
- 迁移函数不得调用 LLM、网络或当前时间，确保可复现。

## 7. 包边界

允许依赖：TypeScript 标准语言与纯函数工具。

禁止依赖：React、Konva、Three.js、DOM、localStorage、数据库客户端和 LLM SDK。

因此同一包可用于：

- 当前 Vite 前端的导入校验；
- Node API 服务；
- 队列 Worker；
- 离线研究工具；
- 专家标注和回放程序。

## 8. 验收与下一步

```bash
npm run build
npm run qa:analysis-spec
npm run qa:analysis-engine
npm run qa:snapshot-contract
```

Phase 2 将新增确定性 `reconstructScene()`、`extractFeatures()` 和 Evidence Graph。它们只能消费 Phase 1 已校验的 Snapshot，并继续保持 Fact、Feature、Hypothesis 三层分离。
