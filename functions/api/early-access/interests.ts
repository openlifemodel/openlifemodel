// Cloudflare Pages Function: POST /api/early-access/interests
// Saves the optional "what would you use it for?" answers from the thank-you
// screen. Only the browser that just signed up holds the matching one-time
// code, so nobody can change someone else's answers.

import { INTERESTS, reply, type Env } from "../early-access";

const TOKEN = /^[0-9a-f-]{36}$/;

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (Number(request.headers.get("Content-Length") ?? 0) > 2048) return reply(413, { error: "Too large." });
  let data: Record<string, unknown>;
  try {
    data = (await request.json()) as Record<string, unknown>;
  } catch {
    return reply(400, { error: "Send JSON." });
  }
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const token = typeof data.token === "string" && TOKEN.test(data.token) ? data.token : "";
  const interests = Array.isArray(data.interests)
    ? [...new Set(data.interests.filter((i): i is string => typeof i === "string" && INTERESTS.has(i)))]
    : [];
  if (!email || !token) return reply(400, { error: "Missing details." });

  // A mismatch is ignored silently, so the reply reveals nothing about the list.
  await env.EARLY_ACCESS_DB.prepare("UPDATE early_access SET interests = ?1 WHERE email = ?2 AND update_token = ?3")
    .bind(JSON.stringify(interests), email, token)
    .run();
  return reply(200, { ok: true });
}

export function onRequest(): Response {
  return reply(405, { error: "Use POST." });
}
