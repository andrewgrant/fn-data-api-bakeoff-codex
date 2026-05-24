import { afterEach, describe, expect, it, vi } from "vitest";
import { EpicApiError, EpicClient } from "../src/services/epicClient.js";

describe("EpicClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces 429 responses with retry metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("slow down", {
        status: 429,
        headers: {
          "retry-after": "2"
        }
      })
    );

    const client = new EpicClient({ baseUrl: "https://example.test", timeoutMs: 1000 });
    await expect(client.getIsland("1234-1234-1234")).rejects.toMatchObject({
      statusCode: 429,
      retryAfterMs: 2000
    } satisfies Partial<EpicApiError>);
  });

  it("supports repeated metrics query parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        peakCCU: []
      })
    );

    const client = new EpicClient({ baseUrl: "https://example.test", timeoutMs: 1000 });
    await client.getMetrics("1234-1234-1234", "hour", ["peakCCU", "plays"]);

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("metrics=peakCCU");
    expect(url).toContain("metrics=plays");
  });
});
