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
  epicBaseUrl: process.env.EPIC_API_BASE_URL ?? "https://api.fortnite.com/ecosystem/v1",
  requestTimeoutMs: integerEnv("REQUEST_TIMEOUT_MS", 15000),
  ingestOnStart: booleanEnv("INGEST_ON_START", false),
  ingestMaxIslands: integerEnv("INGEST_MAX_ISLANDS", 25),
  ingestIntervalMinutes: integerEnv("INGEST_INTERVAL_MINUTES", 30),
  metadataCrawlIntervalMinutes: integerEnv("METADATA_CRAWL_INTERVAL_MINUTES", 360)
};
