import type { SandboxEvent, SandboxObject } from "../types";

const STORAGE_KEY = "psych-sandbox-2-5d-demo.scene";

interface StoredScene {
  objects: SandboxObject[];
  events: SandboxEvent[];
}

export function loadScene(): StoredScene | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredScene;
    if (!Array.isArray(parsed.objects) || !Array.isArray(parsed.events)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveScene(scene: StoredScene): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
}
