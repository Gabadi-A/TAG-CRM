import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { STAGE_LABEL, fmtK, daysSince } from "@/lib/format";
import { logContact } from "@/lib/actions/projects";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const projects = await prisma.project.findMany({ include: { contractor: true } });
  const rows = projects
    .filter((p) => p.stage !== "SOLD" && p.stage !== "DEAD")
    .map((p) => ({ ...p, d: daysSince(p.lastContact) }))
    .filter((p) => p.d == null || p.d > 30)
    .sort((a, b) => (b.d == null ? 99999 : b.d) - (a.d == null ? 99999 : a.d));
  const totalVal = rows.reduce((s, p) => s + (p.value || 0), 0);

  return (
    <div className="section">
      <h1 className="page">Follow-ups</h1>
      <p className="page-sub">Anything with no contact in 30+ days surfaces here automatically — the end of the &quot;Status?&quot; pile.</p>
      <div className="banner">⚑ {rows.length} opportunities need a nudge — combined open value {fmtK(totalVal)}.</div>
      {rows.map((p) => (
        <div className="fu-row" key={p.id}>
          <div>
            <Link href={`/projects/${p.id}`} style={{ fontWeight: 700 }}>{p.name} <span className="muted" style={{ fontWeight: 400 }}>#{p.number}</span></Link>
            <div className="muted" style={{ fontSize: 12 }}>{p.contractor?.name || "—"} · {p.ownerRep || "—"} · {STAGE_LABEL[p.stage]}</div>
          </div>
          <div className="stale">{p.d == null ? "No email logged" : p.d + " days quiet"}</div>
          {isAdmin ? (
            <form action={logContact}>
              <input type="hidden" name="id" value={p.id} />
              <button className="btn ghost" type="submit">Log contact today</button>
            </form>
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  );
}
