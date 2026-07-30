# 当前沙盘 Snapshot 数据输出规范

文档版本：v1.1  
更新日期：2026-07-31  
适用项目：`psych-sandbox-2-5d-demo`  
适用对象：前端工程师、后端工程师、LLM 工程师  

---

## 1. 目标

第一版只向 LLM 输出**当前沙盘状态的完整 Snapshot**，让 LLM 能清楚知道：

- 当前沙盘里有哪些沙具；
- 每个沙具在哪里；
- 每个沙具属于什么类别、有哪些象征候选；
- 当前天气和光照是什么；
- 九宫格、中心区、边界区、风险标签和类别分布如何。

第一版**暂不输出**：

- 事件流；
- 个人授权上下文；
- 长期记忆；
- 用户真实身份；
- 对话历史；
- API Key；
- PNG 截图。

---

## 2. 总体结构

建议输出一个 JSON 对象，命名为：

```ts
CurrentSandboxSnapshot
```

结构如下：

```ts
interface CurrentSandboxSnapshot {
  schemaVersion: "sandbox.current-snapshot.v1";
  snapshotId: string;
  generatedAt: string;
  source: "current_sandbox";
  canvas: SnapshotCanvas;
  environment: SnapshotEnvironment;
  objects: SnapshotObject[];
  analysis: SnapshotAnalysis;
  selectedObjectId?: string | null;
}
```

---

## 3. 顶层字段说明

| 字段 | 类型 | 必填 | 中文说明 | 示例 |
|---|---|---:|---|---|
| `schemaVersion` | string | 是 | Snapshot 结构版本。后续字段有破坏性变化时升级版本。 | `sandbox.current-snapshot.v1` |
| `snapshotId` | string | 是 | 本次 Snapshot 的唯一 ID，用于日志追踪。 | `snapshot_20260731_001` |
| `generatedAt` | string | 是 | 生成时间，使用 ISO 8601 格式。 | `2026-07-31T10:30:00+08:00` |
| `source` | string | 是 | 数据来源。第一版固定为当前沙盘。 | `current_sandbox` |
| `canvas` | object | 是 | 沙盘画布和坐标系信息。 | 见第 4 节 |
| `environment` | object | 是 | 当前天气和光照信息。 | 见第 5 节 |
| `objects` | array | 是 | 当前沙盘上的全部沙具对象。 | 见第 6 节 |
| `analysis` | object | 是 | 基于当前对象生成的空间统计。 | 见第 7 节 |
| `selectedObjectId` | string/null | 否 | 当前选中沙具 ID。没有选中时为 `null`。 | `obj_house_001` |

---

## 4. 画布字段：canvas

```ts
interface SnapshotCanvas {
  width: number;
  height: number;
  coordinateSystem: "board-pixel";
  normalizedCoordinateSystem: "0-1";
  guides: string[];
}
```

| 字段 | 类型 | 必填 | 中文说明 | 示例 |
|---|---|---:|---|---|
| `width` | number | 是 | 沙盘逻辑画布宽度。当前项目参考值为 `960`。 | `960` |
| `height` | number | 是 | 沙盘逻辑画布高度。当前项目参考值为 `640`。 | `640` |
| `coordinateSystem` | string | 是 | 原始坐标系。第一版统一使用画布像素坐标。 | `board-pixel` |
| `normalizedCoordinateSystem` | string | 是 | 归一化坐标系，便于 LLM 分析。 | `0-1` |
| `guides` | string[] | 是 | 当前可用于分析的辅助系统。 | `["nine-grid", "center-region", "boundary-region", "y-depth-sort"]` |

---

## 5. 环境字段：environment

```ts
interface SnapshotEnvironment {
  weather: "sunny" | "cloudy" | "rainy";
  weatherLabel: string;
  light: "day" | "night";
  lightLabel: string;
}
```

| 字段 | 类型 | 必填 | 中文说明 | 示例 |
|---|---|---:|---|---|
| `weather` | string | 是 | 天气枚举。 | `rainy` |
| `weatherLabel` | string | 是 | 天气中文名。 | `雨天` |
| `light` | string | 是 | 光照枚举。 | `night` |
| `lightLabel` | string | 是 | 光照中文名。 | `黑夜` |

