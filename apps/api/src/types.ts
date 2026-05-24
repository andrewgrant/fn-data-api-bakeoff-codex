export const metricNames = [
  "averageMinutesPerPlayer",
  "peakCCU",
  "favorites",
  "minutesPlayed",
  "recommendations",
  "plays",
  "uniquePlayers"
] as const;

export const intervals = ["minute", "hour", "day"] as const;

export type MetricName = (typeof metricNames)[number];
export type MetricsQueryName = MetricName | "retention";
export type MetricInterval = (typeof intervals)[number];

export interface IslandMetadata {
  code: string;
  creatorCode?: string;
  displayName?: string;
  title: string;
  category?: string;
  createdIn?: string;
  tags: string[];
}

export interface MetricValue {
  value: number | null;
  timestamp: string;
}

export interface RetentionValue {
  d1: number | null;
  d7: number | null;
  timestamp: string;
}

export type MetricsResponse = Partial<Record<MetricName, MetricValue[]>> & {
  retention?: RetentionValue[];
};

export interface IslandListResponse {
  links: {
    next: string | null;
    prev: string | null;
  };
  meta: {
    count: number;
    page: {
      nextCursor: string | null;
      prevCursor: string | null;
    };
  };
  data: Array<IslandMetadata & { meta?: { page?: { cursor?: string } } }>;
}

export interface RankingQuery {
  page: number;
  pageSize: number;
  sort: string;
  direction: "asc" | "desc";
  search?: string;
  tag?: string;
  creator?: string;
  hideEpic?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  minMinutes?: number;
  maxMinutes?: number;
  lastUpdatedHours?: number;
}

export interface IngestionOptions {
  seeds: boolean;
  maxIslands: number;
  intervals: MetricInterval[];
  concurrency: number;
  metadata: boolean;
  metrics: boolean;
}

export interface IngestionSummary {
  runId: number;
  status: "completed" | "failed";
  metadataCount: number;
  metricPointCount: number;
  errorCount: number;
}
