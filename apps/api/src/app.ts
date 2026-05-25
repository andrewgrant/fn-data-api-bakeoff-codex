import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import type { Database } from "./db/database.js";
import {
  databaseStats,
  getCreator,
  getIsland,
  getIslandMetrics,
  listCreators,
  listIngestionRuns,
  listRankings,
  listTags
} from "./db/repository.js";
import { asyncRoute } from "./lib/async.js";
import { toInteger, toNumber } from "./lib/time.js";
import { config } from "./config.js";
import { EpicClient } from "./services/epicClient.js";
import { defaultIngestionOptions, IngestionService } from "./services/ingestion.js";
import type { MetricInterval, RankingQuery } from "./types.js";

export function createApp(db: Database) {
  const app = express();
  app.use(
    cors({
      origin: config.corsOrigin,
      methods: ["GET", "POST", "OPTIONS"]
    })
  );
  app.use(express.json());

  const epicClient = new EpicClient({
    baseUrl: config.epicBaseUrl,
    timeoutMs: config.requestTimeoutMs
  });
  const ingestionService = new IngestionService(db, epicClient);

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      service: "island-intel-api",
      db: databaseStats(db)
    });
  });

  app.get(
    "/api/rankings",
    asyncRoute(async (request, response) => {
      const query = parseRankingQuery(request.query);
      response.json(listRankings(db, query));
    })
  );

  app.get(
    "/api/tags",
    asyncRoute(async (_request, response) => {
      response.json({ data: listTags(db) });
    })
  );

  app.get(
    "/api/creators",
    asyncRoute(async (request, response) => {
      response.json({ data: listCreators(db, toInteger(request.query.limit, 100, 1, 500)) });
    })
  );

  app.get(
    "/api/creators/:creatorCode",
    asyncRoute(async (request, response) => {
      const creator = getCreator(db, String(request.params.creatorCode));
      if (!creator) {
        response.status(404).json({ error: "creator_not_found" });
        return;
      }
      response.json(creator);
    })
  );

  app.get(
    "/api/islands/:code",
    asyncRoute(async (request, response) => {
      const island = getIsland(db, String(request.params.code));
      if (!island) {
        response.status(404).json({ error: "island_not_found" });
        return;
      }
      response.json(island);
    })
  );

  app.get(
    "/api/islands/:code/metrics",
    asyncRoute(async (request, response) => {
      const interval = parseInterval(request.query.interval);
      response.json(getIslandMetrics(db, String(request.params.code), interval));
    })
  );

  app.get(
    "/api/ingestion/runs",
    asyncRoute(async (_request, response) => {
      response.json({ data: listIngestionRuns(db) });
    })
  );

  app.post(
    "/api/ingestion/run",
    asyncRoute(async (request, response) => {
      const legacyMax = toInteger(request.body?.maxIslands, 0, 0, 10000);
      const summary = await ingestionService.run({
        ...defaultIngestionOptions,
        metadataLimit: toInteger(
          request.body?.metadataLimit,
          legacyMax || defaultIngestionOptions.metadataLimit,
          0,
          10000
        ),
        metricsLimit: toInteger(
          request.body?.metricsLimit,
          legacyMax || defaultIngestionOptions.metricsLimit,
          0,
          2000
        ),
        concurrency: toInteger(request.body?.concurrency, defaultIngestionOptions.concurrency, 1, 8),
        seeds: request.body?.seeds ?? defaultIngestionOptions.seeds,
        metadata: request.body?.metadata ?? defaultIngestionOptions.metadata,
        metrics: request.body?.metrics ?? defaultIngestionOptions.metrics
      });
      response.status(summary.status === "completed" ? 200 : 500).json(summary);
    })
  );

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "not_found" });
  });

  if (fs.existsSync(path.join(config.webDistPath, "index.html"))) {
    app.use(express.static(config.webDistPath));
    app.get(/^(?!\/api\/).*/, (_request, response) => {
      response.sendFile(path.join(config.webDistPath, "index.html"));
    });
  }

  app.use(((_error, _request, response, _next) => {
    const error = _error instanceof Error ? _error : new Error(String(_error));
    response.status(500).json({
      error: "internal_server_error",
      message: error.message
    });
  }) satisfies ErrorRequestHandler);

  return app;
}

function parseInterval(value: unknown): MetricInterval {
  if (value === "minute" || value === "hour" || value === "day") return value;
  return "hour";
}

function parseRankingQuery(query: Record<string, unknown>): RankingQuery {
  const direction = query.direction === "asc" ? "asc" : "desc";
  return {
    page: toInteger(query.page, 1, 1, 10000),
    pageSize: toInteger(query.pageSize, 25, 1, 100),
    sort: typeof query.sort === "string" ? query.sort : "currentPlayers",
    direction,
    search: typeof query.search === "string" && query.search.trim() ? query.search.trim() : undefined,
    tag: typeof query.tag === "string" && query.tag.trim() ? query.tag.trim() : undefined,
    creator: typeof query.creator === "string" && query.creator.trim() ? query.creator.trim() : undefined,
    hideEpic: query.hideEpic === "true" || query.hideEpic === "1",
    minPlayers: toNumber(query.minPlayers),
    maxPlayers: toNumber(query.maxPlayers),
    minMinutes: toNumber(query.minMinutes),
    maxMinutes: toNumber(query.maxMinutes),
    lastUpdatedHours: toNumber(query.lastUpdatedHours)
  };
}
