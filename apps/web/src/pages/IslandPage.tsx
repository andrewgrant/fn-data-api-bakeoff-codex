import { ArrowLeft, ExternalLink, Gamepad2, Heart, LineChart, RefreshCw, Star, Timer, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "../components/DataState.js";
import MetricChart from "../components/MetricChart.js";
import StatCard from "../components/StatCard.js";
import { apiGet, type IslandDetail, type MetricSeriesResponse } from "../lib/api.js";
import { compact, minutes, percent, shortDate, whole } from "../lib/format.js";

const metricLabels: Record<string, string> = {
  peakCCU: "Players",
  minutesPlayed: "Playtime",
  plays: "Sessions",
  uniquePlayers: "Players 24h",
  favorites: "Favorites",
  recommendations: "Recommends",
  averageMinutesPerPlayer: "Avg playtime"
};

export default function IslandPage() {
  const { code = "" } = useParams();
  const [island, setIsland] = useState<IslandDetail | null>(null);
  const [series, setSeries] = useState<MetricSeriesResponse | null>(null);
  const [interval, setIntervalValue] = useState<"minute" | "hour" | "day">("hour");
  const [metric, setMetric] = useState("peakCCU");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<IslandDetail>(`/api/islands/${code}`, abort.signal),
      apiGet<MetricSeriesResponse>(`/api/islands/${code}/metrics?interval=${interval}`, abort.signal)
    ])
      .then(([islandResponse, metricResponse]) => {
        setIsland(islandResponse);
        setSeries(metricResponse);
        if (!metricResponse.metrics[metric]) {
          setMetric(Object.keys(metricResponse.metrics)[0] ?? "peakCCU");
        }
      })
      .catch((apiError: Error) => {
        if (!abort.signal.aborted) setError(apiError.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [code, interval, metric]);

  const chartData = useMemo(() => series?.metrics[metric] ?? [], [metric, series]);
  const availableMetrics = Object.keys(series?.metrics ?? {});

  if (loading) return <LoadingState label="Loading island" />;
  if (error) return <ErrorState message={error} />;
  if (!island) return <EmptyState message="Island not found in the local corpus." />;

  return (
    <section className="page-stack">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Rankings
      </Link>

      <div className="detail-header">
        <div className="detail-thumb" aria-hidden="true">
          <span>{island.tags[0]?.slice(0, 2).toUpperCase() ?? "FN"}</span>
        </div>
        <div>
          <p className="eyebrow">{island.creatorCode ? <Link to={`/creators/${island.creatorCode}`}>{island.creatorCode}</Link> : "Unknown creator"}</p>
          <h1>{island.title}</h1>
          <div className="detail-meta">
            <span>{island.code}</span>
            <span>{island.createdIn ?? "Unknown tool"}</span>
            {island.category ? <span>{island.category}</span> : null}
            <span>Updated {shortDate(island.metrics.latestUpdatedAt)}</span>
          </div>
          <div className="tag-row">
            {island.tags.map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="external-actions">
          <a href={island.externalLinks.epic} target="_blank" rel="noreferrer">
            <Gamepad2 size={16} />
            Fortnite
          </a>
          <a href={island.externalLinks.fortniteGg} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            Fortnite.GG
          </a>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={Users} label="Players proxy" value={whole(island.metrics.latestPeakCcu)} detail={shortDate(island.metrics.latestPeakCcuAt)} />
        <StatCard icon={LineChart} label="Observed peak" value={whole(island.metrics.observedAllTimePeak)} detail={shortDate(island.metrics.observedAllTimePeakAt)} tone="violet" />
        <StatCard icon={Timer} label="24h playtime" value={minutes(island.metrics.dayMinutesPlayed)} detail={`${compact(island.metrics.dayPlays)} sessions`} tone="amber" />
        <StatCard icon={Heart} label="24h favorites" value={compact(island.metrics.dayFavorites)} detail={`${percent(island.metrics.dayRetentionD1)} D1`} tone="red" />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Metric timeline</h2>
            <small>{interval === "minute" ? "10-minute buckets" : `${interval} buckets`}</small>
          </div>
          <div className="segmented">
            {(["minute", "hour", "day"] as const).map((value) => (
              <button key={value} className={interval === value ? "active" : ""} onClick={() => setIntervalValue(value)}>
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="metric-buttons">
          {availableMetrics.map((value) => (
            <button key={value} className={metric === value ? "active" : ""} onClick={() => setMetric(value)}>
              {metricLabels[value] ?? value}
            </button>
          ))}
        </div>

        {chartData.length ? <MetricChart data={chartData} color="#0f766e" /> : <EmptyState message="No stored metric points for this interval yet." />}
      </div>

      <div className="two-column">
        <div className="panel">
          <div className="panel-head">
            <h2>24h overview</h2>
            <RefreshCw size={17} />
          </div>
          <dl className="kv-list">
            <div>
              <dt>Unique players</dt>
              <dd>{compact(island.metrics.dayUniquePlayers)}</dd>
            </div>
            <div>
              <dt>Recommendations</dt>
              <dd>{compact(island.metrics.dayRecommendations)}</dd>
            </div>
            <div>
              <dt>Average playtime</dt>
              <dd>{island.metrics.dayAverageMinutesPerPlayer ? `${compact(island.metrics.dayAverageMinutesPerPlayer)} min` : "n/a"}</dd>
            </div>
            <div>
              <dt>Day 7 retention</dt>
              <dd>{percent(island.metrics.dayRetentionD7)}</dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Not exposed by Epic API</h2>
            <Star size={17} />
          </div>
          <div className="missing-grid">
            {island.unavailableFromEpicApi.map((field) => (
              <span key={field}>{field}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
