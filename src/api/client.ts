import {
  API_ERROR_CATALOG,
  type ApiAuthContextDto,
  type ApiErrorCode,
  type ApiErrorDto,
  type ApiFilterValue,
  type ApiHttpMethod,
  type ApiResponseDto,
} from "./contracts";

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs: number;
  getAuthContext?: () => ApiAuthContextDto | null;
  getBearerToken?: () => string | null;
  fetchImpl?: typeof fetch;
}

export interface ApiClientRequest<TBody = unknown> {
  method: ApiHttpMethod;
  path: string;
  query?: Record<string, ApiFilterValue | undefined>;
  body?: TBody;
  signal?: AbortSignal;
  authContext?: ApiAuthContextDto | null;
  timeoutMs?: number;
}

export interface ApiClientDiagnostic {
  baseUrl: string;
  timeoutMs: number;
  authHeaderStrategy: "bearer" | "context-headers" | "anonymous";
  canUseBrowserFetch: boolean;
  contractVersionHeader: string;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly requestId: string;
  readonly code: ApiErrorCode;
  readonly dto: ApiErrorDto;

  constructor(status: number, dto: ApiErrorDto) {
    super(dto.message);
    this.name = "ApiClientError";
    this.status = status;
    this.requestId = dto.requestId;
    this.code = dto.code;
    this.dto = dto;
  }
}

export function createApiClient(config: ApiClientConfig) {
  const fetcher = config.fetchImpl ?? fetch;

  async function request<TResponse, TBody = unknown>(
    input: ApiClientRequest<TBody>,
  ): Promise<ApiResponseDto<TResponse>> {
    const requestId = createRequestId();
    const controller = new AbortController();
    const timeoutMs = input.timeoutMs ?? config.timeoutMs;
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    const abortListener = () => controller.abort();
    input.signal?.addEventListener("abort", abortListener, { once: true });

    try {
      const authContext = input.authContext ?? config.getAuthContext?.() ?? null;
      const bearerToken = config.getBearerToken?.() ?? null;
      const response = await fetcher(buildUrl(config.baseUrl, input.path, input.query), {
        method: input.method,
        headers: buildHeaders(requestId, authContext, bearerToken, input.body !== undefined),
        body: input.body === undefined ? undefined : JSON.stringify(input.body),
        signal: controller.signal,
      });
      const parsed = await parseApiResponse<TResponse>(response, requestId);
      if (!parsed.ok) {
        throw new ApiClientError(response.status, parsed.error);
      }
      return parsed;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      const dto = createClientErrorDto(requestId, error);
      throw new ApiClientError(0, dto);
    } finally {
      window.clearTimeout(timeoutId);
      input.signal?.removeEventListener("abort", abortListener);
    }
  }

  function diagnostic(): ApiClientDiagnostic {
    const hasBearer = Boolean(config.getBearerToken?.());
    const hasContext = Boolean(config.getAuthContext?.());
    return {
      baseUrl: normalizeBaseUrl(config.baseUrl),
      timeoutMs: config.timeoutMs,
      authHeaderStrategy: hasBearer ? "bearer" : hasContext ? "context-headers" : "anonymous",
      canUseBrowserFetch: typeof fetcher === "function",
      contractVersionHeader: "X-Api-Contract-Version",
    };
  }

  return {
    request,
    diagnostic,
  };
}

async function parseApiResponse<TResponse>(
  response: Response,
  fallbackRequestId: string,
): Promise<ApiResponseDto<TResponse>> {
  const requestId = response.headers.get("x-request-id") ?? fallbackRequestId;
  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (isApiResponseDto<TResponse>(parsed)) {
    return parsed;
  }

  if (!response.ok) {
    return {
      ok: false,
      requestId,
      error: {
        code: mapHttpStatusToErrorCode(response.status),
        message: typeof parsed === "object" && parsed && "message" in parsed ? String(parsed.message) : response.statusText,
        requestId,
      },
    };
  }

  return {
    ok: true,
    requestId,
    data: parsed as TResponse,
  };
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, ApiFilterValue | undefined>): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function buildHeaders(
  requestId: string,
  authContext: ApiAuthContextDto | null,
  bearerToken: string | null,
  hasBody: boolean,
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Request-ID": requestId,
    "X-Api-Contract-Version": "2026-05-06.v1",
  };
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  if (authContext) {
    headers["X-Actor-User-ID"] = authContext.actorUserId;
    headers["X-Active-User-ID"] = authContext.activeUserId;
    headers["X-Workspace-Scope"] = authContext.workspaceScope;
    headers["X-Auth-Role"] = authContext.role;
  }
  return headers;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return "http://localhost:8787";
  }
  return trimmed.replace(/\/+$/, "");
}

function mapHttpStatusToErrorCode(status: number): ApiErrorCode {
  const found = API_ERROR_CATALOG.find((item) => item.httpStatus === status);
  return found?.code ?? "INTERNAL_ERROR";
}

function createClientErrorDto(requestId: string, error: unknown): ApiErrorDto {
  const isAbort = error instanceof DOMException && error.name === "AbortError";
  return {
    code: isAbort ? "REQUEST_TIMEOUT" : "INTERNAL_ERROR",
    message: isAbort ? "请求超时或已取消。" : error instanceof Error ? error.message : String(error),
    requestId,
  };
}

function isApiResponseDto<TResponse>(value: unknown): value is ApiResponseDto<TResponse> {
  if (!value || typeof value !== "object" || !("ok" in value) || !("requestId" in value)) {
    return false;
  }
  if ((value as { ok: unknown }).ok === true) {
    return "data" in value;
  }
  return "error" in value;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `req_${crypto.randomUUID()}`;
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
