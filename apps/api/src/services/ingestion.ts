import type { Database } from "../db/database.js";
import {
  addIngestionError,
  createIngestionRun,
  finishIngestionRun,
  listKnownIslandCodes,
  listSeedCodes,
  markStaleObservations,
  refreshIslandObservation,
  seedCuratedIslands,
  upsertIsland,
  upsertMetrics
} from "../db/repository.js";
import type {
  IngestionOptions,
  IngestionSummary,
  IslandMetadata,
  MetricInterval,
  MetricsQueryName
} from "../types.js";
import { EpicApiError, EpicClient } from "./epicClient.js";

const metricSets: Record<MetricInterval, MetricsQueryName[]> = {
  minute: ["peakCCU", "favorites", "minutesPlayed", "recommendations", "plays", "uniquePlayers"],
  hour: [
    "averageMinutesPerPlayer",
    "peakCCU",
    "favorites",
    "minutesPlayed",
    "recommendations",
    "plays",
    "uniquePlayers"
  ],
  day: [
    "averageMinutesPerPlayer",
    "peakCCU",
    "favorites",
    "minutesPlayed",
    "recommendations",
    "plays",
    "uniquePlayers",
    "retention"
  ]
};

type ErrorRecord = {
  islandCode?: string;
  endpoint?: string;
  statusCode?: number;
  message: string;
  rawResponse?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof EpicApiError) || error.statusCode !== 429 || attempt >= retries) {
        throw error;
      }
      const backoff = error.retryAfterMs ?? 1000 * 2 ** attempt;
      await sleep(backoff);
      attempt += 1;
    }
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export class IngestionService {
  constructor(
    private readonly db: Database,
    private readonly client: EpicClient
  ) {}

  async run(options: IngestionOptions): Promise<IngestionSummary> {
    seedCuratedIslands(this.db);
    const runId = createIngestionRun(this.db, this.describeMode(options), options.maxIslands);
    const errors: ErrorRecord[] = [];
    let metadataCount = 0;
    let metricPointCount = 0;
    const codes = new Set<string>();

    try {
      if (options.seeds) {
        for (const code of listSeedCodes(this.db)) {
          codes.add(code);
        }
      }

      if (options.metadata) {
        metadataCount += await this.fetchSeedMetadata([...codes], runId, errors);
        const crawled = await this.crawlMetadata(options.maxIslands, runId, errors);
        metadataCount += crawled.count;
        for (const code of crawled.codes) codes.add(code);
      }

      if (options.metrics) {
        if (!options.metadata) {
          for (const code of listKnownIslandCodes(this.db, options.maxIslands || 500)) codes.add(code);
        }
        const targets = [...codes].slice(0, Math.max(options.maxIslands, codes.size));
        metricPointCount += await this.fetchMetrics(targets, options.intervals, options.concurrency, runId, errors);
      }

      markStaleObservations(this.db);
      finishIngestionRun(this.db, runId, "completed", metadataCount, metricPointCount, errors.length, errors);
      return {
        runId,
        status: "completed",
        metadataCount,
        metricPointCount,
        errorCount: errors.length
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ message });
      finishIngestionRun(this.db, runId, "failed", metadataCount, metricPointCount, errors.length, errors);
      return {
        runId,
        status: "failed",
        metadataCount,
        metricPointCount,
        errorCount: errors.length
      };
    }
  }

  private describeMode(options: IngestionOptions): string {
    const parts = [];
    if (options.seeds) parts.push("seeds");
    if (options.metadata) parts.push("metadata");
    if (options.metrics) parts.push(`metrics:${options.intervals.join(",")}`);
    return parts.join("+") || "noop";
  }

  private async fetchSeedMetadata(codes: string[], runId: number, errors: ErrorRecord[]): Promise<number> {
    let count = 0;
    for (const code of codes) {
      try {
        const island = await withRetry(() => this.client.getIsland(code));
        upsertIsland(this.db, island);
        count += 1;
      } catch (error) {
        this.captureError(runId, errors, error, code);
      }
    }
    return count;
  }

  private async crawlMetadata(
    maxIslands: number,
    runId: number,
    errors: ErrorRecord[]
  ): Promise<{ count: number; codes: string[] }> {
    const codes: string[] = [];
    let after: string | undefined;
    let count = 0;
    while (count < maxIslands) {
      const size = Math.min(1000, maxIslands - count);
      try {
        const page = await withRetry(() => this.client.listIslands({ size, after }));
        for (const island of page.data) {
          upsertIsland(this.db, island);
          codes.push(island.code);
          count += 1;
        }
        after = page.meta.page.nextCursor ?? undefined;
        if (!after || page.data.length === 0) break;
      } catch (error) {
        this.captureError(runId, errors, error);
        break;
      }
    }
    return { count, codes };
  }

  private async fetchMetrics(
    codes: string[],
    intervals: MetricInterval[],
    concurrency: number,
    runId: number,
    errors: ErrorRecord[]
  ): Promise<number> {
    let metricPointCount = 0;
    await mapLimit(codes, concurrency, async (code) => {
      for (const interval of intervals) {
        try {
          const metrics = await withRetry(() => this.client.getMetrics(code, interval, metricSets[interval]));
          metricPointCount += upsertMetrics(this.db, code, interval, metrics);
        } catch (error) {
          this.captureError(runId, errors, error, code);
        }
      }
      refreshIslandObservation(this.db, code);
    });
    return metricPointCount;
  }

  private captureError(runId: number, errors: ErrorRecord[], error: unknown, islandCode?: string): void {
    const record: ErrorRecord =
      error instanceof EpicApiError
        ? {
            islandCode,
            endpoint: error.endpoint,
            statusCode: error.statusCode,
            message: error.message,
            rawResponse: error.rawResponse
          }
        : {
            islandCode,
            message: error instanceof Error ? error.message : String(error)
          };
    errors.push(record);
    addIngestionError(this.db, runId, record);
  }
}

export const defaultIngestionOptions: IngestionOptions = {
  seeds: true,
  maxIslands: 25,
  intervals: ["minute", "hour", "day"],
  concurrency: 4,
  metadata: true,
  metrics: true
};

export function normalizeIslandForTest(island: IslandMetadata): IslandMetadata {
  return {
    code: island.code,
    creatorCode: island.creatorCode,
    displayName: island.displayName,
    title: island.title,
    category: island.category,
    createdIn: island.createdIn,
    tags: island.tags ?? []
  };
}
