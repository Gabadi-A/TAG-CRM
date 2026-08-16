import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { fmt, STAGE_LABEL } from "@/lib/format";
import { updateContractor, addContact, updateContact, deleteContact } from "@/lib/actions/records";

export const dynamic = "force-dynamic";

const cellInput = { margin: 0 } as const;

export default async function ContractorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const c = await prisma.contractor.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { name: "asc" } },
      projects: { include: { quotes: true }, orderBy: { closingPct: "desc" } },
    },
  });
  if (!c) notFound();
  const isClient = c.projects.some((p) => p.quotes.some((q) => q.status === "WON"));

  return (
    <div className="section">
      <p className="page-sub" style={{ marginBottom: 6 }}><Link href="/contractors">← Contractors</Link></p>
      <h1 className="page">{c.name}</h1>
      <p className="page-sub">
        <span className={"rel " + (isClient ? "client" : "prospect")}>{isClient ? "Client" : "Prospect"}</span>
        {" "}· {c.projects.length} project{c.projects.length === 1 ? "" : "s"}
      </p>

      {isAdmin ? (
        <form action={updateContractor} className="card" style={{ marginBottom: 16, maxWidth: 620 }}>
          <input type="hidden" name="id" value={c.id} />
          <div className="field"><label>Name</label><input name="name" defaultValue={c.name} /></div>
          <div className="field"><label>Address</label><input name="address" defaultValue={c.address || ""} /></div>
          <div className="field"><label>Notes (tax info, “just furnish”, billing quirks…)</label><textarea name="notes" defaultValue={c.notes || ""} /></div>
          <button className="btn" type="submit">Save details</button>
        </form>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="kv">
            <div className="k">Address</div><div>{c.address || "—"}</div>
            <div className="k">Notes</div><div style={{ whiteSpace: "pre-line" }}>{c.notes || "—"}</div>
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="sub-h" style={{ marginTop: 0 }}>Contacts</div>
          {c.contacts.length === 0 && <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>No contacts yet.</div>}
          {c.contacts.map((ct) => (
            <div key={ct.id} style={{ border: "1px solid var(--line)", borderRadius: 9, padding: "10px 12px", marginBottom: 8 }}>
              {isAdmin ? (
                <>
                  <form action={updateContact} className="frow" style={{ marginBottom: 6, alignItems: "flex-end" }}>
                    <input type="hidden" name="id" value={ct.id} />
                    <div className="field" style={cellInput}><input name="name" defaultValue={ct.name} placeholder="Name" /></div>
                    <div className="field" style={cellInput}><input name="email" defaultValue={ct.email || ""} placeholder="Email" /></div>
                    <div className="field" style={cellInput}><input name="phone" defaultValue={ct.phone || ""} placeholder="Phone" /></div>
                    <button className="btn ghost" type="submit">Save</button>
                  </form>
                  <form action={deleteContact}>
                    <input type="hidden" name="id" value={ct.id} />
                    <button className="linkbtn" style={{ color: "#a52222" }} type="submit">Remove</button>
                  </form>
                </>
              ) : (
                <div><b>{ct.name}</b>{ct.email && <span className="muted"> · {ct.email}</span>}{ct.phone && <span className="muted"> · {ct.phone}</span>}</div>
              )}
            </div>
          ))}
          {isAdmin && (
            <form action={addContact} className="frow" style={{ marginTop: 10, alignItems: "flex-end" }}>
              <input type="hidden" name="contractorId" value={c.id} />
              <div className="field" style={cellInput}><label>Add contact</label><input name="name" placeholder="Name" required /></div>
              <div className="field" style={cellInput}><input name="email" placeholder="Email" /></div>
              <div className="field" style={cellInput}><input name="phone" placeholder="Phone" /></div>
              <button className="btn" type="submit">Add</button>
            </form>
          )}
        </div>

        <div className="card">
          <div className="sub-h" style={{ marginTop: 0 }}>Projects ({c.projects.length})</div>
          {c.projects.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No projects yet.</div>}
          {c.projects.map((pr) => {
            const v = pr.quotes.reduce((s, q) => s + (q.value || 0), 0) || pr.value;
            return (
              <Link key={pr.id} href={`/projects/${pr.id}`} className="trade-row" style={{ display: "flex" }}>
                <span>{pr.name} <span className="muted">#{pr.number} · {STAGE_LABEL[pr.stage]}</span></span>
                <span className="val-sm">{fmt(v)}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