天气取值：

| 值 | 中文 |
|---|---|
| `sunny` | 晴天 |
| `cloudy` | 阴天 |
| `rainy` | 雨天 |

光照取值：

| 值 | 中文 |
|---|---|
| `day` | 白天 |
| `night` | 黑夜 |

---

## 6. 沙具字段：objects

每个沙具输出为一个 `SnapshotObject`。

```ts
interface SnapshotObject {
  id: string;
  assetId: string;
  name: string;
  category: string;
  riskTag: "normal" | "conflict" | "death" | "fantasy";
  riskLabel: string;
  symbolicCandidates: string[];
  semanticTags: string[];
  position: SnapshotObjectPosition;
  transform: SnapshotObjectTransform;
  footprint: SnapshotObjectFootprint;
  createdOrder: number;
}
```

### 6.1 沙具基础字段

| 字段 | 类型 | 必填 | 中文说明 | 示例 |
|---|---|---:|---|---|
| `id` | string | 是 | 沙盘中这个沙具实例的唯一 ID。 | `obj_house_001` |
| `assetId` | string | 是 | 沙具资产 ID。 | `env_house` |
| `name` | string | 是 | 沙具名称。 | `房子` |
| `category` | string | 是 | 沙具分类。 | `建筑与环境` |
| `riskTag` | string | 是 | 沙具风险标签枚举。注意：这是资产标签，不是用户风险判断。 | `normal` |
| `riskLabel` | string | 是 | 风险标签中文名。 | `常规` |
| `symbolicCandidates` | string[] | 是 | 可能的象征候选，仅供开放式探索，不能当作结论。 | `["家庭", "安全", "归属"]` |
| `semanticTags` | string[] | 是 | 语义标签，用于检索和摘要。 | `["建筑", "家庭", "容器"]` |
| `position` | object | 是 | 沙具位置和区域信息。 | 见第 6.2 节 |
| `transform` | object | 是 | 沙具旋转、缩放和尺寸信息。 | 见第 6.3 节 |
| `footprint` | object | 是 | 沙具在沙盘中的占地类型。 | 见第 6.4 节 |
| `createdOrder` | number | 是 | 沙具放置顺序。没有事件流时按 `createdAt` 排序生成。 | `1` |

### 6.2 位置字段：position

```ts
interface SnapshotObjectPosition {
  x: number;
  y: number;
  xNorm: number;
  yNorm: number;
  zone: string;
  zoneLabel: string;
  inCenter: boolean;
  inBoundary: boolean;
  depthRank: number;
}
```

| 字段 | 类型 | 必填 | 中文说明 | 示例 |
|---|---|---:|---|---|
| `x` | number | 是 | 原始 x 坐标。 | `465` |
| `y` | number | 是 | 原始 y 坐标。 | `280` |
| `xNorm` | number | 是 | 归一化 x 坐标，范围 0 到 1。计算：`x / canvas.width`。 | `0.484` |
| `yNorm` | number | 是 | 归一化 y 坐标，范围 0 到 1。计算：`y / canvas.height`。 | `0.438` |
| `zone` | string | 是 | 九宫格区域 ID。 | `middle-center` |
| `zoneLabel` | string | 是 | 九宫格区域中文名。 | `中心` |
| `inCenter` | boolean | 是 | 是否在中心区域。 | `true` |
| `inBoundary` | boolean | 是 | 是否在边界区域。 | `false` |
| `depthRank` | number | 是 | y 深度排序名次，用于说明前后层级。 | `5` |

九宫格区域：

| `zone` | 中文 |
|---|---|
| `top-left` | 左上 |
| `top-center` | 上中 |
| `top-right` | 右上 |
| `middle-left` | 左中 |
| `middle-center` | 中心 |
| `middle-right` | 右中 |
| `bottom-left` | 左下 |
| `bottom-center` | 下中 |
| `bottom-right` | 右下 |

### 6.3 变换字段：transform

