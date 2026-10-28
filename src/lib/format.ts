const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

export const formatUsd = (n: number) => (n >= 10_000 ? usdCompact.format(n) : usd.format(n));
export const formatTokens = (n: number) => compact.format(n);
export const formatPct = (n: number) => pct.format(n);
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function delta(current: number, previous: number): { label: string; up: boolean } | null {
  if (previous <= 0) return null;
  const change = (current - previous) / previous;
  return { label: `${change >= 0 ? "+" : ""}${pct.format(change)}`, up: change >= 0 };
}

export const repoHref = (repo: string) => `/repos/${repo}`;
export const prHref = (repo: string, pr: number) => `/repos/${repo}/pulls/${pr}`;
