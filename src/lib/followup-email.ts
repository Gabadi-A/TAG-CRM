import { prisma } from "@/lib/db";
import { STAGE_LABEL, fmtK } from "@/lib/format";

const APP_URL = process.env.APP_URL || "https://tag-crm.vercel.app";

/** Builds the weekly follow-up digest: active opportunities whose follow-up date is
 *  overdue or falls within the next 7 days, grouped by stage. Returns null when nothing is due. */
export async function buildWeeklyFollowups() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const projects = await prisma.project.findMany({
    where: {
      followUpDate: { not: null, lte: weekEnd },
      stage: { notIn: ["SOLD" as never, "DEAD" as never] },
    },
    include: { contractor: true, quotes: true },
    orderBy: { followUpDate: "asc" },
  });

  if (projects.length === 0) return null;

  // Group by stage, preserving the stage order from STAGE_LABEL.
  const groups = new Map<string, typeof projects>();
  for (const p of projects) {
    const arr = groups.get(p.stage) || [];
    arr.push(p);
    groups.set(p.stage, arr);
  }

  const dayMs = 86400000;
  const rowFor = (p: (typeof projects)[number]) => {
    const fu = new Date(p.followUpDate as Date);
    fu.setHours(0, 0, 0, 0);
    const days = Math.round((fu.getTime() - today.getTime()) / dayMs);
    const when =
      days < 0 ? `${-days}d overdue` : days === 0 ? "due today" : `in ${days}d`;
    const whenColor = days <= 0 ? "#c0392b" : days <= 2 ? "#c0392b" : "#555";
    const dateStr = fu.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    const val = p.quotes.reduce((a, q) => a + (q.value || 0), 0);
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;">
          <a href="${APP_URL}/projects/${p.id}" style="color:#1c50a5;text-decoration:none;font-weight:600;">${esc(p.name)}</a>
          <span style="color:#999;">#${esc(p.number)}</span><br/>
          <span style="color:#666;font-size:12px;">${esc(p.contractor?.name || "—")} · ${esc(p.ownerRep || "—")}</span>
          ${p.nextStep ? `<br/><span style="color:#444;font-size:12px;"><b>Next:</b> ${esc(p.nextStep)}</span>` : ""}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap;text-align:right;color:${whenColor};font-weight:600;font-size:13px;">
          ${dateStr}<br/><span style="font-weight:400;">${when}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;white-space:nowrap;text-align:right;color:#333;font-size:13px;">${fmtK(val)}</td>
      </tr>`;
  };

  let body = "";
  for (const stage of Object.keys(STAGE_LABEL)) {
    const list = groups.get(stage);
    if (!list || list.length === 0) continue;
    body += `
      <h3 style="margin:22px 0 6px;font-size:15px;color:#222;border-bottom:2px solid #e4b55a;padding-bottom:4px;">
        ${esc(STAGE_LABEL[stage] || stage)} <span style="color:#999;font-weight:400;">(${list.length})</span>
      </h3>
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">${list.map(rowFor).join("")}</table>`;
  }
  // Any stages not in STAGE_LABEL (defensive).
  for (const [stage, list] of groups) {
    if (STAGE_LABEL[stage]) continue;
    body += `
      <h3 style="margin:22px 0 6px;font-size:15px;color:#222;border-bottom:2px solid #e4b55a;padding-bottom:4px;">${esc(stage)} <span style="color:#999;font-weight:400;">(${list.length})</span></h3>
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">${list.map(rowFor).join("")}</table>`;
  }

  const total = projects.length;
  const totalVal = projects.reduce((s, p) => s + p.quotes.reduce((a, q) => a + (q.value || 0), 0), 0);
  const weekLabel = `${today.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const html = `
    <div style="max-width:640px;margin:0 auto;font-family:Arial,sans-serif;color:#222;">
      <h2 style="margin:0 0 2px;">Follow-ups this week</h2>
      <p style="margin:0 0 4px;color:#666;font-size:13px;">${weekLabel} · ${total} to work · ${fmtK(totalVal)} open value</p>
      <p style="margin:0 0 10px;color:#888;font-size:12px;">Overdue items and anything due in the next 7 days, grouped by stage.</p>
      ${body}
      <p style="margin:26px 0 0;font-size:12px;color:#999;">
        Sent from <a href="${APP_URL}/follow-ups" style="color:#1c50a5;">TAG CRM</a>. Update follow-up dates on each opportunity to change what shows here.
      </p>
    </div>`;

  const subject = `TAG CRM — ${total} follow-up${total === 1 ? "" : "s"} this week (${weekLabel})`;
  return { subject, html, count: total };
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}