```ts
interface SnapshotObjectTransform {
  rotationDeg: number;
  scale: number;
  width: number;
  height: number;
}
```

| 字段 | 类型 | 必填 | 中文说明 | 示例 |
|---|---|---:|---|---|
| `rotationDeg` | number | 是 | 沙具旋转角度，单位为度。 | `12` |
| `scale` | number | 是 | 沙具缩放比例。 | `1.05` |
| `width` | number | 是 | 沙具当前显示宽度。 | `96` |
| `height` | number | 是 | 沙具当前显示高度。 | `82` |

### 6.4 占地字段：footprint

```ts
interface SnapshotObjectFootprint {
  kind: "compact" | "wide" | "tall" | "flat";
  width: number;
  depth: number;
  height: number;
}
```

| 字段 | 类型 | 必填 | 中文说明 | 示例 |
|---|---|---:|---|---|
| `kind` | string | 是 | 沙具占地类型。 | `wide` |
| `width` | number | 是 | 沙具占地宽度。 | `1.2` |
| `depth` | number | 是 | 沙具占地深度。 | `0.9` |
| `height` | number | 是 | 沙具高度提示。 | `0.8` |

占地类型：

| 值 | 中文说明 |
|---|---|
| `compact` | 小型、紧凑沙具，例如儿童、小动物 |
| `wide` | 横向较宽沙具，例如房子、桥、围栏 |
| `tall` | 竖向较高沙具，例如树、塔、太阳 |
| `flat` | 扁平沙具，例如水域、石头 |

---

## 7. 分析字段：analysis

`analysis` 是给 LLM 最重要的摘要字段。它让 LLM 不需要自己从坐标里猜结构。

```ts
interface SnapshotAnalysis {
  totalObjects: number;
  centerCount: number;
  boundaryCount: number;
  zoneCounts: SnapshotCountItem[];
  categoryCounts: SnapshotCountItem[];
  riskCounts: SnapshotCountItem[];
  emptyZones: string[];
  depthOrder: string[];
  summaryText: string;
}
```

| 字段 | 类型 | 必填 | 中文说明 | 示例 |
|---|---|---:|---|---|
| `totalObjects` | number | 是 | 沙具总数。 | `8` |
| `centerCount` | number | 是 | 中心区域沙具数量。 | `3` |
| `boundaryCount` | number | 是 | 边界区域沙具数量。 | `1` |
| `zoneCounts` | array | 是 | 九宫格区域数量统计。 | 见下方 |
| `categoryCounts` | array | 是 | 沙具分类数量统计。 | 见下方 |
| `riskCounts` | array | 是 | 风险标签数量统计。 | 见下方 |
| `emptyZones` | string[] | 是 | 当前没有沙具的九宫格区域。 | `["top-right"]` |
| `depthOrder` | string[] | 是 | 按 y 深度排序后的对象 ID。 | `["obj_sun_001", "obj_house_001"]` |
| `summaryText` | string | 是 | 面向 LLM 的一句话结构摘要。只描述事实，不做诊断。 | `中心区域有 3 个沙具，主要包括房子、儿童和狗。` |

统计项统一格式：

```ts
interface SnapshotCountItem {
  id: string;
  label: string;
  count: number;
}
```

| 字段 | 类型 | 必填 | 中文说明 | 示例 |
|---|---|---:|---|---|
| `id` | string | 是 | 统计项 ID。 | `middle-center` |
| `label` | string | 是 | 统计项中文名称。 | `中心` |
| `count` | number | 是 | 数量。 | `3` |

---

## 8. 不输出内容

第一版 Snapshot 明确不输出以下内容：

| 内容 | 原因 |
|---|---|
| `events` 事件流 | 先保持简单，避免 LLM 误读创作过程 |
| 个人授权上下文 | 第一版只分析当前沙盘，不使用长期记忆 |
| 用户真实姓名、邮箱、手机号 | 隐私保护 |
| API Key / LLM 配置 | 安全风险 |
| 对话历史 | 避免和当前沙盘状态混淆 |
| PNG / base64 截图 | 当前先走结构化数据，不走视觉输入 |
| 心理诊断字段 | 系统只提供开放式探索，不做诊断 |

