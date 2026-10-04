// Cloudflare Pages Function: POST /api/early-access
// Saves an email to the early-access list on openlifemodel.com. It runs only on
// Cloudflare Pages with the EARLY_ACCESS_DB (D1) binding; self-hosted copies of
// the static site do not include it. See docs/platform-setup.md.

interface D1Statement {
  bind(...values: unknown[]): { run(): Promise<unknown> };
}
export interface Env {
  EARLY_ACCESS_DB: { prepare(sql: string): D1Statement };
}

// Shared with functions/api/early-access/interests.ts; keep in step with
// web/components/EarlyAccess.tsx.
export const INTERESTS = new Set(["history", "labs", "wearables", "assistant", "models"]);
const CONSENT_VERSION = "2026-10-04";
export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;

export const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (Number(request.headers.get("Content-Length") ?? 0) > 2048) return reply(413, { error: "Too large." });
  let data: Record<string, unknown>;
  try {
    data = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply(400, { error: "Send JSON." });
  }

  // A one-time code lets the same browser add its answers on the thank-you screen.
  const token = crypto.randomUUID();
  // Bots fill in every field; people never see this one.
  if (typeof data.website === "string" && data.website !== "") return reply(200, { ok: true, token });

  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return reply(400, { error: "Please enter a valid email address." });

  const interests = Array.isArray(data.interests)
    ? [...new Set(data.interests.filter((i): i is string => typeof i === "string" && INTERESTS.has(i)))]
    : [];
  const source =
    typeof data.source === "string" && /^[a-z0-9.-]{1,60}$/.test(data.source) ? data.source : null;

  // Signing up twice is not an error, and the reply never reveals who is on the
  // list: an existing entry keeps its code, so the new one simply won't match.
  await env.EARLY_ACCESS_DB.prepare(
    "INSERT INTO early_access (email, interests, source, consent_version, update_token) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(email) DO NOTHING",
  )
    .bind(email, JSON.stringify(interests), source, CONSENT_VERSION, token)
    .run();
  return reply(200, { ok: true, token });
}

export function onRequest(): Response {
  return reply(405, { error: "Use POST." });
}
