import { getEffectivePermissions } from "../admin/localAdminGovernance";
import type { AdminGovernanceData } from "../admin/types";
import type { PersonalDataBundle, PersonalMemoryCandidate, SandtraySessionArchive, UserWorkspace } from "../personal/types";
import type { LlmProviderConfig, ManagedAsset, PsychAgentProfile } from "../types";
import {
  API_CONTRACT_VERSION,
  API_ENDPOINT_CONTRACTS,
  API_ERROR_CATALOG,
  API_PAGINATION_PROTOCOL,
  type AccessPolicyDto,
  type ApiAuthContextDto,
  type ApiContractReport,
  type ApiFilterValue,
  type ApiPageMetaDto,
  type ApiPageResponseDto,
  type ApiPaginationRequestDto,
  type ApiResponseDto,
  type ApiSortDto,
  type AssetSummaryDto,
  type LlmProviderSummaryDto,
  type MemoryCandidateDto,
  type PsychAgentSummaryDto,
  type SandtraySessionSummaryDto,
  type UserDto,
  type WorkspaceDto,
} from "./contracts";

type NormalizedPaginationRequest = Omit<ApiPaginationRequestDto, "sort" | "filters"> & {
  sort: ApiSortDto[];
  filters: Record<string, ApiFilterValue>;
};

export interface MockApiAdapterInput {
  personalData: PersonalDataBundle;
  adminGovernance: AdminGovernanceData;
  managedAssets?: ManagedAsset[];
  llmProviders?: LlmProviderConfig[];
  agents?: PsychAgentProfile[];
  activeUserId?: string;
}

export interface FrontendMockApiAdapter {
  adapterName: string;
  createAuthContext(): ApiAuthContextDto;
  queryUsers(request?: Partial<ApiPaginationRequestDto>): Promise<ApiPageResponseDto<UserDto>>;
  queryWorkspaces(request?: Partial<ApiPaginationRequestDto>): Promise<ApiPageResponseDto<WorkspaceDto>>;
  queryAccessPolicies(request?: Partial<ApiPaginationRequestDto>): Promise<ApiPageResponseDto<AccessPolicyDto>>;
  querySandtraySessions(request?: Partial<ApiPaginationRequestDto>): Promise<ApiPageResponseDto<SandtraySessionSummaryDto>>;
  queryMemoryCandidates(request?: Partial<ApiPaginationRequestDto>): Promise<ApiPageResponseDto<MemoryCandidateDto>>;
  queryAssets(request?: Partial<ApiPaginationRequestDto>): Promise<ApiPageResponseDto<AssetSummaryDto>>;
  queryLlmProviders(request?: Partial<ApiPaginationRequestDto>): Promise<ApiPageResponseDto<LlmProviderSummaryDto>>;
  queryAgents(request?: Partial<ApiPaginationRequestDto>): Promise<ApiPageResponseDto<PsychAgentSummaryDto>>;
  buildContractReport(): ApiContractReport;
}

const MOCK_ADAPTER_NAME = "FrontendMockApiAdapter.v1";

