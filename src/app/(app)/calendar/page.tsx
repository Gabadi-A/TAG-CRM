import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import FollowUpCalendar, { type CalItem } from "@/components/FollowUpCalendar";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month = "" } = await searchParams;
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { stage: { notIn: ["SOLD", "DEAD"] as never }, OR: [{ followUpDate: { not: null } }, { dueDate: { not: null } }] },
      select: { id: true, name: true, followUpDate: true, dueDate: true, nextStep: true },
    }),
    prisma.task.findMany({ where: { dueDate: { not: null } } }),
  ]);

  const itemsByDate: Record<string, CalItem[]> = {};
  const add = (key: string, it: CalItem) => { (itemsByDate[key] = itemsByDate[key] || []).push(it); };
  for (const p of projects) {
    if (p.dueDate) add(new Date(p.dueDate).toISOString().slice(0, 10), { id: p.id, kind: "due", label: p.name, href: `/projects/${p.id}`, title: `${p.name} — Proposal due`, icon: "⏰" });
    if (p.followUpDate) add(new Date(p.followUpDate).toISOString().slice(0, 10), { id: p.id, kind: "fu", label: p.name, href: `/projects/${p.id}`, title: `${p.name} — ${p.nextStep || "Follow up"}`, icon: "📞" });
  }
  for (const t of tasks) {
    add(new Date(t.dueDate as Date).toISOString().slice(0, 10), { id: t.id, kind: "task", label: t.title, title: t.title + (t.note ? ` — ${t.note}` : ""), icon: "📌", done: t.done });
  }
  const order = { due: 0, fu: 1, task: 2 } as const;
  for (const k of Object.keys(itemsByDate)) itemsByDate[k].sort((a, b) => order[a.kind] - order[b.kind]);

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
      <p className="page-sub">Proposal due dates, scheduled follow-ups, and to-dos in one place. Click an opportunity item to open it{isAdmin ? ", or drag any item to another day to reschedule it" : ""}.</p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <Link href={`/calendar?month=${prevM}`} className="btn ghost">←</Link>
        <span style={{ fontWeight: 700, minWidth: 150, textAlign: "center" }}>{monthLabel}</span>
        <Link href={`/calendar?month=${nextM}`} className="btn ghost">→</Link>
        <Link href="/calendar" className="pill-note">Today</Link>
      </div>
      <div className="cal-legend"><span><i className="due" /> Proposal due</span><span><i className="fu" /> Follow-up</span><span><i className="task" /> To-do</span></div>

      <FollowUpCalendar cells={cells} itemsByDate={itemsByDate} todayKey={todayKey} canEdit={isAdmin} />
    </div>
  );
}
