# 当前沙盘 Snapshot 输出规范

版本：v1.6
适用对象：前端开发、LLM 调用层、后续后端接口

## 一句话目标

给 LLM 的沙盘数据只输出“当前沙盘这一刻的完整状态”，不输出事件流、不输出个人信息、不输出个人记忆、不输出授权上下文。

代码入口：

```ts
src/api/currentSandboxSnapshotApi.ts -> createCurrentSandboxSnapshotPayload
```

LLM Prompt 入口：

```ts
src/llm/sandboxPromptContext.ts -> createSandboxSnapshotChatMessages
```

验证命令：

```bash
npm run qa:snapshot-contract
```

## 输出边界

| 内容 | 是否输出 | 说明 |
|---|---:|---|
| 当前天气、光照 | 是 | 例如晴天、雨天、白天、黑夜。 |
| 当前沙具列表 | 是 | 包含沙具名称、位置、区域、旋转、缩放等。 |
| 当前空间统计 | 是 | 包含总数、中心区、边界区、九宫格、分类、风险标签。 |
| 当前选中沙具 | 是 | 只输出选中对象 ID；未选中为 `null`。 |
| 事件流 | 否 | 不包含新增、移动、删除等历史过程。 |
| 个人信息 | 否 | 不输出姓名、账号、年龄、身份。 |
| 个人记忆 | 否 | 不包含长期记忆、历史会话、历史作品。 |
| 授权上下文 | 否 | 不输出 consent、scope、权限边界。 |
| 图片截图 | 否 | 不输出 PNG、base64、canvas 图像。 |
| API Key | 否 | 永远不输出密钥。 |

## 顶层结构

```ts
CurrentSandboxSnapshot
```

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `schemaVersion` | string | 数据结构版本，固定为 `sandbox.current-snapshot.v1`。 |
| `snapshotId` | string | 本次快照 ID，方便排查一次 LLM 调用使用了哪份数据。 |
| `generatedAt` | string | 快照生成时间，ISO 8601 格式。 |
| `source` | string | 数据来源，固定为 `current_sandbox`。 |
| `canvas` | object | 沙盘画布尺寸和坐标系。 |
| `environment` | object | 当前天气与光照。 |
| `objects` | array | 当前沙盘上的全部沙具。 |
| `analysis` | object | 当前空间统计结果。 |
| `selectedObjectId` | string/null | 当前选中沙具 ID；没有选中时为 `null`。 |

## canvas 字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `width` | number | 沙盘逻辑宽度。 |
| `height` | number | 沙盘逻辑高度。 |
| `coordinateSystem` | string | 坐标系，固定为 `board-pixel`。 |
| `normalizedCoordinateSystem` | string | 归一化坐标系，固定为 `0-1`。 |
| `guides` | string[] | 当前支持的空间辅助能力，例如九宫格、中心区、边界区、y 深度排序。 |

## environment 字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `weather` | string | 天气枚举：`sunny`、`cloudy`、`rainy`。 |
| `weatherLabel` | string | 天气中文名：晴天、阴天、雨天。 |
| `light` | string | 光照枚举：`day`、`night`。 |
| `lightLabel` | string | 光照中文名：白天、黑夜。 |

## objects 字段

`objects` 是数组，每一项代表一个当前已放置沙具。

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `id` | string | 沙具实例 ID。 |
| `assetId` | string | 沙具资产 ID。 |
| `name` | string | 沙具名称。 |
| `category` | string | 沙具分类。 |
| `riskTag` | string | 风险标签：`normal`、`conflict`、`death`、`fantasy`。 |
| `riskLabel` | string | 风险标签中文名。 |
| `symbolicCandidates` | string[] | 象征候选词，只能作为开放式提问线索，不能当作诊断结论。 |
| `semanticTags` | string[] | 语义标签。 |
| `position` | object | 沙具在沙盘中的位置和区域信息。 |
| `transform` | object | 沙具旋转、缩放和显示尺寸。 |
| `footprint` | object | 沙具占地形态提示。 |
| `createdOrder` | number | 当前对象的创建顺序。 |

### position 字段

| 字段 | 类型 | 中文说明 |
|---|---|---|
| `x` / `y` | number | 沙盘像素坐标。 |
| `xNorm` / `yNorm` | number | 归一化坐标，范围 0 到 1。 |
| `zone` | string | 九宫格区域 ID。 |
| `zoneLabel` | string | 九宫格区域中文名。 |
| `inCenter` | boolean | 是否在中心区域。 |
| `inBoundary` | boolean | 是否在边界区域。 |
| `depthRank` | number | 按 y 坐标得到的深度排序名次。 |

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
| `height` | number | 沙具高度提示。 |

## analysis 字段

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
| `summaryText` | string | 给 LLM 快速阅读的简短摘要。 |

## 完整示例

```json
{
  "schemaVersion": "sandbox.current-snapshot.v1",
  "snapshotId": "snapshot_20260802_110000_demo",
  "generatedAt": "2026-08-02T11:00:00+08:00",
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
    "zoneCounts": [{ "id": "top-left", "label": "左上", "count": 1 }],
    "categoryCounts": [{ "id": "建筑与环境", "label": "建筑与环境", "count": 1 }],
    "riskCounts": [{ "id": "normal", "label": "常规", "count": 1 }],
    "emptyZones": ["top-center", "top-right", "middle-left", "middle-center", "middle-right", "bottom-left", "bottom-center", "bottom-right"],
    "depthOrder": ["obj_house_001"],
    "summaryText": "当前沙盘共有 1 个沙具，中心区 0 个，边界区 0 个。"
  },
  "selectedObjectId": "obj_house_001"
}
```

## 给 LLM 的固定提醒

```text
你将收到 CurrentSandboxSnapshot。
请只基于当前沙盘状态进行温和、开放式回应。
不要引用事件流、个人记忆、用户身份或授权信息，因为本次输入不包含这些内容。
象征候选词只能用于提问和探索，不能作为诊断结论。
```
