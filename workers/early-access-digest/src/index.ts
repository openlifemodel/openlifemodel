// Cloudflare Worker: an hourly email to the owner listing new early-access
// sign-ups. Runs on a cron trigger; sends nothing when there are none. The
// recipient is the DIGEST_TO secret (a verified Email Routing destination),
// so no personal address lives in this repository. See docs/platform-setup.md.

import { EmailMessage } from "cloudflare:email";

interface D1Result<T> {
  results: T[];
}
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface Env {
  EARLY_ACCESS_DB: { prepare(sql: string): D1Statement };
  DIGEST: { send(message: EmailMessage): Promise<void> };
  DIGEST_TO: string;
}

const FROM = "digest@openlifemodel.com";
const INTEREST_NAMES: Record<string, string> = {
  history: "Tracking over time",
  labs: "Lab results",
  wearables: "Wearables",
  assistant: "AI assistant",
  models: "Building/sharing models",
};

const iso = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

interface SignUp {
  email: string;
  interests: string;
  source: string | null;
  created_at: string;
}

export async function sendDigest(env: Env, now = new Date()): Promise<number> {
  const db = env.EARLY_ACCESS_DB;
  // A few seconds' margin so a sign-up being written right now waits for the next run.
  const until = iso(new Date(now.getTime() - 10_000));
  const last =
    (await db.prepare("SELECT value FROM digest_state WHERE key = 'last_sent_at'").first<{ value: string }>())?.value ??
    iso(new Date(now.getTime() - 3_600_000));

  const { results: fresh } = await db
    .prepare("SELECT email, interests, source, created_at FROM early_access WHERE created_at > ?1 AND created_at <= ?2 ORDER BY created_at")
    .bind(last, until)
    .all<SignUp>();

  if (fresh.length > 0) {
    const total = (await db.prepare("SELECT COUNT(*) AS n FROM early_access").first<{ n: number }>())?.n ?? fresh.length;
    const { results: bySource } = await db
      .prepare("SELECT COALESCE(source, 'direct') AS source, COUNT(*) AS n FROM early_access GROUP BY 1 ORDER BY n DESC")
      .all<{ source: string; n: number }>();
    const { results: byInterest } = await db
      .prepare("SELECT value AS interest, COUNT(*) AS n FROM early_access, json_each(early_access.interests) GROUP BY value ORDER BY n DESC")
      .all<{ interest: string; n: number }>();

    const lines = [
      `${fresh.length} new early-access sign-up${fresh.length === 1 ? "" : "s"} since ${last} (UTC). ${total} in total.`,
      "",
      "New:",
      ...fresh.map((s) => {
        const wants = (JSON.parse(s.interests) as string[]).map((i) => INTEREST_NAMES[i] ?? i).join(", ") || "no answer";
        return `- ${s.email} (${s.source ?? "direct"}; ${wants}) at ${s.created_at}`;
      }),
      "",
      "All sign-ups by source:",
      ...bySource.map((r) => `- ${r.source}: ${r.n}`),
      "",
      "What people want (all sign-ups, multiple answers):",
      ...(byInterest.length ? byInterest.map((r) => `- ${INTEREST_NAMES[r.interest] ?? r.interest}: ${r.n}`) : ["- no answers yet"]),
      "",
      "Sent hourly by the openlifemodel-early-access-digest Worker; nothing is sent in hours without sign-ups.",
    ];
    const subject = `${fresh.length} new early-access sign-up${fresh.length === 1 ? "" : "s"} (${total} total)`;
    const raw = [
      `From: OpenLifeModel <${FROM}>`,
      `To: <${env.DIGEST_TO}>`,
      `Subject: ${subject}`,
      `Date: ${now.toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@openlifemodel.com>`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      lines.join("\r\n"),
    ].join("\r\n");
    // Send before moving the watermark: if sending fails, the next run retries.
    await env.DIGEST.send(new EmailMessage(FROM, env.DIGEST_TO, raw));
  }

  await db
    .prepare("INSERT INTO digest_state (key, value) VALUES ('last_sent_at', ?1) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(until)
    .run();
  return fresh.length;
}

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(sendDigest(env));
  },
};
