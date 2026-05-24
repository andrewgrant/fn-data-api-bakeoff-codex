import { Search, Timer, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/DataState.js";
import StatCard from "../components/StatCard.js";
import { apiGet, type CreatorSummary } from "../lib/api.js";
import { compact, minutes, shortDate, whole } from "../lib/format.js";

export default function CreatorsPage() {
  const [creators, setCreators] = useState<CreatorSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    apiGet<{ data: CreatorSummary[] }>("/api/creators?limit=200", abort.signal)
      .then((response) => setCreators(response.data))
      .catch((apiError: Error) => {
        if (!abort.signal.aborted) setError(apiError.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, []);

  const filtered = useMemo(
    () => creators.filter((creator) => creator.creatorCode.toLowerCase().includes(search.toLowerCase())),
    [creators, search]
  );
  const totals = useMemo(
    () => ({
      players: filtered.reduce((sum, creator) => sum + creator.currentPlayers, 0),
      minutes: filtered.reduce((sum, creator) => sum + creator.dayMinutesPlayed, 0),
      islands: filtered.reduce((sum, creator) => sum + creator.islandCount, 0)
    }),
    [filtered]
  );

  return (
    <section className="page-stack">
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Aggregated locally</p>
          <h1>Creators</h1>
        </div>
        <label className="search-box slim">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creator" />
        </label>
      </div>

      <div className="stats-grid three">
        <StatCard icon={Users} label="Players proxy" value={compact(totals.players)} detail="filtered creators" />
        <StatCard icon={Timer} label="24h playtime" value={minutes(totals.minutes)} detail={`${whole(totals.islands)} islands`} tone="amber" />
        <StatCard icon={Users} label="Creators" value={whole(filtered.length)} detail="with ingested islands" tone="violet" />
      </div>

      {loading ? <LoadingState label="Loading creators" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && filtered.length === 0 ? <EmptyState message="No creators found in the local corpus." /> : null}

      <div className="creator-grid">
        {filtered.map((creator) => (
          <Link className="creator-card" to={`/creators/${creator.creatorCode}`} key={creator.creatorCode}>
            <strong>{creator.creatorCode}</strong>
            <span>{whole(creator.currentPlayers)} players proxy</span>
            <small>
              {creator.islandCount} islands · {minutes(creator.dayMinutesPlayed)} · {shortDate(creator.latestUpdatedAt)}
            </small>
          </Link>
        ))}
      </div>
    </section>
  );
}
