import type { DatasetIssue } from "../contracts/dataset.js";

const FORBIDDEN_KEYS = new Set([
  "accountid",
  "accesstoken",
  "address",
  "apikey",
  "email",
  "events",
  "fullname",
  "idcard",
  "identitycard",
  "medicalhistory",
  "mobile",
  "password",
  "personalmemory",
  "phone",
  "realname",
  "userid",
]);
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const CHINESE_MOBILE_PATTERN = /(?<!\d)1[3-9]\d{9}(?!\d)/u;
const SECRET_PATTERN = /\b(?:sk|api|token)[-_][A-Za-z0-9_-]{12,}\b/iu;

/**
 * Conservative supplementary scan. A passing result does not replace consent,
 * de-identification review or the governance attestations enforced by the service.
 */
export function scanEvaluationCasePrivacy(value: unknown): readonly DatasetIssue[] {
  const issues: DatasetIssue[] = [];
  visit(value, "", issues);
  return issues;
}

function visit(value: unknown, path: string, issues: DatasetIssue[]): void {
  if (typeof value === "string") {
    if (isCryptographicDigest(path, value)) return;
    if (EMAIL_PATTERN.test(value)) issues.push(issue(path || "/", "Email-like direct identity was detected."));
    if (CHINESE_MOBILE_PATTERN.test(value)) issues.push(issue(path || "/", "Mobile-number-like direct identity was detected."));
    if (SECRET_PATTERN.test(value)) issues.push(issue(path || "/", "API key or token-like secret was detected."));
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, `${path}/${index}`, issues));
    return;
  }
  if (value === null || typeof value !== "object") return;
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    const childPath = `${path}/${escapePointer(key)}`;
    if (FORBIDDEN_KEYS.has(key.toLowerCase().replace(/[_-]/gu, ""))) {
      issues.push(issue(childPath, `Forbidden sensitive field '${key}' was detected.`));
    }
    visit(child, childPath, issues);
  });
}

function isCryptographicDigest(path: string, value: string): boolean {
  const segments = path.split("/");
  const field = segments[segments.length - 1]?.toLowerCase() ?? "";
  return field.endsWith("hash") && /^[a-f0-9]{64}$/u.test(value);
}

function issue(path: string, message: string): DatasetIssue {
  return { code: "PRIVACY_SCAN_FAILED", path, message };
}

function escapePointer(value: string): string {
  return value.replace(/~/gu, "~0").replace(/\//gu, "~1");
}
