# AI Coding Cost Dashboard: MVP plan

**One line:** See how much your team spends on AI coding agents (Claude Code, Cursor, Codex), per repo and per PR.

## Stack
- Next.js 16 App Router + TypeScript + Tailwind v4 (Cache Components on)
- SQLite via built-in `node:sqlite` for MVP (swap to Postgres later for Vercel)
- Charts as plain SVG server components (no chart library)

## How data gets in
1. `POST /api/events` with a bearer token. Body: repo, PR, author, tool, model, token counts.
2. A small CLI (`scripts/report-usage.mjs`) reads Claude Code's local session logs, finds the repo, branch and PR (via `gh`), and posts usage.
3. Cost is computed at ingest from a pricing table (`src/lib/pricing.ts`) and stored, so old costs don't change when prices change.

## Pages
1. **Overview** `/`: total spend, tokens, cost per PR, daily spend chart, spend by repo, model and tool, top PRs. Filter 7/30/90 days.
2. **Repo** `/repos/[owner]/[name]`: spend trend, PR list with cost, spend by author.
3. **PR** `/repos/[owner]/[name]/pulls/[number]`: cost by model and author, list of sessions.

## Demo data
Auto-seed 90 days of realistic fake data for 4 repos, so the deployed demo looks alive.

## Later (after MVP)
- GitHub App that posts "this PR cost $X in AI tokens" as a PR comment
- Budgets and Slack alerts per repo
- Cursor / Codex importers, team login

## Status
Started: pricing table, event types and validation (in `src/lib/`). Paused until the GitHub repo is ready.
