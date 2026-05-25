const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? "http://localhost:3201" : "")).replace(
  /\/$/,
  ""
);

export interface ObservationMetrics {
  latestPeakCcu: number | null;
  latestPeakCcuAt: string | null;
  observedAllTimePeak: number | null;
  observedAllTimePeakAt: string | null;
  dayPlays: number | null;
  dayUniquePlayers: number | null;
  dayMinutesPlayed: number | null;
  dayAverageMinutesPerPlayer: number | null;
  dayFavorites: number | null;
  dayRecommendations: number | null;
  dayRetentionD1: number | null;
  dayRetentionD7: number | null;
  dayMetricsAt: string | null;
  latestUpdatedAt: string | null;
}

export interface IslandSummary {
  code: string;
  creatorCode: string | null;
  displayName: string | null;
  title: string;
  category: string | null;
  createdIn: string | null;
  tags: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  isStale: boolean;
  metrics: ObservationMetrics;
}

export interface IslandDetail extends IslandSummary {
  externalLinks: {
    epic: string;
    fortniteGg: string;
  };
  unavailableFromEpicApi: string[];
}

export interface RankingsResponse {
  page: number;
  pageSize: number;
  total: number;
  data: IslandSummary[];
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface CreatorSummary {
  creatorCode: string;
  islandCount: number;
  currentPlayers: number;
  dayMinutesPlayed: number;
  dayFavorites: number;
  latestUpdatedAt: string | null;
}

export interface CreatorDetail extends CreatorSummary {
  dayPlays: number;
  islands: IslandSummary[];
}

export interface MetricSeriesResponse {
  interval: "minute" | "hour" | "day";
  metrics: Record<string, Array<{ timestamp: string; value: number | null }>>;
  retention: Array<{ timestamp: string; d1: number | null; d7: number | null }>;
}

export interface IngestionSummary {
  runId: number;
  status: "completed" | "failed";
  metadataCount: number;
  metricPointCount: number;
  errorCount: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { signal });
  if (!response.ok) {
    throw new ApiError(`API request failed: ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new ApiError(`API request failed: ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

export function rankingsQuery(params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== false) query.set(key, String(value));
  }
  return `/api/rankings?${query.toString()}`;
}
