import Link from "next/link";
import { prisma } from "@/lib/db";
import { STAGES, fmtK, pctColor, daysSince } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const projects = await prisma.project.findMany({ include: { contractor: true } });
  return (
    <div className="section">
      <h1 className="page">Pipeline</h1>
      <p className="page-sub">Every project on one board — replaces Basecamp.</p>
      <div className="board">
        {STAGES.map((st) => {
          const items = projects.filter((p) => p.stage === st.key);
          const bg = st.key === "SOLD" ? "#e7f5e7" : st.key === "DEAD" ? "#f3ecec" : "var(--tan-lt)";
          return (
            <div className="col" key={st.key}>
              <div className="col-h" style={{ background: bg }}>
                <span>{st.label}</span><span className="cnt">{items.length}</span>
              </div>
              <div className="col-b">
                {items.map((p) => {
                  const d = daysSince(p.lastContact);
                  const stale = (d == null || d > 30) && p.stage !== "SOLD" && p.stage !== "DEAD";
                  return (
                    <Link className="pcard" key={p.id} href={`/projects/${p.id}`}>
                      <div className="pn">#{p.number}</div>
                      <div className="pt">{p.name}</div>
                      <div className="pg">{p.contractor?.name || "—"}</div>
                      <div className="prow">
                        <span className="val-sm">{fmtK(p.value)}</span>
                        <span className="pct"><span className="dot" style={{ background: pctColor(p.closingPct) }} /><span className="muted" style={{ fontSize: 11 }}>{p.closingPct}%</span></span>
                      </div>
                      {stale && <div style={{ marginTop: 6 }}><span className="chip crit">⚑ {d != null ? d + "d quiet" : "no email"}</span></div>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
