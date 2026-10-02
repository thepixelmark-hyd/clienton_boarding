import type { ErrorCode } from "@clientos/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:9004/api/v1";

export class ApiClientError extends Error {
  constructor(
    public readonly code: ErrorCode | "NETWORK_ERROR",
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...options.headers,
      },
    });
  } catch {
    throw new ApiClientError(
      "NETWORK_ERROR",
      "Couldn't reach the server. Check your connection and try again.",
      0,
    );
  }

  if (response.status === 204) return undefined as T;

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    throw new ApiClientError(
      body?.code ?? "NETWORK_ERROR",
      body?.message ?? "Something went wrong. Try again.",
      response.status,
      body?.details,
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data !== undefined ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
