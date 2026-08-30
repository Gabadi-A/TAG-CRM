"use client";

import { useActionState } from "react";
import { importEstimatingCardTable } from "@/lib/actions/basecamp";

export default function ImportEstimating() {
  const [result, action, pending] = useActionState(importEstimatingCardTable, undefined);
  return (
    <div style={{ margin: "6px 0 18px" }}>
      <form action={action}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Importing… (this can take a minute)" : "Import Estimating card table"}</button>
      </form>
      {result?.error && <div className="banner" style={{ marginTop: 10 }}>Import failed: {result.error}</div>}
      {result && !result.error && (
        <div className="info-banner" style={{ marginTop: 10 }}>
          Imported from {result.columns} columns — <b>{result.created} new</b>, <b>{result.updated} updated</b>
          {result.skipped ? `, ${result.skipped} skipped (template cards / no number)` : ""}. Each opportunity now has its board column and an “Open in Basecamp” link.
        </div>
      )}
    </div>
  );
}
