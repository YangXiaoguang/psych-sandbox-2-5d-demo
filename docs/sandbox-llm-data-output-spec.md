# 当前沙盘 Snapshot 输出规范（简版）

版本：v1.4
适用对象：前端、LLM 调用层、后续后端 API
代码实现：`src/llm/currentSandboxSnapshot.ts`
API 契约：`POST /api/llm/current-sandbox-snapshot`
验证命令：`npm run qa:snapshot-contract`

## 目标

向 LLM 只发送一份“当前沙盘这一刻的完整状态”。

这份数据只回答三个问题：

1. 当前沙盘环境是什么？
2. 当前有哪些沙具，它们在哪里、是什么状态？
3. 当前空间分布统计是什么？

## 当前不输出

第一版明确不输出以下内容：

| 不输出内容 | 说明 |
|---|---|
| 事件流 | 不包含新增、移动、删除等历史过程。 |
| 个人信息 | 不包含姓名、账号、年龄、身份等用户资料。 |
| 个人记忆 | 不包含长期记忆、历史会话、历史作品。 |
| 授权上下文 | 不包含 consent、scope、权限边界。 |
| 图片截图 | 不包含 PNG、base64、canvas 图像。 |

## 输出对象

统一输出一个 JSON 对象：

```ts
CurrentSandboxSnapshot
```

前端 Mock API 会用以下响应包装：

```ts
ApiResponseDto<CurrentSandboxSnapshotResponseDto>
```

其中 `data.snapshot` 就是完整的 `CurrentSandboxSnapshot`。

## 顶层字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `schemaVersion` | string | Snapshot 数据结构版本，固定为 `sandbox.current-snapshot.v1`。 |
| `snapshotId` | string | 本次快照 ID，用于追踪和排查。 |
| `generatedAt` | string | 快照生成时间，ISO 8601 格式。 |
| `source` | string | 数据来源，固定为 `current_sandbox`。 |
| `canvas` | object | 沙盘尺寸与坐标系。 |
| `environment` | object | 当前天气与光照。 |
| `objects` | array | 当前沙盘上的全部沙具。 |
| `analysis` | object | 当前空间统计结果。 |
| `selectedObjectId` | string/null | 当前选中沙具 ID；未选中为 `null`。 |

## canvas

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `width` | number | 沙盘逻辑宽度。 |
| `height` | number | 沙盘逻辑高度。 |
| `coordinateSystem` | string | 坐标系，固定为 `board-pixel`。 |
| `normalizedCoordinateSystem` | string | 归一化坐标系，固定为 `0-1`。 |
| `guides` | string[] | 当前支持的空间辅助能力。 |

## environment

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `weather` | string | 天气枚举：`sunny`、`cloudy`、`rainy`。 |
| `weatherLabel` | string | 天气中文名。 |
| `light` | string | 光照枚举：`day`、`night`。 |
| `lightLabel` | string | 光照中文名。 |

## objects

每个沙具对象都包含以下字段：

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `id` | string | 沙具实例 ID。 |
| `assetId` | string | 沙具资产 ID。 |
| `name` | string | 沙具名称。 |
| `category` | string | 沙具分类。 |
| `riskTag` | string | 风险标签：`normal`、`conflict`、`death`、`fantasy`。 |
| `riskLabel` | string | 风险标签中文名。 |
| `symbolicCandidates` | string[] | 象征候选词，只作开放式提问线索。 |
| `semanticTags` | string[] | 语义标签。 |
| `position` | object | 位置、九宫格、中心/边界、深度排序。 |
| `transform` | object | 旋转、缩放和显示尺寸。 |
| `footprint` | object | 占地类型与空间尺寸提示。 |
| `createdOrder` | number | 当前对象的创建顺序。 |

### position

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `x` / `y` | number | 沙盘像素坐标。 |
| `xNorm` / `yNorm` | number | 归一化坐标，范围 0 到 1。 |
| `zone` | string | 九宫格区域 ID。 |
| `zoneLabel` | string | 九宫格区域中文名。 |
| `inCenter` | boolean | 是否在中心区域。 |
| `inBoundary` | boolean | 是否在边界区域。 |
| `depthRank` | number | y 轴深度排序名次。 |

### transform

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `rotationDeg` | number | 旋转角度，单位为度。 |
| `scale` | number | 缩放比例。 |
| `width` | number | 当前显示宽度。 |
| `height` | number | 当前显示高度。 |

### footprint

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `kind` | string | 占地类型：`compact`、`wide`、`tall`、`flat`。 |
| `width` | number | 占地宽度提示。 |
| `depth` | number | 占地深度提示。 |
| `height` | number | 高度提示。 |

## analysis

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `totalObjects` | number | 沙具总数。 |
| `centerCount` | number | 中心区沙具数量。 |
| `boundaryCount` | number | 边界区沙具数量。 |
| `zoneCounts` | array | 九宫格各区域数量。 |
| `categoryCounts` | array | 各分类数量。 |
| `riskCounts` | array | 各风险标签数量。 |
| `emptyZones` | string[] | 当前为空的九宫格区域 ID。 |
| `depthOrder` | string[] | 按 y 坐标排序后的沙具 ID。 |
| `summaryText` | string | 给 LLM 快速阅读的摘要。 |

## 完整 JSON 示例

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
    "zoneCounts": [
      { "id": "top-center", "label": "上中", "count": 1 }
    ],
    "categoryCounts": [
      { "id": "建筑与环境", "label": "建筑与环境", "count": 1 }
    ],
    "riskCounts": [
      { "id": "normal", "label": "常规", "count": 1 }
    ],
    "emptyZones": ["top-left", "top-right", "middle-left"],
    "depthOrder": ["obj_house_001"],
    "summaryText": "当前沙盘共有 1 个沙具，中心区 0 个，边界区 0 个。"
  },
  "selectedObjectId": "obj_house_001"
}
```

## 给 LLM 的最短提示词

```text
你将收到 CurrentSandboxSnapshot。请只基于当前沙盘状态进行温和、开放式回应。
不要引用事件流、个人记忆、用户身份或授权信息，因为本次输入不包含这些内容。
象征候选词只能用于提问和探索，不能作为诊断结论。
```
