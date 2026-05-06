import type { AdminAccessRole, AdminAccessStatus, AdminPermissionKey, AdminWorkspaceScope } from "../admin/types";
import type {
  CommunicationTone,
  ConsentScope,
  MemoryCandidateKind,
  MemoryCandidateStatus,
  PersonalAccountStatus,
  PersonalAgeGroup,
  PersonalAuthMode,
  PersonalRole,
  ReplyLengthPreference,
  SandtrayArchiveStatus,
} from "../personal/types";
import type {
  AgentAvatarStyle,
  LlmProviderConfig,
  LlmProviderKind,
  ManagedAsset,
  RiskTag,
  SandboxAnalysis,
  SandboxEnvironment,
  SandboxEvent,
  SandboxObject,
} from "../types";

export const API_CONTRACT_VERSION = "2026-05-06.v1";

export type ApiHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
export type ApiAuthMode = "local_demo" | "session_cookie" | "bearer_token" | "service_account";
export type ApiSortDirection = "asc" | "desc";
export type ApiFilterValue = string | number | boolean | null | Array<string | number | boolean>;

export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_FORBIDDEN"
  | "AUTH_EXPIRED"
  | "VALIDATION_FAILED"
  | "RESOURCE_NOT_FOUND"
  | "RESOURCE_CONFLICT"
  | "PAGE_OUT_OF_RANGE"
  | "REQUEST_TIMEOUT"
  | "RATE_LIMITED"
  | "TASK_ACCEPTED"
  | "LLM_PROVIDER_ERROR"
  | "EXPORT_FAILED"
  | "INTERNAL_ERROR";

export interface ApiErrorCatalogItem {
  code: ApiErrorCode;
  httpStatus: number;
  label: string;
  retryable: boolean;
  description: string;
  userMessage: string;
}

export interface ApiAuthContextDto {
  requestId: string;
  actorUserId: string;
  activeUserId: string;
  role: AdminAccessRole;
  permissions: AdminPermissionKey[];
  workspaceScope: AdminWorkspaceScope;
  workspaceIds: string[];
  authMode: ApiAuthMode;
  issuedAt: string;
  expiresAt: string;
  timezone: string;
  locale: "zh-CN" | "en-US";
}

export interface ApiErrorDto {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId: string;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
}

export type ApiResponseDto<T> =
  | {
      ok: true;
      requestId: string;
      data: T;
      warnings?: string[];
    }
  | {
      ok: false;
      requestId: string;
      error: ApiErrorDto;
    };

export interface ApiSortDto {
  field: string;
  direction: ApiSortDirection;
}

export interface ApiPaginationRequestDto {
  page: number;
  pageSize: number;
  query?: string;
  sort?: ApiSortDto[];
  filters?: Record<string, ApiFilterValue>;
}

export interface ApiPageMetaDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor?: string;
  stableSortKey: string;
}

export interface ApiPagePayloadDto<T> {
  items: T[];
  page: ApiPageMetaDto;
}

export type ApiPageResponseDto<T> = ApiResponseDto<ApiPagePayloadDto<T>>;

export interface ApiPaginationProtocol {
  defaultPageSize: number;
  maxPageSize: number;
  minPageSize: number;
  pageBase: 1;
  queryParam: "query";
  filterFormat: "filters[field]=value";
  sortFormat: "sort=field:asc,updatedAt:desc";
  cursorMigrationNote: string;
}

export interface UserDto {
  userId: string;
  localHandle: string;
  displayName: string;
  authMode: PersonalAuthMode;
  status: PersonalAccountStatus;
  ageGroup: PersonalAgeGroup;
  role: PersonalRole;
  workspaceCount: number;
  sandtraySessionCount: number;
  memoryCandidateCount: number;
  createdAt: string;
  lastActiveAt: string;
}

