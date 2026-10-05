"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buildWeeklyFollowups } from "@/lib/followup-email";
import { sendMail } from "@/lib/mailer";

const TO = process.env.FOLLOWUP_EMAIL_TO || "julieta.chi@theabadigroup.com";

/** Admin-only: builds the weekly follow-up digest and emails it to Julieta right now,
 *  then redirects back to /follow-ups with a status the page turns into a banner. */
export async function sendWeeklyFollowupsNow() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    redirect("/follow-ups?sent=forbidden");
  }

  let status = "ok";
  let extra = "";
  try {
    const digest = await buildWeeklyFollowups();
    if (!digest) {
      status = "none";
    } else {
      await sendMail({ to: TO, subject: digest.subject, html: digest.html });
      extra = `&n=${digest.count}`;
    }
  } catch (err) {
    status = "err";
    extra = `&msg=${encodeURIComponent(err instanceof Error ? err.message : "Unknown error")}`;
  }
  redirect(`/follow-ups?sent=${status}${extra}`);
}