---

## 9. 示例 JSON

```json
{
  "schemaVersion": "sandbox.current-snapshot.v1",
  "snapshotId": "snapshot_20260731_001",
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
      "symbolicCandidates": ["家庭", "安全", "归属", "内部空间"],
      "semanticTags": ["建筑", "家庭", "容器", "安全感"],
      "position": {
        "x": 465,
        "y": 280,
        "xNorm": 0.484,
        "yNorm": 0.438,
        "zone": "middle-center",
        "zoneLabel": "中心",
        "inCenter": true,
        "inBoundary": false,
        "depthRank": 1
      },
      "transform": {
        "rotationDeg": 0,
        "scale": 1,
        "width": 96,
        "height": 82
      },
      "footprint": {
        "kind": "wide",
        "width": 1.2,
        "depth": 0.9,
        "height": 0.8
      },
      "createdOrder": 1
    },
    {
      "id": "obj_child_001",
      "assetId": "person_child",
      "name": "儿童",
      "category": "人物",
      "riskTag": "normal",
      "riskLabel": "常规",
      "symbolicCandidates": ["成长", "自我", "脆弱", "希望"],
      "semanticTags": ["人物", "儿童", "成长"],
      "position": {
        "x": 550,
        "y": 310,
        "xNorm": 0.573,
        "yNorm": 0.484,
        "zone": "middle-center",
        "zoneLabel": "中心",
        "inCenter": true,
        "inBoundary": false,
        "depthRank": 2
      },
      "transform": {
        "rotationDeg": 6,
        "scale": 1.05,
        "width": 72,
        "height": 88
      },
      "footprint": {
        "kind": "compact",
        "width": 0.7,
        "depth": 0.7,
        "height": 1
      },
      "createdOrder": 2
    }
  ],
  "analysis": {
    "totalObjects": 2,
    "centerCount": 2,
    "boundaryCount": 0,
    "zoneCounts": [
      { "id": "middle-center", "label": "中心", "count": 2 }
    ],
    "categoryCounts": [
      { "id": "建筑与环境", "label": "建筑与环境", "count": 1 },
      { "id": "人物", "label": "人物", "count": 1 }
    ],
    "riskCounts": [
      { "id": "normal", "label": "常规", "count": 2 },
      { "id": "conflict", "label": "冲突", "count": 0 },
      { "id": "death", "label": "死亡", "count": 0 },
      { "id": "fantasy", "label": "幻想", "count": 0 }
    ],
    "emptyZones": [
      "top-left",
      "top-center",
      "top-right",
      "middle-left",
      "middle-right",
      "bottom-left",
      "bottom-center",
      "bottom-right"
    ],
    "depthOrder": ["obj_house_001", "obj_child_001"],
    "summaryText": "当前沙盘共有 2 个沙具，房子和儿童都位于中心区域。"
  },
  "selectedObjectId": "obj_child_001"
}
```

---

## 10. 给 LLM 的最简使用方式

向 LLM 发送时，可以这样组织：

```text
下面是当前沙盘的结构化 Snapshot。
请只基于这些字段进行温和、开放、非诊断式的观察。
不要输出心理疾病诊断，不要把象征候选当成确定结论。

{{CURRENT_SANDBOX_SNAPSHOT_JSON}}
```

---

## 11. 开发检查清单

实现 Snapshot 输出时，只需要检查这几项：

- [ ] 是否输出 `schemaVersion = sandbox.current-snapshot.v1`。
- [ ] 是否输出当前天气和光照。
- [ ] 是否输出所有当前沙具。
- [ ] 每个沙具是否有名称、分类、风险标签、象征候选、语义标签。
- [ ] 每个沙具是否有原始坐标和归一化坐标。
- [ ] 每个沙具是否有九宫格区域中文名。
- [ ] 是否输出总数、中心数、边界数、类别统计、风险统计。
- [ ] 是否没有输出事件流、个人记忆、用户隐私和 API Key。
- [ ] 示例 JSON 是否能被正常解析。
