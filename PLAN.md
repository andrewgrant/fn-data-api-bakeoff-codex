# Fortnite Islands Rankings Plan

Status legend: `[ ]` pending, `[~]` in progress, `[x]` complete.

## Research Summary

Sources reviewed:

- Epic Fortnite Data API overview and Swagger UI at `https://dev.epicgames.com/documentation/fortnite/using-fortnite-data-api-in-fortnite?lang=en-US` and `https://api.fortnite.com/ecosystem/v1/docs/`.
- Fortnite.GG Creative, player-count, creator, and island pages, especially `https://fortnite.gg/creative`.

Relevant API findings:

- The official API base is `https://api.fortnite.com/ecosystem/v1`.
- Public endpoints include `GET /islands`, `GET /islands/{code}`, `GET /islands/{code}/metrics`, and metric-specific paths.
- Available interval paths are `minute`, `hour`, and `day`; minute buckets are returned at 10-minute intervals.
- Available metrics are `averageMinutesPerPlayer`, `peakCCU`, `favorites`, `minutesPlayed`, `recommendations`, `plays`, `uniquePlayers`, and `retention`.
- Historical data is limited to about seven days, so this project must persist snapshots locally to build longer-running history.
- The API only includes public and discoverable islands, and intervals below five unique players can return `null`.

Fortnite.GG feature findings to emulate where possible:

- Creative ranking table with sortable columns for players now / peak CCU, all-time peak, minutes played, favorites, 24h plays, 24h favorites, recommends, players, average playtime, retention, and publish date.
- Filters by tag, feature, release date, metric ranges, hide Epic maps, and map/creator search.
- Creator pages with aggregate current players, minutes played, followers/favorites, map list, charts, and update history.
- Island detail pages with metadata, tags, player-count chart, 24h overview, total playtime, sessions, recommendations, retention, and platform-share style contextual metrics.

Feature parity and limits:

| Fortnite.GG feature | Implementation target | Limit / note |
| --- | --- | --- |
| Players Now | Use latest 10-minute `peakCCU` as current activity proxy | Not truly live CCU; observed by ingestion only. |
| All-time peak | Track `observed_all_time_peak` from stored metric points | Cannot know peaks before local ingestion except Epic's current 7-day window. |
| 24h plays, players, favorites, recommends, avg playtime, retention | Use day interval metrics from Epic API | Nulls are expected below API privacy thresholds and sort last. |
| Minutes played | Sum stored day metrics and expose latest 24h | Long-term totals only accrue after local ingestion. |
| Release/publish date, version, max players, XP status, age rating, description, screenshots | Link out to Fortnite/Fortnite.GG when unavailable | Official Data API metadata does not expose these fields. |
| Creator followers and total favorites | Show local aggregates from creator islands | Fortnite.GG follower counts are not exposed by the official API. |
| Earnings, discovery/homebar time, platform share, update history | Out of scope unless another public source becomes available | Mark as unavailable in UI copy/API metadata. |

## Product Scope

Build a local and Docker-deployable app named `Island Intel` with:

- Rankings page for the locally ingested island corpus with search, tag filter, creator filter, sort selection, pagination, and metric range filters.
- Island detail page with metadata, current 10-minute/hour/day summaries, charts, and external Fortnite/Fortnite.GG links.
- Creator view with aggregate metrics and creator map rankings.
- Backend ingestion service that periodically fetches Epic island metadata and metrics, stores them in SQLite, and keeps historical snapshots beyond Epic's short window.
- Manual ingestion endpoint/CLI for local testing.
- Seed list of known active islands from research to make the first local run useful before broad crawling completes.
- Docker Compose deployment with backend on port `3201` and frontend on port `3200`.

## Architecture

- Monorepo with npm workspaces.
- Runtime: Node 24+ locally and in Docker because the backend uses built-in `node:sqlite`; pin with `.nvmrc`, `engines`, and `node:24` images.
- Backend: Node.js + TypeScript, Express, built-in `node:sqlite`, no authentication required for Epic API.
- Frontend: Vite + React + TypeScript, Recharts for charts, Lucide icons for controls.
- Storage: SQLite database under `data/islands.db`, mounted as a Docker volume with writable permissions for the backend container user.
- Ingestion: background scheduler in the API process plus `npm run ingest` for one-shot runs; separate metadata crawl and metric refresh cadence.
- Ingestion controls: cursor pagination via `after`/`before` and `size`, configurable max corpus size, retry/backoff on `429`, request timeouts, concurrency cap, stale-data marking, raw payload/error capture, and ingestion watermarks.
- Ranking semantics: all backend rankings are rankings over data already ingested locally. The Epic API has no global metric-sorted ranking endpoint, so wider rankings require crawling metadata and fetching metrics per island under rate limits.
- Data model:
  - `islands`: island metadata and tags.
  - `metric_points`: per-island metric time series by interval with unique `(island_code, interval, metric, timestamp)` and support for null values.
  - `retention_points`: D1/D7 retention by day interval with unique `(island_code, interval, timestamp)` and support for null values.
  - `ingestion_runs`: operational history, status, raw errors, and high-level counts.
  - `island_observations`: latest derived fields such as latest CCU proxy, observed all-time peak, latest 24h metrics, and stale state.
  - `curated_seed_islands`: known-active island codes collected during research.
