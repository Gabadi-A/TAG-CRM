import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { STAGE_LABEL, fmtK, daysSince } from "@/lib/format";
import { logContact } from "@/lib/actions/projects";
import { setNextStep } from "@/lib/actions/records";

export const dynamic = "force-dynamic";

const inputStyle = {
  border: "1px solid var(--line-2)", borderRadius: 9, padding: "7px 9px",
  fontSize: 13, fontFamily: "inherit", background: "var(--paper)",
} as const;

export default async function FollowUpsPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";
  const projects = await prisma.project.findMany({ include: { contractor: true, quotes: true } });

  const todayMid = new Date(); todayMid.setHours(0, 0, 0, 0);
  const rows = projects
    .filter((p) => p.stage !== "SOLD" && p.stage !== "DEAD")
    .map((p) => ({ p, d: daysSince(p.lastContact) }))
    .filter((x) => x.d == null || x.d > 30 || x.p.followUpDate != null)
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

  return (
    <div className="section">
      <h1 className="page">Follow-ups</h1>
      <p className="page-sub">Anything overdue (no contact in 30+ days) or with a scheduled follow-up. Add a <b>next step</b> so everyone knows what to do — e.g. &quot;ask about the January start.&quot;</p>
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
    </div>
  );
}
