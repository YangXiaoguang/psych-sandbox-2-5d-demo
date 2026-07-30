# 当前沙盘 Snapshot 输出规范

版本：v1.2
更新日期：2026-07-31  
代码实现：`src/llm/currentSandboxSnapshot.ts`

## 一句话说明

发给 LLM 的数据只包含“当前沙盘这一刻是什么样子”。
第一版不包含事件流、个人记忆、授权上下文、用户身份、API Key 或截图。

## 输出对象

```ts
CurrentSandboxSnapshot
```

## 顶层字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `schemaVersion` | string | 数据结构版本，固定为 `sandbox.current-snapshot.v1`。 |
| `snapshotId` | string | 本次快照 ID，用于排查日志。 |
| `generatedAt` | string | 快照生成时间，ISO 8601 格式。 |
| `source` | string | 数据来源，固定为 `current_sandbox`。 |
| `canvas` | object | 沙盘画布与坐标系信息。 |
| `environment` | object | 当前天气与光照。 |
| `objects` | array | 当前沙盘上的全部沙具。 |
| `analysis` | object | 当前沙盘的空间统计结果。 |
| `selectedObjectId` | string/null | 当前选中的沙具 ID，没有选中则为 `null`。 |

## canvas 字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `width` | number | 沙盘逻辑宽度。 |
| `height` | number | 沙盘逻辑高度。 |
| `coordinateSystem` | string | 原始坐标系，固定为 `board-pixel`。 |
| `normalizedCoordinateSystem` | string | 归一化坐标系，固定为 `0-1`。 |
| `guides` | string[] | 可用于分析的辅助能力，例如九宫格、中心区、边界区、y 深度排序。 |

## environment 字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `weather` | string | 天气枚举：`sunny`、`cloudy`、`rainy`。 |
| `weatherLabel` | string | 天气中文名：晴天、阴天、雨天。 |
| `light` | string | 光照枚举：`day`、`night`。 |
| `lightLabel` | string | 光照中文名：白天、黑夜。 |

## objects 字段

每个沙具对象包含：

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `id` | string | 沙盘中这个沙具实例的唯一 ID。 |
| `assetId` | string | 沙具资产 ID。 |
| `name` | string | 沙具名称。 |
| `category` | string | 沙具分类。 |
| `riskTag` | string | 资产风险标签：`normal`、`conflict`、`death`、`fantasy`。 |
| `riskLabel` | string | 风险标签中文名。 |
| `symbolicCandidates` | string[] | 象征候选词，只能作为开放式探索线索。 |
| `semanticTags` | string[] | 语义标签，用于摘要和检索。 |
| `position` | object | 位置、九宫格区域、中心区、边界区和深度排序。 |
| `transform` | object | 旋转、缩放、宽度和高度。 |
| `footprint` | object | 占地类型与空间尺寸提示。 |
| `createdOrder` | number | 当前对象按创建时间推导出的摆放顺序。 |

### position 字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `x` / `y` | number | 沙盘像素坐标。 |
| `xNorm` / `yNorm` | number | 归一化坐标，范围 0 到 1。 |
| `zone` | string | 九宫格区域 ID。 |
| `zoneLabel` | string | 九宫格区域中文名。 |
| `inCenter` | boolean | 是否位于中心区域。 |
| `inBoundary` | boolean | 是否位于边界区域。 |
| `depthRank` | number | y 深度排序名次，数值越大越靠前。 |

### transform 字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `rotationDeg` | number | 旋转角度，单位为度。 |
| `scale` | number | 缩放比例。 |
| `width` | number | 当前显示宽度。 |
| `height` | number | 当前显示高度。 |

### footprint 字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `kind` | string | 占地类型：`compact`、`wide`、`tall`、`flat`。 |
| `width` | number | 占地宽度提示。 |
| `depth` | number | 占地深度提示。 |
| `height` | number | 高度提示。 |

## analysis 字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `totalObjects` | number | 沙具总数。 |
| `centerCount` | number | 中心区沙具数量。 |
| `boundaryCount` | number | 边界区沙具数量。 |
| `zoneCounts` | array | 九宫格各区域数量。 |
| `categoryCounts` | array | 各沙具分类数量。 |
| `riskCounts` | array | 各风险标签数量。 |
| `emptyZones` | string[] | 当前为空的九宫格区域 ID。 |
| `depthOrder` | string[] | 按 y 坐标深度排序后的对象 ID。 |
| `summaryText` | string | 给人和 LLM 快速阅读的当前状态摘要。 |

## 示例

```json
{
  "schemaVersion": "sandbox.current-snapshot.v1",
  "snapshotId": "snapshot_20260731_103000_abc123",
  "generatedAt": "2026-07-31T10:30:00+08:00",
  "source": "current_sandbox",
  "canvas": {
    "width": 960,
    "height": 640,
    "coordinateSystem": "board-pixel",
    "normalizedCoordinateSystem": "0-1",
    "guides": ["nine-grid", "center-region", "boundary-region", "y-depth-sort"]
  },
  "environment": {
    "weather": "rainy",
    "weatherLabel": "雨天",
    "light": "night",
    "lightLabel": "黑夜"
  },
  "objects": [
    {
      "id": "obj_house_001",
      "assetId": "env_house",
      "name": "房子",
      "category": "建筑与环境",
      "riskTag": "normal",
      "riskLabel": "常规",
      "symbolicCandidates": ["家庭", "安全", "归属"],
      "semanticTags": ["建筑", "容器", "安全感"],
      "position": {
        "x": 293,
        "y": 170,
        "xNorm": 0.305,
        "yNorm": 0.266,
        "zone": "top-center",
        "zoneLabel": "上中",
        "inCenter": false,
        "inBoundary": false,
        "depthRank": 2
      },
      "transform": {
        "rotationDeg": -3,
        "scale": 1.35,
        "width": 112,
        "height": 76
      },
      "footprint": {
        "kind": "wide",
        "width": 1.2,
        "depth": 0.9,
        "height": 0.8
      },
      "createdOrder": 1
    }
  ],
  "analysis": {
    "totalObjects": 1,
    "centerCount": 0,
    "boundaryCount": 0,
    "zoneCounts": [{ "id": "top-center", "label": "上中", "count": 1 }],
    "categoryCounts": [{ "id": "建筑与环境", "label": "建筑与环境", "count": 1 }],
    "riskCounts": [{ "id": "normal", "label": "常规", "count": 1 }],
    "emptyZones": ["top-left", "top-right", "middle-left"],
    "depthOrder": ["obj_house_001"],
    "summaryText": "当前沙盘共有 1 个沙具，中心区 0 个，边界区 0 个。"
  },
  "selectedObjectId": "obj_house_001"
}
```

## LLM 使用边界

- 只能基于这个 snapshot 讨论“当前画面”。
- 不要推断用户真实身份、历史记忆或授权信息。
- 不要说“刚才你先放了什么”，因为第一版没有事件流。
- 象征候选词只能用于开放式提问，不能当作诊断结论。