export interface WorkspaceDto {
  workspaceId: string;
  ownerUserId: string;
  title: string;
  description: string;
  active: boolean;
  sandtraySessionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccessPolicyDto {
  userId: string;
  role: AdminAccessRole;
  status: AdminAccessStatus;
  workspaceScope: AdminWorkspaceScope;
  deniedPermissions: AdminPermissionKey[];
  effectivePermissions: AdminPermissionKey[];
  note: string;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt?: string;
}

export interface MemoryCandidateDto {
  memoryId: string;
  userId: string;
  sourceSessionId?: string;
  kind: MemoryCandidateKind;
  status: MemoryCandidateStatus;
  title: string;
  summary: string;
  tags: string[];
  confidence: number;
  includeInAgentContext: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SandtraySessionSummaryDto {
  sessionId: string;
  userId: string;
  workspaceId?: string;
  title: string;
  status: SandtrayArchiveStatus;
  objectCount: number;
  eventCount: number;
  dominantCategories: string[];
  riskDistribution: Record<RiskTag, number>;
  environment: SandboxEnvironment;
  createdAt: string;
  updatedAt: string;
  archivedAt: string;
}

export interface AssetSummaryDto {
  assetId: string;
  name: string;
  category: string;
  riskTag: RiskTag;
  enabled: boolean;
  isBuiltIn: boolean;
  semanticTags: string[];
  thumbnailScale: number;
  updatedAt: string;
  deletedAt?: string;
}

export interface LlmProviderSummaryDto {
  id: string;
  name: string;
  provider: LlmProviderKind;
  baseUrl: string;
  model: string;
  enabled: boolean;
  apiKeyConfigured: boolean;
  apiKeyPreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface PsychAgentSummaryDto {
  id: string;
  name: string;
  school: string;
  description: string;
  avatarStyle: AgentAvatarStyle;
  providerId?: string;
  temperature: number;
  enabled: boolean;
  isBuiltIn: boolean;
  updatedAt: string;
}

export interface RegisterUserRequestDto {
  displayName: string;
  email: string;
  password: string;
  ageGroup: PersonalAgeGroup;
  role: PersonalRole;
  consentScope: ConsentScope;
}

export interface LoginRequestDto {
  email: string;
  password: string;
  rememberSession: boolean;
}

export interface UpdateUserProfileRequestDto {
  displayName?: string;
  ageGroup?: PersonalAgeGroup;
  role?: PersonalRole;
  timezone?: string;
  preferredLanguage?: "zh-CN" | "en-US";
  notes?: string;
  preferredTone?: CommunicationTone;
  replyLength?: ReplyLengthPreference;
}

export interface UpsertAccessPolicyRequestDto {
  userId: string;
  role: AdminAccessRole;
  status: AdminAccessStatus;
  workspaceScope: AdminWorkspaceScope;
  deniedPermissions: AdminPermissionKey[];
  note: string;
}

export interface SaveSandtraySnapshotRequestDto {
  sessionId?: string;
  userId: string;
  workspaceId?: string;
  title: string;
  description: string;
  environment: SandboxEnvironment;
  objects: SandboxObject[];
  events: SandboxEvent[];
  analysis: SandboxAnalysis;
  capturedAt: string;
}

export interface UpdateMemoryCandidateRequestDto {
  memoryId: string;
  status?: MemoryCandidateStatus;
  title?: string;
  summary?: string;
  tags?: string[];
  includeInAgentContext?: boolean;
}

export interface UpsertAssetRequestDto {
  asset: ManagedAsset;
  changeReason: string;
}

export interface SaveLlmProviderRequestDto {
  provider: Omit<LlmProviderConfig, "apiKey">;
  apiKeySecret?: string;
  rotateSecret: boolean;
}

export interface UpsertAgentRequestDto {
  id?: string;
  name: string;
  school: string;
  description: string;
  avatarStyle: AgentAvatarStyle;
  openingMessage: string;
  systemPrompt: string;
  providerId?: string;
  temperature: number;
  enabled: boolean;
}

export interface CreateTaskRequestDto {
  taskType: "archive_export" | "archive_import" | "asset_bulk_update" | "memory_rebuild" | "llm_connection_test";
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

export interface TaskStatusDto {
  taskId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiEndpointContract {
  method: ApiHttpMethod;
  path: string;
  summary: string;
  auth: "required" | "admin" | "owner-or-admin";
  requestDto: string;
  responseDto: string;
  paginated: boolean;
  errors: ApiErrorCode[];
  migrationPriority: "p0" | "p1" | "p2";
}

export interface ApiContractReport {
  version: string;
  generatedAt: string;
  adapterName: string;
  authContext: ApiAuthContextDto;
  pagination: ApiPaginationProtocol;
  errors: ApiErrorCatalogItem[];
  endpoints: ApiEndpointContract[];
  sampleUserPage: ApiPageResponseDto<UserDto>;
  sampleWorkspacePage: ApiPageResponseDto<WorkspaceDto>;
  sampleMemoryPage: ApiPageResponseDto<MemoryCandidateDto>;
  sampleAssetPage: ApiPageResponseDto<AssetSummaryDto>;
  sampleLlmProviderPage: ApiPageResponseDto<LlmProviderSummaryDto>;
}

export const API_PAGINATION_PROTOCOL: ApiPaginationProtocol = {
  defaultPageSize: 20,
  maxPageSize: 100,
  minPageSize: 1,
  pageBase: 1,
  queryParam: "query",
  filterFormat: "filters[field]=value",
  sortFormat: "sort=field:asc,updatedAt:desc",
  cursorMigrationNote: "万级数据第一版采用 page/pageSize；服务端上线后可在不破坏前端 DTO 的前提下补充 nextCursor。",
};

export const API_ERROR_CATALOG: ApiErrorCatalogItem[] = [
  {
    code: "AUTH_REQUIRED",
    httpStatus: 401,
    label: "未登录",
    retryable: false,
    description: "请求缺少有效身份，会话不存在或未携带凭据。",
    userMessage: "请先登录后再继续操作。",
  },
  {
    code: "AUTH_FORBIDDEN",
    httpStatus: 403,
    label: "权限不足",
    retryable: false,
    description: "认证有效，但角色或授权范围不能访问目标资源。",
    userMessage: "当前账号没有执行该操作的权限。",
  },
  {
    code: "AUTH_EXPIRED",
    httpStatus: 401,
    label: "会话过期",
    retryable: true,
    description: "访问令牌或服务端会话已经过期。",
    userMessage: "登录状态已过期，请重新登录。",
  },
  {
    code: "VALIDATION_FAILED",
    httpStatus: 422,
    label: "字段校验失败",
    retryable: false,
    description: "DTO 字段缺失、格式错误或越过业务边界。",
    userMessage: "请检查表单内容后再提交。",
  },
  {
    code: "RESOURCE_NOT_FOUND",
    httpStatus: 404,
    label: "资源不存在",
    retryable: false,
    description: "目标用户、工作区、沙盘档案或资产不存在。",
    userMessage: "没有找到对应的数据。",
  },
  {
    code: "RESOURCE_CONFLICT",
    httpStatus: 409,
    label: "资源冲突",
    retryable: false,
    description: "唯一键、版本号或归档状态与当前操作冲突。",
    userMessage: "数据状态已变化，请刷新后再试。",
  },
  {
    code: "PAGE_OUT_OF_RANGE",
    httpStatus: 400,
    label: "分页越界",
    retryable: false,
    description: "分页参数超出允许范围。",
    userMessage: "分页参数无效。",
  },
  {
    code: "REQUEST_TIMEOUT",
    httpStatus: 408,
    label: "请求超时",
    retryable: true,
    description: "网络请求超过前端或服务端允许的等待时间。",
    userMessage: "请求超时，请稍后重试。",
  },
  {
    code: "RATE_LIMITED",
    httpStatus: 429,
    label: "请求过快",
    retryable: true,
    description: "用户、IP 或工作区级别的限流被触发。",
    userMessage: "请求太频繁，请稍后再试。",
  },
  {
    code: "TASK_ACCEPTED",
    httpStatus: 202,
    label: "异步任务已接收",
    retryable: true,
    description: "导入、导出、批量处理等长任务已进入后台队列。",
    userMessage: "任务已开始，完成后会更新状态。",
  },
  {
    code: "LLM_PROVIDER_ERROR",
    httpStatus: 502,
    label: "模型服务异常",
    retryable: true,
    description: "第三方 LLM provider 调用失败、超时或返回异常。",
    userMessage: "AI 服务暂时不可用，稍后可重试。",
  },
  {
    code: "EXPORT_FAILED",
    httpStatus: 500,
    label: "导出失败",
    retryable: true,
    description: "PNG、JSON 或个人档案导出过程失败。",
    userMessage: "导出失败，请稍后重试。",
  },
  {
    code: "INTERNAL_ERROR",
    httpStatus: 500,
    label: "系统异常",
    retryable: true,
    description: "未预期的服务端错误。",
    userMessage: "系统遇到异常，请稍后重试。",
  },
];

export const API_ENDPOINT_CONTRACTS: ApiEndpointContract[] = [
  {
    method: "GET",
    path: "/api/admin/users",
    summary: "万级用户目录分页查询，支持身份、状态、角色与关键词筛选。",
    auth: "admin",
    requestDto: "ApiPaginationRequestDto",
    responseDto: "ApiPageResponseDto<UserDto>",
    paginated: true,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "PAGE_OUT_OF_RANGE"],
    migrationPriority: "p0",
  },
  {
    method: "PATCH",
    path: "/api/admin/users/:userId",
    summary: "更新用户画像、沟通偏好和后台可见状态。",
    auth: "admin",
    requestDto: "UpdateUserProfileRequestDto",
    responseDto: "ApiResponseDto<UserDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "VALIDATION_FAILED", "RESOURCE_NOT_FOUND"],
    migrationPriority: "p0",
  },
  {
    method: "POST",
    path: "/api/auth/register",
    summary: "注册个人账号并初始化默认工作区、同意记录与本地偏好。",
    auth: "required",
    requestDto: "RegisterUserRequestDto",
    responseDto: "ApiResponseDto<UserDto>",
    paginated: false,
    errors: ["VALIDATION_FAILED", "RESOURCE_CONFLICT", "RATE_LIMITED"],
    migrationPriority: "p0",
  },
  {
    method: "POST",
    path: "/api/auth/login",
    summary: "登录并返回认证上下文，前端只消费上下文，不直接解析密钥。",
    auth: "required",
    requestDto: "LoginRequestDto",
    responseDto: "ApiResponseDto<ApiAuthContextDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "AUTH_EXPIRED", "RATE_LIMITED"],
    migrationPriority: "p0",
  },
  {
    method: "GET",
    path: "/api/workspaces",
    summary: "当前授权范围内的工作区分页列表。",
    auth: "required",
    requestDto: "ApiPaginationRequestDto",
    responseDto: "ApiPageResponseDto<WorkspaceDto>",
    paginated: true,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "PAGE_OUT_OF_RANGE"],
    migrationPriority: "p0",
  },
  {
    method: "PATCH",
    path: "/api/admin/access-policies/:userId",
    summary: "更新指定用户的后台角色、工作区范围、拒绝权限和复核备注。",
    auth: "admin",
    requestDto: "UpsertAccessPolicyRequestDto",
    responseDto: "ApiResponseDto<AccessPolicyDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "VALIDATION_FAILED", "RESOURCE_NOT_FOUND"],
    migrationPriority: "p0",
  },
  {
    method: "GET",
    path: "/api/admin/access-policies",
    summary: "后台权限策略矩阵与有效权限分页查询。",
    auth: "admin",
    requestDto: "ApiPaginationRequestDto",
    responseDto: "ApiPageResponseDto<AccessPolicyDto>",
    paginated: true,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN"],
    migrationPriority: "p0",
  },
  {
    method: "GET",
    path: "/api/sandtray/sessions",
    summary: "用户沙盘会话档案与历史作品分页查询。",
    auth: "owner-or-admin",
    requestDto: "ApiPaginationRequestDto",
    responseDto: "ApiPageResponseDto<SandtraySessionSummaryDto>",
    paginated: true,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "PAGE_OUT_OF_RANGE"],
    migrationPriority: "p0",
  },
  {
    method: "POST",
    path: "/api/sandtray/sessions/:sessionId/snapshots",
    summary: "保存沙盘作品快照、事件流和环境状态。",
    auth: "owner-or-admin",
    requestDto: "SaveSandtraySnapshotRequestDto",
    responseDto: "ApiResponseDto<SandtraySessionSummaryDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "VALIDATION_FAILED", "RESOURCE_CONFLICT"],
    migrationPriority: "p0",
  },
  {
    method: "GET",
    path: "/api/memory/candidates",
    summary: "个人记忆候选分页查询，可追踪来源沙盘、证据与 Agent 使用原因。",
    auth: "owner-or-admin",
    requestDto: "ApiPaginationRequestDto",
    responseDto: "ApiPageResponseDto<MemoryCandidateDto>",
    paginated: true,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "PAGE_OUT_OF_RANGE"],
    migrationPriority: "p1",
  },
  {
    method: "PATCH",
    path: "/api/memory/candidates/:memoryId",
    summary: "确认、驳回、屏蔽或编辑某条个人记忆候选。",
    auth: "owner-or-admin",
    requestDto: "UpdateMemoryCandidateRequestDto",
    responseDto: "ApiResponseDto<MemoryCandidateDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "VALIDATION_FAILED", "RESOURCE_NOT_FOUND"],
    migrationPriority: "p1",
  },
  {
    method: "GET",
    path: "/api/assets",
    summary: "沙具资产目录分页查询，支撑 300+ 资产搜索、标签和健康检查。",
    auth: "required",
    requestDto: "ApiPaginationRequestDto",
    responseDto: "ApiPageResponseDto<AssetSummaryDto>",
    paginated: true,
    errors: ["AUTH_REQUIRED", "PAGE_OUT_OF_RANGE"],
    migrationPriority: "p1",
  },
  {
    method: "POST",
    path: "/api/assets",
    summary: "新增或更新沙具资产，服务端负责版本、标签和健康检查。",
    auth: "admin",
    requestDto: "UpsertAssetRequestDto",
    responseDto: "ApiResponseDto<AssetSummaryDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "VALIDATION_FAILED", "RESOURCE_CONFLICT"],
    migrationPriority: "p1",
  },
  {
    method: "GET",
    path: "/api/admin/llm-providers",
    summary: "LLM 厂商配置分页查询，永不向前端回传明文 API Key。",
    auth: "admin",
    requestDto: "ApiPaginationRequestDto",
    responseDto: "ApiPageResponseDto<LlmProviderSummaryDto>",
    paginated: true,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN"],
    migrationPriority: "p1",
  },
  {
    method: "PATCH",
    path: "/api/admin/llm-providers/:providerId",
    summary: "保存 LLM 配置并可选择轮换密钥；响应永不返回明文 API Key。",
    auth: "admin",
    requestDto: "SaveLlmProviderRequestDto",
    responseDto: "ApiResponseDto<LlmProviderSummaryDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "VALIDATION_FAILED", "RESOURCE_NOT_FOUND"],
    migrationPriority: "p1",
  },
  {
    method: "GET",
    path: "/api/admin/agents",
    summary: "心理学取向 Agent 配置分页查询。",
    auth: "admin",
    requestDto: "ApiPaginationRequestDto",
    responseDto: "ApiPageResponseDto<PsychAgentSummaryDto>",
    paginated: true,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN"],
    migrationPriority: "p1",
  },
  {
    method: "POST",
    path: "/api/admin/agents",
    summary: "创建或更新心理学取向 Agent 的角色资料、提示词和 LLM 绑定。",
    auth: "admin",
    requestDto: "UpsertAgentRequestDto",
    responseDto: "ApiResponseDto<PsychAgentSummaryDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "VALIDATION_FAILED", "RESOURCE_CONFLICT"],
    migrationPriority: "p1",
  },
  {
    method: "POST",
    path: "/api/tasks",
    summary: "导入、导出、批量资产处理等长任务入口，返回可轮询 taskId。",
    auth: "admin",
    requestDto: "CreateTaskRequestDto",
    responseDto: "ApiResponseDto<TaskStatusDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "TASK_ACCEPTED", "INTERNAL_ERROR"],
    migrationPriority: "p2",
  },
];
