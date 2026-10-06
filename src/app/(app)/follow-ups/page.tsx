import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { STAGE_LABEL, fmtK, daysSince } from "@/lib/format";
import { logContact } from "@/lib/actions/projects";
import { setNextStep } from "@/lib/actions/records";
import { sendWeeklyFollowupsNow } from "@/lib/actions/email";
import { addTask, toggleTask, deleteTask, saveTask } from "@/lib/actions/tasks";
import FollowUpCalendar, { type CalItem } from "@/components/FollowUpCalendar";

export const dynamic = "force-dynamic";

const DIGEST_TO = process.env.FOLLOWUP_EMAIL_TO || "julieta.chi@theabadigroup.com";

const inputStyle = {
  border: "1px solid var(--line-2)", borderRadius: 9, padding: "7px 9px",
  fontSize: 13, fontFamily: "inherit", background: "var(--paper)",
} as const;
const pad = (n: number) => String(n).padStart(2, "0");

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string; sent?: string; n?: string; msg?: string }> }) {
  const { view = "list", month = "", sent = "", n = "", msg = "" } = await searchParams;
  const isCal = view === "calendar";
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const projects = await prisma.project.findMany({ include: { contractor: true, quotes: true } });
  const tasks = await prisma.task.findMany({ orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] });
  const openTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);
  const taskDate = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  const renderTaskRow = (t: (typeof tasks)[number]) =>
    isAdmin ? (
      <div key={t.id} className="focus-row" style={{ alignItems: "center", gap: 8 }}>
        <form action={toggleTask}>
          <input type="hidden" name="id" value={t.id} />
          <button className="btn ghost" type="submit" title={t.done ? "Mark not done" : "Mark done"}>{t.done ? "☑" : "☐"}</button>
        </form>
        <form action={saveTask} style={{ display: "flex", gap: 8, flex: "1 1 320px", flexWrap: "wrap", alignItems: "center" }}>
          <input type="hidden" name="id" value={t.id} />
          <input name="title" defaultValue={t.title} style={{ ...inputStyle, flex: "1 1 200px", textDecoration: t.done ? "line-through" : "none" }} />
          <input name="owner" defaultValue={t.owner || ""} placeholder="Owner" style={{ ...inputStyle, width: 120 }} />
          <input name="dueDate" type="date" defaultValue={taskDate(t.dueDate)} style={inputStyle} />
          <button className="btn ghost" type="submit">Save</button>
        </form>
        <form action={deleteTask}>
          <input type="hidden" name="id" value={t.id} />
          <button className="btn ghost danger-btn" type="submit" title="Delete to-do">✕</button>
        </form>
      </div>
    ) : (
      <div key={t.id} className="focus-row" style={{ alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
          <span className="muted" style={{ fontSize: 12 }}> {t.owner ? `· ${t.owner} ` : ""}{t.dueDate ? `· due ${taskDate(t.dueDate)}` : "· no date"}</span>
        </div>
      </div>
    );

  const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
  const rows = projects
    .filter((p) => p.stage !== "SOLD" && p.stage !== "DEAD")
    .map((p) => ({ p, d: daysSince(p.lastContact) }))
    .filter((x) => x.p.followUpDate != null)
    .sort((a, b) => {
      const fa = a.p.followUpDate ? new Date(a.p.followUpDate).getTime() : Infinity;
      const fb = b.p.followUpDate ? new Date(b.p.followUpDate).getTime() : Infinity;
      if (fa !== fb) return fa - fb;
      return (b.d == null ? 1e9 : b.d) - (a.d == null ? 1e9 : a.d);
    });
  const totalVal = rows.reduce((s, r) => s + r.p.quotes.reduce((a, q) => a + (q.value || 0), 0), 0);

  function due(p: (typeof rows)[number]["p"], d: number | null): { text: string; color: string } {
    if (p.followUpDate) {
      const days = Math.round((new Date(p.followUpDate).setHours(0, 0, 0, 0) - todayMid.getTime()) / 86400000);
      if (days < 0) return { text: `Follow-up ${-days}d overdue`, color: "#c0392b" };
      if (days === 0) return { text: "Follow up today", color: "#c0392b" };
      return { text: `Follow up in ${days}d`, color: days <= 3 ? "#c0392b" : "var(--ink-2)" };
    }
    return { text: d == null ? "No email logged" : `${d} days quiet`, color: "#c0392b" };
  }

  // --- calendar data (opportunity follow-ups + standalone to-dos) ---
  const scheduled = projects.filter((p) => p.stage !== "SOLD" && p.stage !== "DEAD" && p.followUpDate);
  const scheduledTasks = tasks.filter((t) => t.dueDate != null);
  const itemsByDate: Record<string, CalItem[]> = {};
  const pushItem = (key: string, it: CalItem) => { (itemsByDate[key] = itemsByDate[key] || []).push(it); };
  for (const p of scheduled) {
    const key = new Date(p.followUpDate as Date).toISOString().slice(0, 10);
    pushItem(key, { id: p.id, kind: "fu", label: p.name, href: `/projects/${p.id}`, title: p.name + (p.nextStep ? ` — ${p.nextStep}` : "") });
  }
  for (const t of scheduledTasks) {
    const key = new Date(t.dueDate as Date).toISOString().slice(0, 10);
    pushItem(key, { id: t.id, kind: "task", label: t.title, title: t.title + (t.note ? ` — ${t.note}` : ""), done: t.done });
  }
  const calCount = scheduled.length + scheduledTasks.length;
  const nowD = new Date();
  let year = nowD.getUTCFullYear();
  let monthIdx = nowD.getUTCMonth();
  if (/^\d{4}-\d{2}$/.test(month)) { const [y, m] = month.split("-").map(Number); year = y; monthIdx = m - 1; }
  const first = new Date(Date.UTC(year, monthIdx, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const todayKey = new Date().toISOString().slice(0, 10);
  const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const fmtParam = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  const prevM = fmtParam(new Date(Date.UTC(year, monthIdx - 1, 1)));
  const nextM = fmtParam(new Date(Date.UTC(year, monthIdx + 1, 1)));
  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day, key: `${year}-${pad(monthIdx + 1)}-${pad(day)}` });

  return (
    <div className="section">
      <h1 className="page">Follow-ups</h1>
      <p className="page-sub">Opportunities with a scheduled follow-up date, soonest first. Set a <b>follow-up date</b> and a <b>next step</b> on any opportunity to have it show up here.</p>

      {sent === "ok" && <div className="banner" style={{ background: "#e7f5e7", borderColor: "#9fcf9f" }}>✓ Sent {n ? `${n} follow-up${n === "1" ? "" : "s"}` : "the digest"} to {DIGEST_TO}.</div>}
      {sent === "none" && <div className="banner">No follow-ups are due this week — nothing was sent.</div>}
      {sent === "err" && <div className="banner" style={{ background: "#fbe6e6", borderColor: "#e0a3a3" }}>Couldn&apos;t send the email{msg ? `: ${msg}` : ""}. Check GMAIL_USER and GMAIL_APP_PASSWORD in Vercel.</div>}
      {sent === "forbidden" && <div className="banner" style={{ background: "#fbe6e6", borderColor: "#e0a3a3" }}>Only admins can send the digest.</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Link href="/follow-ups" className={isCal ? "btn ghost" : "btn"}>List</Link>
        <Link href="/follow-ups?view=calendar" className={isCal ? "btn" : "btn ghost"}>Calendar</Link>
        {isCal && (
          <>
            <Link href={`/follow-ups?view=calendar&month=${prevM}`} className="btn ghost">←</Link>
            <span style={{ fontWeight: 700, minWidth: 150, textAlign: "center" }}>{monthLabel}</span>
            <Link href={`/follow-ups?view=calendar&month=${nextM}`} className="btn ghost">→</Link>
            <Link href="/follow-ups?view=calendar" className="pill-note">Today</Link>
          </>
        )}
        {isAdmin && (
          <form action={sendWeeklyFollowupsNow} style={{ marginLeft: "auto" }}>
            <button className="btn" type="submit" title={`Email this week's follow-ups to ${DIGEST_TO} now`}>✉ Send digest now</button>
          </form>
        )}
      </div>

      {isCal ? (
        <>
          <FollowUpCalendar cells={cells} itemsByDate={itemsByDate} todayKey={todayKey} canEdit={isAdmin} />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#2f6fb0", display: "inline-block" }} />Opportunity follow-up</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#1c7a4a", display: "inline-block" }} />To-do</span>
            {isAdmin && <span className="muted" style={{ fontSize: 12 }}>Drag any item to another day to reschedule it.</span>}
          </div>
          <p className="page-sub" style={{ marginTop: 8 }}>{calCount} scheduled item{calCount === 1 ? "" : "s"} shown.</p>
        </>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3 style={{ marginTop: 0 }}>Follow-up to-dos <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>— reminders that aren&apos;t tied to an opportunity</span></h3>
            {isAdmin && (
              <form action={addTask} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: tasks.length ? 12 : 0 }}>
                <input name="title" placeholder="What to do — e.g. Call Mega about pricing" required style={{ ...inputStyle, flex: "1 1 260px" }} />
                <input name="owner" placeholder="Owner (optional)" style={{ ...inputStyle, width: 150 }} />
                <input name="dueDate" type="date" style={inputStyle} />
                <button className="btn" type="submit">+ Add to-do</button>
              </form>
            )}
            {tasks.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No to-dos yet.{isAdmin ? " Add one above." : ""}</p>
            ) : (
              <>
                {openTasks.map(renderTaskRow)}
                {openTasks.length === 0 && <p className="muted" style={{ margin: "4px 0" }}>All to-dos done. 🎉</p>}
                {doneTasks.length > 0 && (
                  <details style={{ marginTop: 8 }}>
                    <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>{doneTasks.length} completed</summary>
                    <div style={{ marginTop: 6 }}>{doneTasks.map(renderTaskRow)}</div>
                  </details>
                )}
              </>
            )}
          </div>
          <div className="banner">⚑ {rows.length} opportunities to work — combined open value {fmtK(totalVal)}.</div>
          {rows.map(({ p, d }) => {
            const label = due(p, d);
            const val = p.quotes.reduce((a, q) => a + (q.value || 0), 0);
            return (
              <div key={p.id} style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 11, padding: "12px 15px", marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div>
                    <Link href={`/projects/${p.id}`} style={{ fontWeight: 700 }}>{p.name} <span className="muted" style={{ fontWeight: 400 }}>#{p.number}</span></Link>
                    <div className="muted" style={{ fontSize: 12 }}>{p.contractor?.name || "—"} · {p.ownerRep || "—"} · {STAGE_LABEL[p.stage]}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: label.color }}>{label.text}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{fmtK(val)}</div>
                  </div>
                </div>
                {isAdmin ? (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <form action={setNextStep} style={{ display: "flex", gap: 8, flex: "1 1 300px", flexWrap: "wrap", alignItems: "flex-end" }}>
                      <input type="hidden" name="id" value={p.id} />
                      <input name="nextStep" defaultValue={p.nextStep || ""} placeholder="Next step — what to do / what to ask" style={{ ...inputStyle, flex: "1 1 200px" }} />
                      <input name="followUpDate" type="date" defaultValue={p.followUpDate ? new Date(p.followUpDate).toISOString().slice(0, 10) : ""} style={inputStyle} />
                      <button className="btn ghost" type="submit">Save</button>
                    </form>
                    <form action={logContact}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn ghost" type="submit">Log contact today</button>
                    </form>
                  </div>
                ) : (
                  p.nextStep && <div className="note-box" style={{ marginTop: 8 }}><b>Next:</b> {p.nextStep}</div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
