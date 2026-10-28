import { timingSafeEqual } from "node:crypto";
import { insertEvents } from "@/lib/db";
import type { UsageEventInput } from "@/lib/types";
import { parseEvent } from "@/lib/validate";

const MAX_EVENTS = 5_000;

function authorized(request: Request): boolean {
  const token = process.env.INGEST_TOKEN;
  // Without a token configured, ingest is open in development only.
  if (!token) return process.env.NODE_ENV !== "production";
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /api/events — body is one usage event, an array of them, or { events: [...] }.
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const raw = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)
      ? (body as { events: unknown[] }).events
      : [body];
  if (raw.length === 0) return Response.json({ error: "no events" }, { status: 400 });
  if (raw.length > MAX_EVENTS) return Response.json({ error: `max ${MAX_EVENTS} events per request` }, { status: 413 });

  const events: UsageEventInput[] = [];
  for (const [i, item] of raw.entries()) {
    const parsed = parseEvent(item, i);
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
    events.push(parsed.value);
  }

  return Response.json({ inserted: insertEvents(events) }, { status: 201 });
}
