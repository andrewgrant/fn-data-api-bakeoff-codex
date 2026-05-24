import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db/database.js";

describe("api app", () => {
  it("serves health and empty rankings from a new database", async () => {
    const db = createDatabase(":memory:");
    const app = createApp(db);

    const health = await request(app).get("/api/health").expect(200);
    expect(health.body.ok).toBe(true);
    expect(health.body.db.islandCount).toBe(0);

    const rankings = await request(app).get("/api/rankings").expect(200);
    expect(rankings.body.total).toBe(0);
    db.close();
  });

  it("returns 404 for unknown islands", async () => {
    const db = createDatabase(":memory:");
    const app = createApp(db);

    await request(app).get("/api/islands/0000-0000-0000").expect(404);
    db.close();
  });
});
