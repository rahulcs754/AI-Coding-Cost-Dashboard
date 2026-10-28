import type { Tool, UsageEventInput } from "./types";

// Deterministic PRNG so the demo looks the same on every fresh database.
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REPOS = [
  { repo: "acme/web-app", weight: 1.6, titles: ["Checkout redesign", "Fix hydration error on PDP", "Add search filters", "Migrate to App Router", "Dark mode", "Cart a11y fixes"] },
  { repo: "acme/api", weight: 1.1, titles: ["Rate limit middleware", "Orders pagination", "Postgres connection pool", "Webhook retries"] },
  { repo: "acme/design-system", weight: 0.6, titles: ["Button variants", "Table component", "Token cleanup"] },
  { repo: "acme/mobile", weight: 0.8, titles: ["Push notifications", "Offline cache", "Login with passkeys", "Crash on Android 15"] },
];
const AUTHORS = ["priya", "arjun", "meera", "dev", "sara", "kabir"];
const MODELS: { tool: Tool; model: string; w: number }[] = [
  { tool: "claude-code", model: "claude-opus-5-5", w: 0.4 },
  { tool: "claude-code", model: "claude-sonnet-5-5", w: 0.25 },
  { tool: "cursor", model: "claude-sonnet-5-5", w: 0.15 },
  { tool: "codex", model: "claude-haiku-5-5", w: 0.1 },
  { tool: "claude-code", model: "claude-fable-5-1", w: 0.1 },
];

export function seedEvents(days = 90, now = new Date()): UsageEventInput[] {
  const rand = mulberry32(42);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const pickModel = () => {
    let r = rand();
    for (const m of MODELS) if ((r -= m.w) <= 0) return m;
    return MODELS[0];
  };

  const events: UsageEventInput[] = [];
  let prNumber = 100;
  for (const { repo, weight, titles } of REPOS) {
    // Spread this repo's PRs over the window; each PR gets a few days of agent sessions.
    const prCount = Math.round(days / 4 * weight);
    for (let i = 0; i < prCount; i++) {
      const pr = ++prNumber;
      const startDay = Math.floor(rand() * days);
      const author = pick(AUTHORS);
      const sessions = 1 + Math.floor(rand() * 6 * weight);
      for (let s = 0; s < sessions; s++) {
        const day = Math.max(0, startDay - Math.floor(rand() * 4));
        const ts = new Date(now.getTime() - day * 86_400_000 - Math.floor(rand() * 10) * 3_600_000);
        const { tool, model } = pickModel();
        const calls = 5 + Math.floor(rand() * 40);
        events.push({
          ts: ts.toISOString(),
          repo,
          pr,
          prTitle: `${pick(titles)}${i >= titles.length ? ` (part ${Math.floor(i / titles.length) + 1})` : ""}`,
          branch: `feat/${pr}`,
          author: rand() < 0.8 ? author : pick(AUTHORS),
          tool,
          model,
          sessionId: `seed-${pr}-${s}`,
          inputTokens: calls * Math.floor(2_000 + rand() * 6_000),
          outputTokens: calls * Math.floor(300 + rand() * 1_500),
          cacheWriteTokens: calls * Math.floor(rand() * 8_000),
          cacheReadTokens: calls * Math.floor(20_000 + rand() * 60_000),
        });
      }
    }
  }
  return events;
}
