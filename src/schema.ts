export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name         TEXT    NOT NULL,
    quota_bytes          INTEGER NOT NULL,
    daily_request_limit  INTEGER NOT NULL,
    created_at           TEXT    NOT NULL,
    updated_at           TEXT    NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS provider_accounts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider    TEXT    NOT NULL,
    subject     TEXT    NOT NULL,
    login       TEXT    NOT NULL,
    created_at  TEXT    NOT NULL,
    UNIQUE (provider, subject)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_provider_accounts_user ON provider_accounts(user_id)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash  TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT    NOT NULL,
    expires_at  TEXT    NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS oauth_states (
    state         TEXT PRIMARY KEY,
    provider      TEXT NOT NULL,
    mode          TEXT NOT NULL,
    user_id       INTEGER,
    redirect_uri  TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    expires_at    TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_exchange_codes (
    code_hash   TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS buckets (
    id             TEXT    NOT NULL,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    envelope_json  TEXT    NOT NULL,
    payload_bytes  INTEGER NOT NULL,
    created_at     TEXT    NOT NULL,
    updated_at     TEXT    NOT NULL,
    PRIMARY KEY (user_id, id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_buckets_user ON buckets(user_id)`,
  `CREATE TABLE IF NOT EXISTS request_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bucket_id  TEXT,
    endpoint   TEXT    NOT NULL,
    created_at TEXT    NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_request_log_user_day ON request_log(user_id, created_at)`,
];

export function ensureSchema(db: import("node:sqlite").DatabaseSync): void {
  for (const statement of SCHEMA_STATEMENTS) db.exec(statement);
}
