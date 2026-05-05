import { createId } from "../utils/id";
import type { LocalAuthIdentity, LocalAuthLoginInput, LocalAuthRegisterInput, LocalAuthSession } from "./types";

const AUTH_IDENTITIES_KEY = "psych-sandbox-2-5d-demo.local-auth-identities.v1";
const AUTH_SESSION_KEY = "psych-sandbox-2-5d-demo.local-auth-session.v1";

export function loadLocalAuthSession(): LocalAuthSession | null {
  const session = readJson<LocalAuthSession>(AUTH_SESSION_KEY);
  if (!isLocalAuthSession(session)) {
    return null;
  }

  return session;
}

export function saveLocalAuthSession(session: LocalAuthSession): void {
  writeJson(AUTH_SESSION_KEY, {
    ...session,
    lastSeenAt: new Date().toISOString(),
  });
}

export function clearLocalAuthSession(): void {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

export function loadLocalAuthIdentities(): LocalAuthIdentity[] {
  const identities = readJson<LocalAuthIdentity[]>(AUTH_IDENTITIES_KEY);
  if (!Array.isArray(identities)) {
    return [];
  }

  return identities.filter(isLocalAuthIdentity);
}

export function isLocalAuthEmailAvailable(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  return !loadLocalAuthIdentities().some((identity) => identity.email === normalizedEmail);
}

export async function registerLocalAuthIdentity(input: LocalAuthRegisterInput): Promise<LocalAuthSession> {
  const normalizedEmail = normalizeEmail(input.email);
  validateEmailAndPassword(normalizedEmail, input.password);

  const identities = loadLocalAuthIdentities();
  if (identities.some((identity) => identity.email === normalizedEmail)) {
    throw new Error("该邮箱已经注册，请直接登录或使用其他邮箱。");
  }

  const now = new Date().toISOString();
  const salt = createId("salt");
  const identity: LocalAuthIdentity = {
    authId: createId("auth"),
    userId: input.userId,
    email: normalizedEmail,
    displayName: input.displayName.trim() || "新的本地用户",
    passwordHash: await hashPassword(input.password, salt),
    salt,
    status: "active",
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };
  writeJson(AUTH_IDENTITIES_KEY, [identity, ...identities].slice(0, 20000));
  const session = createPasswordSession(identity, now);
  saveLocalAuthSession(session);
  return session;
}

export async function loginLocalAuthIdentity(input: LocalAuthLoginInput): Promise<LocalAuthSession> {
  const normalizedEmail = normalizeEmail(input.email);
  const identities = loadLocalAuthIdentities();
  const identity = identities.find((item) => item.email === normalizedEmail);
  if (!identity || identity.status !== "active") {
    throw new Error("未找到可用账号，请检查邮箱或先注册。");
  }

  const passwordHash = await hashPassword(input.password, identity.salt);
  if (passwordHash !== identity.passwordHash) {
    throw new Error("密码不正确。");
  }

  const now = new Date().toISOString();
  writeJson(
    AUTH_IDENTITIES_KEY,
    identities.map((item) =>
      item.authId === identity.authId ? { ...item, lastLoginAt: now, updatedAt: now } : item,
    ),
  );
  const session = createPasswordSession(identity, now);
  saveLocalAuthSession(session);
  return session;
}

export function createGuestAuthSession(input: { userId: string; displayName: string }): LocalAuthSession {
  const now = new Date().toISOString();
  const session: LocalAuthSession = {
    sessionId: createId("session"),
    userId: input.userId,
    displayName: input.displayName,
    authMode: "guest",
    issuedAt: now,
    lastSeenAt: now,
  };
  saveLocalAuthSession(session);
  return session;
}

export async function createLocalPasswordResetPreview(email: string): Promise<string> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("请输入注册邮箱。");
  }

  const identity = loadLocalAuthIdentities().find((item) => item.email === normalizedEmail);
  if (!identity) {
    return "如果该邮箱存在，本地原型会显示重置指引。当前没有找到匹配账号。";
  }

  return `本地原型不会发送真实邮件。请在后续服务端版本接入一次性重置链接；当前账号为：${identity.displayName}。`;
}

function createPasswordSession(identity: LocalAuthIdentity, now: string): LocalAuthSession {
  return {
    sessionId: createId("session"),
    userId: identity.userId,
    email: identity.email,
    displayName: identity.displayName,
    authMode: "password",
    issuedAt: now,
    lastSeenAt: now,
  };
}

function validateEmailAndPassword(email: string, password: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("请输入有效邮箱地址。");
  }
  if (password.length < 8) {
    throw new Error("密码至少需要 8 位。");
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const value = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return btoa(unescape(encodeURIComponent(value)));
}

function isLocalAuthIdentity(value: unknown): value is LocalAuthIdentity {
  if (!value || typeof value !== "object") {
    return false;
  }
  const identity = value as Partial<LocalAuthIdentity>;
  return (
    typeof identity.authId === "string" &&
    typeof identity.userId === "string" &&
    typeof identity.email === "string" &&
    typeof identity.passwordHash === "string" &&
    typeof identity.salt === "string" &&
    identity.status === "active"
  );
}

function isLocalAuthSession(value: unknown): value is LocalAuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const session = value as Partial<LocalAuthSession>;
  return (
    typeof session.sessionId === "string" &&
    typeof session.userId === "string" &&
    typeof session.displayName === "string" &&
    (session.authMode === "password" || session.authMode === "guest")
  );
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}
