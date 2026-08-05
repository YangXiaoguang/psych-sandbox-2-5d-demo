import type { SnapshotMigration, SnapshotMigrationResult } from "./contracts/migration.js";
import type { DeterministicSnapshotAnalysisV1, FeatureBundleV1 } from "./contracts/features.js";
import type { ReconstructedSceneV1 } from "./contracts/scene.js";
import { CURRENT_SANDBOX_SNAPSHOT_V1, type CurrentSandboxSnapshotV1 } from "./contracts/snapshot.js";
import type { ValidationResult } from "./contracts/validation.js";
import { extractFeatures as extractDeterministicFeatures } from "./features/extractFeatures.js";
import { migrateSnapshotToCurrent, SnapshotMigrationRegistry } from "./migrations/registry.js";
import { reconstructScene as reconstructDeterministicScene } from "./reconstruction/reconstructScene.js";
import { validateCurrentSandboxSnapshot } from "./validation/validateSnapshot.js";

export interface CreateSandboxAnalysisEngineOptions {
  migrations?: SnapshotMigration[];
}

export type SceneReconstructionResult =
  | {
      ok: true;
      value: ReconstructedSceneV1;
      snapshot: CurrentSandboxSnapshotV1;
      migration: SnapshotMigrationResult & { ok: true };
    }
  | {
      ok: false;
      migration: SnapshotMigrationResult & { ok: false };
    };

export type DeterministicSnapshotAnalysisResult =
  | {
      ok: true;
      value: DeterministicSnapshotAnalysisV1;
      snapshot: CurrentSandboxSnapshotV1;
      migration: SnapshotMigrationResult & { ok: true };
    }
  | {
      ok: false;
      migration: SnapshotMigrationResult & { ok: false };
    };

export interface SandboxAnalysisEngine {
  readonly currentSnapshotSchemaVersion: typeof CURRENT_SANDBOX_SNAPSHOT_V1;
  validateSnapshot(input: unknown): ValidationResult<CurrentSandboxSnapshotV1>;
  migrateSnapshot(input: unknown): SnapshotMigrationResult;
  parseSnapshot(input: unknown): SnapshotMigrationResult;
  reconstructScene(input: unknown): SceneReconstructionResult;
  extractFeatures(scene: ReconstructedSceneV1): FeatureBundleV1;
  analyzeDeterministically(input: unknown): DeterministicSnapshotAnalysisResult;
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
    reconstructScene(input) {
      const migration = migrateSnapshotToCurrent(input, registry);
      if (!migration.ok) {
        return { ok: false, migration };
      }
      return {
        ok: true,
        value: reconstructDeterministicScene(migration.value),
        snapshot: migration.value,
        migration,
      };
    },
    extractFeatures(scene) {
      return extractDeterministicFeatures(scene);
    },
    analyzeDeterministically(input) {
      const migration = migrateSnapshotToCurrent(input, registry);
      if (!migration.ok) {
        return { ok: false, migration };
      }
      const scene = reconstructDeterministicScene(migration.value);
      const featureBundle = extractDeterministicFeatures(scene);
      return {
        ok: true,
        value: { scene, featureBundle },
        snapshot: migration.value,
        migration,
      };
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
