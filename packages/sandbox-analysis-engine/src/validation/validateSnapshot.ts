import {
  CURRENT_SANDBOX_SNAPSHOT_V1,
  type CurrentSandboxSnapshotV1,
  type SnapshotZoneId,
} from "../contracts/snapshot.js";
import type { ValidationIssue, ValidationResult } from "../contracts/validation.js";

const KNOWN_WEATHER = new Set(["sunny", "cloudy", "rainy", "snowy"]);
const LIGHT_MODES = new Set(["day", "night"]);
const RISK_TAGS = new Set(["normal", "conflict", "death", "fantasy", "unknown"]);
const FOOTPRINT_KINDS = new Set(["compact", "wide", "tall", "flat"]);
const ZONE_IDS = new Set<SnapshotZoneId>([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

export function readSnapshotSchemaVersion(input: unknown): string | undefined {
  return isRecord(input) && typeof input.schemaVersion === "string" ? input.schemaVersion : undefined;
}

export function validateCurrentSandboxSnapshot(input: unknown): ValidationResult<CurrentSandboxSnapshotV1> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [issue("INVALID_TYPE", "", "Snapshot 必须是 JSON 对象。", input)],
    };
  }

  expectLiteral(input, "schemaVersion", CURRENT_SANDBOX_SNAPSHOT_V1, issues);
  expectNonEmptyString(input, "snapshotId", issues);
  expectIsoDate(input, "generatedAt", issues);
  expectLiteral(input, "source", "current_sandbox", issues);

  const canvas = expectRecord(input, "canvas", issues);
  if (canvas) {
    expectPositiveNumber(canvas, "width", issues, "/canvas");
    expectPositiveNumber(canvas, "height", issues, "/canvas");
    expectLiteral(canvas, "coordinateSystem", "board-pixel", issues, "/canvas");
    expectLiteral(canvas, "normalizedCoordinateSystem", "0-1", issues, "/canvas");
    expectStringArray(canvas, "guides", issues, "/canvas");
  }

  const environment = expectRecord(input, "environment", issues);
  if (environment) {
    const weather = expectNonEmptyString(environment, "weather", issues, "/environment");
    expectNonEmptyString(environment, "weatherLabel", issues, "/environment");
    const light = expectNonEmptyString(environment, "light", issues, "/environment");
    expectNonEmptyString(environment, "lightLabel", issues, "/environment");
    if (weather && !KNOWN_WEATHER.has(weather)) {
      issues.push(issue("INVALID_VALUE", "/environment/weather", "发现扩展天气值；结构有效，但需要业务适配器确认显示和特征策略。", weather, "warning"));
    }
    if (light && !LIGHT_MODES.has(light)) {
      issues.push(issue("INVALID_VALUE", "/environment/light", "光照模式必须是 day 或 night。", light));
    }
  }

  const objectValues = expectArray(input, "objects", issues);
  const objectIds = new Set<string>();
  if (objectValues) {
    objectValues.forEach((objectValue, index) => validateObject(objectValue, index, issues, objectIds));
  }

  const analysis = expectRecord(input, "analysis", issues);
  if (analysis) {
    expectNonNegativeInteger(analysis, "totalObjects", issues, "/analysis");
    expectNonNegativeInteger(analysis, "centerCount", issues, "/analysis");
    expectNonNegativeInteger(analysis, "boundaryCount", issues, "/analysis");
    validateCountItems(analysis, "zoneCounts", issues);
    validateCountItems(analysis, "categoryCounts", issues);
    validateCountItems(analysis, "riskCounts", issues);
    validateZoneArray(analysis, "emptyZones", issues, "/analysis");
    const depthOrder = expectStringArray(analysis, "depthOrder", issues, "/analysis");
    expectString(analysis, "summaryText", issues, "/analysis");

    if (objectValues && typeof analysis.totalObjects === "number" && analysis.totalObjects !== objectValues.length) {
      issues.push(issue("COUNT_MISMATCH", "/analysis/totalObjects", "totalObjects 必须等于 objects 数量。", analysis.totalObjects));
    }
    if (depthOrder) {
      validateDepthOrder(depthOrder, objectIds, issues);
    }
    if (objectValues) {
      validateAggregateCount(analysis.zoneCounts, objectValues.length, "/analysis/zoneCounts", issues);
      validateAggregateCount(analysis.categoryCounts, objectValues.length, "/analysis/categoryCounts", issues);
      validateAggregateCount(analysis.riskCounts, objectValues.length, "/analysis/riskCounts", issues);
    }
  }

  if (input.selectedObjectId !== undefined && input.selectedObjectId !== null && typeof input.selectedObjectId !== "string") {
    issues.push(issue("INVALID_TYPE", "/selectedObjectId", "selectedObjectId 必须是字符串或 null。", input.selectedObjectId));
  } else if (typeof input.selectedObjectId === "string" && !objectIds.has(input.selectedObjectId)) {
    issues.push(issue("REFERENCE_NOT_FOUND", "/selectedObjectId", "selectedObjectId 必须引用当前 objects 中的对象。", input.selectedObjectId));
  }

  const hasErrors = issues.some((current) => current.severity === "error");
  if (hasErrors) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    value: input as unknown as CurrentSandboxSnapshotV1,
    issues,
  };
}

