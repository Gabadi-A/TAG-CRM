import nodemailer from "nodemailer";

/** Sends mail through the Google Workspace account via an App Password (GMAIL_USER / GMAIL_APP_PASSWORD). */
export async function sendMail(opts: { to: string; subject: string; html: string }) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Email isn't configured — set GMAIL_USER and GMAIL_APP_PASSWORD.");
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  await transporter.sendMail({ from: `TAG CRM <${user}>`, ...opts });
}
