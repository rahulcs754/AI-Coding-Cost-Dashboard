import "server-only";
import { connection } from "next/server";
import { getDb } from "./db";

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: string | string[] | undefined): Range {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30;
}

export type Scope = { repo?: string; pr?: number; author?: string };

export type Totals = {
  cost: number;
  tokens: number;
  events: number;
  prs: number;
  authors: number;
  prevCost: number;
};
export type DailyPoint = { day: string; cost: number };
export type Breakdown = { key: string; cost: number; tokens: number; share: number };
export type PrRow = {
  repo: string;
  pr: number;
  title: string | null;
  cost: number;
  tokens: number;
  sessions: number;
  authors: string;
  lastTs: string;
};
export type SessionRow = {
  sessionId: string | null;
  ts: string;
  author: string;
  tool: string;
  model: string;
  tokens: number;
  cost: number;
};

const TOKENS = "(input_tokens + output_tokens + cache_write_tokens + cache_read_tokens)";

// The SQLite driver is synchronous, so connection() keeps these reads out of the prerendered shell.
async function scoped(days: number, scope: Scope) {
  await connection();
  const now = Date.now();
  const since = new Date(now - days * 86_400_000).toISOString();
  const prevSince = new Date(now - 2 * days * 86_400_000).toISOString();
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (scope.repo) {
    clauses.push("repo = ?");
    params.push(scope.repo);
  }
  if (scope.pr != null) {
    clauses.push("pr = ?");
    params.push(scope.pr);
  }
  if (scope.author) {
    clauses.push("author = ?");
    params.push(scope.author);
  }
  const where = clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
  return { db: getDb(), since, prevSince, where, params };
}

export async function getTotals(days: number, scope: Scope = {}): Promise<Totals> {
  const { db, since, prevSince, where, params } = await scoped(days, scope);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) AS cost, COALESCE(SUM(${TOKENS}), 0) AS tokens, COUNT(*) AS events,
         COUNT(DISTINCT CASE WHEN pr IS NOT NULL THEN repo || '#' || pr END) AS prs, COUNT(DISTINCT author) AS authors
       FROM usage_events WHERE ts >= ?${where}`,
    )
    .get(since, ...params) as Omit<Totals, "prevCost">;
  const prev = db
    .prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS cost FROM usage_events WHERE ts >= ? AND ts < ?${where}`)
    .get(prevSince, since, ...params) as { cost: number };
  return { ...row, prevCost: prev.cost };
}

export async function getDaily(days: number, scope: Scope = {}): Promise<DailyPoint[]> {
  const { db, since, where, params } = await scoped(days, scope);
  const rows = db
    .prepare(
      `SELECT substr(ts, 1, 10) AS day, SUM(cost_usd) AS cost FROM usage_events
       WHERE ts >= ?${where} GROUP BY day ORDER BY day`,
    )
    .all(since, ...params) as DailyPoint[];
  // Fill empty days so the chart has one bar per day.
  const byDay = new Map(rows.map((r) => [r.day, r.cost]));
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ day, cost: byDay.get(day) ?? 0 });
  }
  return out;
}

export async function getBreakdown(
  column: "repo" | "model" | "tool" | "author",
  days: number,
  scope: Scope = {},
): Promise<Breakdown[]> {
  const { db, since, where, params } = await scoped(days, scope);
  const rows = db
    .prepare(
      `SELECT ${column} AS key, SUM(cost_usd) AS cost, SUM(${TOKENS}) AS tokens FROM usage_events
       WHERE ts >= ?${where} GROUP BY ${column} ORDER BY cost DESC`,
    )
    .all(since, ...params) as Omit<Breakdown, "share">[];
  const total = rows.reduce((s, r) => s + r.cost, 0) || 1;
  return rows.map((r) => ({ ...r, share: r.cost / total }));
}

export async function getPrs(days: number, scope: Scope = {}, limit = 50): Promise<PrRow[]> {
  const { db, since, where, params } = await scoped(days, scope);
  return db
    .prepare(
      `SELECT repo, pr, MAX(pr_title) AS title, SUM(cost_usd) AS cost, SUM(${TOKENS}) AS tokens,
         COUNT(DISTINCT COALESCE(session_id, id)) AS sessions, GROUP_CONCAT(DISTINCT author) AS authors, MAX(ts) AS lastTs
       FROM usage_events WHERE ts >= ? AND pr IS NOT NULL${where}
       GROUP BY repo, pr ORDER BY cost DESC LIMIT ?`,
    )
    .all(since, ...params, limit) as PrRow[];
}

export type UserRow = {
  author: string;
  cost: number;
  tokens: number;
  sessions: number;
  prs: number;
  tools: string;
  models: string;
  lastTs: string;
};

export async function getUsers(days: number): Promise<UserRow[]> {
  const { db, since } = await scoped(days, {});
  return db
    .prepare(
      `SELECT author, SUM(cost_usd) AS cost, SUM(${TOKENS}) AS tokens, COUNT(DISTINCT COALESCE(session_id, id)) AS sessions,
         COUNT(DISTINCT CASE WHEN pr IS NOT NULL THEN repo || '#' || pr END) AS prs,
         GROUP_CONCAT(DISTINCT tool) AS tools, GROUP_CONCAT(DISTINCT model) AS models, MAX(ts) AS lastTs
       FROM usage_events WHERE ts >= ? GROUP BY author ORDER BY cost DESC`,
    )
    .all(since) as UserRow[];
}

// A PR page shows its whole history, not just the selected window.
export async function getPrSessions(repo: string, pr: number): Promise<SessionRow[]> {
  await connection();
  return getDb()
    .prepare(
      `SELECT session_id AS sessionId, MIN(ts) AS ts, author, tool, model, SUM(${TOKENS}) AS tokens, SUM(cost_usd) AS cost
       FROM usage_events WHERE repo = ? AND pr = ?
       GROUP BY COALESCE(session_id, id), author, tool, model ORDER BY ts DESC`,
    )
    .all(repo, pr) as SessionRow[];
}

export async function getPrTitle(repo: string, pr: number): Promise<string | null> {
  await connection();
  const row = getDb()
    .prepare("SELECT MAX(pr_title) AS title FROM usage_events WHERE repo = ? AND pr = ?")
    .get(repo, pr) as { title: string | null } | undefined;
  return row?.title ?? null;
}
