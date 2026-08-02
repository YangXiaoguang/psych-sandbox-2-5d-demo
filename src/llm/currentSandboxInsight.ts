import type { CurrentSandboxSnapshot, SnapshotObject } from "./currentSandboxSnapshot";

export const CURRENT_SANDBOX_INSIGHT_SCHEMA = "sandbox.current-insight.v1";

export type CurrentInsightObservationKind =
  | "environment"
  | "zone-density"
  | "empty-space"
  | "center-focus"
  | "boundary-presence"
  | "isolated-object"
  | "selected-object";

export type CurrentInsightRelationKind = "near" | "same-zone";

export interface CurrentInsightGuardrails {
  derivedFromCurrentSnapshotOnly: true;
  includesEvents: false;
  includesPersonalMemory: false;
  includesIdentity: false;
  includesImage: false;
  note: string;
}

export interface CurrentInsightObservation {
  id: string;
  kind: CurrentInsightObservationKind;
  title: string;
  detail: string;
  evidence: string[];
  evidenceObjectIds: string[];
  confidence: "low" | "medium" | "high";
  interpretiveLimit: string;
}

export interface CurrentInsightRelation {
  id: string;
  relationKind: CurrentInsightRelationKind;
  sourceObjectId: string;
  sourceObjectName: string;
  targetObjectId: string;
  targetObjectName: string;
  sharedZone?: string;
  sharedZoneLabel?: string;
  distanceNorm: number;
  detail: string;
}

export interface CurrentInsightThemeCandidate {
  theme: string;
  weight: number;
  sourceObjectIds: string[];
  sourceObjectNames: string[];
  reason: string;
}

export interface CurrentInsightQuestion {
  questionId: string;
  text: string;
  basedOnObservationIds: string[];
}

export interface CurrentSandboxInsight {
  schemaVersion: typeof CURRENT_SANDBOX_INSIGHT_SCHEMA;
  generatedAt: string;
  sourceSnapshotId: string;
  source: "derived_from_current_sandbox_snapshot";
  guardrails: CurrentInsightGuardrails;
  observations: CurrentInsightObservation[];
  relations: CurrentInsightRelation[];
  themeCandidates: CurrentInsightThemeCandidate[];
  suggestedQuestions: CurrentInsightQuestion[];
  brief: string;
}

const MAX_RELATIONS = 8;
const MAX_THEMES = 8;
const NEAR_DISTANCE_NORM = 0.16;
const SAME_ZONE_DISTANCE_NORM = 0.24;
const ISOLATED_DISTANCE_NORM = 0.34;

export function buildCurrentSandboxInsight(snapshot: CurrentSandboxSnapshot): CurrentSandboxInsight {
  const observations = buildObservations(snapshot);
  const relations = buildRelations(snapshot.objects);
  const themeCandidates = buildThemeCandidates(snapshot.objects);
  const suggestedQuestions = buildSuggestedQuestions(snapshot, observations, relations, themeCandidates);
  const brief = buildCurrentInsightBriefFromParts(snapshot, observations, relations, themeCandidates);

  return {
    schemaVersion: CURRENT_SANDBOX_INSIGHT_SCHEMA,
    generatedAt: snapshot.generatedAt,
    sourceSnapshotId: snapshot.snapshotId,
    source: "derived_from_current_sandbox_snapshot",
    guardrails: {
      derivedFromCurrentSnapshotOnly: true,
      includesEvents: false,
      includesPersonalMemory: false,
      includesIdentity: false,
      includesImage: false,
      note: "本洞察只由 CurrentSandboxSnapshot 确定性派生；只能作为温和观察和开放式提问线索，不能作为诊断结论。",
    },
    observations,
    relations,
    themeCandidates,
    suggestedQuestions,
    brief,
  };
}

export function buildCurrentInsightBrief(snapshot: CurrentSandboxSnapshot): string {
  const insight = buildCurrentSandboxInsight(snapshot);
  return insight.brief;
}

