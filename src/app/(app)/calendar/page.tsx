import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Ev = { key: string; type: "fu" | "due"; name: string; id: string; title: string };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month = "" } = await searchParams;

  const projects = await prisma.project.findMany({
    where: { stage: { notIn: ["SOLD", "DEAD"] as never }, OR: [{ followUpDate: { not: null } }, { dueDate: { not: null } }] },
    select: { id: true, name: true, followUpDate: true, dueDate: true, nextStep: true },
  });

  const byDate: Record<string, Ev[]> = {};
  const add = (e: Ev) => { (byDate[e.key] = byDate[e.key] || []).push(e); };
  for (const p of projects) {
    if (p.followUpDate) add({ key: new Date(p.followUpDate).toISOString().slice(0, 10), type: "fu", name: p.name, id: p.id, title: p.nextStep || "Follow up" });
    if (p.dueDate) add({ key: new Date(p.dueDate).toISOString().slice(0, 10), type: "due", name: p.name, id: p.id, title: "Proposal due" });
  }
  for (const k of Object.keys(byDate)) byDate[k].sort((a) => (a.type === "due" ? -1 : 1));

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
      <h1 className="page">Calendar</h1>
      <p className="page-sub">Proposal due dates and scheduled follow-ups in one place. Click any item to open the opportunity.</p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <Link href={`/calendar?month=${prevM}`} className="btn ghost">←</Link>
        <span style={{ fontWeight: 700, minWidth: 150, textAlign: "center" }}>{monthLabel}</span>
        <Link href={`/calendar?month=${nextM}`} className="btn ghost">→</Link>
        <Link href="/calendar" className="pill-note">Today</Link>
      </div>
      <div className="cal-legend"><span><i className="due" /> Proposal due</span><span><i className="fu" /> Follow-up</span></div>

      <div className="table-wrap">
        <div className="cal-grid">
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="cal-cell empty" />;
            const items = byDate[c.key] || [];
            const isToday = c.key === todayKey;
            const isPast = c.key < todayKey;
            return (
              <div key={i} className={"cal-cell" + (isToday ? " today" : "") + (isPast ? " past" : "")}>
                <div className="cal-daynum">{c.day}</div>
                {items.map((e, j) => (
                  <Link key={j} href={`/projects/${e.id}`} className={"cal-item " + e.type} title={`${e.name} — ${e.title}`}>{e.type === "due" ? "⏰ " : "📞 "}{e.name}</Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
