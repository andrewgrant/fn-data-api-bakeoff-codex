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

## Product Scope

Build a local and Docker-deployable app named `Island Intel` with:

- Rankings page for islands with search, tag filter, creator filter, sort selection, and metric range filters.
- Island detail page with metadata, current 10-minute/hour/day summaries, charts, and external Fortnite/Fortnite.GG links.
- Creator view with aggregate metrics and creator map rankings.
- Backend ingestion service that periodically fetches Epic island metadata and metrics, stores them in SQLite, and keeps historical snapshots beyond Epic's short window.
- Manual ingestion endpoint/CLI for local testing.
- Seed list of known active islands from research to make the first local run useful before broad crawling completes.
- Docker Compose deployment with backend on port `3201` and frontend on port `3200`.

## Architecture

- Monorepo with npm workspaces.
- Backend: Node.js + TypeScript, Express, built-in `node:sqlite`, no authentication required for Epic API.
- Frontend: Vite + React + TypeScript, Recharts for charts, Lucide icons for controls.
- Storage: SQLite database under `data/islands.db`, mounted as a Docker volume.
- Ingestion: background scheduler in the API process plus `npm run ingest` for one-shot runs.
- Data model:
  - `islands`: island metadata and tags.
  - `metric_points`: per-island metric time series by interval.
  - `retention_points`: D1/D7 retention by day interval.
  - `ingestion_runs`: operational history.
  - `curated_seed_islands`: known-active island codes collected during research.

## Phases

### Phase 0: Repo Baseline

- [x] Initialize Git repository and remote.
- [ ] Commit the received instructions and plan baseline.

### Phase 1: Planning Review

- [ ] Have a second agent review this plan.
- [ ] Apply appropriate review changes.
- [ ] Mark Phase 1 complete after review is incorporated.

### Phase 2: Backend Service

- [ ] Create API workspace, TypeScript config, and scripts.
- [ ] Implement SQLite schema, migrations, and repository queries.
- [ ] Implement Epic API client with pagination, metric filters, timeouts, and rate-conscious concurrency.
- [ ] Implement ingestion service for seed islands plus configurable metadata crawl.
- [ ] Implement Express routes:
  - `GET /api/health`
  - `GET /api/rankings`
  - `GET /api/islands/:code`
  - `GET /api/islands/:code/metrics`
  - `GET /api/creators`
  - `GET /api/creators/:creatorCode`
  - `GET /api/tags`
  - `GET /api/ingestion/runs`
  - `POST /api/ingestion/run`
- [ ] Add backend tests for normalization, ranking queries, and route smoke coverage.
- [ ] Commit backend milestone.

### Phase 3: Frontend App

- [ ] Create Vite React workspace.
- [ ] Build rankings dashboard with filters, metric cards, sortable table, and responsive island cards.
- [ ] Build island detail view with charts and 24h/day summaries.
- [ ] Build creator view with aggregate metrics and creator map list.
- [ ] Add loading, empty, and error states.
- [ ] Ensure the design is dense, scan-friendly, and not a marketing landing page.
- [ ] Commit frontend milestone.

### Phase 4: Docker and Local Operations

- [ ] Add root scripts for install, dev, build, test, ingest, and lint/typecheck.
- [ ] Add Dockerfiles and Docker Compose for API and frontend with ports `3201` and `3200`.
- [ ] Add `.env.example` and README with local/Docker instructions.
- [ ] Commit operations milestone.

### Phase 5: Verification and Polish

- [ ] Run install, typecheck, tests, and builds.
- [ ] Run local API and frontend on ports `3201` and `3200`.
- [ ] Trigger a small ingestion run against the live Epic API.
- [ ] Verify UI through the browser at desktop and mobile sizes.
- [ ] Fix issues discovered during verification.
- [ ] Mark all phases complete and commit final state.

## Acceptance Criteria

- `npm install`, `npm run build`, and `npm test` pass.
- `npm run dev` starts API and web locally using backend port `3201` and frontend port `3200`.
- `npm run ingest -- --seeds --max-islands 25` stores real Epic API data in SQLite.
- Rankings, island detail, creators, tags, and ingestion status are available through backend routes.
- Frontend exposes rankings, island details, and creator pages with useful real data after ingestion.
- `docker compose up --build` runs deployable containers.
- Git history contains regular milestone commits.
