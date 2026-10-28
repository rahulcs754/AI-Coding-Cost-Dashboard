import { TOOLS, type Tool, type UsageEventInput } from "./types";

type Result = { ok: true; value: UsageEventInput } | { ok: false; error: string };

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const optStr = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);

export function parseEvent(raw: unknown, index = 0): Result {
  const fail = (msg: string): Result => ({ ok: false, error: `events[${index}]: ${msg}` });
  if (!raw || typeof raw !== "object") return fail("must be an object");
  const e = raw as Record<string, unknown>;

  if (typeof e.repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(e.repo)) return fail('repo must look like "owner/name"');
  if (typeof e.author !== "string" || !e.author) return fail("author is required");
  if (typeof e.model !== "string" || !e.model) return fail("model is required");
  const tool = (e.tool ?? "other") as Tool;
  if (!TOOLS.includes(tool)) return fail(`tool must be one of ${TOOLS.join(", ")}`);
  const ts = typeof e.ts === "string" ? e.ts : new Date().toISOString();
  if (Number.isNaN(Date.parse(ts))) return fail("ts must be an ISO date");
  if (e.pr != null && !(Number.isInteger(e.pr) && (e.pr as number) > 0)) return fail("pr must be a positive integer");

  const counts = {
    inputTokens: e.inputTokens ?? 0,
    outputTokens: e.outputTokens ?? 0,
    cacheWriteTokens: e.cacheWriteTokens ?? 0,
    cacheReadTokens: e.cacheReadTokens ?? 0,
  };
  for (const [k, v] of Object.entries(counts)) if (!isCount(v)) return fail(`${k} must be a non-negative integer`);

  return {
    ok: true,
    value: {
      ts: new Date(ts).toISOString(),
      repo: e.repo,
      pr: (e.pr as number | undefined) ?? null,
      prTitle: optStr(e.prTitle),
      branch: optStr(e.branch),
      author: e.author,
      tool,
      model: e.model,
      sessionId: optStr(e.sessionId),
      ...(counts as Record<keyof typeof counts, number>),
    },
  };
}