export function createMockApiAdapter(input: MockApiAdapterInput): FrontendMockApiAdapter {
  const activeUserId = input.activeUserId ?? input.personalData.activeUserId;

  const adapter: FrontendMockApiAdapter = {
    adapterName: MOCK_ADAPTER_NAME,
    createAuthContext() {
      return buildAuthContext(input.personalData, input.adminGovernance, activeUserId);
    },
    async queryUsers(request) {
      return toPageResponse(mapUsers(input.personalData), request, "lastActiveAt");
    },
    async queryWorkspaces(request) {
      return toPageResponse(mapWorkspaces(input.personalData), request, "updatedAt");
    },
    async queryAccessPolicies(request) {
      return toPageResponse(mapAccessPolicies(input.adminGovernance), request, "updatedAt");
    },
    async querySandtraySessions(request) {
      return toPageResponse(mapSandtraySessions(input.personalData.sandtraySessions), request, "updatedAt");
    },
    async queryMemoryCandidates(request) {
      return toPageResponse(mapMemoryCandidates(input.personalData.memoryCandidates), request, "updatedAt");
    },
    async queryAssets(request) {
      return toPageResponse(mapAssets(input.managedAssets ?? []), request, "updatedAt");
    },
    async queryLlmProviders(request) {
      return toPageResponse(mapLlmProviders(input.llmProviders ?? []), request, "updatedAt");
    },
    async queryAgents(request) {
      return toPageResponse(mapAgents(input.agents ?? []), request, "updatedAt");
    },
    buildContractReport() {
      return {
        version: API_CONTRACT_VERSION,
        generatedAt: new Date().toISOString(),
        adapterName: MOCK_ADAPTER_NAME,
        authContext: buildAuthContext(input.personalData, input.adminGovernance, activeUserId),
        pagination: API_PAGINATION_PROTOCOL,
        errors: API_ERROR_CATALOG,
        endpoints: API_ENDPOINT_CONTRACTS,
        sampleUserPage: toPageResponseSync(mapUsers(input.personalData), { page: 1, pageSize: 5 }, "lastActiveAt"),
        sampleWorkspacePage: toPageResponseSync(mapWorkspaces(input.personalData), { page: 1, pageSize: 5 }, "updatedAt"),
        sampleMemoryPage: toPageResponseSync(mapMemoryCandidates(input.personalData.memoryCandidates), { page: 1, pageSize: 5 }, "updatedAt"),
        sampleAssetPage: toPageResponseSync(mapAssets(input.managedAssets ?? []), { page: 1, pageSize: 5 }, "updatedAt"),
        sampleLlmProviderPage: toPageResponseSync(mapLlmProviders(input.llmProviders ?? []), { page: 1, pageSize: 5 }, "updatedAt"),
      };
    },
  };

  return adapter;
}

export function buildMockApiContractReport(input: MockApiAdapterInput): ApiContractReport {
  return createMockApiAdapter(input).buildContractReport();
}

function buildAuthContext(
  personalData: PersonalDataBundle,
  adminGovernance: AdminGovernanceData,
  activeUserId: string,
): ApiAuthContextDto {
  const policy = adminGovernance.accessPolicies.find((item) => item.userId === activeUserId);
  const profile = personalData.profiles.find((item) => item.userId === activeUserId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 8);
  const effectivePolicy = policy ?? {
    userId: activeUserId,
    role: "viewer" as const,
    status: "active" as const,
    workspaceScope: "own" as const,
    deniedPermissions: [],
    note: "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  return {
    requestId: createRequestId(),
    actorUserId: activeUserId,
    activeUserId,
    role: effectivePolicy.role,
    permissions: getEffectivePermissions(effectivePolicy),
    workspaceScope: effectivePolicy.workspaceScope,
    workspaceIds: personalData.workspaces
      .filter((workspace) => workspace.userId === activeUserId || effectivePolicy.workspaceScope === "all")
      .map((workspace) => workspace.workspaceId),
    authMode: "local_demo",
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    timezone: profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Shanghai",
    locale: profile?.preferredLanguage ?? "zh-CN",
  };
}

function mapUsers(personalData: PersonalDataBundle): UserDto[] {
  const profilesByUserId = new Map(personalData.profiles.map((profile) => [profile.userId, profile]));
  const workspaceCountByUserId = countBy(personalData.workspaces, (workspace) => workspace.userId);
  const sessionCountByUserId = countBy(personalData.sandtraySessions, (session) => session.userId);
  const memoryCountByUserId = countBy(personalData.memoryCandidates, (memory) => memory.userId);

  return personalData.accounts.map((account) => {
    const profile = profilesByUserId.get(account.userId);
    return {
      userId: account.userId,
      localHandle: account.localHandle,
      displayName: profile?.displayName ?? account.displayName,
      authMode: account.authMode,
      status: account.status,
      ageGroup: profile?.ageGroup ?? "unknown",
      role: profile?.role ?? "demo",
      workspaceCount: workspaceCountByUserId.get(account.userId) ?? 0,
      sandtraySessionCount: sessionCountByUserId.get(account.userId) ?? 0,
      memoryCandidateCount: memoryCountByUserId.get(account.userId) ?? 0,
      createdAt: account.createdAt,
      lastActiveAt: account.lastActiveAt,
    };
  });
}

