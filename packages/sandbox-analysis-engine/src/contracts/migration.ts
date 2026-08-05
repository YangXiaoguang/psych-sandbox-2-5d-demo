import type { CurrentSandboxSnapshotV1 } from "./snapshot.js";
import type { ValidationIssue } from "./validation.js";

export interface SnapshotMigration {
  fromVersion: string;
  toVersion: string;
  description: string;
  migrate(input: unknown): unknown;
}

export interface AppliedSnapshotMigration {
  fromVersion: string;
  toVersion: string;
  description: string;
}

export type SnapshotMigrationResult =
  | {
      ok: true;
      value: CurrentSandboxSnapshotV1;
      sourceVersion: string;
      targetVersion: string;
      appliedMigrations: AppliedSnapshotMigration[];
      issues: ValidationIssue[];
    }
  | {
      ok: false;
      sourceVersion?: string;
      targetVersion: string;
      appliedMigrations: AppliedSnapshotMigration[];
      issues: ValidationIssue[];
    };
