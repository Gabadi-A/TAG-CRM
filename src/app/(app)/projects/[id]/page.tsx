import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { STAGE_LABEL, fmt, pctColor, daysSince, TRADE_LABEL, QUOTE_STATUS, quoteNumber } from "@/lib/format";
import { createProposal } from "@/lib/actions/proposals";
import { logContact, toggleFocus } from "@/lib/actions/projects";
import OpportunityEditor from "@/components/OpportunityEditor";

export const dynamic = "force-dynamic";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      contractor: { include: { contacts: true } },
      contact: true,
      takeoffs: true,
      quotes: { orderBy: { value: "desc" } },
      proposals: { orderBy: { version: "desc" } },
    },
  });
  if (!p) notFound();
  const d = daysSince(p.lastContact);
  const oppValue = p.quotes.reduce((s, q) => s + (q.value || 0), 0);
  const contacts = (p.contractor?.contacts || []).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="section">
      <p className="page-sub" style={{ marginBottom: 6 }}><Link href="/projects">← Opportunities</Link></p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="page" style={{ margin: 0 }}>{p.name} <span className="muted" style={{ fontWeight: 400, fontSize: 16 }}>#{p.number}</span></h1>
        {isAdmin && (
          <form action={toggleFocus}>
            <input type="hidden" name="id" value={p.id} />
            <button className="btn ghost" style={p.focus ? { borderColor: "#e6c477", color: "#8a5a00" } : undefined}>{p.focus ? "★ Pinned — unpin" : "☆ Pin to team focus"}</button>
          </form>
        )}
        {!isAdmin && p.focus && <span className="curated-badge">★ Team focus</span>}
      </div>
      <p className="page-sub" style={{ marginTop: 6 }}>{p.contractor?.name || "—"} · {p.architect || "no architect"}</p>

      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <OpportunityEditor
            p={{
              id: p.id, name: p.name, gc: p.contractor?.name || "", contactId: p.contactId,
              architect: p.architect, ownerRep: p.ownerRep, stage: p.stage,
              closingPct: p.closingPct, value: p.value,
              lastContact: p.lastContact ? new Date(p.lastContact).toISOString().slice(0, 10) : null,
              notes: p.notes,
              nextStep: p.nextStep,
              followUpDate: p.followUpDate ? new Date(p.followUpDate).toISOString().slice(0, 10) : null,
            }}
            contacts={contacts}
          />
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="kv">
            <div className="k">Stage</div><div><span className="pill-note">{STAGE_LABEL[p.stage]}</span></div>
            <div className="k">Contractor</div><div>{p.contractor ? <Link href={`/contractors/${p.contractor.id}`}>{p.contractor.name}</Link> : "—"}</div>
            <div className="k">GC contact</div><div>{p.contact ? <>{p.contact.name}{p.contact.email && <span className="muted"> · {p.contact.email}</span>}</> : <span className="muted">—</span>}</div>
            <div className="k">Owner</div><div>{p.ownerRep || "—"}</div>
            <div className="k">Total value</div><div style={{ fontWeight: 700 }}>{fmt(oppValue || p.value)}</div>
            <div className="k">Closing %</div><div><span className="pct"><span className="dot" style={{ background: pctColor(p.closingPct) }} />{p.closingPct}%</span></div>
            <div className="k">Last contact</div>
            <div>
              {p.lastContact ? `${new Date(p.lastContact).toLocaleDateString("en-US")} (${d}d ago)` : "— no email logged"}
              {isAdmin && (
                <form action={logContact} style={{ display: "inline", marginLeft: 10 }}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="linkbtn" type="submit">Log today</button>
                </form>
              )}
            </div>
          </div>

          <div className="sub-h">Quotes · trade · version</div>
          {p.quotes.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No quotes yet.</div>}
          {p.quotes.map((q) => (
            <div className="trade-row" key={q.id}>
              <span><span className="mono">{quoteNumber(p.number, q.trade, q.version)}</span> · {TRADE_LABEL[q.trade]}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={"qs " + QUOTE_STATUS[q.status].cls}>{QUOTE_STATUS[q.status].label}</span>
                <span className="val-sm">{fmt(q.value)}</span>
              </span>
            </div>
          ))}

          <div className="sub-h">Takeoff status</div>
          {p.takeoffs.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No takeoffs yet.</div>}
          {p.takeoffs.map((t) => (
            <div className="trade-row" key={t.id}>
              <span>{TRADE_LABEL[t.trade]}</span>
              <span className={"tstat " + t.status}>{t.status.replace("_", " ")}</span>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="sub-h" style={{ marginTop: 0 }}>Proposals</div>
          {p.proposals.length === 0 && <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>No proposals yet.</div>}
          {p.proposals.map((pr) => (
            <Link key={pr.id} href={`/proposals/${pr.id}`} className="trade-row" style={{ display: "flex" }}>
              <span>{pr.quoteNumber} <span className="muted">· {pr.status}</span></span>
              <span className="val-sm">{new Date(pr.updatedAt).toLocaleDateString("en-US")}</span>
            </Link>
          ))}
          {isAdmin && (
            <form action={createProposal} style={{ marginTop: 12 }}>
              <input type="hidden" name="projectId" value={p.id} />
              <button className="btn" type="submit">+ New proposal</button>
            </form>
          )}

          <div className="sub-h">Notes</div>
          <div className="note-box">{p.notes || "—"}</div>
        </div>
      </div>
    </div>
  );
}
