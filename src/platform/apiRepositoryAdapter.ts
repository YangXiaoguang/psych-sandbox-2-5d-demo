import { createApiClient } from "../api/client";
import { API_ENDPOINT_CONTRACTS } from "../api/contracts";
import { createMockApiAdapter } from "../api/mockApiAdapter";
import type { AdminGovernanceData } from "../admin/types";
import type { PersonalDataBundle } from "../personal/types";
import type {
  BackendAdapterReport,
  RepositoryMode,
  SystemArchitectureReport,
  SystemRepositoryAdapter,
  SystemRepositoryReportContext,
} from "./repositoryTypes";
import { buildLocalRepositoryReport, localRepositoryAdapter } from "./localRepositoryAdapter";

const DEFAULT_REMOTE_API_BASE_URL = "http://localhost:8787";

export const mockApiRepositoryAdapter = createApiRepositoryAdapter({
  mode: "mockApi",
  adapterName: "MockApiRepositoryAdapter.v1",
  baseUrl: "mock://frontend-adapter",
});

export const remoteApiRepositoryAdapter = createApiRepositoryAdapter({
  mode: "remoteApi",
  adapterName: "RemoteApiRepositoryAdapter.placeholder.v1",
  baseUrl: DEFAULT_REMOTE_API_BASE_URL,
});

function createApiRepositoryAdapter({
  mode,
  adapterName,
  baseUrl,
}: {
  mode: Exclude<RepositoryMode, "localStorage">;
  adapterName: string;
  baseUrl: string;
}): SystemRepositoryAdapter {
  return {
    adapterName,
    mode,
    personal: localRepositoryAdapter.personal,
    admin: localRepositoryAdapter.admin,
    workspace: localRepositoryAdapter.workspace,
    buildReport(personalData, adminGovernance, context = {}) {
      return buildApiRepositoryReport({
        mode,
        adapterName,
        baseUrl,
        personalData,
        adminGovernance,
        context,
      });
    },
  };
}

function buildApiRepositoryReport({
  mode,
  adapterName,
  baseUrl,
  personalData,
  adminGovernance,
  context,
}: {
  mode: Exclude<RepositoryMode, "localStorage">;
  adapterName: string;
  baseUrl: string;
  personalData: PersonalDataBundle;
  adminGovernance: AdminGovernanceData;
  context: SystemRepositoryReportContext;
}): SystemArchitectureReport {
  const baseReport = buildLocalRepositoryReport(personalData, adminGovernance, context);
  const mockApi = createMockApiAdapter({
    personalData,
    adminGovernance,
    managedAssets: context.managedAssets,
    llmProviders: context.llmProviders,
    agents: context.agents,
  });
  const apiContract = mockApi.buildContractReport();

  return {
    ...baseReport,
    adapterName,
    mode,
    apiContract,
    backend: buildBackendReport({
      mode,
      adapterName,
      baseUrl,
      personalData,
      adminGovernance,
      context,
      mockRoundTrip: Boolean(apiContract.sampleUserPage.ok && apiContract.sampleWorkspacePage.ok && apiContract.sampleMemoryPage.ok),
    }),
    migrationSteps: [
      mode === "mockApi"
        ? "当前已切换到 Mock API Adapter：运行时仍由本地仓储兜底，读模型通过 DTO 分页协议演练。"
        : "当前选择 Remote API 占位模式：前端已具备 HTTP Client 和诊断结构，等待真实服务端实现。",
      ...baseReport.migrationSteps,
      "将 App 初始化从同步仓储升级为异步 bootstrap，支持远程用户、工作区和沙盘草稿预加载。",
    ],
  };
}

function buildBackendReport({
  mode,
  adapterName,
  baseUrl,
  personalData,
  adminGovernance,
  context,
  mockRoundTrip,
}: {
  mode: Exclude<RepositoryMode, "localStorage">;
  adapterName: string;
  baseUrl: string;
  personalData: PersonalDataBundle;
  adminGovernance: AdminGovernanceData;
  context: SystemRepositoryReportContext;
  mockRoundTrip: boolean;
}): BackendAdapterReport {
  const apiClient = createApiClient({
    baseUrl: mode === "mockApi" ? DEFAULT_REMOTE_API_BASE_URL : baseUrl,
    timeoutMs: 12000,
    getAuthContext: () =>
      createMockApiAdapter({
        personalData,
        adminGovernance,
        managedAssets: context.managedAssets,
        llmProviders: context.llmProviders,
        agents: context.agents,
      }).createAuthContext(),
  });
  const clientDiagnostic = apiClient.diagnostic();
  const p0EndpointCount = API_ENDPOINT_CONTRACTS.filter((endpoint) => endpoint.migrationPriority === "p0").length;
  const writeEndpointCount = API_ENDPOINT_CONTRACTS.filter((endpoint) => endpoint.method !== "GET").length;

  return {
    activeMode: mode,
    modeLabel: mode === "mockApi" ? "Mock API 演练" : "Remote API 占位",
    transport: mode === "mockApi" ? "mock-api" : "http",
    baseUrl,
    authStrategy: mode === "mockApi" ? "Mock ApiAuthContextDto" : clientDiagnostic.authHeaderStrategy,
    writeStrategy: mode === "mockApi" ? "写操作仍落 localStorage，DTO 已定义" : "HTTP request/response DTO，等待服务端实现",
    remoteReady: false,
    mockRoundTrip,
    p0EndpointCount,
    checks: [
      {
        label: "统一 API Client",
        status: "ok",
        detail: `${clientDiagnostic.contractVersionHeader} / ${clientDiagnostic.timeoutMs}ms 超时 / ${clientDiagnostic.authHeaderStrategy}。`,
      },
      {
        label: "DTO 分页演练",
        status: mockRoundTrip ? "ok" : "warn",
        detail: mockRoundTrip ? "用户、工作区、记忆候选分页样例均可从 Mock Adapter 生成。" : "Mock 分页样例尚未完整生成。",
      },
      {
        label: "写操作契约",
        status: "ok",
        detail: `${writeEndpointCount} 个写接口已具备 request/response DTO 名称和错误码边界。`,
      },
      {
        label: "真实服务",
        status: mode === "remoteApi" ? "warn" : "ok",
        detail: mode === "remoteApi" ? `等待 ${baseUrl} 实现契约接口。` : "当前不发起网络请求，适合前端自测和视觉回归。",
      },
    ],
    nextSteps: [
      "把 P0 接口落到真实服务端：auth、users、workspaces、access-policies、sandtray sessions。",
      "将远程错误统一转换为 ApiErrorDto，并在页面层使用 userMessage。",
      "把大规模列表切到服务端分页，避免把万级数据一次性拉到浏览器。",
    ],
  };
}
