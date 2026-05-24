import { Database, Filter, PlayCircle, RefreshCw, Search, Star, Timer, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import IslandTable from "../components/IslandTable.js";
import StatCard from "../components/StatCard.js";
import { EmptyState, ErrorState, LoadingState } from "../components/DataState.js";
import { apiGet, apiPost, rankingsQuery, type IngestionSummary, type RankingsResponse, type TagCount } from "../lib/api.js";
import { compact, minutes, whole } from "../lib/format.js";

const sortOptions = [
  ["currentPlayers", "Players now"],
  ["observedPeak", "Observed peak"],
  ["minutesPlayed", "24h playtime"],
  ["plays", "24h plays"],
  ["uniquePlayers", "24h players"],
  ["avgPlaytime", "Avg playtime"],
  ["favorites", "Favorites"],
  ["recommendations", "Recommends"],
  ["retentionD1", "D1 retention"],
  ["updated", "Last updated"]
];

export default function RankingsPage() {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("currentPlayers");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [hideEpic, setHideEpic] = useState(false);
  const [page, setPage] = useState(1);
  const [rankings, setRankings] = useState<RankingsResponse | null>(null);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<IngestionSummary | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError(null);
    apiGet<RankingsResponse>(
      rankingsQuery({
        page,
        pageSize: 25,
        search,
        tag,
        sort,
        direction,
        hideEpic
      }),
      abort.signal
    )
      .then(setRankings)
      .catch((apiError: Error) => {
        if (!abort.signal.aborted) setError(apiError.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [direction, hideEpic, page, search, sort, tag]);

  useEffect(() => {
    apiGet<{ data: TagCount[] }>("/api/tags")
      .then((response) => setTags(response.data))
      .catch(() => setTags([]));
  }, [rankings?.total]);

  const pageTotals = useMemo(() => {
    const rows = rankings?.data ?? [];
    return {
      players: rows.reduce((sum, island) => sum + (island.metrics.latestPeakCcu ?? 0), 0),
      plays: rows.reduce((sum, island) => sum + (island.metrics.dayPlays ?? 0), 0),
      minutes: rows.reduce((sum, island) => sum + (island.metrics.dayMinutesPlayed ?? 0), 0),
      favorites: rows.reduce((sum, island) => sum + (island.metrics.dayFavorites ?? 0), 0)
    };
  }, [rankings]);

  async function runRefresh() {
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const result = await apiPost<IngestionSummary>("/api/ingestion/run", {
        maxIslands: 25,
        concurrency: 1,
        seeds: true,
        metadata: true,
        metrics: true
      });
      setRefreshResult(result);
      setPage(1);
      const refreshed = await apiGet<RankingsResponse>(
        rankingsQuery({ page: 1, pageSize: 25, search, tag, sort, direction, hideEpic })
      );
      setRankings(refreshed);
    } finally {
      setRefreshing(false);
    }
  }

  const totalPages = rankings ? Math.max(1, Math.ceil(rankings.total / rankings.pageSize)) : 1;

  return (
    <section className="page-stack">
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Local corpus</p>
          <h1>Island rankings</h1>
        </div>
        <button className="primary-action" onClick={runRefresh} disabled={refreshing} title="Run ingestion">
          <RefreshCw size={17} className={refreshing ? "spin" : ""} />
          Refresh data
        </button>
      </div>

      <div className="stats-grid">
        <StatCard icon={Database} label="Ingested islands" value={whole(rankings?.total ?? 0)} detail="local SQLite corpus" />
        <StatCard icon={Users} label="Players proxy" value={compact(pageTotals.players)} detail="latest 10-minute peak" tone="violet" />
        <StatCard icon={PlayCircle} label="24h plays" value={compact(pageTotals.plays)} detail="current page total" tone="amber" />
        <StatCard icon={Timer} label="24h playtime" value={minutes(pageTotals.minutes)} detail={`${compact(pageTotals.favorites)} favorites`} tone="red" />
      </div>

      {refreshResult ? (
        <div className="notice">
          Run #{refreshResult.runId}: {refreshResult.metadataCount} metadata rows, {refreshResult.metricPointCount} metric points,{" "}
          {refreshResult.errorCount} errors.
        </div>
      ) : null}

      <div className="control-bar">
        <label className="search-box">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search island, code, creator"
          />
        </label>
        <label>
          <Filter size={16} />
          <select
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All tags</option>
            {tags.slice(0, 100).map((tagCount) => (
              <option value={tagCount.tag} key={tagCount.tag}>
                {tagCount.tag} ({tagCount.count})
              </option>
            ))}
          </select>
        </label>
        <label>
          <Star size={16} />
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            {sortOptions.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented" aria-label="Sort direction">
          <button className={direction === "desc" ? "active" : ""} onClick={() => setDirection("desc")}>
            Desc
          </button>
          <button className={direction === "asc" ? "active" : ""} onClick={() => setDirection("asc")}>
            Asc
          </button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={hideEpic} onChange={(event) => setHideEpic(event.target.checked)} />
          Hide Epic
        </label>
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && rankings?.data.length === 0 ? (
        <EmptyState message="No islands match the current filters. Run ingestion or clear filters." />
      ) : null}
      {!loading && !error && rankings?.data.length ? (
        <>
          <IslandTable islands={rankings.data} page={rankings.page} pageSize={rankings.pageSize} />
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
              Next
            </button>
          </div>
        </>
      ) : null}

      <div className="source-strip">
        <span>Official Epic Data API</span>
        <span>10-minute, hourly, and day buckets</span>
        <span>Longer history accrues after ingestion</span>
        <Link to="/creators">Creator aggregates</Link>
      </div>
    </section>
  );
}
