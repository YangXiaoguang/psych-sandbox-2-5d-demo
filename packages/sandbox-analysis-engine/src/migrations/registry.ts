import { CURRENT_SANDBOX_SNAPSHOT_V1 } from "../contracts/snapshot.js";
import type { AppliedSnapshotMigration, SnapshotMigration, SnapshotMigrationResult } from "../contracts/migration.js";
import type { ValidationIssue } from "../contracts/validation.js";
import { readSnapshotSchemaVersion, validateCurrentSandboxSnapshot } from "../validation/validateSnapshot.js";

export class SnapshotMigrationRegistry {
  private readonly migrations = new Map<string, SnapshotMigration[]>();

  constructor(initialMigrations: SnapshotMigration[] = []) {
    initialMigrations.forEach((migration) => this.register(migration));
  }

  register(migration: SnapshotMigration): void {
    if (!migration.fromVersion.trim() || !migration.toVersion.trim()) {
      throw new Error("Snapshot migration versions cannot be empty.");
    }
    if (migration.fromVersion === migration.toVersion) {
      throw new Error("Snapshot migration must change the schema version.");
    }
    const existing = this.migrations.get(migration.fromVersion) ?? [];
    if (existing.some((candidate) => candidate.toVersion === migration.toVersion)) {
      throw new Error(`Duplicate snapshot migration: ${migration.fromVersion} -> ${migration.toVersion}`);
    }
    this.migrations.set(migration.fromVersion, [...existing, migration]);
  }

  list(): SnapshotMigration[] {
    return [...this.migrations.values()].flat().map((migration) => ({ ...migration }));
  }

  findPath(sourceVersion: string, targetVersion: string): SnapshotMigration[] | undefined {
    if (sourceVersion === targetVersion) {
      return [];
    }

    const queue: Array<{ version: string; path: SnapshotMigration[] }> = [{ version: sourceVersion, path: [] }];
    const visited = new Set([sourceVersion]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }
      for (const migration of this.migrations.get(current.version) ?? []) {
        if (visited.has(migration.toVersion)) {
          continue;
        }
        const path = [...current.path, migration];
        if (migration.toVersion === targetVersion) {
          return path;
        }
        visited.add(migration.toVersion);
        queue.push({ version: migration.toVersion, path });
      }
    }

    return undefined;
  }
}

export function migrateSnapshotToCurrent(
  input: unknown,
  registry: SnapshotMigrationRegistry,
): SnapshotMigrationResult {
  const sourceVersion = readSnapshotSchemaVersion(input);
  if (!sourceVersion) {
    return migrationFailure(undefined, [], {
      code: "MISSING_FIELD",
      severity: "error",
      path: "/schemaVersion",
      message: "Snapshot 缺少 schemaVersion；禁止猜测历史结构。",
    });
  }

  const path = registry.findPath(sourceVersion, CURRENT_SANDBOX_SNAPSHOT_V1);
  if (!path) {
    return migrationFailure(sourceVersion, [], {
      code: "MIGRATION_NOT_FOUND",
      severity: "error",
      path: "/schemaVersion",
      message: `没有从 ${sourceVersion} 到 ${CURRENT_SANDBOX_SNAPSHOT_V1} 的已注册迁移。`,
      actual: sourceVersion,
    });
  }

  let migrated = input;
  const appliedMigrations: AppliedSnapshotMigration[] = [];
  for (const migration of path) {
    try {
      migrated = migration.migrate(migrated);
      appliedMigrations.push({
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
        description: migration.description,
      });
    } catch (error) {
      return migrationFailure(sourceVersion, appliedMigrations, {
        code: "MIGRATION_FAILED",
        severity: "error",
        path: "/",
        message: error instanceof Error ? error.message : "Snapshot 迁移失败。",
      });
    }
  }

  const validation = validateCurrentSandboxSnapshot(migrated);
  if (!validation.ok) {
    return {
      ok: false,
      sourceVersion,
      targetVersion: CURRENT_SANDBOX_SNAPSHOT_V1,
      appliedMigrations,
      issues: validation.issues,
    };
  }

  return {
    ok: true,
    value: validation.value,
    sourceVersion,
    targetVersion: CURRENT_SANDBOX_SNAPSHOT_V1,
    appliedMigrations,
    issues: validation.issues,
  };
}

function migrationFailure(
  sourceVersion: string | undefined,
  appliedMigrations: AppliedSnapshotMigration[],
  issue: ValidationIssue,
): SnapshotMigrationResult {
  return {
    ok: false,
    ...(sourceVersion ? { sourceVersion } : {}),
    targetVersion: CURRENT_SANDBOX_SNAPSHOT_V1,
    appliedMigrations,
    issues: [issue],
  };
}
