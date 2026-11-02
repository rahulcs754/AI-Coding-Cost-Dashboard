import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { costUsd } from "./pricing";
import { seedEvents } from "./seed";
import type { UsageEventInput } from "./types";

// Vercel's filesystem is read-only except /tmp, so the demo DB lives there.
const DB_PATH =
  process.env.DATABASE_PATH ??
  (process.env.VERCEL ? "/tmp/usage.db" : path.join(process.cwd(), "data", "usage.db"));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  repo TEXT NOT NULL,
  pr INTEGER,
  pr_title TEXT,
  branch TEXT,
  author TEXT NOT NULL,
  tool TEXT NOT NULL,
  model TEXT NOT NULL,
  session_id TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL,
  cache_rebuilds INTEGER NOT NULL DEFAULT 0,
  idle_rebuilds INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON usage_events (ts);
CREATE INDEX IF NOT EXISTS idx_events_repo_pr ON usage_events (repo, pr);
CREATE TABLE IF NOT EXISTS members (
  login TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  added_by TEXT,
  added_at TEXT NOT NULL
);
`;

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;
  if (DB_PATH !== ":memory:") mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  migrate(db);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM usage_events").get() as { n: number };
  if (n === 0 && process.env.SEED_DEMO !== "false") insertEvents(seedEvents());
  return db;
}

// Databases created before the cache tab lack the rebuild columns.
function migrate(conn: DatabaseSync) {
  const cols = new Set((conn.prepare("PRAGMA table_info(usage_events)").all() as { name: string }[]).map((c) => c.name));
  for (const col of ["cache_rebuilds", "idle_rebuilds"]) {
    if (!cols.has(col)) conn.exec(`ALTER TABLE usage_events ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`);
  }
}

export function insertEvents(events: UsageEventInput[]): number {
  const conn = db ?? getDb();
  const stmt = conn.prepare(`
    INSERT INTO usage_events (ts, repo, pr, pr_title, branch, author, tool, model, session_id,
      input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, cost_usd, cache_rebuilds, idle_rebuilds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  conn.exec("BEGIN");
  try {
    for (const e of events) {
      stmt.run(
        e.ts, e.repo, e.pr ?? null, e.prTitle ?? null, e.branch ?? null, e.author, e.tool, e.model,
        e.sessionId ?? null, e.inputTokens, e.outputTokens, e.cacheWriteTokens, e.cacheReadTokens,
        costUsd(e.model, e), e.cacheRebuilds ?? 0, e.idleRebuilds ?? 0,
      );
    }
    conn.exec("COMMIT");
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
  return events.length;
}
