import type { RiskTag, SandboxAsset } from "../types";
import { getToyAssetSpec } from "./toyAssetSpecs";

export const ASSET_CATEGORIES = [
  "人物",
  "动物",
  "建筑与环境",
  "自然元素",
  "特殊象征",
] as const;

export const RISK_LABELS: Record<RiskTag, string> = {
  normal: "常规",
  conflict: "冲突",
  death: "死亡",
  fantasy: "幻想",
};

export const RISK_COLORS: Record<RiskTag, string> = {
  normal: "#2f8f83",
  conflict: "#b06124",
  death: "#5f6673",
  fantasy: "#7657b8",
};

type SandboxAssetBase = Omit<
  SandboxAsset,
  "anchor" | "footprint" | "modelRecipe" | "semanticTags" | "thumbnailScale"
>;

const SANDBOX_ASSET_BASES: SandboxAssetBase[] = [
  {
    assetId: "person_child",
    name: "儿童",
    category: "人物",
    defaultWidth: 52,
    defaultHeight: 84,
    symbolicCandidates: ["成长", "脆弱", "自我早期经验"],
    riskTag: "normal",
  },
  {
    assetId: "person_adult",
    name: "成人",
    category: "人物",
    defaultWidth: 58,
    defaultHeight: 98,
    symbolicCandidates: ["照顾者", "权威", "现实角色"],
    riskTag: "normal",
  },
  {
    assetId: "person_elder",
    name: "老人",
    category: "人物",
    defaultWidth: 58,
    defaultHeight: 94,
    symbolicCandidates: ["经验", "祖辈关系", "时间感"],
    riskTag: "normal",
  },
  {
    assetId: "animal_dog",
    name: "狗",
    category: "动物",
    defaultWidth: 90,
    defaultHeight: 58,
    symbolicCandidates: ["陪伴", "忠诚", "警觉"],
    riskTag: "normal",
  },
  {
    assetId: "animal_bird",
    name: "鸟",
    category: "动物",
    defaultWidth: 74,
    defaultHeight: 54,
    symbolicCandidates: ["自由", "观察", "逃离"],
    riskTag: "normal",
  },
  {
    assetId: "animal_fish",
    name: "鱼",
    category: "动物",
    defaultWidth: 88,
    defaultHeight: 46,
    symbolicCandidates: ["流动", "情绪", "潜意识"],
    riskTag: "normal",
  },
  {
    assetId: "animal_lion",
    name: "狮子",
    category: "动物",
    defaultWidth: 96,
    defaultHeight: 78,
    symbolicCandidates: ["力量", "攻击性", "保护"],
    riskTag: "conflict",
  },
  {
    assetId: "env_house",
    name: "房子",
    category: "建筑与环境",
    defaultWidth: 112,
    defaultHeight: 92,
    symbolicCandidates: ["家庭", "安全", "内部空间"],
    riskTag: "normal",
  },
  {
    assetId: "env_bridge",
    name: "桥",
    category: "建筑与环境",
    defaultWidth: 132,
    defaultHeight: 64,
    symbolicCandidates: ["连接", "过渡", "关系修复"],
    riskTag: "normal",
  },
  {
    assetId: "env_fence",
    name: "围栏",
    category: "建筑与环境",
    defaultWidth: 126,
    defaultHeight: 54,
    symbolicCandidates: ["边界", "防御", "隔离"],
    riskTag: "conflict",
  },
  {
    assetId: "env_tower",
    name: "塔",
    category: "建筑与环境",
    defaultWidth: 68,
    defaultHeight: 128,
    symbolicCandidates: ["观察", "控制", "距离"],
    riskTag: "normal",
  },
  {
    assetId: "nature_tree",
    name: "树",
    category: "自然元素",
    defaultWidth: 86,
    defaultHeight: 118,
    symbolicCandidates: ["生命力", "扎根", "成长"],
    riskTag: "normal",
  },
  {
    assetId: "nature_water",
    name: "水域",
    category: "自然元素",
    defaultWidth: 146,
    defaultHeight: 80,
    symbolicCandidates: ["情绪流动", "滋养", "边界模糊"],
    riskTag: "normal",
  },
  {
    assetId: "nature_rock",
    name: "石头",
    category: "自然元素",
    defaultWidth: 82,
    defaultHeight: 56,
    symbolicCandidates: ["阻碍", "稳定", "沉默"],
    riskTag: "normal",
  },
  {
    assetId: "nature_sun",
    name: "太阳",
    category: "自然元素",
    defaultWidth: 82,
    defaultHeight: 82,
    symbolicCandidates: ["能量", "关注", "希望"],
    riskTag: "normal",
  },
  {
    assetId: "symbol_monster",
    name: "怪兽",
    category: "特殊象征",
    defaultWidth: 94,
    defaultHeight: 102,
    symbolicCandidates: ["恐惧", "冲突", "被压迫感"],
    riskTag: "fantasy",
  },
  {
    assetId: "symbol_robot",
    name: "机器人",
    category: "特殊象征",
    defaultWidth: 78,
    defaultHeight: 98,
    symbolicCandidates: ["控制", "理性防御", "自动化"],
    riskTag: "fantasy",
  },
  {
    assetId: "symbol_skull",
    name: "骷髅",
    category: "特殊象征",
    defaultWidth: 72,
    defaultHeight: 80,
    symbolicCandidates: ["死亡", "失去", "终结"],
    riskTag: "death",
  },
  {
    assetId: "symbol_light",
    name: "光源",
    category: "特殊象征",
    defaultWidth: 76,
    defaultHeight: 92,
    symbolicCandidates: ["觉察", "希望", "指引"],
    riskTag: "normal",
  },
];

export const SANDBOX_ASSETS: SandboxAsset[] = SANDBOX_ASSET_BASES.map((asset) => {
  const spec = getToyAssetSpec(asset.assetId, asset.riskTag);

  return {
    ...asset,
    anchor: spec.anchor,
    footprint: spec.footprint,
    thumbnailScale: spec.thumbnailScale,
    semanticTags: spec.semanticTags,
    modelRecipe: spec.modelRecipe,
  };
});

export function findAsset(assetId: string): SandboxAsset | undefined {
  return SANDBOX_ASSETS.find((asset) => asset.assetId === assetId);
}
