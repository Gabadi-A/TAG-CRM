"use client";

import { useActionState } from "react";
import { createOpportunity } from "@/lib/actions/records";
import { STAGES } from "@/lib/format";

export default function NewOpportunityForm({ contractors }: { contractors: string[] }) {
  const [error, formAction, pending] = useActionState(createOpportunity, undefined);
  return (
    <form action={formAction} className="card" style={{ maxWidth: 620 }}>
      <div className="frow">
        <div className="field"><label>Project #</label><input name="number" placeholder="2896" required /></div>
        <div className="field" style={{ flex: "2 1 240px" }}><label>Project name</label><input name="name" placeholder="Project name" required /></div>
      </div>
      <div className="frow">
        <div className="field"><label>Contractor (GC)</label><input name="gc" list="gc-list" placeholder="Type or pick a GC" /></div>
        <div className="field"><label>Architect</label><input name="architect" placeholder="Architect" /></div>
      </div>
      <datalist id="gc-list">{contractors.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="frow">
        <div className="field"><label>Owner (rep)</label><input name="ownerRep" placeholder="Gabriel" /></div>
        <div className="field"><label>Stage</label>
          <select name="stage" defaultValue="TRIAGE">{STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        </div>
        <div className="field"><label>Close %</label><input name="closingPct" type="number" min="0" max="100" defaultValue="50" /></div>
        <div className="field"><label>Value ($)</label><input name="value" placeholder="1500000" /></div>
      </div>
      <div className="field"><label>Notes</label><textarea name="notes" placeholder="Anything worth remembering…" /></div>
      {error && <div className="auth-err" style={{ marginBottom: 12 }}>{error}</div>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Creating…" : "Create opportunity"}</button>
    </form>
  );
}