function validateObject(value: unknown, index: number, issues: ValidationIssue[], objectIds: Set<string>): void {
  const path = `/objects/${index}`;
  if (!isRecord(value)) {
    issues.push(issue("INVALID_TYPE", path, "沙具必须是 JSON 对象。", value));
    return;
  }

  const id = expectNonEmptyString(value, "id", issues, path);
  if (id) {
    if (objectIds.has(id)) {
      issues.push(issue("DUPLICATE_ID", `${path}/id`, "沙具实例 ID 必须唯一。", id));
    }
    objectIds.add(id);
  }
  expectNonEmptyString(value, "assetId", issues, path);
  expectNonEmptyString(value, "name", issues, path);
  expectNonEmptyString(value, "category", issues, path);
  const riskTag = expectNonEmptyString(value, "riskTag", issues, path);
  if (riskTag && !RISK_TAGS.has(riskTag)) {
    issues.push(issue("INVALID_VALUE", `${path}/riskTag`, "未知风险标签必须先迁移为 unknown。", riskTag));
  }
  expectNonEmptyString(value, "riskLabel", issues, path);
  expectStringArray(value, "symbolicCandidates", issues, path);
  expectStringArray(value, "semanticTags", issues, path);
  expectNonNegativeInteger(value, "createdOrder", issues, path);

  const position = expectRecord(value, "position", issues, path);
  if (position) {
    expectFiniteNumber(position, "x", issues, `${path}/position`);
    expectFiniteNumber(position, "y", issues, `${path}/position`);
    expectNumberInRange(position, "xNorm", 0, 1, issues, `${path}/position`);
    expectNumberInRange(position, "yNorm", 0, 1, issues, `${path}/position`);
    const zone = expectNonEmptyString(position, "zone", issues, `${path}/position`);
    if (zone && !ZONE_IDS.has(zone as SnapshotZoneId)) {
      issues.push(issue("INVALID_VALUE", `${path}/position/zone`, "zone 必须是标准九宫格区域。", zone));
    }
    expectNonEmptyString(position, "zoneLabel", issues, `${path}/position`);
    expectBoolean(position, "inCenter", issues, `${path}/position`);
    expectBoolean(position, "inBoundary", issues, `${path}/position`);
    expectNonNegativeInteger(position, "depthRank", issues, `${path}/position`);
  }

  const transform = expectRecord(value, "transform", issues, path);
  if (transform) {
    expectFiniteNumber(transform, "rotationDeg", issues, `${path}/transform`);
    expectPositiveNumber(transform, "scale", issues, `${path}/transform`);
    expectNonNegativeNumber(transform, "width", issues, `${path}/transform`);
    expectNonNegativeNumber(transform, "height", issues, `${path}/transform`);
  }

  const footprint = expectRecord(value, "footprint", issues, path);
  if (footprint) {
    const kind = expectNonEmptyString(footprint, "kind", issues, `${path}/footprint`);
    if (kind && !FOOTPRINT_KINDS.has(kind)) {
      issues.push(issue("INVALID_VALUE", `${path}/footprint/kind`, "未知占地类型。", kind));
    }
    expectNonNegativeNumber(footprint, "width", issues, `${path}/footprint`);
    expectNonNegativeNumber(footprint, "depth", issues, `${path}/footprint`);
    expectNonNegativeNumber(footprint, "height", issues, `${path}/footprint`);
  }
}

