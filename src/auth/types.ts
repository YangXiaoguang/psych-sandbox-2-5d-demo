import type { PersonalAgeGroup, PersonalRole } from "../personal/types";

export type LocalAuthMode = "password" | "guest";
export type LocalAuthStatus = "active" | "disabled";

export interface LocalAuthIdentity {
  authId: string;
  userId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  status: LocalAuthStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface LocalAuthSession {
  sessionId: string;
  userId: string;
  email?: string;
  displayName: string;
  authMode: LocalAuthMode;
  issuedAt: string;
  lastSeenAt: string;
}

export interface LocalAuthLoginInput {
  email: string;
  password: string;
}

export interface LocalAuthRegisterInput extends LocalAuthLoginInput {
  userId: string;
  displayName: string;
  ageGroup: PersonalAgeGroup;
  role: PersonalRole;
}
