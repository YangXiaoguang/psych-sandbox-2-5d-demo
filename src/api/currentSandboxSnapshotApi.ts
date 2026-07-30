import { buildCurrentSandboxSnapshot } from "../llm/currentSandboxSnapshot";
import type {
  ApiResponseDto,
  BuildCurrentSandboxSnapshotRequestDto,
  CurrentSandboxSnapshotPolicyDto,
  CurrentSandboxSnapshotResponseDto,
} from "./contracts";

export const CURRENT_SANDBOX_SNAPSHOT_POLICY: CurrentSandboxSnapshotPolicyDto = {
  includesEvents: false,
  includesPersonalMemory: false,
  includesUserIdentity: false,
  includesImage: false,
  note: "只包含当前沙盘状态；不包含事件流、个人记忆、用户身份、授权上下文或截图。",
};

export function createCurrentSandboxSnapshotPayload(
  request: BuildCurrentSandboxSnapshotRequestDto,
): CurrentSandboxSnapshotResponseDto {
  return {
    snapshot: buildCurrentSandboxSnapshot(request),
    policy: CURRENT_SANDBOX_SNAPSHOT_POLICY,
  };
}

export function createCurrentSandboxSnapshotResponse(
  request: BuildCurrentSandboxSnapshotRequestDto,
): ApiResponseDto<CurrentSandboxSnapshotResponseDto> {
  const requestId = createRequestId();

  return {
    ok: true,
    requestId,
    data: createCurrentSandboxSnapshotPayload(request),
  };
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `req_${crypto.randomUUID()}`;
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
