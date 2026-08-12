import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { STAGES, STAGE_LABEL, fmtK, fmt, pctColor, daysSince, TRADE_LABEL, isOpenQuote } from "@/lib/format";
import { toggleFocus } from "@/lib/actions/projects";

export const dynamic = "force-dynamic";

type QuoteLite = { value: number; status: string; trade: string };
const oppValue = (p: { quotes: QuoteLite[] }) => p.quotes.reduce((s, q) => s + (q.value || 0), 0);

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const projects = await prisma.project.findMany({ include: { contractor: true, quotes: true } });
  const active = projects.filter((p) => p.stage !== "SOLD" && p.stage !== "DEAD");

  const totalPipe = active.reduce((s, p) => s + oppValue(p), 0);
  const weighted = active.reduce((s, p) => s + oppValue(p) * (p.closingPct / 100), 0);
  const sold = projects.filter((p) => p.stage === "SOLD");
  const soldVal = sold.reduce((s, p) => s + oppValue(p), 0);

  const allQuotes = projects.flatMap((p) => p.quotes);
  const wonQ = allQuotes.filter((q) => q.status === "WON").reduce((s, q) => s + q.value, 0);
  const lostQ = allQuotes.filter((q) => q.status === "LOST").reduce((s, q) => s + q.value, 0);
  const winRate = wonQ + lostQ ? Math.round((wonQ / (wonQ + lostQ)) * 100) : null;

  const byStage = STAGES.filter((s) => s.key !== "SOLD" && s.key !== "DEAD").map((s) => ({
    label: s.label,
    val: active.filter((p) => p.stage === s.key).reduce((a, p) => a + oppValue(p), 0),
    n: active.filter((p) => p.stage === s.key).length,
  }));
  const maxStage = Math.max(...byStage.map((s) => s.val), 1);

  // Contractors: open pipeline by GC + client flag (has any won quote).
  const gcOpen: Record<string, number> = {};
  const gcClient: Record<string, boolean> = {};
  projects.forEach((p) => {
    const k = p.contractor?.name || "—";
    if (p.stage !== "SOLD" && p.stage !== "DEAD") gcOpen[k] = (gcOpen[k] || 0) + oppValue(p);
    if (p.quotes.some((q) => q.status === "WON")) gcClient[k] = true;
  });
  const byGc = Object.entries(gcOpen).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const maxGc = Math.max(...byGc.map((g) => g[1]), 1);

  const tradeMap: Record<string, number> = {};
  allQuotes.filter((q) => isOpenQuote(q.status)).forEach((q) => {
    const t = TRADE_LABEL[q.trade] || q.trade;
    tradeMap[t] = (tradeMap[t] || 0) + q.value;
  });
  const byTrade = Object.entries(tradeMap).sort((a, b) => b[1] - a[1]);
  const maxTrade = Math.max(...byTrade.map((t) => t[1]), 1);

  // Where to focus — curated pins, else auto top-6 by closing %.
  const pinned = projects.filter((p) => p.focus);
  const curated = pinned.length > 0;
  type Proj = (typeof projects)[number];
  const byPriority = (a: Proj, b: Proj) =>
    b.closingPct - a.closingPct || oppValue(b) - oppValue(a);
  let focusList = (curated ? pinned : active).slice().sort(byPriority);
  if (!curated) focusList = focusList.slice(0, 6);

  return (
    <div className="section">
      <h1 className="page">Sales dashboard</h1>
      <p className="page-sub">The money-and-status ledger — one trustworthy view of what&apos;s quoted, what it&apos;s worth, and what we&apos;re winning. Files and comms stay in Basecamp.</p>

      <div className="tiles">
        <div className="tile"><div className="lab">Open pipeline</div><div className="val">{fmtK(totalPipe)}</div><div className="note">{active.length} active opportunities</div></div>
        <div className="tile"><div className="lab">Weighted forecast</div><div className="val">{fmtK(weighted)}</div><div className="note">by closing probability</div></div>
        <div className="tile"><div className="lab" style={{ color: "#1c6b1c" }}>Won</div><div className="val" style={{ color: "#1c6b1c" }}>{fmtK(soldVal)}</div><div className="note">{sold.length} projects awarded</div></div>
        <div className="tile"><div className="lab">Win rate ($)</div><div className="val">{winRate == null ? "—" : winRate + "%"}</div><div className="note">won ÷ decided quotes</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Where to focus</h3>
          {curated && <span className="curated-badge">★ Curated for the team · {pinned.length}</span>}
        </div>
        <p className="h-sub" style={{ marginTop: 6 }}>
          {curated
            ? "The opportunities pinned by an admin — this is where the team should focus."
            : "Auto-ranked by closing probability. " + (isAdmin ? "Pin opportunities (★) to set the list your team sees." : "An admin can pin the ones to focus on.")}
        </p>
        {focusList.map((p) => {
          const w = oppValue(p) * (p.closingPct / 100);
          return (
            <div className="focus-row" key={p.id}>
              <Link className="focus-main" href={`/projects/${p.id}`}>
                <span className="close-badge" style={{ color: pctColor(p.closingPct) }}>
                  <span className="dot" style={{ background: pctColor(p.closingPct) }} />{p.closingPct}%
                </span>
                <span>
                  <span style={{ fontWeight: 700 }}>{p.name}</span> <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>#{p.number}</span>
                  <div className="muted" style={{ fontSize: 12 }}>{p.contractor?.name || "—"} · {STAGE_LABEL[p.stage]} · {p.lastContact ? daysSince(p.lastContact) + "d since contact" : "no email logged"}</div>
                </span>
                <span className="num-cell" style={{ fontWeight: 700 }}>{fmtK(oppValue(p))}<div className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{fmtK(w)} weighted</div></span>
              </Link>
              {isAdmin ? (
                <form action={toggleFocus}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className={"pin " + (p.focus ? "on" : "")} title={p.focus ? "Unpin from team focus" : "Pin to team focus"} aria-label="Toggle team-focus pin">{p.focus ? "★" : "☆"}</button>
                </form>
              ) : (
                <span className={"pin readonly " + (p.focus ? "on" : "")}>{p.focus ? "★" : ""}</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Pipeline value by stage</h3>
          {byStage.map((s, i) => (
            <div className="barrow" key={i}>
              <div className="name">{s.label} <span className="muted">({s.n})</span></div>
              <div className="bartrack"><div className="barfill" style={{ width: (s.val / maxStage) * 100 + "%", background: "var(--brand)" }} /></div>
              <div className="amt">{fmtK(s.val)}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Top contractors</h3>
          {byGc.map(([g, v], i) => (
            <div className="barrow" key={i}>
              <div className="name" title={g}>{gcClient[g] && <span style={{ color: "#1c6b1c", fontWeight: 900, marginRight: 4 }}>●</span>}{g}</div>
              <div className="bartrack"><div className="barfill" style={{ width: (v / maxGc) * 100 + "%", background: gcClient[g] ? "var(--s6)" : "var(--brand-accent)" }} /></div>
              <div className="amt">{fmtK(v)}</div>
            </div>
          ))}
          <div className="legend"><span><i style={{ background: "var(--s6)" }} />Existing client</span></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Open pipeline by trade</h3>
        {byTrade.map(([t, v], i) => (
          <div className="barrow" key={i} style={{ gridTemplateColumns: "150px 1fr 92px" }}>
            <div className="name">{t}</div>
            <div className="bartrack"><div className="barfill" style={{ width: (v / maxTrade) * 100 + "%", background: "var(--brand)" }} /></div>
            <div className="amt">{fmtK(v)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
