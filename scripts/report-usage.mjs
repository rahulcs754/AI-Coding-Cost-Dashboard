#!/usr/bin/env node
// Reads Claude Code session logs (~/.claude/projects/**/*.jsonl), sums token usage per
// session and model, maps each session to its GitHub repo and PR, and posts the result
// to the dashboard's /api/events endpoint.
//
// Usage:
//   node scripts/report-usage.mjs [--url http://localhost:3000] [--since 7d] [--dry-run]
// Env: INGEST_TOKEN (bearer token), DASHBOARD_URL.
//
// Only usage after the last successful run is sent (tracked in ~/.ai-cost-dashboard/state.json),
// so the script is safe to run from a cron job or a git hook.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: process.env.DASHBOARD_URL ?? "http://localhost:3000" },
    since: { type: "string" },
    dir: { type: "string", default: path.join(homedir(), ".claude", "projects") },
    author: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});

const STATE_DIR = path.join(homedir(), ".ai-cost-dashboard");
const STATE_FILE = path.join(STATE_DIR, "state.json");

function parseSince(value) {
  const m = /^(\d+)([hd])$/.exec(value ?? "");
  if (m) return new Date(Date.now() - Number(m[1]) * (m[2] === "h" ? 3_600_000 : 86_400_000));
  if (value && !Number.isNaN(Date.parse(value))) return new Date(value);
  throw new Error(`--since must look like 12h, 7d or an ISO date, got "${value}"`);
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function run(cmd, argv, cwd) {
  try {
    return execFileSync(cmd, argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function* jsonlFiles(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* jsonlFiles(full);
    else if (entry.name.endsWith(".jsonl")) yield full;
  }
}

const repoCache = new Map();
function repoFor(cwd) {
  if (!repoCache.has(cwd)) {
    const remote = existsSync(cwd) ? run("git", ["remote", "get-url", "origin"], cwd) : "";
    const m = /github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/.exec(remote);
    repoCache.set(cwd, m ? `${m[1]}/${m[2]}` : null);
  }
  return repoCache.get(cwd);
}

const prCache = new Map();
function prFor(repo, branch) {
  const key = `${repo}@${branch}`;
  if (!prCache.has(key)) {
    let pr = null;
    if (branch && branch !== "main" && branch !== "master") {
      const out = run("gh", ["pr", "list", "--repo", repo, "--head", branch, "--state", "all", "--limit", "1", "--json", "number,title"]);
      try {
        const [hit] = JSON.parse(out || "[]");
        if (hit) pr = { number: hit.number, title: hit.title };
      } catch {
        // gh missing or not logged in: report without a PR.
      }
    }
    prCache.set(key, pr);
  }
  return prCache.get(key);
}

const state = readState();
const since = args.since ? parseSince(args.since) : state.lastRun ? new Date(state.lastRun) : parseSince("7d");
const startedAt = new Date().toISOString();
const author = args.author ?? (run("git", ["config", "user.name"]) || process.env.USER || "unknown");

// Claude Code writes one line per content block, repeating the same usage, so dedupe by message id.
const seen = new Set();
const sessions = new Map();
for (const file of jsonlFiles(args.dir)) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.includes('"usage"')) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = rec.message;
    if (rec.type !== "assistant" || !msg?.usage || !rec.timestamp || new Date(rec.timestamp) < since) continue;
    const id = msg.id ?? rec.requestId ?? rec.uuid;
    if (seen.has(id)) continue;
    seen.add(id);

    const key = `${rec.sessionId}|${msg.model}`;
    const s = sessions.get(key) ?? {
      ts: rec.timestamp,
      cwd: rec.cwd,
      branch: rec.gitBranch,
      sessionId: rec.sessionId,
      model: msg.model,
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    };
    s.inputTokens += msg.usage.input_tokens ?? 0;
    s.outputTokens += msg.usage.output_tokens ?? 0;
    s.cacheWriteTokens += msg.usage.cache_creation_input_tokens ?? 0;
    s.cacheReadTokens += msg.usage.cache_read_input_tokens ?? 0;
    sessions.set(key, s);
  }
}

const events = [];
let skipped = 0;
for (const s of sessions.values()) {
  const repo = s.cwd && repoFor(s.cwd);
  if (!repo || !s.model || s.model.startsWith("<")) {
    skipped++;
    continue;
  }
  const pr = prFor(repo, s.branch);
  events.push({
    ts: s.ts,
    repo,
    pr: pr?.number ?? null,
    prTitle: pr?.title ?? null,
    branch: s.branch ?? null,
    author,
    tool: "claude-code",
    model: s.model,
    sessionId: s.sessionId,
    inputTokens: s.inputTokens,
    outputTokens: s.outputTokens,
    cacheWriteTokens: s.cacheWriteTokens,
    cacheReadTokens: s.cacheReadTokens,
  });
}

console.log(`Found ${events.length} session(s) since ${since.toISOString()}` + (skipped ? ` (${skipped} skipped: no GitHub remote)` : ""));
if (args["dry-run"]) {
  console.log(JSON.stringify(events, null, 2));
  process.exit(0);
}
if (events.length === 0) process.exit(0);

const res = await fetch(new URL("/api/events", args.url), {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(process.env.INGEST_TOKEN ? { authorization: `Bearer ${process.env.INGEST_TOKEN}` } : {}),
  },
  body: JSON.stringify(events),
});
if (!res.ok) {
  console.error(`Upload failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
console.log(`Uploaded: ${JSON.stringify(await res.json())}`);
mkdirSync(STATE_DIR, { recursive: true });
writeFileSync(STATE_FILE, JSON.stringify({ ...state, lastRun: startedAt }, null, 2));
