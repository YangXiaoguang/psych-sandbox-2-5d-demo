import { mockApiRepositoryAdapter, remoteApiRepositoryAdapter } from "./apiRepositoryAdapter";
import { localRepositoryAdapter } from "./localRepositoryAdapter";
import type { RepositoryHealthTone, RepositoryMode, SystemRepositoryAdapter } from "./repositoryTypes";

const REPOSITORY_MODE_STORAGE_KEY = "psych-sandbox-2-5d-demo.repository-mode.v1";

export interface RepositoryModeOption {
  mode: RepositoryMode;
  label: string;
  tone: RepositoryHealthTone;
  enabled: boolean;
  description: string;
}

export const REPOSITORY_MODE_OPTIONS: RepositoryModeOption[] = [
  {
    mode: "localStorage",
    label: "LocalStorage",
    tone: "ok",
    enabled: true,
    description: "当前稳定默认模式，所有数据保存在浏览器本地。",
  },
  {
    mode: "mockApi",
    label: "Mock API",
    tone: "ok",
    enabled: true,
    description: "使用前端 Mock API Adapter 演练 DTO、分页、错误码和认证上下文。",
  },
  {
    mode: "remoteApi",
    label: "Remote API",
    tone: "warn",
    enabled: true,
    description: "真实后端占位模式，前端具备 HTTP Client 骨架，服务端实现前仍由本地仓储兜底。",
  },
];

export function loadRepositoryMode(): RepositoryMode {
  try {
    const raw = localStorage.getItem(REPOSITORY_MODE_STORAGE_KEY);
    return isRepositoryMode(raw) ? raw : "localStorage";
  } catch {
    return "localStorage";
  }
}

export function saveRepositoryMode(mode: RepositoryMode): void {
  localStorage.setItem(REPOSITORY_MODE_STORAGE_KEY, mode);
}

export function getSystemRepositoryAdapter(mode: RepositoryMode): SystemRepositoryAdapter {
  if (mode === "mockApi") {
    return mockApiRepositoryAdapter;
  }
  if (mode === "remoteApi") {
    return remoteApiRepositoryAdapter;
  }
  return localRepositoryAdapter;
}

export function isRepositoryMode(value: unknown): value is RepositoryMode {
  return value === "localStorage" || value === "mockApi" || value === "remoteApi";
}