function validateCountItems(parent: Record<string, unknown>, key: string, issues: ValidationIssue[]): void {
  const values = expectArray(parent, key, issues, "/analysis");
  if (!values) {
    return;
  }
  values.forEach((value, index) => {
    const path = `/analysis/${key}/${index}`;
    if (!isRecord(value)) {
      issues.push(issue("INVALID_TYPE", path, "统计项必须是 JSON 对象。", value));
      return;
    }
    expectNonEmptyString(value, "id", issues, path);
    expectNonEmptyString(value, "label", issues, path);
    expectNonNegativeInteger(value, "count", issues, path);
  });
}

function validateZoneArray(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath: string): void {
  const values = expectStringArray(parent, key, issues, basePath);
  values?.forEach((value, index) => {
    if (!ZONE_IDS.has(value as SnapshotZoneId)) {
      issues.push(issue("INVALID_VALUE", `${basePath}/${key}/${index}`, "未知九宫格区域。", value));
    }
  });
}

function validateDepthOrder(values: string[], objectIds: Set<string>, issues: ValidationIssue[]): void {
  const unique = new Set(values);
  if (unique.size !== values.length) {
    issues.push(issue("DUPLICATE_ID", "/analysis/depthOrder", "depthOrder 不能包含重复对象 ID。", values));
  }
  for (const id of values) {
    if (!objectIds.has(id)) {
      issues.push(issue("REFERENCE_NOT_FOUND", "/analysis/depthOrder", "depthOrder 引用了不存在的对象。", id));
    }
  }
  if (values.length !== objectIds.size) {
    issues.push(issue("COUNT_MISMATCH", "/analysis/depthOrder", "depthOrder 必须覆盖全部沙具。", values.length));
  }
}

function validateAggregateCount(value: unknown, expected: number, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    return;
  }
  const total = value.reduce((sum, item) => sum + (isRecord(item) && typeof item.count === "number" ? item.count : 0), 0);
  if (total !== expected) {
    issues.push(issue("COUNT_MISMATCH", path, "统计项 count 总和必须等于 objects 数量。", total));
  }
}

function expectRecord(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): Record<string, unknown> | undefined {
  const value = parent[key];
  if (value === undefined) {
    issues.push(issue("MISSING_FIELD", `${basePath}/${key}`, `缺少字段 ${key}。`));
    return undefined;
  }
  if (!isRecord(value)) {
    issues.push(issue("INVALID_TYPE", `${basePath}/${key}`, `${key} 必须是 JSON 对象。`, value));
    return undefined;
  }
  return value;
}

function expectArray(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): unknown[] | undefined {
  const value = parent[key];
  if (value === undefined) {
    issues.push(issue("MISSING_FIELD", `${basePath}/${key}`, `缺少字段 ${key}。`));
    return undefined;
  }
  if (!Array.isArray(value)) {
    issues.push(issue("INVALID_TYPE", `${basePath}/${key}`, `${key} 必须是数组。`, value));
    return undefined;
  }
  return value;
}

function expectString(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): string | undefined {
  const value = parent[key];
  if (value === undefined) {
    issues.push(issue("MISSING_FIELD", `${basePath}/${key}`, `缺少字段 ${key}。`));
    return undefined;
  }
  if (typeof value !== "string") {
    issues.push(issue("INVALID_TYPE", `${basePath}/${key}`, `${key} 必须是字符串。`, value));
    return undefined;
  }
  return value;
}