function mapWorkspaces(personalData: PersonalDataBundle): WorkspaceDto[] {
  const sessionCountByWorkspaceId = countBy(personalData.sandtraySessions, (session) => session.workspaceId ?? `user:${session.userId}`);
  return personalData.workspaces.map((workspace) => ({
    workspaceId: workspace.workspaceId,
    ownerUserId: workspace.userId,
    title: workspace.title,
    description: workspace.description,
    active: workspace.active,
    sandtraySessionCount: sessionCountByWorkspaceId.get(workspace.workspaceId) ?? sessionCountByWorkspaceId.get(`user:${workspace.userId}`) ?? 0,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  }));
}

function mapAccessPolicies(adminGovernance: AdminGovernanceData): AccessPolicyDto[] {
  return adminGovernance.accessPolicies.map((policy) => ({
    userId: policy.userId,
    role: policy.role,
    status: policy.status,
    workspaceScope: policy.workspaceScope,
    deniedPermissions: policy.deniedPermissions,
    effectivePermissions: getEffectivePermissions(policy),
    note: policy.note,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
    lastReviewedAt: policy.lastReviewedAt,
  }));
}

function mapMemoryCandidates(memoryCandidates: PersonalMemoryCandidate[]): MemoryCandidateDto[] {
  return memoryCandidates.map((memory) => ({
    memoryId: memory.memoryId,
    userId: memory.userId,
    sourceSessionId: memory.sourceSessionId,
    kind: memory.kind,
    status: memory.status,
    title: memory.title,
    summary: memory.summary,
    tags: memory.tags,
    confidence: memory.confidence,
    includeInAgentContext: memory.includeInAgentContext,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  }));
}

function mapSandtraySessions(sessions: SandtraySessionArchive[]): SandtraySessionSummaryDto[] {
  return sessions.map((session) => ({
    sessionId: session.sessionId,
    userId: session.userId,
    workspaceId: session.workspaceId,
    title: session.title,
    status: session.status,
    objectCount: session.featureSummary.objectCount,
    eventCount: session.featureSummary.eventCount,
    dominantCategories: session.featureSummary.dominantCategories,
    riskDistribution: session.featureSummary.riskDistribution,
    environment: session.snapshot.environment,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    archivedAt: session.archivedAt,
  }));
}

function mapAssets(assets: ManagedAsset[]): AssetSummaryDto[] {
  return assets.map((asset) => ({
    assetId: asset.assetId,
    name: asset.name,
    category: asset.category,
    riskTag: asset.riskTag,
    enabled: asset.enabled,
    isBuiltIn: asset.isBuiltIn,
    semanticTags: asset.semanticTags,
    thumbnailScale: asset.thumbnailScale,
    updatedAt: asset.updatedAt,
    deletedAt: asset.deletedAt,
  }));
}

function mapLlmProviders(providers: LlmProviderConfig[]): LlmProviderSummaryDto[] {
  return providers.map((provider) => ({
    id: provider.id,
    name: provider.name,
    provider: provider.provider,
    baseUrl: provider.baseUrl,
    model: provider.model,
    enabled: provider.enabled,
    apiKeyConfigured: Boolean(provider.apiKey.trim()),
    apiKeyPreview: maskApiKey(provider.apiKey),
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  }));
}

function mapAgents(agents: PsychAgentProfile[]): PsychAgentSummaryDto[] {
  return agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    school: agent.school,
    description: agent.description,
    avatarStyle: agent.avatarStyle,
    providerId: agent.providerId,
    temperature: agent.temperature,
    enabled: agent.enabled,
    isBuiltIn: agent.isBuiltIn,
    updatedAt: agent.updatedAt,
  }));
}

async function toPageResponse<T extends object>(
  items: T[],
  request: Partial<ApiPaginationRequestDto> | undefined,
  defaultSortKey: string,
): Promise<ApiPageResponseDto<T>> {
  return toPageResponseSync(items, request, defaultSortKey);
}

