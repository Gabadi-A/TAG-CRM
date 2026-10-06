import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import FollowUpCalendar, { type CalItem } from "@/components/FollowUpCalendar";

export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; owner?: string }> }) {
  const { month = "", owner = "" } = await searchParams;
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { stage: { notIn: ["SOLD", "DEAD"] as never }, OR: [{ followUpDate: { not: null } }, { dueDate: { not: null } }] },
      select: { id: true, name: true, followUpDate: true, dueDate: true, nextStep: true, ownerRep: true },
    }),
    prisma.task.findMany({ where: { dueDate: { not: null } } }),
  ]);

  // Owner options (for the person filter) + match helper.
  const ownerOf = (s?: string | null) => (s && s.trim() && s.trim() !== "—" ? s.trim() : null);
  const owners = Array.from(
    new Set([...projects.map((p) => ownerOf(p.ownerRep)), ...tasks.map((t) => ownerOf(t.owner))].filter(Boolean) as string[])
  ).sort((a, b) => a.localeCompare(b));
  const matches = (o?: string | null) => !owner || ownerOf(o) === owner;

  const itemsByDate: Record<string, CalItem[]> = {};
  const add = (key: string, it: CalItem) => { (itemsByDate[key] = itemsByDate[key] || []).push(it); };
  for (const p of projects) {
    if (!matches(p.ownerRep)) continue;
    if (p.dueDate) add(new Date(p.dueDate).toISOString().slice(0, 10), { id: p.id, kind: "due", label: p.name, href: `/projects/${p.id}`, title: `${p.name} — Proposal due`, icon: "⏰" });
    if (p.followUpDate) add(new Date(p.followUpDate).toISOString().slice(0, 10), { id: p.id, kind: "fu", label: p.name, href: `/projects/${p.id}`, title: `${p.name} — ${p.nextStep || "Follow up"}`, icon: "📞" });
  }
  for (const t of tasks) {
    if (!matches(t.owner)) continue;
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

  const monthParam = `${year}-${pad(monthIdx + 1)}`;
  const ownerQS = owner ? `&owner=${encodeURIComponent(owner)}` : "";

  return (
    <div className="section">
      <h1 className="page">Calendar</h1>
      <p className="page-sub">Proposal due dates, scheduled follow-ups, and to-dos in one place. Filter by person to see just one owner&apos;s work. Click an opportunity item to open it{isAdmin ? ", or drag any item to another day to reschedule it" : ""}.</p>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        <Link href={`/calendar?month=${prevM}${ownerQS}`} className="btn ghost">←</Link>
        <span style={{ fontWeight: 700, minWidth: 150, textAlign: "center" }}>{monthLabel}</span>
        <Link href={`/calendar?month=${nextM}${ownerQS}`} className="btn ghost">→</Link>
        <Link href={`/calendar${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`} className="pill-note">Today</Link>
      </div>

      {owners.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <span className="muted" style={{ fontSize: 12, marginRight: 2 }}>Owner:</span>
          <Link href={`/calendar?month=${monthParam}`} className={"pill-note" + (!owner ? " on" : "")}>Everyone</Link>
          {owners.map((o) => (
            <Link key={o} href={`/calendar?month=${monthParam}&owner=${encodeURIComponent(o)}`} className={"pill-note" + (owner === o ? " on" : "")}>{o}</Link>
          ))}
        </div>
      )}

      <div className="cal-legend"><span><i className="due" /> Proposal due</span><span><i className="fu" /> Follow-up</span><span><i className="task" /> To-do</span></div>

      <FollowUpCalendar cells={cells} itemsByDate={itemsByDate} todayKey={todayKey} canEdit={isAdmin} />
    </div>
  );
}
