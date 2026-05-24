import type { IslandListResponse, IslandMetadata, MetricInterval, MetricsQueryName, MetricsResponse } from "../types.js";

export class EpicApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly endpoint: string,
    public readonly rawResponse?: string,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "EpicApiError";
  }
}

interface EpicClientOptions {
  baseUrl: string;
  timeoutMs: number;
}

export class EpicClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: EpicClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs;
  }

  async listIslands(options: { size: number; after?: string; before?: string }): Promise<IslandListResponse> {
    return this.fetchJson<IslandListResponse>("/islands", {
      size: String(options.size),
      after: options.after,
      before: options.before
    });
  }

  async getIsland(code: string): Promise<IslandMetadata> {
    return this.fetchJson<IslandMetadata>(`/islands/${encodeURIComponent(code)}`);
  }

  async getMetrics(
    code: string,
    interval: MetricInterval,
    metrics: MetricsQueryName[],
    range?: { from?: string; to?: string }
  ): Promise<MetricsResponse> {
    return this.fetchJson<MetricsResponse>(`/islands/${encodeURIComponent(code)}/metrics/${interval}`, {
      metrics,
      from: range?.from,
      to: range?.to
    });
  }

  private async fetchJson<T>(
    endpoint: string,
    query: Record<string, string | string[] | undefined> = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "island-intel/0.1"
      },
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const retryAfterSeconds = Number(response.headers.get("retry-after"));
      throw new EpicApiError(
        `Epic API ${response.status} for ${url.pathname}`,
        response.status,
        `${url.pathname}${url.search}`,
        raw.slice(0, 2000),
        Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : undefined
      );
    }

    return (await response.json()) as T;
  }
}
