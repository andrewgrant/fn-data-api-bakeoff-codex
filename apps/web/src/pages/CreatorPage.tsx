import { ArrowLeft, Heart, PlayCircle, Timer, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/DataState.js";
import IslandTable from "../components/IslandTable.js";
import StatCard from "../components/StatCard.js";
import { apiGet, type CreatorDetail } from "../lib/api.js";
import { compact, minutes, shortDate, whole } from "../lib/format.js";

export default function CreatorPage() {
  const { creatorCode = "" } = useParams();
  const [creator, setCreator] = useState<CreatorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    apiGet<CreatorDetail>(`/api/creators/${creatorCode}`, abort.signal)
      .then(setCreator)
      .catch((apiError: Error) => {
        if (!abort.signal.aborted) setError(apiError.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [creatorCode]);

  if (loading) return <LoadingState label="Loading creator" />;
  if (error) return <ErrorState message={error} />;
  if (!creator) return <EmptyState message="Creator not found in the local corpus." />;

  return (
    <section className="page-stack">
      <Link className="back-link" to="/creators">
        <ArrowLeft size={16} />
        Creators
      </Link>

      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Creator</p>
          <h1>{creator.creatorCode}</h1>
          <div className="detail-meta">
            <span>{creator.islandCount} islands</span>
            <span>Updated {shortDate(creator.latestUpdatedAt)}</span>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={Users} label="Players proxy" value={whole(creator.currentPlayers)} detail="local aggregate" />
        <StatCard icon={Timer} label="24h playtime" value={minutes(creator.dayMinutesPlayed)} detail="sum of islands" tone="amber" />
        <StatCard icon={PlayCircle} label="24h plays" value={compact(creator.dayPlays)} detail="sum of sessions" tone="violet" />
        <StatCard icon={Heart} label="24h favorites" value={compact(creator.dayFavorites)} detail="not follower count" tone="red" />
      </div>

      <IslandTable islands={creator.islands} page={1} pageSize={creator.islands.length || 25} />
    </section>
  );
}
