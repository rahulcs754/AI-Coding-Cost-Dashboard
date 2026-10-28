Project: AI Coding Cost Dashboard

Summary: A web dashboard that shows how much a team spends on AI coding agents (Claude Code, Cursor, Codex), broken down per repo, per PR, per author and per model. Built by me (senior frontend dev, React/Next.js/TS) as a portfolio piece and possible product.

Goal: Ship a working, deployed MVP in about 2 weeks, with demo data, that I can show in interviews.

Stack:
- Next.js 16 App Router + TypeScript + Tailwind v4 (Cache Components on: dynamic data inside Suspense, use connection() before DB reads)
- SQLite via built-in node:sqlite for MVP; move to Postgres for Vercel later
- Charts as plain SVG server components (no chart library)

How data gets in:
1. POST /api/events with a bearer token (INGEST_TOKEN). Body: ts, repo "owner/name", pr, prTitle, branch, author, tool (claude-code|cursor|codex|copilot|other), model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens, sessionId. Accepts one event or an array.
2. CLI scripts/report-usage.mjs reads Claude Code local session logs (~/.claude/projects/*/*.jsonl, message.usage), gets repo/branch from git and the PR number from gh, then posts events.
3. Cost is computed at ingest from src/lib/pricing.ts (USD per 1M tokens) and stored, so old costs don't change when prices change. Unknown models use the highest rate.

Pages:
1. / Overview: total spend, tokens, cost per PR, change vs previous period, daily spend chart, spend by repo, model and tool, top PRs. Filter 7/30/90 days.
2. /repos/[owner]/[name]: spend trend, PR list with cost, spend by author.
3. /repos/[owner]/[name]/pulls/[number]: cost by model and author, session list.

Demo data: auto-seed 90 days of realistic fake data for 4 repos when the DB is empty.

Later: GitHub App that comments "this PR cost $X in AI tokens", budgets and Slack alerts, Cursor/Codex importers, team login.

Starter code already written: src/lib/pricing.ts, src/lib/types.ts, src/lib/validate.ts.

Working style: reply in short, simple English. Push work to the GitHub repo for this project.
