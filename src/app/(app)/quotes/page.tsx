import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  fmt, fmtK, daysSince, isOpenQuote, quoteNumber,
  QUOTE_STATUS, QUOTE_STATUS_KEYS, TRADES, TRADE_LABEL,
} from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = { q?: string; trade?: string; status?: string; sort?: string; dir?: string };

export default async function QuotesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { q = "", trade = "", status = "", sort = "value", dir = "desc" } = await searchParams;

  const quotes = await prisma.quote.findMany({
    include: { project: { include: { contractor: true } } },
  });

  const rows0 = quotes.map((qt) => ({
    projectId: qt.projectId,
    id: quoteNumber(qt.project.number, qt.trade, qt.version),
    name: qt.project.name,
    number: qt.project.number,
    gc: qt.project.contractor?.name || "—",
    trade: TRADE_LABEL[qt.trade] || qt.trade,
    status: qt.status as string,
    value: qt.value,
    days: daysSince(qt.project.lastContact),
  }));

  const ql = q.toLowerCase();
  let rows = rows0.filter(
    (r) =>
      (!q || `${r.name} ${r.id} ${r.gc} ${r.trade}`.toLowerCase().includes(ql)) &&
      (!trade || r.trade === trade) &&
      (!status || r.status === status)
  );

  const dirMul = dir === "asc" ? 1 : -1;
  const key = sort as keyof (typeof rows0)[number];
  rows = rows.slice().sort((a, b) => {
    let va = a[key] as string | number | null;
    let vb = b[key] as string | number | null;
    if (va == null) va = -Infinity;
    if (vb == null) vb = -Infinity;
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dirMul;
    return ((va as number) - (vb as number)) * dirMul;
  });

  const openV = rows.filter((r) => isOpenQuote(r.status)).reduce((s, r) => s + r.value, 0);
  const wonV = rows.filter((r) => r.status === "WON").reduce((s, r) => s + r.value, 0);
  const lostV = rows.filter((r) => r.status === "LOST").reduce((s, r) => s + r.value, 0);
  const liveCount = rows.filter((r) => isOpenQuote(r.status)).length;

  const th = (k: string, label: string, right = false) => {
    const active = sort === k;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (trade) params.set("trade", trade);
    if (status) params.set("status", status);
    params.set("sort", k);
    params.set("dir", active && dir === "desc" ? "asc" : "desc");
    const arrow = active ? (dir === "desc" ? " ▼" : " ▲") : "";
    return (
      <th style={right ? { textAlign: "right" } : undefined}>
        <Link href={`/quotes?${params.toString()}`}>{label}{arrow}</Link>
      </th>
    );
  };

  return (
    <div className="section">
      <h1 className="page">Quotes</h1>
      <p className="page-sub">Every trade quote is its own line — <span className="mono">project·trade·version</span> — with its own status and value. One project can be part-won and part-lost at the same time.</p>

      <div className="tiles" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="tile"><div className="lab">Open value</div><div className="val">{fmtK(openV)}</div><div className="note">{liveCount} live quotes</div></div>
        <div className="tile"><div className="lab" style={{ color: "#1c6b1c" }}>Won</div><div className="val" style={{ color: "#1c6b1c" }}>{fmtK(wonV)}</div><div className="note">in current filter</div></div>
        <div className="tile"><div className="lab" style={{ color: "#a52222" }}>Lost</div><div className="val" style={{ color: "#a52222" }}>{fmtK(lostV)}</div><div className="note">in current filter</div></div>
      </div>

      <form className="toolbar" method="get">
        <input name="q" placeholder="Search quote #, project, GC…" defaultValue={q} />
        <select name="trade" defaultValue={trade}>
          <option value="">All trades</option>
          {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          {QUOTE_STATUS_KEYS.map((k) => <option key={k} value={k}>{QUOTE_STATUS[k].label}</option>)}
        </select>
        <button className="btn ghost" type="submit">Filter</button>
        <span className="pill-note">{rows.length} quotes</span>
      </form>

      <div className="table-wrap"><table>
        <thead>
          <tr>
            {th("id", "Quote #")}{th("name", "Project")}{th("trade", "Trade")}{th("gc", "Contractor")}
            {th("status", "Status")}{th("value", "Value", true)}{th("days", "Age", true)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const st = QUOTE_STATUS[r.status];
            return (
              <tr key={i} className="rowlink">
                <td className="mono"><Link href={`/projects/${r.projectId}`}>{r.id}</Link></td>
                <td style={{ fontWeight: 600 }}><Link href={`/projects/${r.projectId}`}>{r.name}</Link></td>
                <td>{r.trade}</td>
                <td>{r.gc}</td>
                <td><span className={"qs " + st.cls}>{st.label}</span></td>
                <td className="num-cell">{fmt(r.value)}</td>
                <td className="num-cell" style={{ color: r.days != null && r.days > 90 ? "#c0392b" : "var(--muted)" }}>
                  {!isOpenQuote(r.status) ? "—" : r.days == null ? "no email" : r.days + "d"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </div>
  );
}
