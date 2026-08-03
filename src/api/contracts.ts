import type { AdminAccessRole, AdminAccessStatus, AdminPermissionKey, AdminWorkspaceScope } from "../admin/types";
import type { CurrentSandboxInsight } from "../analysis/currentSandboxInsight";
import type { CurrentSandboxSnapshot } from "../analysis/currentSandboxSnapshot";
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

export interface BuildCurrentSandboxSnapshotRequestDto {
  environment: SandboxEnvironment;
  objects: SandboxObject[];
  selectedObjectId?: string | null;
  generatedAt?: string;
  snapshotId?: string;
}

export interface CurrentSandboxSnapshotPolicyDto {
  includesEvents: false;
  includesPersonalMemory: false;
  includesUserIdentity: false;
  includesImage: false;
  note: string;
}

export interface CurrentSandboxSnapshotResponseDto {
  snapshot: CurrentSandboxSnapshot;
  insight: CurrentSandboxInsight;
  policy: CurrentSandboxSnapshotPolicyDto;
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

export type ApiEndpointAuthRequirement = "required" | "admin" | "owner-or-admin";
export type ApiMigrationPriority = "p0" | "p1" | "p2";
export type ApiServiceBoundaryKey =
  | "auth"
  | "users"
  | "workspaces"
  | "access"
  | "sandtraySessions"
  | "memoryCandidates"
  | "assets"
  | "agents"
  | "llmProxy"
  | "tasks";
export type ApiServiceBoundaryTier = "core" | "admin" | "ai" | "async";
export type ApiDataClassification = "public_catalog" | "personal" | "sensitive" | "secret" | "derived";
export type ApiServiceReadiness = "local_prototype" | "mock_contract" | "backend_required";

export interface ApiEndpointContract {
  method: ApiHttpMethod;
  path: string;
  summary: string;
  auth: ApiEndpointAuthRequirement;
  requestDto: string;
  responseDto: string;
  paginated: boolean;
  errors: ApiErrorCode[];
  migrationPriority: ApiMigrationPriority;
}

export interface ApiServiceBoundary {
  key: ApiServiceBoundaryKey;
  label: string;
  tier: ApiServiceBoundaryTier;
  owner: string;
  purpose: string;
  currentImplementation: string;
  futureBackend: string;
  dataClassification: ApiDataClassification[];
  auth: ApiEndpointAuthRequirement[];
  readEndpoints: string[];
  writeEndpoints: string[];
  asyncTasks: CreateTaskRequestDto["taskType"][];
  migrationPriority: ApiMigrationPriority;
  readiness: ApiServiceReadiness;
  notes: string[];
}

export interface ApiContractReport {
  version: string;
  generatedAt: string;
  adapterName: string;
  authContext: ApiAuthContextDto;
  pagination: ApiPaginationProtocol;
  errors: ApiErrorCatalogItem[];
  endpoints: ApiEndpointContract[];
  serviceBoundaries: ApiServiceBoundary[];
  sampleUserPage: ApiPageResponseDto<UserDto>;
  sampleWorkspacePage: ApiPageResponseDto<WorkspaceDto>;
  sampleMemoryPage: ApiPageResponseDto<MemoryCandidateDto>;
  sampleAssetPage: ApiPageResponseDto<AssetSummaryDto>;
  sampleLlmProviderPage: ApiPageResponseDto<LlmProviderSummaryDto>;
  sampleCurrentSandboxSnapshot: ApiResponseDto<CurrentSandboxSnapshotResponseDto>;
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
    method: "POST",
    path: "/api/llm/current-sandbox-snapshot",
    summary: "生成供 LLM 使用的当前沙盘状态 Snapshot，不包含事件流、个人记忆、用户身份或截图。",
    auth: "owner-or-admin",
    requestDto: "BuildCurrentSandboxSnapshotRequestDto",
    responseDto: "ApiResponseDto<CurrentSandboxSnapshotResponseDto>",
    paginated: false,
    errors: ["AUTH_REQUIRED", "AUTH_FORBIDDEN", "VALIDATION_FAILED"],
    migrationPriority: "p1",
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

export const API_SERVICE_BOUNDARIES: ApiServiceBoundary[] = [
  {
    key: "auth",
    label: "认证与会话",
    tier: "core",
    owner: "Identity Service",
    purpose: "负责注册、登录、会话上下文和前端请求身份边界。",
    currentImplementation: "PersonalDataBundle + local demo auth context",
    futureBackend: "Auth Service / session cookie or bearer token",
    dataClassification: ["personal", "sensitive"],
    auth: ["required"],
    readEndpoints: [],
    writeEndpoints: ["POST /api/auth/register", "POST /api/auth/login"],
    asyncTasks: [],
    migrationPriority: "p0",
    readiness: "backend_required",
    notes: [
      "生产环境不得把密码或 session secret 保存在浏览器 localStorage。",
      "前端只消费 ApiAuthContextDto，不直接解析服务端令牌内容。",
    ],
  },
  {
    key: "users",
    label: "用户目录与画像",
    tier: "admin",
    owner: "User Service",
    purpose: "支撑万级用户查询、画像编辑、状态治理和后台用户检索。",
    currentImplementation: "personal-memory-os.accounts / profiles",
    futureBackend: "users / user_profiles / user_status tables",
    dataClassification: ["personal", "sensitive"],
    auth: ["admin"],
    readEndpoints: ["GET /api/admin/users"],
    writeEndpoints: ["PATCH /api/admin/users/:userId"],
    asyncTasks: [],
    migrationPriority: "p0",
    readiness: "mock_contract",
    notes: [
      "列表必须服务端分页、筛选和排序，避免把万级用户一次性下发到浏览器。",
      "详情编辑建议走抽屉或独立详情页，列表只保留查看、编辑、权限和删除/归档动作。",
    ],
  },
  {
    key: "workspaces",
    label: "工作区与归属",
    tier: "core",
    owner: "Workspace Service",
    purpose: "维护个人沙盘工作区、作品归属和后续团队/机构扩展边界。",
    currentImplementation: "personal-memory-os.workspaces",
    futureBackend: "workspaces / workspace_members / workspace_settings tables",
    dataClassification: ["personal"],
    auth: ["required", "owner-or-admin"],
    readEndpoints: ["GET /api/workspaces"],
    writeEndpoints: [],
    asyncTasks: [],
    migrationPriority: "p0",
    readiness: "mock_contract",
    notes: [
      "所有沙盘档案、记忆候选和 Agent 会话都应归属于 userId + workspaceId。",
      "后端迁移时要保留 own/all workspace scope 语义。",
    ],
  },
  {
    key: "access",
    label: "权限与审计",
    tier: "admin",
    owner: "Access Control Service",
    purpose: "维护后台角色、工作区访问范围、拒绝权限和审计复核。",
    currentImplementation: "AdminGovernanceData.accessPolicies",
    futureBackend: "access_policies / admin_audit_logs tables",
    dataClassification: ["sensitive"],
    auth: ["admin"],
    readEndpoints: ["GET /api/admin/access-policies"],
    writeEndpoints: ["PATCH /api/admin/access-policies/:userId"],
    asyncTasks: [],
    migrationPriority: "p0",
    readiness: "mock_contract",
    notes: [
      "权限计算必须服务端执行，前端展示的 effectivePermissions 只用于 UI 控制。",
      "所有权限变更都需要写入审计日志。",
    ],
  },
  {
    key: "sandtraySessions",
    label: "沙盘会话与快照",
    tier: "core",
    owner: "Sandtray Service",
    purpose: "保存当前草稿、历史作品、环境状态、事件流和可回放快照。",
    currentImplementation: "scene storage + personal-memory-os.sandtraySessions",
    futureBackend: "sandtray_sessions / sandtray_snapshots / sandbox_objects / sandbox_events tables",
    dataClassification: ["personal", "sensitive", "derived"],
    auth: ["owner-or-admin"],
    readEndpoints: ["GET /api/sandtray/sessions"],
    writeEndpoints: ["POST /api/sandtray/sessions/:sessionId/snapshots"],
    asyncTasks: ["archive_export", "archive_import"],
    migrationPriority: "p0",
    readiness: "mock_contract",
    notes: [
      "当前 LLM Snapshot 只读取当前状态；完整事件流只进入沙盘档案，不默认进入 LLM。",
      "Stage v2 交互仍以 SandboxObject 为源，后端只保存可回放状态。",
    ],
  },
  {
    key: "memoryCandidates",
    label: "记忆候选与 Context Packet",
    tier: "ai",
    owner: "Memory Service",
    purpose: "管理个人记忆候选、确认状态、阻断规则和未来 AI 可用上下文。",
    currentImplementation: "personal-memory-os.memoryCandidates / blockRules",
    futureBackend: "memory_candidates / memory_block_rules / context_packets tables",
    dataClassification: ["personal", "sensitive", "derived"],
    auth: ["owner-or-admin"],
    readEndpoints: ["GET /api/memory/candidates"],
    writeEndpoints: ["PATCH /api/memory/candidates/:memoryId"],
    asyncTasks: ["memory_rebuild"],
    migrationPriority: "p1",
    readiness: "mock_contract",
    notes: [
      "Context Packet 必须独立授权、可预览、可撤销，不能混入 CurrentSandboxSnapshot。",
      "记忆候选来源必须能追溯到 sessionId 或用户确认记录。",
    ],
  },
  {
    key: "assets",
    label: "沙具资产目录",
    tier: "admin",
    owner: "Asset Service",
    purpose: "支撑 300+ 沙具的搜索、批量管理、健康检查和模型配方维护。",
    currentImplementation: "managed-assets local catalog",
    futureBackend: "assets / asset_versions / asset_tags / asset_health_checks tables",
    dataClassification: ["public_catalog", "derived"],
    auth: ["required", "admin"],
    readEndpoints: ["GET /api/assets"],
    writeEndpoints: ["POST /api/assets"],
    asyncTasks: ["asset_bulk_update"],
    migrationPriority: "p1",
    readiness: "mock_contract",
    notes: [
      "资产列表以服务端分页为主，详情编辑走抽屉，批量操作固定在工具栏。",
      "沙盘中已放置对象应保留实例字段，避免资产隐藏后破坏历史作品。",
    ],
  },
  {
    key: "agents",
    label: "Agent 角色配置",
    tier: "ai",
    owner: "Agent Configuration Service",
    purpose: "维护心理学取向 Agent 资料、系统提示词、开场白和 LLM 绑定。",
    currentImplementation: "psych-agents local config",
    futureBackend: "psych_agents / agent_versions / agent_prompt_audits tables",
    dataClassification: ["public_catalog", "sensitive"],
    auth: ["admin"],
    readEndpoints: ["GET /api/admin/agents"],
    writeEndpoints: ["POST /api/admin/agents"],
    asyncTasks: [],
    migrationPriority: "p1",
    readiness: "mock_contract",
    notes: [
      "Agent 应表述为理论取向角色，不声称真实人物本人。",
      "系统提示词更新需要版本化，方便回滚和审计。",
    ],
  },
  {
    key: "llmProxy",
    label: "LLM 配置与代理",
    tier: "ai",
    owner: "LLM Proxy Service",
    purpose: "托管模型供应商配置、密钥、连接测试和真实流式调用。",
    currentImplementation: "llm-providers local config + browser direct call fallback",
    futureBackend: "llm_providers / llm_provider_secrets / llm_call_logs + streaming proxy",
    dataClassification: ["secret", "sensitive", "derived"],
    auth: ["admin", "owner-or-admin"],
    readEndpoints: ["GET /api/admin/llm-providers"],
    writeEndpoints: ["PATCH /api/admin/llm-providers/:providerId", "POST /api/llm/current-sandbox-snapshot"],
    asyncTasks: ["llm_connection_test"],
    migrationPriority: "p1",
    readiness: "backend_required",
    notes: [
      "生产环境必须由后端托管 API Key，前端只拿到 key 是否已配置和遮罩预览。",
      "LLM 输入必须通过 createSandboxSnapshotChatMessages，默认只包含 Snapshot 与 Insight。",
    ],
  },
  {
    key: "tasks",
    label: "后台任务",
    tier: "async",
    owner: "Task Service",
    purpose: "承接导入、导出、批量资产、记忆重建和 LLM 连接测试等长任务。",
    currentImplementation: "前端同步操作或本地即时模拟",
    futureBackend: "tasks / task_events / task_results tables + worker queue",
    dataClassification: ["personal", "sensitive", "derived"],
    auth: ["admin"],
    readEndpoints: [],
    writeEndpoints: ["POST /api/tasks"],
    asyncTasks: ["archive_export", "archive_import", "asset_bulk_update", "memory_rebuild", "llm_connection_test"],
    migrationPriority: "p2",
    readiness: "backend_required",
    notes: [
      "长任务入口必须使用 idempotencyKey，避免重复提交导入或批量更新。",
      "前端后续应通过 taskId 轮询或订阅任务状态。",
    ],
  },
];