function expectNonEmptyString(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): string | undefined {
  const value = expectString(parent, key, issues, basePath);
  if (value !== undefined && value.trim().length === 0) {
    issues.push(issue("INVALID_VALUE", `${basePath}/${key}`, `${key} 不能为空。`, value));
    return undefined;
  }
  return value;
}

function expectIsoDate(parent: Record<string, unknown>, key: string, issues: ValidationIssue[]): void {
  const value = expectNonEmptyString(parent, key, issues);
  if (value && Number.isNaN(Date.parse(value))) {
    issues.push(issue("INVALID_VALUE", `/${key}`, `${key} 必须是有效的 ISO 8601 时间。`, value));
  }
}

function expectLiteral(parent: Record<string, unknown>, key: string, expected: string, issues: ValidationIssue[], basePath = ""): void {
  const value = parent[key];
  if (value === undefined) {
    issues.push(issue("MISSING_FIELD", `${basePath}/${key}`, `缺少字段 ${key}。`));
  } else if (value !== expected) {
    issues.push(issue("INVALID_VALUE", `${basePath}/${key}`, `${key} 必须是 ${expected}。`, value));
  }
}

function expectStringArray(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): string[] | undefined {
  const values = expectArray(parent, key, issues, basePath);
  if (!values) {
    return undefined;
  }
  const valid: string[] = [];
  values.forEach((value, index) => {
    if (typeof value !== "string") {
      issues.push(issue("INVALID_TYPE", `${basePath}/${key}/${index}`, "数组项必须是字符串。", value));
    } else {
      valid.push(value);
    }
  });
  return valid;
}

function expectBoolean(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): void {
  const value = parent[key];
  if (value === undefined) {
    issues.push(issue("MISSING_FIELD", `${basePath}/${key}`, `缺少字段 ${key}。`));
  } else if (typeof value !== "boolean") {
    issues.push(issue("INVALID_TYPE", `${basePath}/${key}`, `${key} 必须是布尔值。`, value));
  }
}

function expectFiniteNumber(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): number | undefined {
  const value = parent[key];
  if (value === undefined) {
    issues.push(issue("MISSING_FIELD", `${basePath}/${key}`, `缺少字段 ${key}。`));
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push(issue("INVALID_TYPE", `${basePath}/${key}`, `${key} 必须是有限数值。`, value));
    return undefined;
  }
  return value;
}

function expectPositiveNumber(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): void {
  const value = expectFiniteNumber(parent, key, issues, basePath);
  if (value !== undefined && value <= 0) {
    issues.push(issue("OUT_OF_RANGE", `${basePath}/${key}`, `${key} 必须大于 0。`, value));
  }
}

function expectNonNegativeNumber(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): void {
  const value = expectFiniteNumber(parent, key, issues, basePath);
  if (value !== undefined && value < 0) {
    issues.push(issue("OUT_OF_RANGE", `${basePath}/${key}`, `${key} 不能小于 0。`, value));
  }
}

function expectNumberInRange(parent: Record<string, unknown>, key: string, min: number, max: number, issues: ValidationIssue[], basePath = ""): void {
  const value = expectFiniteNumber(parent, key, issues, basePath);
  if (value !== undefined && (value < min || value > max)) {
    issues.push(issue("OUT_OF_RANGE", `${basePath}/${key}`, `${key} 必须在 ${min} 到 ${max} 之间。`, value));
  }
}

function expectNonNegativeInteger(parent: Record<string, unknown>, key: string, issues: ValidationIssue[], basePath = ""): void {
  const value = expectFiniteNumber(parent, key, issues, basePath);
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    issues.push(issue("OUT_OF_RANGE", `${basePath}/${key}`, `${key} 必须是非负整数。`, value));
  }
}

function issue(
  code: ValidationIssue["code"],
  path: string,
  message: string,
  actual?: unknown,
  severity: ValidationIssue["severity"] = "error",
): ValidationIssue {
  return { code, severity, path: path || "/", message, ...(actual === undefined ? {} : { actual }) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
