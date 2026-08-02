# 当前沙盘 Snapshot 输出规范

版本：v1.8
适用对象：前端开发、LLM 调用层、后续后端接口

## 目标

给 LLM 只输出“当前沙盘这一刻的完整状态”。

本版本不输出：

- 事件流：不包含新增、移动、删除等历史过程。
- 个人信息
- 个人记忆：不包含长期记忆、历史会话或历史作品。
- 授权上下文
- 图片截图
- API Key

## 代码入口

```ts
src/api/currentSandboxSnapshotApi.ts -> createCurrentSandboxSnapshotPayload
```

LLM Prompt 入口：

```ts
src/llm/sandboxPromptContext.ts -> createSandboxSnapshotChatMessages
```

可选派生洞察：

```ts
src/llm/currentSandboxInsight.ts -> buildCurrentSandboxInsight
```

`CurrentSandboxInsight` 只由 `CurrentSandboxSnapshot` 派生，用来给 LLM 提供空间观察、对象关系、主题候选和开放问题。它不额外读取事件流、个人记忆、用户身份或截图。

验证命令：

```bash
npm run qa:snapshot-contract
```

## 顶层结构

```ts
CurrentSandboxSnapshot
```

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `schemaVersion` | string | Snapshot 结构版本，固定为 `sandbox.current-snapshot.v1`。 |
| `snapshotId` | string | 本次快照 ID，用于排查一次 LLM 调用使用了哪份数据。 |
| `generatedAt` | string | 快照生成时间，ISO 8601 格式。 |
| `source` | string | 数据来源，固定为 `current_sandbox`。 |
| `canvas` | object | 沙盘画布、坐标系和辅助线信息。 |
| `environment` | object | 当前天气和光照。 |
| `objects` | array | 当前沙盘上全部沙具实例。 |
| `analysis` | object | 当前沙盘的空间统计结果。 |
| `selectedObjectId` | string/null | 当前选中的沙具 ID；未选中时为 `null`。 |

## canvas

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `width` | number | 沙盘逻辑宽度。 |
| `height` | number | 沙盘逻辑高度。 |
| `coordinateSystem` | string | 坐标系，固定为 `board-pixel`。 |
| `normalizedCoordinateSystem` | string | 归一化坐标系，固定为 `0-1`。 |
| `guides` | string[] | 已启用的辅助能力，例如九宫格、中心区、边界区、y 深度排序。 |

## environment

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `weather` | string | 天气枚举：`sunny`、`cloudy`、`rainy`。 |
| `weatherLabel` | string | 天气中文名：晴天、阴天、雨天。 |
| `light` | string | 光照枚举：`day`、`night`。 |
| `lightLabel` | string | 光照中文名：白天、黑夜。 |

## objects

`objects` 是数组。每一项代表一个当前放在沙盘上的沙具。

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `id` | string | 沙具实例 ID。 |
| `assetId` | string | 沙具资产 ID。 |
| `name` | string | 沙具名称。 |
| `category` | string | 沙具分类。 |
| `riskTag` | string | 风险标签：`normal`、`conflict`、`death`、`fantasy`。 |
| `riskLabel` | string | 风险标签中文名。 |
| `symbolicCandidates` | string[] | 象征候选词，只能作为开放式提问线索。 |
| `semanticTags` | string[] | 语义标签。 |
| `position` | object | 位置、九宫格区域、中心/边界判断和深度排序。 |
| `transform` | object | 旋转、缩放和当前显示尺寸。 |
| `footprint` | object | 沙具占地形态提示。 |
| `createdOrder` | number | 当前对象创建顺序。 |

### object.position

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `x` / `y` | number | 沙盘像素坐标。 |
| `xNorm` / `yNorm` | number | 归一化坐标，范围 0 到 1。 |
| `zone` | string | 九宫格区域 ID。 |
| `zoneLabel` | string | 九宫格区域中文名。 |
| `inCenter` | boolean | 是否位于中心区域。 |
| `inBoundary` | boolean | 是否位于边界区域。 |
| `depthRank` | number | 按 y 坐标计算出的 2.5D 深度排序名次。 |

### object.transform

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `rotationDeg` | number | 旋转角度，单位为度。 |
| `scale` | number | 缩放比例。 |
| `width` | number | 当前显示宽度。 |
| `height` | number | 当前显示高度。 |

### object.footprint

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `kind` | string | 占地类型：`compact`、`wide`、`tall`、`flat`。 |
| `width` | number | 占地宽度提示。 |
| `depth` | number | 占地深度提示。 |
| `height` | number | 高度提示。 |

## analysis

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `totalObjects` | number | 当前沙具总数。 |
| `centerCount` | number | 中心区域沙具数量。 |
| `boundaryCount` | number | 边界区域沙具数量。 |
| `zoneCounts` | array | 九宫格各区域数量。 |
| `categoryCounts` | array | 各沙具分类数量。 |
| `riskCounts` | array | 各风险标签数量。 |
| `emptyZones` | string[] | 当前没有沙具的九宫格区域 ID。 |
| `depthOrder` | string[] | 按 y 坐标排序后的沙具 ID。 |
| `summaryText` | string | 给 LLM 快速阅读的当前状态摘要。 |

## 完整示例

```json
{
  "schemaVersion": "sandbox.current-snapshot.v1",
  "snapshotId": "snapshot_20260803_120000_demo",
  "generatedAt": "2026-08-03T12:00:00+08:00",
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
        "zone": "top-left",
        "zoneLabel": "左上",
        "inCenter": false,
        "inBoundary": false,
        "depthRank": 1
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
      { "id": "top-left", "label": "左上", "count": 1 },
      { "id": "top-center", "label": "上中", "count": 0 },
      { "id": "top-right", "label": "右上", "count": 0 },
      { "id": "middle-left", "label": "左中", "count": 0 },
      { "id": "middle-center", "label": "中心", "count": 0 },
      { "id": "middle-right", "label": "右中", "count": 0 },
      { "id": "bottom-left", "label": "左下", "count": 0 },
      { "id": "bottom-center", "label": "下中", "count": 0 },
      { "id": "bottom-right", "label": "右下", "count": 0 }
    ],
    "categoryCounts": [
      { "id": "建筑与环境", "label": "建筑与环境", "count": 1 }
    ],
    "riskCounts": [
      { "id": "normal", "label": "常规", "count": 1 },
      { "id": "conflict", "label": "冲突", "count": 0 },
      { "id": "death", "label": "死亡", "count": 0 },
      { "id": "fantasy", "label": "幻想", "count": 0 }
    ],
    "emptyZones": [
      "top-center",
      "top-right",
      "middle-left",
      "middle-center",
      "middle-right",
      "bottom-left",
      "bottom-center",
      "bottom-right"
    ],
    "depthOrder": ["obj_house_001"],
    "summaryText": "当前沙盘共有 1 个沙具，中心区域 0 个，边界区域 0 个。主要类别：建筑与环境1。较早放置的沙具包括：房子。"
  },
  "selectedObjectId": "obj_house_001"
}
```

## LLM 使用提醒

传给 LLM 时只传 `CurrentSandboxSnapshot`，以及由它确定性生成的 `CurrentSandboxInsight`，并附加这段固定规则：

```text
请只基于当前沙盘状态进行温和、开放式回应。
不要引用事件流、个人记忆、用户身份、授权上下文或截图，因为本次输入不包含这些内容。
象征候选词只能用于提问和探索，不能作为诊断结论。
```
