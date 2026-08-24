import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

export type { DatabaseSync, StatementSync } from "node:sqlite";

const nodeRequire: NodeRequire = require;
const { DatabaseSync } = nodeRequire(`node:sqlite`) as {
  DatabaseSync: new(path: string) => DatabaseSyncType;
};

export function openDatabase(path: string): DatabaseSyncType {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  return db;
}