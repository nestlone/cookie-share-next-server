import fs from "node:fs";
import path from "node:path";
import { createApp } from "./app";
import { loadRuntimeConfig } from "./config";
import { openDatabase } from "./db";

const config = loadRuntimeConfig();
if (config.dbPath !== ":memory:") {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
}

const db = openDatabase(config.dbPath);
const app = createApp(config, db);
const server = app.listen(config.port, config.host, () => {
  console.log(`cookie-share-next server listening on http://${config.host}:${config.port}`);
});

function shutdown(): void {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
