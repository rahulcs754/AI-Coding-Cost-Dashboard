// USD per 1M tokens. Snapshot of Anthropic first-party API rates (2026-10).
// Edit this table to match your contract or add other providers' models.
export type ModelPrice = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

const price = (input: number, output: number, cacheRead = input * 0.1): ModelPrice => ({
  input,
  output,
  cacheWrite: input * 1.25,
  cacheRead,
});

export const PRICING: Record<string, ModelPrice> = {
  "claude-fable-5-1": price(10, 50, 0.25),
  "claude-fable-5": price(10, 50),
  "claude-opus-5-5": price(4, 20, 0.2),
  "claude-opus-5": price(5, 25),
  "claude-opus-4-8": price(5, 25),
  "claude-opus-4-7": price(5, 25),
  "claude-opus-4-6": price(5, 25),
  "claude-sonnet-5-5": price(2, 10, 0.2),
  "claude-sonnet-5": price(2, 10),
  "claude-sonnet-4-6": price(3, 15),
  "claude-haiku-5-5": price(0.1, 0.5),
  "claude-haiku-4-5": price(1, 5),
};

// Unknown models are priced at the most expensive rate so spend is never under-reported.
const FALLBACK = PRICING["claude-fable-5-1"];

export function priceFor(model: string): { price: ModelPrice; known: boolean } {
  // Tolerate date suffixes and provider prefixes, e.g. "anthropic.claude-opus-5-5".
  const key = Object.keys(PRICING).find((k) => model === k || model.includes(k));
  return key ? { price: PRICING[key], known: true } : { price: FALLBACK, known: false };
}

export type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
};

export function costUsd(model: string, t: TokenCounts): number {
  const { price: p } = priceFor(model);
  return (
    (t.inputTokens * p.input +
      t.outputTokens * p.output +
      t.cacheWriteTokens * p.cacheWrite +
      t.cacheReadTokens * p.cacheRead) /
    1_000_000
  );
}
