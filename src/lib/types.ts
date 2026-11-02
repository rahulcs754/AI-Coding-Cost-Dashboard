import type { TokenCounts } from "./pricing";

export const TOOLS = ["claude-code", "cursor", "codex", "copilot", "other"] as const;
export type Tool = (typeof TOOLS)[number];

// One model call (or a pre-aggregated session) reported by a coding agent.
export type UsageEventInput = TokenCounts & {
  ts: string; // ISO 8601
  repo: string; // "owner/name"
  pr?: number | null;
  prTitle?: string | null;
  branch?: string | null;
  author: string;
  tool: Tool;
  model: string;
  sessionId?: string | null;
  /** Calls after the first that rebuilt the prompt cache instead of reading it. */
  cacheRebuilds?: number;
  /** Of those, rebuilds that came after the cache expired (idle over the TTL). */
  idleRebuilds?: number;
};

export type UsageEvent = UsageEventInput & { id: number; costUsd: number };
