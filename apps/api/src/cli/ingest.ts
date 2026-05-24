import { config } from "../config.js";
import { createDatabase } from "../db/database.js";
import { EpicClient } from "../services/epicClient.js";
import { defaultIngestionOptions, IngestionService } from "../services/ingestion.js";
import type { MetricInterval } from "../types.js";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const legacyMax = argValue("max-islands");
const metadataLimit = Number.parseInt(
  argValue("metadata-limit") ?? legacyMax ?? String(defaultIngestionOptions.metadataLimit),
  10
);
const metricsLimit = Number.parseInt(
  argValue("metrics-limit") ?? legacyMax ?? String(defaultIngestionOptions.metricsLimit),
  10
);
const concurrency = Number.parseInt(argValue("concurrency") ?? String(defaultIngestionOptions.concurrency), 10);
const intervals = (argValue("intervals") ?? "minute,hour,day")
  .split(",")
  .filter((value): value is MetricInterval => value === "minute" || value === "hour" || value === "day");

const db = createDatabase(config.dbPath);
const ingestion = new IngestionService(
  db,
  new EpicClient({
    baseUrl: config.epicBaseUrl,
    timeoutMs: config.requestTimeoutMs
  })
);

const summary = await ingestion.run({
  ...defaultIngestionOptions,
  seeds: hasFlag("seeds") || !hasFlag("no-seeds"),
  metadata: !hasFlag("no-metadata"),
  metrics: !hasFlag("no-metrics"),
  metadataLimit: Number.isFinite(metadataLimit) ? metadataLimit : defaultIngestionOptions.metadataLimit,
  metricsLimit: Number.isFinite(metricsLimit) ? metricsLimit : defaultIngestionOptions.metricsLimit,
  concurrency: Number.isFinite(concurrency) ? concurrency : defaultIngestionOptions.concurrency,
  intervals: intervals.length ? intervals : defaultIngestionOptions.intervals
});

console.log(JSON.stringify(summary, null, 2));
db.close();
