"use client";

import { useState } from "react";
import { updateOpportunity } from "@/lib/actions/records";
import { STAGES } from "@/lib/format";

type Contact = { id: string; name: string };
type P = {
  id: string; name: string; gc: string; contactId: string | null;
  architect: string | null; ownerRep: string | null; stage: string;
  closingPct: number; value: number | null; lastContact: string | null; notes: string | null;
};

export default function OpportunityEditor({ p, contacts }: { p: P; contacts: Contact[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="btn ghost" onClick={() => setOpen(true)}>Edit details</button>;
  return (
    <form action={updateOpportunity} className="card" style={{ marginBottom: 16 }}>
      <input type="hidden" name="id" value={p.id} />
      <div className="frow">
        <div className="field" style={{ flex: "2 1 240px" }}><label>Project name</label><input name="name" defaultValue={p.name} /></div>
        <div className="field"><label>Contractor (GC)</label><input name="gc" defaultValue={p.gc} /></div>
      </div>
      <div className="frow">
        <div className="field"><label>GC contact</label>
          <select name="contactId" defaultValue={p.contactId || ""}>
            <option value="">— none —</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Architect</label><input name="architect" defaultValue={p.architect || ""} /></div>
        <div className="field"><label>Owner (rep)</label><input name="ownerRep" defaultValue={p.ownerRep || ""} /></div>
      </div>
      <div className="frow">
        <div className="field"><label>Stage</label>
          <select name="stage" defaultValue={p.stage}>{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </div>
        <div className="field"><label>Close %</label><input name="closingPct" type="number" min="0" max="100" defaultValue={p.closingPct} /></div>
        <div className="field"><label>Value ($)</label><input name="value" defaultValue={p.value ?? ""} /></div>
        <div className="field"><label>Last contact</label><input name="lastContact" type="date" defaultValue={p.lastContact || ""} /></div>
      </div>
      <div className="field"><label>Notes</label><textarea name="notes" defaultValue={p.notes || ""} /></div>
      <div className="row-actions">
        <button className="btn" type="submit">Save changes</button>
        <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
