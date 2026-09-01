import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { STAGE_LABEL, fmt, pctColor, daysSince, TRADE_LABEL, QUOTE_STATUS, QUOTE_STATUS_KEYS, quoteNumber } from "@/lib/format";
import { logContact, toggleFocus } from "@/lib/actions/projects";
import { addQuote, updateQuote, deleteQuote, setTakeoff, addTakeoff, deleteTakeoff } from "@/lib/actions/records";
import OpportunityEditor from "@/components/OpportunityEditor";

export const dynamic = "force-dynamic";

const TRADE_OPTS = Object.entries(TRADE_LABEL);
const TAKEOFF_OPTS: [string, string][] = [["PENDING", "Pending"], ["IN_PROGRESS", "In progress"], ["READY", "Ready"]];
const cell = { margin: 0 } as const;

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
        {p.proposalUrl && <a className="btn ghost" href={p.proposalUrl} target="_blank" rel="noreferrer">⤓ Open proposal ↗</a>}
        {p.basecampUrl && <a className="btn ghost" href={p.basecampUrl} target="_blank" rel="noreferrer" style={{ background: "#1d2d35", color: "#fff", borderColor: "#1d2d35" }}>⬒ Open in Basecamp ↗</a>}
      </div>
      <p className="page-sub" style={{ marginTop: 6 }}>{p.contractor?.name || "—"} · {p.architect || "no architect"}{p.basecampColumn && <> · <span className="pill-note" style={{ background: "#eef1f5", color: "#41556e" }}>Estimating: {p.basecampColumn}</span></>}</p>

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
              dueDate: p.dueDate ? new Date(p.dueDate).toISOString().slice(0, 10) : null,
              proposalUrl: p.proposalUrl,
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
            <div className="k">Total value</div><div style={{ fontWeight: 700 }}>{fmt(oppValue || p.value)} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>(sum of quotes)</span></div>
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

          <div className="sub-h">Quotes <span className="muted" style={{ fontWeight: 400, textTransform: "none" }}>· trade · version · value · status</span></div>
          {!isAdmin && p.quotes.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No quotes yet.</div>}
          {!isAdmin && p.quotes.map((q) => (
            <div className="trade-row" key={q.id}>
              <span><span className="mono">{quoteNumber(p.number, q.trade, q.version)}</span> · {TRADE_LABEL[q.trade]}</span>
              <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={"qs " + QUOTE_STATUS[q.status].cls}>{QUOTE_STATUS[q.status].label}</span>
                <span className="val-sm">{fmt(q.value)}</span>
              </span>
            </div>
          ))}
          {isAdmin && p.quotes.map((q) => (
            <div key={q.id} style={{ marginBottom: 8 }}>
              <form action={updateQuote} className="frow" style={{ gap: 6, alignItems: "flex-end", marginBottom: 3 }}>
                <input type="hidden" name="id" value={q.id} /><input type="hidden" name="projectId" value={p.id} />
                <div className="field" style={{ ...cell, flex: "1 1 130px" }}><select name="trade" defaultValue={q.trade}>{TRADE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div className="field" style={{ ...cell, flex: "0 0 54px" }}><input name="version" type="number" min="1" defaultValue={q.version} /></div>
                <div className="field" style={{ ...cell, flex: "0 0 100px" }}><input name="value" defaultValue={q.value} /></div>
                <div className="field" style={{ ...cell, flex: "1 1 120px" }}><select name="status" defaultValue={q.status}>{QUOTE_STATUS_KEYS.map((k) => <option key={k} value={k}>{QUOTE_STATUS[k].label}</option>)}</select></div>
                <button className="btn ghost" type="submit">Save</button>
              </form>
              <form action={deleteQuote}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="projectId" value={p.id} /><button className="linkbtn" style={{ color: "#a52222" }} type="submit">Remove</button></form>
            </div>
          ))}
          {isAdmin && (
            <form action={addQuote} className="frow" style={{ gap: 6, alignItems: "flex-end", marginTop: 10 }}>
              <input type="hidden" name="projectId" value={p.id} />
              <div className="field" style={{ ...cell, flex: "1 1 130px" }}><label>Add quote</label><select name="trade">{TRADE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="field" style={{ ...cell, flex: "0 0 54px" }}><input name="version" type="number" min="1" defaultValue={1} /></div>
              <div className="field" style={{ ...cell, flex: "0 0 100px" }}><input name="value" placeholder="$ value" /></div>
              <div className="field" style={{ ...cell, flex: "1 1 120px" }}><select name="status" defaultValue="DRAFT">{QUOTE_STATUS_KEYS.map((k) => <option key={k} value={k}>{QUOTE_STATUS[k].label}</option>)}</select></div>
              <button className="btn" type="submit">Add</button>
            </form>
          )}

          <div className="sub-h">Takeoff status</div>
          {!isAdmin && p.takeoffs.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No takeoffs yet.</div>}
          {!isAdmin && p.takeoffs.map((t) => (
            <div className="trade-row" key={t.id}><span>{TRADE_LABEL[t.trade]}</span><span className={"tstat " + t.status}>{t.status.replace("_", " ")}</span></div>
          ))}
          {isAdmin && p.takeoffs.map((t) => (
            <div key={t.id} className="frow" style={{ gap: 6, alignItems: "center", marginBottom: 6 }}>
              <span style={{ flex: "1 1 120px", fontSize: 13 }}>{TRADE_LABEL[t.trade]}</span>
              <form action={setTakeoff} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="hidden" name="id" value={t.id} /><input type="hidden" name="projectId" value={p.id} />
                <select name="status" defaultValue={t.status} className="pill-note" style={{ padding: "4px 8px" }}>{TAKEOFF_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <button className="btn ghost" type="submit">Save</button>
              </form>
              <form action={deleteTakeoff}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="projectId" value={p.id} /><button className="linkbtn" style={{ color: "#a52222" }} type="submit">✕</button></form>
            </div>
          ))}
          {isAdmin && (
            <form action={addTakeoff} className="frow" style={{ gap: 6, alignItems: "flex-end", marginTop: 8 }}>
              <input type="hidden" name="projectId" value={p.id} />
              <div className="field" style={{ ...cell, flex: "1 1 130px" }}><label>Add takeoff</label><select name="trade">{TRADE_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="field" style={{ ...cell, flex: "1 1 120px" }}><select name="status" defaultValue="PENDING">{TAKEOFF_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <button className="btn" type="submit">Add</button>
            </form>
          )}
        </div>

        <div className="card">
          <div className="sub-h" style={{ marginTop: 0 }}>Proposal</div>
          {p.proposalUrl ? (
            <a className="btn" href={p.proposalUrl} target="_blank" rel="noreferrer">⤓ Open proposal ↗</a>
          ) : (
            <div className="muted" style={{ fontSize: 13 }}>No proposal attached.{isAdmin && " Paste the Dropbox link in “Edit details” above."}</div>
          )}

          <div className="sub-h">Notes</div>
          <div className="note-box">{p.notes || "—"}</div>
        </div>
      </div>
    </div>
  );
}
