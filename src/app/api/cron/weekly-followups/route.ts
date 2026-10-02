import { NextResponse } from "next/server";
import { buildWeeklyFollowups } from "@/lib/followup-email";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TO = process.env.FOLLOWUP_EMAIL_TO || "julieta.chi@theabadigroup.com";

/** Weekly follow-up digest. Triggered by Vercel Cron (see vercel.json) and also
 *  callable manually to test. Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`;
 *  a manual test can pass `?key=$CRON_SECRET`. If CRON_SECRET is unset, the route is open. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const key = new URL(req.url).searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const digest = await buildWeeklyFollowups();
    if (!digest) {
      return NextResponse.json({ ok: true, sent: false, reason: "No follow-ups due this week." });
    }
    await sendMail({ to: TO, subject: digest.subject, html: digest.html });
    return NextResponse.json({ ok: true, sent: true, to: TO, count: digest.count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
