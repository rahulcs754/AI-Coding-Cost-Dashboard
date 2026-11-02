import { priceFor, type TokenCounts } from "./pricing";

// Prompt caching: how much of the prompt was read from cache, what that saved,
// and why some sessions lost their cache.

/** Cache TTL for Anthropic prompt caching by default. Idle longer than this and the cache is gone. */
export const CACHE_TTL_MINUTES = 5;

export type CacheCounts = Pick<TokenCounts, "inputTokens" | "cacheWriteTokens" | "cacheReadTokens">;

/** All prompt tokens: uncached input + written to cache + read from cache. */
export const promptTokens = (t: CacheCounts) => t.inputTokens + t.cacheWriteTokens + t.cacheReadTokens;

/** Share of prompt tokens served from cache (0..1). */
export function hitRate(t: CacheCounts): number {
  const total = promptTokens(t);
  return total ? t.cacheReadTokens / total : 0;
}

/** Dollars saved because cached tokens were read at the cache price instead of the input price. */
export function cacheSavings(model: string, t: CacheCounts): number {
  const { price } = priceFor(model);
  return (t.cacheReadTokens * (price.input - price.cacheRead)) / 1_000_000;
}

/**
 * Rough dollars lost to cache breaks. A healthy session writes its prefix once
 * and then reads it, so writes stay near 10% of the prompt. Writes above that
 * would have been reads. A large session with no caching at all loses what a
 * 90% hit rate would have saved.
 */
export function cacheLoss(model: string, t: CacheCounts): number {
  const { price } = priceFor(model);
  const prompt = promptTokens(t);
  if (t.cacheWriteTokens === 0 && t.cacheReadTokens === 0) {
    return prompt >= 50_000 ? (prompt * 0.9 * (price.input - price.cacheRead)) / 1_000_000 : 0;
  }
  const extraWrites = Math.max(0, t.cacheWriteTokens - 0.1 * prompt);
  return (extraWrites * (price.cacheWrite - price.cacheRead)) / 1_000_000;
}

export type CacheSession = CacheCounts & {
  sessionId: string | null;
  repo: string;
  pr: number | null;
  author: string;
  tool: string;
  /** Comma-separated models used in the session. */
  models: string;
  ts: string;
  cacheRebuilds: number;
  idleRebuilds: number;
  /** Computed by the query with each row's own model price. */
  lost: number;
};

export type CacheCause = { id: "idle" | "model-switch" | "prefix-changed" | "no-cache" | "low-hit"; label: string; fix: string };

const CAUSES: Record<CacheCause["id"], Omit<CacheCause, "id">> = {
  idle: {
    label: `Idle over ${CACHE_TTL_MINUTES} min`,
    fix: "The cache expired between turns. Use the 1-hour cache TTL for long sessions, or keep the session busy.",
  },
  "model-switch": {
    label: "Model switched",
    fix: "Cache is per model. Switching models mid-session (e.g. /model, or a fallback) starts from zero.",
  },
  "prefix-changed": {
    label: "Prompt prefix changed",
    fix: "Something early in the prompt changed: CLAUDE.md or system prompt edits, MCP servers or tools added or removed, a timestamp or random ID near the top.",
  },
  "no-cache": {
    label: "No caching",
    fix: "This client sent no cache_control breakpoints. Turn prompt caching on.",
  },
  "low-hit": {
    label: "Low hit rate",
    fix: "More cache was written than read. Short sessions or a prefix that keeps changing.",
  },
};

/** Why a session's cache did not work, most likely cause first. Empty when it looks healthy. */
export function diagnose(s: CacheSession): CacheCause[] {
  const out: CacheCause["id"][] = [];
  if (s.idleRebuilds > 0) out.push("idle");
  if (s.models.includes(",")) out.push("model-switch");
  if (s.cacheRebuilds - s.idleRebuilds > 0) out.push("prefix-changed");
  if (s.cacheWriteTokens === 0 && s.cacheReadTokens === 0 && promptTokens(s) >= 50_000) out.push("no-cache");
  if (!out.length && promptTokens(s) > 0 && hitRate(s) < 0.5) out.push("low-hit");
  return out.map((id) => ({ id, ...CAUSES[id] }));
}

export const ALL_CAUSES = Object.entries(CAUSES).map(([id, c]) => ({ id: id as CacheCause["id"], ...c }));
