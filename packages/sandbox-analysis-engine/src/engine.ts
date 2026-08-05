import type { SnapshotMigration, SnapshotMigrationResult } from "./contracts/migration.js";
import { CURRENT_SANDBOX_SNAPSHOT_V1, type CurrentSandboxSnapshotV1 } from "./contracts/snapshot.js";
import type { ValidationResult } from "./contracts/validation.js";
import { migrateSnapshotToCurrent, SnapshotMigrationRegistry } from "./migrations/registry.js";
import { validateCurrentSandboxSnapshot } from "./validation/validateSnapshot.js";

export interface CreateSandboxAnalysisEngineOptions {
  migrations?: SnapshotMigration[];
}

export interface SandboxAnalysisEngine {
  readonly currentSnapshotSchemaVersion: typeof CURRENT_SANDBOX_SNAPSHOT_V1;
  validateSnapshot(input: unknown): ValidationResult<CurrentSandboxSnapshotV1>;
  migrateSnapshot(input: unknown): SnapshotMigrationResult;
  parseSnapshot(input: unknown): SnapshotMigrationResult;
  registerMigration(migration: SnapshotMigration): void;
  listMigrations(): ReadonlyArray<Pick<SnapshotMigration, "fromVersion" | "toVersion" | "description">>;
  getSupportedSnapshotVersions(): string[];
}

export function createSandboxAnalysisEngine(
  options: CreateSandboxAnalysisEngineOptions = {},
): SandboxAnalysisEngine {
  const registry = new SnapshotMigrationRegistry(options.migrations);

  return {
    currentSnapshotSchemaVersion: CURRENT_SANDBOX_SNAPSHOT_V1,
    validateSnapshot: validateCurrentSandboxSnapshot,
    migrateSnapshot(input) {
      return migrateSnapshotToCurrent(input, registry);
    },
    parseSnapshot(input) {
      return migrateSnapshotToCurrent(input, registry);
    },
    registerMigration(migration) {
      registry.register(migration);
    },
    listMigrations() {
      return registry.list().map(({ fromVersion, toVersion, description }) => ({ fromVersion, toVersion, description }));
    },
    getSupportedSnapshotVersions() {
      return [
        CURRENT_SANDBOX_SNAPSHOT_V1,
        ...new Set(registry.list().map((migration) => migration.fromVersion)),
      ];
    },
  };
}
