import { config } from "./config.js";
import { createApp } from "./app.js";
import { createDatabase } from "./db/database.js";
import { EpicClient } from "./services/epicClient.js";
import { defaultIngestionOptions, IngestionService } from "./services/ingestion.js";

const db = createDatabase(config.dbPath);
const app = createApp(db);

const server = app.listen(config.port, () => {
  console.log(`Island Intel API listening on http://localhost:${config.port}`);
});

if (config.ingestOnStart) {
  const ingestion = new IngestionService(
    db,
    new EpicClient({
      baseUrl: config.epicBaseUrl,
      timeoutMs: config.requestTimeoutMs
    })
  );
  ingestion
    .run({
      ...defaultIngestionOptions,
      metadataLimit: config.ingestMetadataLimit,
      metricsLimit: config.ingestMetricsLimit
    })
    .then((summary) => console.log("Startup ingestion finished", summary))
    .catch((error) => console.error("Startup ingestion failed", error));

  setInterval(
    () => {
      ingestion
        .run({
          ...defaultIngestionOptions,
          metadata: false,
          metadataLimit: config.ingestMetadataLimit,
          metricsLimit: config.ingestMetricsLimit
        })
        .catch((error) => console.error("Scheduled metrics ingestion failed", error));
    },
    config.ingestIntervalMinutes * 60 * 1000
  );

  setInterval(
    () => {
      ingestion
        .run({
          ...defaultIngestionOptions,
          metadataLimit: config.ingestMetadataLimit,
          metricsLimit: config.ingestMetricsLimit
        })
        .catch((error) => console.error("Scheduled metadata ingestion failed", error));
    },
    config.metadataCrawlIntervalMinutes * 60 * 1000
  );
}

function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
