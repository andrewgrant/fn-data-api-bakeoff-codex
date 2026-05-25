import path from "node:path";
import { fileURLToPath } from "node:url";

const distOrSrcDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(distOrSrcDir, "../../..");

function integerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function booleanEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export const config = {
  port: integerEnv("PORT", 3201),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3200",
  dbPath: path.resolve(process.env.DB_PATH ?? path.join(repoRoot, "data/islands.db")),
  webDistPath: path.resolve(process.env.WEB_DIST_PATH ?? path.join(repoRoot, "apps/web/dist")),
  epicBaseUrl: process.env.EPIC_API_BASE_URL ?? "https://api.fortnite.com/ecosystem/v1",
  requestTimeoutMs: integerEnv("REQUEST_TIMEOUT_MS", 15000),
  ingestOnStart: booleanEnv("INGEST_ON_START", process.env.NODE_ENV === "production"),
  ingestMetadataLimit: integerEnv("INGEST_METADATA_LIMIT", integerEnv("INGEST_MAX_ISLANDS", 1000)),
  ingestMetricsLimit: integerEnv("INGEST_METRICS_LIMIT", integerEnv("INGEST_MAX_ISLANDS", 25)),
  ingestIntervalMinutes: integerEnv("INGEST_INTERVAL_MINUTES", 30),
  metadataCrawlIntervalMinutes: integerEnv("METADATA_CRAWL_INTERVAL_MINUTES", 360)
};
