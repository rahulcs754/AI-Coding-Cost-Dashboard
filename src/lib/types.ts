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
};

export type UsageEvent = UsageEventInput & { id: number; costUsd: number };
