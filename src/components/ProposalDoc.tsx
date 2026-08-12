import Logo from "./Logo";
import { fmt, fmtAmt, money } from "@/lib/format";
import { grandTotal, discountAmount } from "@/lib/calc";

export type DocData = {
  header: { bill: string; contact: string; email: string; proj: string; addr: string; date: string; quote: string };
  summary: { label: string; note?: string; amount: number | string }[];
  alternates: { label: string; amount: number | string }[];
  scopes: {
    trade: string;
    includePhase: boolean;
    phase: string;
    products: { label: string; qty: string }[];
    material: { label: string; value: string }[];
  }[];
  discountPct: number | string;
  salesTax: number | string;
};

export default function ProposalDoc({ data }: { data: DocData }) {
  const disc = Number(data.discountPct) || 0;
  const tax = money(data.salesTax);
  const grand = grandTotal(data.summary, disc, tax);
  const discVal = discountAmount(data.summary, disc);
  return (
    <div className="doc" id="proposal-doc">
      <div className="doc-inner">
        <div className="doc-head">
          <div className="doc-co">
            <b>THE ABADI GROUP</b><br />
            151 Industrial Way East, Suite A5<br />
            Eatontown, NJ 07724<br />
            <span className="muted">www.theabadigroup.com</span>
          </div>
          <div style={{ textAlign: "right" }}><Logo /></div>
        </div>
        <div className="doc-grid">
          <div><div className="lab">Bill To</div>{data.header.bill}<br /><span className="muted">{data.header.contact}</span><br /><span className="muted">{data.header.email}</span></div>
          <div><div className="lab">Project</div>{data.header.proj}<br /><span className="muted">{data.header.addr}</span><br /><span className="muted">Quote #{data.header.quote}</span></div>
          <div><div className="lab">Date</div>{data.header.date}<br /><span className="muted">Total {fmt(grand)}</span></div>
        </div>

        <div className="doc-band">Summary Proposal</div>
        {data.summary.map((l, i) => (
          <div className="pl" key={i}>
            <span>{l.label}</span>
            <span className="n muted">{l.note || ""}</span>
            <span className="n">{money(l.amount) ? fmt(money(l.amount)) : "—"}</span>
          </div>
        ))}
        {disc > 0 && (
          <div className="pl"><span className="muted">Discount for package pricing ({disc}%)</span><span></span><span className="n">{fmtAmt(discVal)}</span></div>
        )}
        {tax > 0 && (
          <div className="pl"><span className="muted">Sales Tax</span><span></span><span className="n">{fmt(tax)}</span></div>
        )}
        <div className="pl tot"><span>Grand Total</span><span></span><span className="n">{fmt(grand)}</span></div>
        {tax === 0 && <div style={{ fontSize: 10 }} className="muted">Sales Tax (not included)</div>}

        {data.alternates.length > 0 && <div className="doc-band">Alternates / VE</div>}
        {data.alternates.map((a, i) => (
          <div className="scope-line" key={i}><span>{a.label}</span><span className="n">{fmtAmt(money(a.amount))}</span></div>
        ))}

        {data.scopes.map((s, i) => (
          <div key={i}>
            <div className="doc-band">{s.trade} Scope — Products &amp; Quantities</div>
            {s.products.map((r, j) => (
              <div className="scope-line" key={j}><span>{r.label}</span><span className="n">{r.qty}</span></div>
            ))}
            {s.material.length > 0 && <div className="doc-band">Material Info</div>}
            {s.material.map((r, j) => (
              <div className="scope-line" key={j}><span>{r.label}</span><span className="n">{r.value}</span></div>
            ))}
            {s.includePhase && <div className="doc-band">Work Phase &amp; Exclusions</div>}
            {s.includePhase && <div className="phase-text">{s.phase}</div>}
          </div>
        ))}

        <div style={{ textAlign: "center", marginTop: 22, fontSize: 11 }} className="muted">
          THE ABADI GROUP — If you have any questions about this quote, please contact us
        </div>
      </div>
    </div>
  );
}