function buildObservations(snapshot: CurrentSandboxSnapshot): CurrentInsightObservation[] {
  const observations: CurrentInsightObservation[] = [];
  const nonEmptyZones = snapshot.analysis.zoneCounts
    .filter((zone) => zone.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
  const emptyZoneLabels = snapshot.analysis.zoneCounts
    .filter((zone) => snapshot.analysis.emptyZones.includes(zone.id))
    .map((zone) => zone.label);

  observations.push({
    id: "obs_environment",
    kind: "environment",
    title: "环境状态",
    detail: `当前环境为${snapshot.environment.weatherLabel}、${snapshot.environment.lightLabel}。环境会影响画面氛围，但不应被解释成固定心理含义。`,
    evidence: [`weather=${snapshot.environment.weather}`, `light=${snapshot.environment.light}`],
    evidenceObjectIds: [],
    confidence: "high",
    interpretiveLimit: "环境只描述当前场景氛围，不代表用户真实情绪。",
  });

  const topZone = nonEmptyZones[0];
  if (topZone) {
    observations.push({
      id: "obs_zone_density",
      kind: "zone-density",
      title: "主要聚集区域",
      detail: `${topZone.label}是当前沙具最多的区域，共 ${topZone.count} 个沙具。`,
      evidence: nonEmptyZones.slice(0, 4).map((zone) => `${zone.label}${zone.count}`),
      evidenceObjectIds: snapshot.objects.filter((object) => object.position.zone === topZone.id).map((object) => object.id),
      confidence: "high",
      interpretiveLimit: "区域聚集只能说明空间分布，不直接说明动机或人格特征。",
    });
  }

  if (snapshot.analysis.centerCount > 0) {
    observations.push({
      id: "obs_center_focus",
      kind: "center-focus",
      title: "中心区域有摆放",
      detail: `中心区域有 ${snapshot.analysis.centerCount} 个沙具，可能是后续对话中值得先观察的位置。`,
      evidence: snapshot.objects
        .filter((object) => object.position.inCenter)
        .slice(0, 6)
        .map((object) => object.name),
      evidenceObjectIds: snapshot.objects.filter((object) => object.position.inCenter).map((object) => object.id),
      confidence: "high",
      interpretiveLimit: "中心位置可以作为注意力线索，不等同于问题核心。",
    });
  }

  if (snapshot.analysis.boundaryCount > 0) {
    observations.push({
      id: "obs_boundary_presence",
      kind: "boundary-presence",
      title: "边界区域有摆放",
      detail: `边界区域有 ${snapshot.analysis.boundaryCount} 个沙具，可关注它们与沙盘中心、边缘和其他沙具之间的关系。`,
      evidence: snapshot.objects
        .filter((object) => object.position.inBoundary)
        .slice(0, 6)
        .map((object) => object.name),
      evidenceObjectIds: snapshot.objects.filter((object) => object.position.inBoundary).map((object) => object.id),
      confidence: "high",
      interpretiveLimit: "靠近边界只描述位置，不应推断为退缩、逃避或防御。",
    });
  }

  if (emptyZoneLabels.length >= 3 && snapshot.objects.length > 0) {
    observations.push({
      id: "obs_empty_space",
      kind: "empty-space",
      title: "存在空白区域",
      detail: `当前有 ${emptyZoneLabels.length} 个九宫格区域暂未放置沙具。空白区域可以作为开放探索点。`,
      evidence: emptyZoneLabels.slice(0, 6),
      evidenceObjectIds: [],
      confidence: "high",
      interpretiveLimit: "空白可能来自构图、操作习惯或尚未完成，不应被单独解释。",
    });
  }

  const isolatedObjects = findIsolatedObjects(snapshot.objects).slice(0, 4);
  if (isolatedObjects.length > 0) {
    observations.push({
      id: "obs_isolated_object",
      kind: "isolated-object",
      title: "有相对独立的沙具",
      detail: `${isolatedObjects.map((object) => object.name).join("、")} 与其他沙具距离较远，可作为关系探索线索。`,
      evidence: isolatedObjects.map((object) => `${object.name}@${object.position.zoneLabel}`),
      evidenceObjectIds: isolatedObjects.map((object) => object.id),
      confidence: "medium",
      interpretiveLimit: "距离较远只是空间关系，不代表孤立感或排斥感。",
    });
  }

  const selectedObject = snapshot.objects.find((object) => object.id === snapshot.selectedObjectId);
  if (selectedObject) {
    observations.push({
      id: "obs_selected_object",
      kind: "selected-object",
      title: "当前选中沙具",
      detail: `当前选中“${selectedObject.name}”，位于${selectedObject.position.zoneLabel}，可从它的摆放位置和周边关系开始提问。`,
      evidence: [
        `zone=${selectedObject.position.zoneLabel}`,
        `category=${selectedObject.category}`,
        `risk=${selectedObject.riskLabel}`,
      ],
      evidenceObjectIds: [selectedObject.id],
      confidence: "high",
      interpretiveLimit: "选中状态只表示当前操作焦点，不代表情绪焦点。",
    });
  }

  return observations;
}

function buildRelations(objects: SnapshotObject[]): CurrentInsightRelation[] {
  const relations: CurrentInsightRelation[] = [];

  for (let i = 0; i < objects.length; i += 1) {
    for (let j = i + 1; j < objects.length; j += 1) {
      const source = objects[i];
      const target = objects[j];
      const distanceNorm = getDistanceNorm(source, target);
      const sameZone = source.position.zone === target.position.zone;
      const relationKind =
        distanceNorm <= NEAR_DISTANCE_NORM ? "near" : sameZone && distanceNorm <= SAME_ZONE_DISTANCE_NORM ? "same-zone" : null;

      if (!relationKind) {
        continue;
      }

      relations.push({
        id: `rel_${source.id}_${target.id}`,
        relationKind,
        sourceObjectId: source.id,
        sourceObjectName: source.name,
        targetObjectId: target.id,
        targetObjectName: target.name,
        sharedZone: sameZone ? source.position.zone : undefined,
        sharedZoneLabel: sameZone ? source.position.zoneLabel : undefined,
        distanceNorm: roundNumber(distanceNorm, 3),
        detail:
          relationKind === "near"
            ? `“${source.name}”和“${target.name}”距离较近。`
            : `“${source.name}”和“${target.name}”同在${source.position.zoneLabel}区域。`,
      });
    }
  }

  return relations
    .sort((a, b) => a.distanceNorm - b.distanceNorm || a.sourceObjectName.localeCompare(b.sourceObjectName, "zh-CN"))
    .slice(0, MAX_RELATIONS);
}

function buildThemeCandidates(objects: SnapshotObject[]): CurrentInsightThemeCandidate[] {
  const themeMap = new Map<
    string,
    {
      weight: number;
      ids: Set<string>;
      names: Set<string>;
      semanticHits: number;
      symbolicHits: number;
    }
  >();

  for (const object of objects) {
    for (const tag of object.semanticTags) {
      addTheme(themeMap, normalizeTheme(tag), object, 1.15, "semantic");
    }
    for (const candidate of object.symbolicCandidates) {
      addTheme(themeMap, normalizeTheme(candidate), object, 1, "symbolic");
    }
  }

  return [...themeMap.entries()]
    .filter(([theme]) => Boolean(theme))
    .map(([theme, value]) => ({
      theme,
      weight: roundNumber(value.weight, 2),
      sourceObjectIds: [...value.ids].slice(0, 10),
      sourceObjectNames: [...value.names].slice(0, 10),
      reason:
        value.semanticHits >= value.symbolicHits
          ? `来自 ${value.semanticHits} 个语义标签和 ${value.symbolicHits} 个象征候选。`
          : `来自 ${value.symbolicHits} 个象征候选和 ${value.semanticHits} 个语义标签。`,
    }))
    .sort((a, b) => b.weight - a.weight || b.sourceObjectIds.length - a.sourceObjectIds.length || a.theme.localeCompare(b.theme, "zh-CN"))
    .slice(0, MAX_THEMES);
}

function buildSuggestedQuestions(
  snapshot: CurrentSandboxSnapshot,
  observations: CurrentInsightObservation[],
  relations: CurrentInsightRelation[],
  themes: CurrentInsightThemeCandidate[],
): CurrentInsightQuestion[] {
  if (snapshot.objects.length === 0) {
    return [
      {
        questionId: "q_empty_start",
        text: "如果从一个最想先放下的沙具开始，你会选哪一个？",
        basedOnObservationIds: ["obs_environment"],
      },
    ];
  }

  const questions: CurrentInsightQuestion[] = [];
  const selectedObject = snapshot.objects.find((object) => object.id === snapshot.selectedObjectId);
  if (selectedObject) {
    questions.push({
      questionId: "q_selected_object",
      text: `如果先从“${selectedObject.name}”开始看，它在这个位置给你的第一感觉是什么？`,
      basedOnObservationIds: ["obs_selected_object"],
    });
  }

  const zoneObservation = observations.find((observation) => observation.kind === "zone-density");
  if (zoneObservation) {
    questions.push({
      questionId: "q_dense_zone",
      text: "沙具比较集中的那个区域，像是在发生什么，或者承载了什么主题？",
      basedOnObservationIds: [zoneObservation.id],
    });
  }

  const relation = relations[0];
  if (relation) {
    questions.push({
      questionId: "q_near_relation",
      text: `“${relation.sourceObjectName}”和“${relation.targetObjectName}”看起来有些靠近，它们之间像是什么关系？`,
      basedOnObservationIds: [],
    });
  }

  const theme = themes[0];
  if (theme) {
    questions.push({
      questionId: "q_theme_candidate",
      text: `这里出现了“${theme.theme}”相关线索。这个词和你的作品感觉贴近吗，还是不太准确？`,
      basedOnObservationIds: [],
    });
  }

  const emptyObservation = observations.find((observation) => observation.kind === "empty-space");
  if (emptyObservation) {
    questions.push({
      questionId: "q_empty_space",
      text: "那些还空着的位置，是暂时留白，还是你觉得那里不需要放东西？",
      basedOnObservationIds: [emptyObservation.id],
    });
  }

  return questions.slice(0, 5);
}

function buildCurrentInsightBriefFromParts(
  snapshot: CurrentSandboxSnapshot,
  observations: CurrentInsightObservation[],
  relations: CurrentInsightRelation[],
  themes: CurrentInsightThemeCandidate[],
): string {
  if (snapshot.objects.length === 0) {
    return `当前沙盘为空，环境为${snapshot.environment.weatherLabel}、${snapshot.environment.lightLabel}。`;
  }

  const zoneObservation = observations.find((observation) => observation.kind === "zone-density");
  const themeText = themes
    .slice(0, 4)
    .map((theme) => theme.theme)
    .join("、");
  const relationText = relations
    .slice(0, 3)
    .map((relation) => `${relation.sourceObjectName}-${relation.targetObjectName}`)
    .join("、");

  return [
    `当前沙盘有 ${snapshot.analysis.totalObjects} 个沙具，环境为${snapshot.environment.weatherLabel}、${snapshot.environment.lightLabel}。`,
    zoneObservation?.detail,
    relationText ? `可观察的邻近关系包括：${relationText}。` : null,
    themeText ? `可作为提问线索的主题候选：${themeText}。` : null,
    "以上只用于开放式观察，不构成诊断。",
  ]
    .filter(Boolean)
    .join(" ");
}

function addTheme(
  themeMap: Map<
    string,
    {
      weight: number;
      ids: Set<string>;
      names: Set<string>;
      semanticHits: number;
      symbolicHits: number;
    }
  >,
  theme: string,
  object: SnapshotObject,
  weight: number,
  source: "semantic" | "symbolic",
): void {
  if (!theme) {
    return;
  }

  const current =
    themeMap.get(theme) ??
    {
      weight: 0,
      ids: new Set<string>(),
      names: new Set<string>(),
      semanticHits: 0,
      symbolicHits: 0,
    };
  const centerBonus = object.position.inCenter ? 0.18 : 0;
  current.weight += weight + centerBonus;
  current.ids.add(object.id);
  current.names.add(object.name);
  if (source === "semantic") {
    current.semanticHits += 1;
  } else {
    current.symbolicHits += 1;
  }
  themeMap.set(theme, current);
}

function findIsolatedObjects(objects: SnapshotObject[]): SnapshotObject[] {
  if (objects.length < 2) {
    return [];
  }

  return objects
    .map((object) => ({
      object,
      nearest: Math.min(...objects.filter((candidate) => candidate.id !== object.id).map((candidate) => getDistanceNorm(object, candidate))),
    }))
    .filter((item) => item.nearest >= ISOLATED_DISTANCE_NORM)
    .sort((a, b) => b.nearest - a.nearest || a.object.name.localeCompare(b.object.name, "zh-CN"))
    .map((item) => item.object);
}

function getDistanceNorm(source: SnapshotObject, target: SnapshotObject): number {
  const dx = source.position.xNorm - target.position.xNorm;
  const dy = source.position.yNorm - target.position.yNorm;
  return Math.sqrt(dx * dx + dy * dy);
}

function normalizeTheme(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function roundNumber(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}