- API query conventions: list routes accept `page`, `pageSize`, `sort`, `direction`, `search`, `tag`, `creator`, metric min/max ranges, and `lastUpdated` filters; null metric values sort last.

## Phases

### Phase 0: Repo Baseline

- [x] Initialize Git repository and remote.
- [x] Commit the received instructions and plan baseline.

### Phase 1: Planning Review

- [x] Have a second agent review this plan.
- [x] Apply appropriate review changes.
- [x] Mark Phase 1 complete after review is incorporated.

### Phase 2: Backend Service

- [x] Create API workspace, TypeScript config, and scripts.
- [x] Implement SQLite schema, migrations, and repository queries.
- [x] Implement Epic API client with pagination, metric filters, timeouts, and rate-conscious concurrency.
- [x] Implement ingestion service for seed islands plus configurable metadata crawl.
- [x] Implement Express routes:
  - `GET /api/health`
  - `GET /api/rankings`
  - `GET /api/islands/:code`
  - `GET /api/islands/:code/metrics`
  - `GET /api/creators`
  - `GET /api/creators/:creatorCode`
  - `GET /api/tags`
  - `GET /api/ingestion/runs`
  - `POST /api/ingestion/run`
- [x] Add backend tests for normalization, ranking queries, and route smoke coverage.
- [x] Commit backend milestone.

### Phase 3: Frontend App

- [x] Create Vite React workspace.
- [x] Build rankings dashboard with filters, metric cards, sortable table, and responsive island cards.
- [x] Build island detail view with charts and 24h/day summaries.
- [x] Build creator view with aggregate metrics and creator map list.
- [x] Add loading, empty, and error states.
- [x] Ensure the design is dense, scan-friendly, and not a marketing landing page.
- [x] Commit frontend milestone.

### Phase 4: Docker and Local Operations

- [x] Add root scripts for install, dev, build, test, ingest, and lint/typecheck.
- [x] Add Dockerfiles and Docker Compose for API and frontend with ports `3201` and `3200`.
- [x] Add frontend API base URL env handling, backend CORS for `localhost:3200`, container healthchecks, persistent SQLite volume, and image build/tag instructions.
- [x] Add `.env.example` and README with local/Docker instructions.
- [x] Commit operations milestone.

### Phase 5: Verification and Polish

- [x] Run install, typecheck, tests, and builds.
- [x] Run local API and frontend on ports `3201` and `3200`.
- [x] Trigger a small ingestion run against the live Epic API.
- [x] Verify API handles empty DB startup, live API 404/400/429 paths, interval metric availability differences, and Docker Compose boot.
- [x] Verify UI through the browser at desktop and mobile sizes against local services and Docker services.
- [x] Fix issues discovered during verification.
- [x] Mark all phases complete and commit final state.

### Phase 6: Expanded Corpus Backfill

- [x] Split ingestion limits into broad metadata discovery and paced metric backfill.
- [x] Increase local/Docker defaults from a tiny seed crawl to a 1,000-island metadata corpus and conservative 25-island metric refresh.
- [x] Add UI controls for quick refresh and larger corpus expansion.
- [x] Preserve `--max-islands` as a compatibility alias while documenting `--metadata-limit` and `--metrics-limit`.

## Acceptance Criteria

- `npm install`, `npm run build`, and `npm test` pass.
- `npm run dev` starts API and web locally using backend port `3201` and frontend port `3200`.
- `npm run ingest -- --seeds --max-islands 25` stores real Epic API data in SQLite.
- Rankings, island detail, creators, tags, and ingestion status are available through backend routes.
- Frontend exposes rankings, island details, and creator pages with useful real data after ingestion.
- `docker compose up --build` runs deployable containers.
- Git history contains regular milestone commits.
