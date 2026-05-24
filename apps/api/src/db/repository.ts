import type { Database } from "./database.js";
import { curatedSeedIslands } from "./seedIslands.js";
import { hoursAgoIso, nowIso } from "../lib/time.js";
import type { IslandMetadata, MetricInterval, MetricName, MetricsResponse, RankingQuery } from "../types.js";

const sortColumns: Record<string, string> = {
  currentPlayers: "o.latest_peak_ccu",
  observedPeak: "o.observed_all_time_peak",
  minutesPlayed: "o.day_minutes_played",
  plays: "o.day_plays",
  uniquePlayers: "o.day_unique_players",
  avgPlaytime: "o.day_average_minutes_per_player",
  favorites: "o.day_favorites",
  recommendations: "o.day_recommendations",
  retentionD1: "o.day_retention_d1",
  updated: "o.latest_updated_at",
  title: "i.title"
};

interface Row {
  [key: string]: unknown;
}

type SqlValue = string | number | bigint | null | Uint8Array;

function sqlValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  return String(value);
}

function asTags(tagsJson: unknown): string[] {
  try {
    const parsed = JSON.parse(String(tagsJson ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normalizeIslandRow(row: Row) {
  return {
    code: String(row.code),
    creatorCode: row.creator_code ? String(row.creator_code) : null,
    displayName: row.display_name ? String(row.display_name) : null,
    title: String(row.title),
    category: row.category ? String(row.category) : null,
    createdIn: row.created_in ? String(row.created_in) : null,
    tags: asTags(row.tags_json),
    firstSeenAt: String(row.first_seen_at),
    lastSeenAt: String(row.last_seen_at),
    isStale: Boolean(row.is_stale)
  };
}

function normalizeObservation(row: Row) {
  return {
    latestPeakCcu: row.latest_peak_ccu ?? null,
    latestPeakCcuAt: row.latest_peak_ccu_at ?? null,
    observedAllTimePeak: row.observed_all_time_peak ?? null,
    observedAllTimePeakAt: row.observed_all_time_peak_at ?? null,
    dayPlays: row.day_plays ?? null,
    dayUniquePlayers: row.day_unique_players ?? null,
    dayMinutesPlayed: row.day_minutes_played ?? null,
    dayAverageMinutesPerPlayer: row.day_average_minutes_per_player ?? null,
    dayFavorites: row.day_favorites ?? null,
    dayRecommendations: row.day_recommendations ?? null,
    dayRetentionD1: row.day_retention_d1 ?? null,
    dayRetentionD7: row.day_retention_d7 ?? null,
    dayMetricsAt: row.day_metrics_at ?? null,
    latestUpdatedAt: row.latest_updated_at ?? null
  };
}

export function seedCuratedIslands(db: Database): void {
  const statement = db.prepare(`
    INSERT INTO curated_seed_islands (code, note, created_at)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET note = excluded.note
  `);
  const createdAt = nowIso();
  for (const seed of curatedSeedIslands) {
    statement.run(seed.code, seed.note, createdAt);
  }
}

export function listSeedCodes(db: Database): string[] {
  return db
    .prepare("SELECT code FROM curated_seed_islands ORDER BY code")
    .all()
    .map((row) => String((row as Row).code));
}

export function listKnownIslandCodes(db: Database, limit = 500): string[] {
  return db
    .prepare(
      `SELECT i.code
       FROM islands i
       LEFT JOIN island_observations o ON o.island_code = i.code
       ORDER BY (o.latest_peak_ccu IS NULL) ASC, o.latest_peak_ccu DESC, i.last_seen_at DESC
       LIMIT ?`
    )
    .all(limit)
    .map((row) => String((row as Row).code));
}

export function upsertIsland(db: Database, island: IslandMetadata, observedAt = nowIso()): void {
  const existing = db.prepare("SELECT first_seen_at FROM islands WHERE code = ?").get(island.code) as Row | undefined;
  const firstSeenAt = existing?.first_seen_at ? String(existing.first_seen_at) : observedAt;
  db.prepare(`
    INSERT INTO islands (
      code, creator_code, display_name, title, category, created_in, tags_json,
      first_seen_at, last_seen_at, last_metadata_payload, is_stale
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(code) DO UPDATE SET
      creator_code = excluded.creator_code,
      display_name = excluded.display_name,
      title = excluded.title,
      category = excluded.category,
      created_in = excluded.created_in,
      tags_json = excluded.tags_json,
      last_seen_at = excluded.last_seen_at,
      last_metadata_payload = excluded.last_metadata_payload,
      is_stale = 0
  `).run(
    island.code,
    island.creatorCode ?? null,
    island.displayName ?? null,
    island.title,
    island.category ?? null,
    island.createdIn ?? null,
    JSON.stringify(island.tags ?? []),
    firstSeenAt,
    observedAt,
    JSON.stringify(island)
  );
}

export function createIngestionRun(db: Database, mode: string, maxIslands: number): number {
  const result = db
    .prepare(
      "INSERT INTO ingestion_runs (started_at, mode, status, max_islands) VALUES (?, ?, 'running', ?)"
    )
    .run(nowIso(), mode, maxIslands);
  return Number(result.lastInsertRowid);
}

export function finishIngestionRun(
  db: Database,
  runId: number,
  status: "completed" | "failed",
  metadataCount: number,
  metricPointCount: number,
  errorCount: number,
  errors: unknown[]
): void {
  db.prepare(`
    UPDATE ingestion_runs
    SET finished_at = ?, status = ?, metadata_count = ?, metric_point_count = ?, error_count = ?, error_json = ?
    WHERE id = ?
  `).run(nowIso(), status, metadataCount, metricPointCount, errorCount, JSON.stringify(errors.slice(0, 25)), runId);
}

export function addIngestionError(
  db: Database,
  runId: number,
  error: {
    islandCode?: string;
    endpoint?: string;
    statusCode?: number;
    message: string;
    rawResponse?: string;
  }
): void {
  db.prepare(`
    INSERT INTO ingestion_errors (run_id, created_at, island_code, endpoint, status_code, message, raw_response)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    nowIso(),
    error.islandCode ?? null,
    error.endpoint ?? null,
    error.statusCode ?? null,
    error.message,
    error.rawResponse ?? null
  );
}

export function upsertMetrics(
  db: Database,
  islandCode: string,
  interval: MetricInterval,
  response: MetricsResponse,
  observedAt = nowIso()
): number {
  let inserted = 0;
  const metricStatement = db.prepare(`
    INSERT INTO metric_points (island_code, interval, metric, timestamp, value, observed_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(island_code, interval, metric, timestamp) DO UPDATE SET
      value = excluded.value,
      observed_at = excluded.observed_at
  `);

  for (const [metric, values] of Object.entries(response) as Array<[MetricName | "retention", unknown]>) {
    if (metric === "retention" || !Array.isArray(values)) continue;
    for (const point of values) {
      if (!point || typeof point !== "object") continue;
      const metricPoint = point as { timestamp?: unknown; value?: unknown };
      if (!metricPoint.timestamp) continue;
      metricStatement.run(
        islandCode,
        interval,
        metric,
        String(metricPoint.timestamp),
        metricPoint.value === null || metricPoint.value === undefined ? null : Number(metricPoint.value),
        observedAt
      );
      inserted += 1;
    }
  }

  const retentionStatement = db.prepare(`
    INSERT INTO retention_points (island_code, interval, timestamp, d1, d7, observed_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(island_code, interval, timestamp) DO UPDATE SET
      d1 = excluded.d1,
      d7 = excluded.d7,
      observed_at = excluded.observed_at
  `);
  for (const point of response.retention ?? []) {
    retentionStatement.run(islandCode, interval, point.timestamp, point.d1, point.d7, observedAt);
    inserted += 1;
  }

  return inserted;
}

function latestMetric(db: Database, islandCode: string, interval: MetricInterval, metric: MetricName): Row | undefined {
  return db
    .prepare(
      `SELECT value, timestamp
       FROM metric_points
       WHERE island_code = ? AND interval = ? AND metric = ? AND value IS NOT NULL
       ORDER BY timestamp DESC
       LIMIT 1`
    )
    .get(islandCode, interval, metric) as Row | undefined;
}

export function refreshIslandObservation(db: Database, islandCode: string): void {
  const latestPeak =
    latestMetric(db, islandCode, "minute", "peakCCU") ??
    latestMetric(db, islandCode, "hour", "peakCCU") ??
    latestMetric(db, islandCode, "day", "peakCCU");
  const allTimePeak = db
    .prepare(
      `SELECT value, timestamp
       FROM metric_points
       WHERE island_code = ? AND metric = 'peakCCU' AND value IS NOT NULL
       ORDER BY value DESC, timestamp DESC
       LIMIT 1`
    )
    .get(islandCode) as Row | undefined;

  const dayMetrics: Record<string, Row | undefined> = {};
  for (const metric of [
    "plays",
    "uniquePlayers",
    "minutesPlayed",
    "averageMinutesPerPlayer",
    "favorites",
    "recommendations"
  ] as MetricName[]) {
    dayMetrics[metric] = latestMetric(db, islandCode, "day", metric);
  }
  const latestRetention = db
    .prepare(
      `SELECT d1, d7, timestamp
       FROM retention_points
       WHERE island_code = ? AND interval = 'day'
       ORDER BY timestamp DESC
       LIMIT 1`
    )
    .get(islandCode) as Row | undefined;

  const latestUpdated = db
    .prepare(
      `SELECT MAX(observed_at) AS latest_updated_at
       FROM (
        SELECT observed_at FROM metric_points WHERE island_code = ?
        UNION ALL
        SELECT observed_at FROM retention_points WHERE island_code = ?
       )`
    )
    .get(islandCode, islandCode) as Row | undefined;
  const latestUpdatedAt = latestUpdated?.latest_updated_at ? String(latestUpdated.latest_updated_at) : null;
  const staleThreshold = hoursAgoIso(2);
  const isStale = latestUpdatedAt ? latestUpdatedAt < staleThreshold : true;

  db.prepare(`
    INSERT INTO island_observations (
      island_code, latest_peak_ccu, latest_peak_ccu_at, observed_all_time_peak, observed_all_time_peak_at,
      day_plays, day_unique_players, day_minutes_played, day_average_minutes_per_player,
      day_favorites, day_recommendations, day_retention_d1, day_retention_d7,
      day_metrics_at, latest_updated_at, is_stale
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(island_code) DO UPDATE SET
      latest_peak_ccu = excluded.latest_peak_ccu,
      latest_peak_ccu_at = excluded.latest_peak_ccu_at,
      observed_all_time_peak = excluded.observed_all_time_peak,
      observed_all_time_peak_at = excluded.observed_all_time_peak_at,
      day_plays = excluded.day_plays,
      day_unique_players = excluded.day_unique_players,
      day_minutes_played = excluded.day_minutes_played,
      day_average_minutes_per_player = excluded.day_average_minutes_per_player,
      day_favorites = excluded.day_favorites,
      day_recommendations = excluded.day_recommendations,
      day_retention_d1 = excluded.day_retention_d1,
      day_retention_d7 = excluded.day_retention_d7,
      day_metrics_at = excluded.day_metrics_at,
      latest_updated_at = excluded.latest_updated_at,
      is_stale = excluded.is_stale
  `).run(
    islandCode,
    sqlValue(latestPeak?.value),
    sqlValue(latestPeak?.timestamp),
    sqlValue(allTimePeak?.value),
    sqlValue(allTimePeak?.timestamp),
    sqlValue(dayMetrics.plays?.value),
    sqlValue(dayMetrics.uniquePlayers?.value),
    sqlValue(dayMetrics.minutesPlayed?.value),
    sqlValue(dayMetrics.averageMinutesPerPlayer?.value),
    sqlValue(dayMetrics.favorites?.value),
    sqlValue(dayMetrics.recommendations?.value),
    sqlValue(latestRetention?.d1),
    sqlValue(latestRetention?.d7),
    sqlValue(dayMetrics.plays?.timestamp ?? dayMetrics.minutesPlayed?.timestamp ?? latestRetention?.timestamp),
    latestUpdatedAt,
    isStale ? 1 : 0
  );

  db.prepare("UPDATE islands SET is_stale = ? WHERE code = ?").run(isStale ? 1 : 0, islandCode);
}

function rankingWhere(query: RankingQuery): { sql: string; values: SqlValue[] } {
  const clauses: string[] = [];
  const values: SqlValue[] = [];

  if (query.search) {
    clauses.push("(LOWER(i.title) LIKE ? OR LOWER(i.code) LIKE ? OR LOWER(i.creator_code) LIKE ?)");
    const search = `%${query.search.toLowerCase()}%`;
    values.push(search, search, search);
  }
  if (query.tag) {
    clauses.push("LOWER(i.tags_json) LIKE ?");
    values.push(`%"${query.tag.toLowerCase().replaceAll('"', '\\"')}"%`);
  }
  if (query.creator) {
    clauses.push("LOWER(i.creator_code) = ?");
    values.push(query.creator.toLowerCase());
  }
  if (query.hideEpic) {
    clauses.push("LOWER(COALESCE(i.creator_code, '')) NOT IN ('epic', 'epicgames', 'fortnite')");
  }
  if (query.minPlayers !== undefined) {
    clauses.push("o.latest_peak_ccu >= ?");
    values.push(query.minPlayers);
  }
  if (query.maxPlayers !== undefined) {
    clauses.push("o.latest_peak_ccu <= ?");
    values.push(query.maxPlayers);
  }
  if (query.minMinutes !== undefined) {
    clauses.push("o.day_minutes_played >= ?");
    values.push(query.minMinutes);
  }
  if (query.maxMinutes !== undefined) {
    clauses.push("o.day_minutes_played <= ?");
    values.push(query.maxMinutes);
  }
  if (query.lastUpdatedHours !== undefined) {
    clauses.push("o.latest_updated_at >= ?");
    values.push(hoursAgoIso(query.lastUpdatedHours));
  }

  return {
    sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values
  };
}

export function listRankings(db: Database, query: RankingQuery) {
  const where = rankingWhere(query);
  const sortColumn = sortColumns[query.sort] ?? sortColumns.currentPlayers;
  const direction = query.direction === "asc" ? "ASC" : "DESC";
  const offset = (query.page - 1) * query.pageSize;

  const totalRow = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM islands i
       LEFT JOIN island_observations o ON o.island_code = i.code
       ${where.sql}`
    )
    .get(...where.values) as Row;

  const rows = db
    .prepare(
      `SELECT i.*, o.*
       FROM islands i
       LEFT JOIN island_observations o ON o.island_code = i.code
       ${where.sql}
       ORDER BY (${sortColumn} IS NULL) ASC, ${sortColumn} ${direction}, i.title COLLATE NOCASE ASC
       LIMIT ? OFFSET ?`
    )
    .all(...where.values, query.pageSize, offset) as Row[];

  return {
    page: query.page,
    pageSize: query.pageSize,
    total: Number(totalRow.total ?? 0),
    data: rows.map((row) => ({
      ...normalizeIslandRow(row),
      metrics: normalizeObservation(row)
    }))
  };
}

export function getIsland(db: Database, code: string) {
  const row = db
    .prepare(
      `SELECT i.*, o.*
       FROM islands i
       LEFT JOIN island_observations o ON o.island_code = i.code
       WHERE i.code = ? OR LOWER(i.display_name) = LOWER(?)`
    )
    .get(code, code) as Row | undefined;
  if (!row) return null;
  return {
    ...normalizeIslandRow(row),
    metrics: normalizeObservation(row),
    externalLinks: {
      epic: row.creator_code
        ? `https://www.fortnite.com/@${row.creator_code}/${row.code}`
        : `https://www.fortnite.com/search?q=${row.code}`,
      fortniteGg: `https://fortnite.gg/island/${row.code}`
    },
    unavailableFromEpicApi: [
      "trueLivePlayersNow",
      "releaseDate",
      "version",
      "maxPlayers",
      "ageRating",
      "xpStatus",
      "screenshots",
      "creatorFollowers",
      "earnings",
      "platformShare",
      "updateHistory"
    ]
  };
}

export function getIslandMetrics(db: Database, code: string, interval: MetricInterval) {
  const rows = db
    .prepare(
      `SELECT metric, timestamp, value
       FROM metric_points
       WHERE island_code = ? AND interval = ?
       ORDER BY timestamp ASC`
    )
    .all(code, interval) as Row[];

  const metrics: Record<string, Array<{ timestamp: string; value: number | null }>> = {};
  for (const row of rows) {
    const metric = String(row.metric);
    metrics[metric] ??= [];
    metrics[metric].push({
      timestamp: String(row.timestamp),
      value: row.value === null || row.value === undefined ? null : Number(row.value)
    });
  }

  const retention = db
    .prepare(
      `SELECT timestamp, d1, d7
       FROM retention_points
       WHERE island_code = ? AND interval = ?
       ORDER BY timestamp ASC`
    )
    .all(code, interval) as Row[];

  return {
    interval,
    metrics,
    retention: retention.map((row) => ({
      timestamp: String(row.timestamp),
      d1: row.d1 === null || row.d1 === undefined ? null : Number(row.d1),
      d7: row.d7 === null || row.d7 === undefined ? null : Number(row.d7)
    }))
  };
}

export function listTags(db: Database) {
  const counts = new Map<string, number>();
  const rows = db.prepare("SELECT tags_json FROM islands").all() as Row[];
  for (const row of rows) {
    for (const tag of asTags(row.tags_json)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function listCreators(db: Database, limit = 100) {
  const rows = db
    .prepare(
      `SELECT
        i.creator_code,
        COUNT(*) AS island_count,
        SUM(COALESCE(o.latest_peak_ccu, 0)) AS current_players,
        SUM(COALESCE(o.day_minutes_played, 0)) AS day_minutes_played,
        SUM(COALESCE(o.day_favorites, 0)) AS day_favorites,
        MAX(o.latest_updated_at) AS latest_updated_at
       FROM islands i
       LEFT JOIN island_observations o ON o.island_code = i.code
       WHERE i.creator_code IS NOT NULL AND i.creator_code != ''
       GROUP BY i.creator_code
       ORDER BY current_players DESC, day_minutes_played DESC, i.creator_code ASC
       LIMIT ?`
    )
    .all(limit) as Row[];

  return rows.map((row) => ({
    creatorCode: String(row.creator_code),
    islandCount: Number(row.island_count ?? 0),
    currentPlayers: Number(row.current_players ?? 0),
    dayMinutesPlayed: Number(row.day_minutes_played ?? 0),
    dayFavorites: Number(row.day_favorites ?? 0),
    latestUpdatedAt: row.latest_updated_at ?? null
  }));
}

export function getCreator(db: Database, creatorCode: string) {
  const creator = db
    .prepare(
      `SELECT
        i.creator_code,
        COUNT(*) AS island_count,
        SUM(COALESCE(o.latest_peak_ccu, 0)) AS current_players,
        SUM(COALESCE(o.day_minutes_played, 0)) AS day_minutes_played,
        SUM(COALESCE(o.day_favorites, 0)) AS day_favorites,
        SUM(COALESCE(o.day_plays, 0)) AS day_plays,
        MAX(o.latest_updated_at) AS latest_updated_at
       FROM islands i
       LEFT JOIN island_observations o ON o.island_code = i.code
       WHERE LOWER(i.creator_code) = LOWER(?)
       GROUP BY i.creator_code`
    )
    .get(creatorCode) as Row | undefined;

  if (!creator) return null;
  const rankings = listRankings(db, {
    page: 1,
    pageSize: 100,
    sort: "currentPlayers",
    direction: "desc",
    creator: String(creator.creator_code).toLowerCase()
  });

  return {
    creatorCode: String(creator.creator_code),
    islandCount: Number(creator.island_count ?? 0),
    currentPlayers: Number(creator.current_players ?? 0),
    dayMinutesPlayed: Number(creator.day_minutes_played ?? 0),
    dayFavorites: Number(creator.day_favorites ?? 0),
    dayPlays: Number(creator.day_plays ?? 0),
    latestUpdatedAt: creator.latest_updated_at ?? null,
    islands: rankings.data
  };
}

export function listIngestionRuns(db: Database) {
  return (db
    .prepare(
      `SELECT *
       FROM ingestion_runs
       ORDER BY started_at DESC
       LIMIT 25`
    )
    .all() as Row[]).map((row) => ({
    id: Number(row.id),
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    mode: row.mode,
    status: row.status,
    maxIslands: row.max_islands,
    metadataCount: row.metadata_count,
    metricPointCount: row.metric_point_count,
    errorCount: row.error_count
  }));
}

export function databaseStats(db: Database) {
  const islandCount = db.prepare("SELECT COUNT(*) AS count FROM islands").get() as Row;
  const metricCount = db.prepare("SELECT COUNT(*) AS count FROM metric_points").get() as Row;
  const latestRun = db
    .prepare("SELECT id, status, started_at, finished_at FROM ingestion_runs ORDER BY started_at DESC LIMIT 1")
    .get() as Row | undefined;
  return {
    islandCount: Number(islandCount.count ?? 0),
    metricPointCount: Number(metricCount.count ?? 0),
    latestRun: latestRun
      ? {
          id: Number(latestRun.id),
          status: latestRun.status,
          startedAt: latestRun.started_at,
          finishedAt: latestRun.finished_at
        }
      : null
  };
}

export function markStaleObservations(db: Database): void {
  const threshold = hoursAgoIso(2);
  db.prepare(
    "UPDATE island_observations SET is_stale = 1 WHERE latest_updated_at IS NULL OR latest_updated_at < ?"
  ).run(threshold);
  db.prepare(
    `UPDATE islands
     SET is_stale = 1
     WHERE code IN (
      SELECT island_code FROM island_observations WHERE latest_updated_at IS NULL OR latest_updated_at < ?
     )`
  ).run(threshold);
}
