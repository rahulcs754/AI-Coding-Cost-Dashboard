import "server-only";
import { connection } from "next/server";
import { cacheLoss, cacheSavings, diagnose, hitRate, promptTokens, type CacheCause, type CacheCounts, type CacheSession } from "./cache";
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

// ---- prompt cache -------------------------------------------------------------

export type CacheTotals = {
  hitRate: number;
  saved: number;
  lost: number;
  rebuilds: number;
  idleRebuilds: number;
  brokenSessions: number;
  sessions: number;
};
export type CacheBreakdown = { key: string; hitRate: number; saved: number; lost: number; promptTokens: number };

type CacheRow = CacheCounts & {
  sid: string;
  sessionId: string | null;
  repo: string;
  pr: number | null;
  author: string;
  tool: string;
  model: string;
  ts: string;
  cacheRebuilds: number;
  idleRebuilds: number;
};

// One row per session and model. Savings and losses depend on each model's price, so they are summed in JS.
async function cacheRows(days: number, scope: Scope): Promise<CacheRow[]> {
  const { db, since, where, params } = await scoped(days, scope);
  return db
    .prepare(
      `SELECT COALESCE(session_id, 'event-' || id) AS sid, session_id AS sessionId, MAX(repo) AS repo, MAX(pr) AS pr,
         MAX(author) AS author, MAX(tool) AS tool, model, MIN(ts) AS ts,
         SUM(input_tokens) AS inputTokens, SUM(cache_write_tokens) AS cacheWriteTokens, SUM(cache_read_tokens) AS cacheReadTokens,
         SUM(cache_rebuilds) AS cacheRebuilds, SUM(idle_rebuilds) AS idleRebuilds
       FROM usage_events WHERE ts >= ?${where} GROUP BY sid, model`,
    )
    .all(since, ...params) as CacheRow[];
}

function sumCounts<T extends CacheCounts>(rows: T[]): CacheCounts {
  return rows.reduce(
    (a, r) => ({
      inputTokens: a.inputTokens + r.inputTokens,
      cacheWriteTokens: a.cacheWriteTokens + r.cacheWriteTokens,
      cacheReadTokens: a.cacheReadTokens + r.cacheReadTokens,
    }),
    { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
  );
}

export async function getCacheReport(days: number, scope: Scope = {}) {
  const rows = await cacheRows(days, scope);

  const bySession = new Map<string, CacheSession>();
  for (const r of rows) {
    const s = bySession.get(r.sid) ?? {
      sessionId: r.sessionId, repo: r.repo, pr: r.pr, author: r.author, tool: r.tool, models: "", ts: r.ts,
      inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, cacheRebuilds: 0, idleRebuilds: 0, lost: 0,
    };
    s.models = s.models ? `${s.models},${r.model}` : r.model;
    s.ts = r.ts < s.ts ? r.ts : s.ts;
    s.inputTokens += r.inputTokens;
    s.cacheWriteTokens += r.cacheWriteTokens;
    s.cacheReadTokens += r.cacheReadTokens;
    s.cacheRebuilds += r.cacheRebuilds;
    s.idleRebuilds += r.idleRebuilds;
    s.lost += cacheLoss(r.model, r);
    bySession.set(r.sid, s);
  }
  const sessions = [...bySession.values()];
  const broken = sessions.filter((s) => diagnose(s).length > 0);

  const totals: CacheTotals = {
    hitRate: hitRate(sumCounts(rows)),
    saved: rows.reduce((a, r) => a + cacheSavings(r.model, r), 0),
    lost: sessions.reduce((a, s) => a + s.lost, 0),
    rebuilds: sessions.reduce((a, s) => a + s.cacheRebuilds, 0),
    idleRebuilds: sessions.reduce((a, s) => a + s.idleRebuilds, 0),
    brokenSessions: broken.length,
    sessions: sessions.length,
  };

  const breakdown = (key: (r: CacheRow) => string): CacheBreakdown[] => {
    const groups = new Map<string, CacheRow[]>();
    for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
    return [...groups]
      .map(([k, rs]) => {
        const c = sumCounts(rs);
        return {
          key: k,
          hitRate: hitRate(c),
          saved: rs.reduce((a, r) => a + cacheSavings(r.model, r), 0),
          lost: rs.reduce((a, r) => a + cacheLoss(r.model, r), 0),
          promptTokens: promptTokens(c),
        };
      })
      .sort((a, b) => b.lost - a.lost || b.promptTokens - a.promptTokens);
  };

  // Which causes cost the most, across all broken sessions.
  const causes = new Map<string, { cause: CacheCause; sessions: number; lost: number }>();
  for (const s of broken) {
    const found = diagnose(s);
    for (const c of found) {
      const e = causes.get(c.id) ?? { cause: c, sessions: 0, lost: 0 };
      e.sessions += 1;
      e.lost += s.lost / found.length;
      causes.set(c.id, e);
    }
  }

  return {
    totals,
    byModel: breakdown((r) => r.model),
    byTool: breakdown((r) => r.tool),
    byAuthor: breakdown((r) => r.author),
    causes: [...causes.values()].sort((a, b) => b.lost - a.lost),
    worst: broken.sort((a, b) => b.lost - a.lost).slice(0, 25),
  };
}
