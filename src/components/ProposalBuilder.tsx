"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import ProposalDoc from "./ProposalDoc";
import { saveProposal, type SaveInput } from "@/lib/actions/proposals";
import { TRADES } from "@/lib/format";

type Row = Record<string, string>;
export type InitialProposal = {
  id: string;
  projectNumber: string;
  tradeCode: string;
  version: number;
  discountPct: number;
  salesTax: number;
  header: { bill: string; contact: string; email: string; proj: string; addr: string; date: string };
  summary: { label: string; note: string; amount: number }[];
  alternates: { label: string; amount: number }[];
  scopes: { trade: string; includePhase: boolean; phase: string; products: { label: string; qty: string }[]; material: { label: string; value: string }[] }[];
};

export default function ProposalBuilder({ initial }: { initial: InitialProposal }) {
  const [tradeCode, setTradeCode] = useState(initial.tradeCode);
  const [ver, setVer] = useState(String(initial.version));
  const [discountPct, setDiscountPct] = useState(String(initial.discountPct || 0));
  const [salesTax, setSalesTax] = useState(String(initial.salesTax || 0));
  const [hdr, setHdr] = useState(initial.header);
  const [summary, setSummary] = useState(initial.summary.map((s) => ({ label: s.label, note: s.note, amount: String(s.amount) })));
  const [alts, setAlts] = useState(initial.alternates.map((a) => ({ label: a.label, amount: String(a.amount) })));
  const [scopes, setScopes] = useState(
    initial.scopes.map((s) => ({ trade: s.trade, includePhase: s.includePhase, phase: s.phase, products: s.products.map((p) => ({ ...p })), material: s.material.map((m) => ({ ...m })) }))
  );
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const quote = `${initial.projectNumber}.${tradeCode}.${ver}`;
  const move = <T,>(list: T[], set: (v: T[]) => void, i: number, dir: number) => {
    const j = i + dir; if (j < 0 || j >= list.length) return;
    const c = list.slice(); const t = c[i]; c[i] = c[j]; c[j] = t; set(c);
  };

  const docData = {
    header: { ...hdr, quote },
    summary, alternates: alts, scopes, discountPct, salesTax,
  };

  const onSave = () => {
    const payload: SaveInput = {
      id: initial.id, tradeCode, version: ver, discountPct, salesTax,
      header: { quote, date: hdr.date, bill: hdr.bill, contact: hdr.contact, email: hdr.email, proj: hdr.proj, addr: hdr.addr },
      summary, alternates: alts, scopes,
    };
    startTransition(async () => {
      await saveProposal(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  };

  return (
    <div className="section">
      <p className="page-sub no-print" style={{ marginBottom: 6 }}>
        <Link href={`/proposals`}>← Proposals</Link>
      </p>
      <h1 className="page no-print">Proposal builder <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>· {quote}</span></h1>
      <p className="page-sub no-print">Edit any row or section on the left; the document updates live. Save writes to the database; PDF prints the document.</p>
      <div className="prop-shell">
        <div className="prop-panel no-print">
          <div className="ed-h" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>Quote</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label>Trade code</label><input value={tradeCode} onChange={(e) => setTradeCode(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label>Version</label><input value={ver} onChange={(e) => setVer(e.target.value)} /></div>
          </div>
          <div style={{ margin: "8px 0", padding: "8px 10px", background: "var(--tan-lt)", borderRadius: 8, fontSize: 12 }}>Quote # <b>{quote}</b></div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}><label>Package discount %</label><input value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} /></div>
            <div style={{ flex: 1 }}><label>Sales tax $</label><input value={salesTax} onChange={(e) => setSalesTax(e.target.value)} /></div>
          </div>

          <div className="ed-h">Header fields</div>
          <label>Bill to (contractor)</label><input value={hdr.bill} onChange={(e) => setHdr({ ...hdr, bill: e.target.value })} />
          <label>Contact</label><input value={hdr.contact} onChange={(e) => setHdr({ ...hdr, contact: e.target.value })} />
          <label>Email</label><input value={hdr.email} onChange={(e) => setHdr({ ...hdr, email: e.target.value })} />
          <label>Project name</label><input value={hdr.proj} onChange={(e) => setHdr({ ...hdr, proj: e.target.value })} />
          <label>Project address</label><input value={hdr.addr} onChange={(e) => setHdr({ ...hdr, addr: e.target.value })} />
          <label>Date</label><input value={hdr.date} onChange={(e) => setHdr({ ...hdr, date: e.target.value })} />

          <div className="ed-h">Price summary <span className="muted" style={{ fontWeight: 400, textTransform: "none" }}>· grand total auto-sums</span></div>
          {summary.map((l, i) => (
            <div className="erow" key={i}>
              <input value={l.label} onChange={(e) => setSummary((a) => a.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} placeholder="Line" />
              <input className="amt-in" value={l.amount} onChange={(e) => setSummary((a) => a.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))} placeholder="$" />
              <button className="ic" onClick={() => move(summary, setSummary, i, -1)}>↑</button>
              <button className="ic" onClick={() => move(summary, setSummary, i, 1)}>↓</button>
              <button className="ic rm" onClick={() => setSummary((a) => a.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="addline" onClick={() => setSummary((a) => [...a, { label: "New line", note: "", amount: "0" }])}>+ Add summary line</button>

          <div className="ed-h">Alternates / VE</div>
          {alts.map((l, i) => (
            <div className="erow" key={i}>
              <input value={l.label} onChange={(e) => setAlts((a) => a.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} placeholder="Alternate" />
              <input className="amt-in" value={l.amount} onChange={(e) => setAlts((a) => a.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))} placeholder="$" />
              <button className="ic rm" onClick={() => setAlts((a) => a.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="addline" onClick={() => setAlts((a) => [...a, { label: "New alternate", amount: "0" }])}>+ Add alternate</button>

          {scopes.map((sc, si) => {
            const patch = (p: Partial<typeof sc>) => setScopes((a) => a.map((s, j) => (j === si ? { ...s, ...p } : s)));
            return (
              <div key={si}>
                <div className="ed-h" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Scope: {sc.trade || "—"}</span>
                  <button className="ic rm" onClick={() => setScopes((a) => a.filter((_, j) => j !== si))}>✕</button>
                </div>
                <label>Trade name</label>
                <input value={sc.trade} onChange={(e) => patch({ trade: e.target.value })} />
                <label>Products &amp; quantities</label>
                {sc.products.map((r: Row, i: number) => (
                  <div className="erow" key={i}>
                    <input value={r.label} onChange={(e) => patch({ products: sc.products.map((x, m) => (m === i ? { ...x, label: e.target.value } : x)) })} placeholder="Product" />
                    <input className="qty-in" value={r.qty} onChange={(e) => patch({ products: sc.products.map((x, m) => (m === i ? { ...x, qty: e.target.value } : x)) })} placeholder="Qty" />
                    <button className="ic rm" onClick={() => patch({ products: sc.products.filter((_, m) => m !== i) })}>✕</button>
                  </div>
                ))}
                <button className="addline" onClick={() => patch({ products: [...sc.products, { label: "New product", qty: "" }] })}>+ Add product</button>
                <label>Material info</label>
                {sc.material.map((r: Row, i: number) => (
                  <div className="erow" key={i}>
                    <input value={r.label} onChange={(e) => patch({ material: sc.material.map((x, m) => (m === i ? { ...x, label: e.target.value } : x)) })} placeholder="Attribute" />
                    <input value={r.value} onChange={(e) => patch({ material: sc.material.map((x, m) => (m === i ? { ...x, value: e.target.value } : x)) })} placeholder="Value" />
                    <button className="ic rm" onClick={() => patch({ material: sc.material.filter((_, m) => m !== i) })}>✕</button>
                  </div>
                ))}
                <button className="addline" onClick={() => patch({ material: [...sc.material, { label: "New attribute", value: "" }] })}>+ Add material row</button>
                <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 12 }}>
                  <input type="checkbox" style={{ width: "auto" }} checked={sc.includePhase} onChange={(e) => patch({ includePhase: e.target.checked })} />
                  Include work phase &amp; exclusions
                </label>
                {sc.includePhase && <textarea value={sc.phase} onChange={(e) => patch({ phase: e.target.value })} />}
              </div>
            );
          })}
          <button className="addline" style={{ marginTop: 8 }} onClick={() => setScopes((a) => [...a, { trade: "New trade", includePhase: true, phase: "Pre-production · Production · Installation NOT in base price · Exclusions: sales tax.", products: [{ label: "Item", qty: "" }], material: [{ label: "Attribute", value: "" }] }])}>+ Add trade scope</button>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button className="btn" style={{ flex: 1 }} onClick={onSave} disabled={pending}>{pending ? "Saving…" : saved ? "Saved ✓" : "Save"}</button>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => window.print()}>⤓ PDF</button>
          </div>
        </div>

        <ProposalDoc data={docData} />
      </div>
    </div>
  );
}
