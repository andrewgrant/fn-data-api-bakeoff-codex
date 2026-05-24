import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;

export function createDatabase(dbPath: string): Database {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

export function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS islands (
      code TEXT PRIMARY KEY,
      creator_code TEXT,
      display_name TEXT,
      title TEXT NOT NULL,
      category TEXT,
      created_in TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]',
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_metadata_payload TEXT,
      is_stale INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS metric_points (
      island_code TEXT NOT NULL,
      interval TEXT NOT NULL,
      metric TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      value REAL,
      observed_at TEXT NOT NULL,
      PRIMARY KEY (island_code, interval, metric, timestamp),
      FOREIGN KEY (island_code) REFERENCES islands(code) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_metric_points_lookup
      ON metric_points (island_code, interval, metric, timestamp);

    CREATE TABLE IF NOT EXISTS retention_points (
      island_code TEXT NOT NULL,
      interval TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      d1 REAL,
      d7 REAL,
      observed_at TEXT NOT NULL,
      PRIMARY KEY (island_code, interval, timestamp),
      FOREIGN KEY (island_code) REFERENCES islands(code) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS island_observations (
      island_code TEXT PRIMARY KEY,
      latest_peak_ccu REAL,
      latest_peak_ccu_at TEXT,
      observed_all_time_peak REAL,
      observed_all_time_peak_at TEXT,
      day_plays REAL,
      day_unique_players REAL,
      day_minutes_played REAL,
      day_average_minutes_per_player REAL,
      day_favorites REAL,
      day_recommendations REAL,
      day_retention_d1 REAL,
      day_retention_d7 REAL,
      day_metrics_at TEXT,
      latest_updated_at TEXT,
      is_stale INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (island_code) REFERENCES islands(code) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_observations_peak
      ON island_observations (latest_peak_ccu);

    CREATE TABLE IF NOT EXISTS ingestion_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      max_islands INTEGER,
      metadata_count INTEGER NOT NULL DEFAULT 0,
      metric_point_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      error_json TEXT
    );

    CREATE TABLE IF NOT EXISTS ingestion_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      island_code TEXT,
      endpoint TEXT,
      status_code INTEGER,
      message TEXT NOT NULL,
      raw_response TEXT,
      FOREIGN KEY (run_id) REFERENCES ingestion_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS curated_seed_islands (
      code TEXT PRIMARY KEY,
      note TEXT,
      created_at TEXT NOT NULL
    );
  `);
}
