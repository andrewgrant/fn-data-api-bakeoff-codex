import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { IslandSummary } from "../lib/api.js";
import { compact, minutes, percent, rankRange, shortDate, whole } from "../lib/format.js";

interface IslandTableProps {
  islands: IslandSummary[];
  page?: number;
  pageSize?: number;
}

export default function IslandTable({ islands, page = 1, pageSize = islands.length || 25 }: IslandTableProps) {
  return (
    <div className="table-wrap">
      <table className="island-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Island</th>
            <th>Players</th>
            <th>Observed Peak</th>
            <th>24h Playtime</th>
            <th>24h Plays</th>
            <th>Avg</th>
            <th>D1</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {islands.map((island, index) => (
            <tr key={island.code}>
              <td className="rank-cell">#{rankRange(page, pageSize, index)}</td>
              <td className="island-name-cell">
                <div className="map-thumb" aria-hidden="true">
                  <span>{island.tags[0]?.slice(0, 2).toUpperCase() ?? "FN"}</span>
                </div>
                <div>
                  <Link to={`/islands/${island.code}`}>{island.title}</Link>
                  <small>
                    {island.creatorCode ? (
                      <Link to={`/creators/${island.creatorCode}`}>{island.creatorCode}</Link>
                    ) : (
                      "unknown creator"
                    )}{" "}
                    · {island.code}
                  </small>
                  <div className="tag-row">
                    {island.tags.slice(0, 4).map((tag) => (
                      <span className="tag-chip" key={tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </td>
              <td>{whole(island.metrics.latestPeakCcu)}</td>
              <td>{whole(island.metrics.observedAllTimePeak)}</td>
              <td>{minutes(island.metrics.dayMinutesPlayed)}</td>
              <td>{compact(island.metrics.dayPlays)}</td>
              <td>{island.metrics.dayAverageMinutesPerPlayer ? `${compact(island.metrics.dayAverageMinutesPerPlayer)}m` : "n/a"}</td>
              <td>{percent(island.metrics.dayRetentionD1)}</td>
              <td>
                <span className={island.isStale ? "stale" : ""}>{shortDate(island.metrics.latestUpdatedAt)}</span>
                <Link className="row-link" to={`/islands/${island.code}`} aria-label={`Open ${island.title}`}>
                  <ExternalLink size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
