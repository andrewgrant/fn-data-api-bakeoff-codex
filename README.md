# Island Intel

Fortnite Islands rankings and stats built on the official Fortnite Data API.

## Local

Use Node 24+.

```bash
npm install
npm run ingest -- --seeds --metadata-limit 1000 --metrics-limit 25
npm run dev
```

- Frontend: http://localhost:3200
- Backend: http://localhost:3201/api/health

Useful commands:

```bash
npm run typecheck
npm test
npm run build
npm run ingest -- --seeds --metadata-limit 2500 --metrics-limit 75 --concurrency 1
```

The SQLite database is stored at `data/islands.db` by default. Set `DB_PATH` to override it.

## Docker

```bash
docker compose up --build
```

This builds:

- `fn-data-api-bakeoff-codex-api:latest`
- `fn-data-api-bakeoff-codex-web:latest`

Ports:

- Frontend: http://localhost:3200
- Backend: http://localhost:3201

The API container stores SQLite data in the `island-data` volume and runs a metadata crawl plus paced metric backfill on startup. To build images without starting services:

```bash
docker compose build
```

## API Notes

Rankings are over the locally ingested corpus. Epic exposes island metadata and per-island metrics, but not a global metric-sorted rankings endpoint. The crawler therefore keeps metadata discovery broad and metric refresh/backfill paced to avoid API rate limits. Longer history starts accruing after the backend has been running because Epic's public API history is short.

Metrics used:

- `peakCCU`
- `minutesPlayed`
- `plays`
- `uniquePlayers`
- `favorites`
- `recommendations`
- `averageMinutesPerPlayer`
- `retention`

Unsupported by the official Data API: true live players now, pre-ingestion all-time peaks, screenshots, release date, max players, XP status, age rating, creator followers, earnings, platform share, and update history.
