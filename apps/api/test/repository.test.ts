import { describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/database.js";
import { getIsland, getIslandMetrics, listRankings, upsertIsland, upsertMetrics, refreshIslandObservation } from "../src/db/repository.js";

describe("repository", () => {
  it("starts with an empty rankings result", () => {
    const db = createDatabase(":memory:");
    const rankings = listRankings(db, {
      page: 1,
      pageSize: 10,
      sort: "currentPlayers",
      direction: "desc"
    });

    expect(rankings.total).toBe(0);
    expect(rankings.data).toEqual([]);
    db.close();
  });

  it("stores null metric values and sorts populated metrics first", () => {
    const db = createDatabase(":memory:");
    upsertIsland(db, {
      code: "1111-1111-1111",
      creatorCode: "alpha",
      title: "Alpha Arena",
      createdIn: "UEFN",
      tags: ["pvp"]
    });
    upsertIsland(db, {
      code: "2222-2222-2222",
      creatorCode: "beta",
      title: "Beta Boxfight",
      createdIn: "UEFN",
      tags: ["boxfight"]
    });

    upsertMetrics(db, "1111-1111-1111", "minute", {
      peakCCU: [{ timestamp: "2026-05-24T16:00:00.000Z", value: 42 }]
    });
    upsertMetrics(db, "2222-2222-2222", "minute", {
      peakCCU: [{ timestamp: "2026-05-24T16:00:00.000Z", value: null }]
    });
    refreshIslandObservation(db, "1111-1111-1111");
    refreshIslandObservation(db, "2222-2222-2222");

    const rankings = listRankings(db, {
      page: 1,
      pageSize: 10,
      sort: "currentPlayers",
      direction: "desc"
    });

    expect(rankings.total).toBe(2);
    expect(rankings.data[0].code).toBe("1111-1111-1111");
    expect(rankings.data[1].code).toBe("2222-2222-2222");
    expect(getIslandMetrics(db, "2222-2222-2222", "minute").metrics.peakCCU[0].value).toBeNull();
    db.close();
  });

  it("returns island detail with explicit unavailable Epic API fields", () => {
    const db = createDatabase(":memory:");
    upsertIsland(db, {
      code: "3333-3333-3333",
      creatorCode: "gamma",
      title: "Gamma Games",
      createdIn: "UEFN",
      tags: ["party game"]
    });

    const island = getIsland(db, "3333-3333-3333");
    expect(island?.title).toBe("Gamma Games");
    expect(island?.unavailableFromEpicApi).toContain("creatorFollowers");
    db.close();
  });
});