function toPageResponseSync<T extends object>(
  items: T[],
  request: Partial<ApiPaginationRequestDto> | undefined,
  defaultSortKey: string,
): ApiPageResponseDto<T> {
  const normalized = normalizePageRequest(request, defaultSortKey);
  const filteredItems = applyFiltersAndQuery(items, normalized);
  const sortedItems = sortDtos(filteredItems, normalized.sort);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / normalized.pageSize));

  if (normalized.page > totalPages && sortedItems.length > 0) {
    return createErrorResponse("PAGE_OUT_OF_RANGE", "分页超出结果范围。");
  }

  const start = (normalized.page - 1) * normalized.pageSize;
  const pageItems = sortedItems.slice(start, start + normalized.pageSize);
  const page: ApiPageMetaDto = {
    page: normalized.page,
    pageSize: normalized.pageSize,
    total: sortedItems.length,
    totalPages,
    hasNextPage: normalized.page < totalPages,
    hasPreviousPage: normalized.page > 1,
    nextCursor: normalized.page < totalPages ? encodeCursor(normalized.page + 1, normalized.pageSize, sortedItems.length) : undefined,
    stableSortKey: normalized.sort[0]?.field ?? defaultSortKey,
  };

  return {
    ok: true,
    requestId: createRequestId(),
    data: {
      items: pageItems,
      page,
    },
  };
}

function normalizePageRequest(
  request: Partial<ApiPaginationRequestDto> | undefined,
  defaultSortKey: string,
): NormalizedPaginationRequest {
  const pageSize = clampInt(request?.pageSize ?? API_PAGINATION_PROTOCOL.defaultPageSize, API_PAGINATION_PROTOCOL.minPageSize, API_PAGINATION_PROTOCOL.maxPageSize);
  const page = Math.max(1, Math.floor(request?.page ?? 1));
  return {
    page,
    pageSize,
    query: request?.query?.trim(),
    filters: request?.filters ?? {},
    sort: request?.sort?.length ? request.sort : [{ field: defaultSortKey, direction: "desc" }],
  };
}

function applyFiltersAndQuery<T extends object>(items: T[], request: NormalizedPaginationRequest): T[] {
  const query = request.query?.toLowerCase();
  return items.filter((item) => {
    const record = item as Record<string, unknown>;
    if (query && !dtoToSearchText(item).includes(query)) {
      return false;
    }
    return Object.entries(request.filters).every(([field, value]) => matchesFilter(record[field], value));
  });
}

function matchesFilter(value: unknown, filter: ApiFilterValue): boolean {
  if (filter === null || filter === "" || (Array.isArray(filter) && filter.length === 0)) {
    return true;
  }
  if (Array.isArray(filter)) {
    return filter.map(String).includes(String(value));
  }
  return String(value) === String(filter);
}

function sortDtos<T extends object>(items: T[], sorts: ApiSortDto[]): T[] {
  return [...items].sort((a, b) => {
    const leftRecord = a as Record<string, unknown>;
    const rightRecord = b as Record<string, unknown>;
    for (const sort of sorts) {
      const left = toComparable(leftRecord[sort.field]);
      const right = toComparable(rightRecord[sort.field]);
      if (left === right) {
        continue;
      }
      const direction = sort.direction === "asc" ? 1 : -1;
      return left > right ? direction : -direction;
    }
    return 0;
  });
}

function toComparable(value: unknown): string | number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  return String(value ?? "");
}

function dtoToSearchText(item: object): string {
  return Object.values(item as Record<string, unknown>)
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value.map(String);
      }
      if (value && typeof value === "object") {
        return Object.values(value as Record<string, unknown>).map(String);
      }
      return [String(value ?? "")];
    })
    .join(" ")
    .toLowerCase();
}

function createErrorResponse<T>(code: "PAGE_OUT_OF_RANGE", message: string): ApiResponseDto<T> {
  const requestId = createRequestId();
  return {
    ok: false,
    requestId,
    error: {
      code,
      message,
      requestId,
    },
  };
}

function countBy<T>(items: T[], getKey: (item: T) => string | undefined): Map<string, number> {
  const result = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) {
      return;
    }
    result.set(key, (result.get(key) ?? 0) + 1);
  });
  return result;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function encodeCursor(page: number, pageSize: number, total: number): string {
  return btoa(JSON.stringify({ page, pageSize, total }));
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `req_${crypto.randomUUID()}`;
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return "not-configured";
  }
  return trimmed.length <= 8 ? "******" : `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}
