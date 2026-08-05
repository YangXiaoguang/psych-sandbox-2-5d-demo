export type ValidationIssueSeverity = "error" | "warning";

export type ValidationIssueCode =
  | "INVALID_TYPE"
  | "MISSING_FIELD"
  | "INVALID_VALUE"
  | "OUT_OF_RANGE"
  | "DUPLICATE_ID"
  | "REFERENCE_NOT_FOUND"
  | "COUNT_MISMATCH"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "MIGRATION_NOT_FOUND"
  | "MIGRATION_FAILED";

export interface ValidationIssue {
  code: ValidationIssueCode;
  severity: ValidationIssueSeverity;
  path: string;
  message: string;
  actual?: unknown;
}

export type ValidationResult<T> =
  | {
      ok: true;
      value: T;
      issues: ValidationIssue[];
    }
  | {
      ok: false;
      issues: ValidationIssue[];
    };
