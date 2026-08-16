"use client";

import { useActionState } from "react";
import { createContractor } from "@/lib/actions/records";

export default function NewContractorForm() {
  const [error, formAction, pending] = useActionState(createContractor, undefined);
  return (
    <form action={formAction} className="card" style={{ maxWidth: 560 }}>
      <div className="field"><label>Contractor name</label><input name="name" placeholder="e.g. Levine Builders" required /></div>
      <div className="field"><label>Address</label><input name="address" placeholder="Street, city, state" /></div>
      <div className="field"><label>Notes</label><textarea name="notes" placeholder="Tax info, “just furnish”, billing quirks — anything that applies to every job with this GC." /></div>
      {error && <div className="auth-err" style={{ marginBottom: 12 }}>{error}</div>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Creating…" : "Create contractor"}</button>
    </form>
  );
}
