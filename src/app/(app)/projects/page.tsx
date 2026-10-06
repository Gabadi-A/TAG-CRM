import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { STAGE_LABEL, fmt, pctColor } from "@/lib/format";
import { toggleFocus } from "@/lib/actions/projects";

export const dynamic = "force-dynamic";

type QuoteLite = { value: number; status: string };
const oppValue = (p: { quotes: QuoteLite[] }) => p.quotes.reduce((s, q) => s + (q.value || 0), 0);

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; gc?: string; sort?: string; dir?: string; quoted?: string }>;
}) {
  const { q = "", gc = "", sort = "closing", dir = "desc", quoted = "" } = await searchParams;
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [projects, contractors] = await Promise.all([
    prisma.project.findMany({ include: { contractor: true, quotes: true } }),
    prisma.contractor.findMany({ orderBy: { name: "asc" } }),
  ]);
  const ql = q.toLowerCase();
  const mapped = projects
    .filter((p) => {
      const hay = `${p.number} ${p.name} ${p.contractor?.name || ""} ${p.ownerRep || ""}`.toLowerCase();
      const quotedOk = quoted === "no" ? p.quotes.length === 0 : quoted === "yes" ? p.quotes.length > 0 : true;
      return (!q || hay.includes(ql)) && (!gc || p.contractor?.name === gc) && quotedOk;
    })
    .map((p) => ({
      p,
      num: parseInt(p.number.replace(/[^0-9]/g, ""), 10) || 0,
      name: p.name,
      gc: p.contractor?.name || "",
      resp: p.ownerRep || "",
      stage: STAGE_LABEL[p.stage] || p.stage,
      quotes: p.quotes.length,
      closing: p.closingPct,
      val: oppValue(p) || p.value || 0,
    }));

  const key = sort as keyof (typeof mapped)[number];
  const dirMul = dir === "asc" ? 1 : -1;
  mapped.sort((a, b) => {
    const va = a[key] as string | number;
    const vb = b[key] as string | number;
    let r: number;
    if (typeof va === "string" && typeof vb === "string") r = va.localeCompare(vb);
    else r = (va as number) - (vb as number);
    if (r !== 0) return r * dirMul;
    return b.val - a.val; // tiebreak: higher value first
  });

  const liveRows = mapped.filter((m) => m.p.stage !== "SOLD");
  const soldRows = mapped.filter((m) => m.p.stage === "SOLD");
  const soldTotal = soldRows.reduce((s, m) => s + m.val, 0);

  const renderRow = ({ p }: (typeof mapped)[number]) => {
    const won = p.quotes.filter((x) => x.status === "WON").length;
    const lost = p.quotes.filter((x) => x.status === "LOST").length;
    return (
      <tr key={p.id} className="rowlink">
        <td style={{ textAlign: "center" }}>
          {isAdmin ? (
            <form action={toggleFocus}>
              <input type="hidden" name="id" value={p.id} />
              <button className={"pin " + (p.focus ? "on" : "")} aria-label="Toggle team-focus pin" title={p.focus ? "Unpin from team focus" : "Pin to team focus"}>{p.focus ? "★" : "☆"}</button>
            </form>
          ) : (
            <span className={"pin readonly " + (p.focus ? "on" : "")}>{p.focus ? "★" : ""}</span>
          )}
        </td>
        <td className="muted"><Link href={`/projects/${p.id}`}>{p.number}</Link></td>
        <td style={{ fontWeight: 600 }}><Link href={`/projects/${p.id}`}>{p.name}</Link></td>
        <td>{p.contractor?.name || "—"}</td>
        <td>{p.ownerRep || "—"}</td>
        <td><span className="pill-note">{STAGE_LABEL[p.stage]}</span></td>
        <td className="num-cell">{p.quotes.length === 0 ? <span className="tag-nq">Not quoted</span> : <>{p.quotes.length}{won > 0 && <span style={{ color: "#1c6b1c" }}> ·{won}W</span>}{lost > 0 && <span style={{ color: "#a52222" }}> ·{lost}L</span>}</>}</td>
        <td className="num-cell"><span className="pct" style={{ justifyContent: "flex-end" }}><span className="dot" style={{ background: pctColor(p.closingPct) }} />{p.closingPct}%</span></td>
        <td className="num-cell">{fmt(oppValue(p) || p.value)}</td>
      </tr>
    );
  };

  const numericCols = ["num", "quotes", "closing", "val"];
  const th = (k: string, label: string, right = false) => {
    const active = sort === k;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (gc) params.set("gc", gc);
    if (quoted) params.set("quoted", quoted);
    params.set("sort", k);
    params.set("dir", active ? (dir === "asc" ? "desc" : "asc") : numericCols.includes(k) ? "desc" : "asc");
    const arrow = active ? (dir === "desc" ? " ▼" : " ▲") : "";
    return (
      <th style={right ? { textAlign: "right" } : undefined}>
        <Link href={`/projects?${params.toString()}`}>{label}{arrow}</Link>
      </th>
    );
  };

  const headRow = (
    <tr>
      <th style={{ width: 32, textAlign: "center", color: "#c9a24a" }} title="Pinned to team focus">★</th>
      {th("num", "#")}{th("name", "Project")}{th("gc", "Contractor")}{th("resp", "Owner")}{th("stage", "Stage")}
      {th("quotes", "Quotes", true)}{th("closing", "Close %", true)}{th("val", "Value", true)}
    </tr>
  );

  const notQuoted = projects.filter((p) => p.quotes.length === 0 && p.stage !== "DEAD" && p.stage !== "SOLD").length;

  return (
    <div className="section">
      <h1 className="page">Opportunities</h1>
      <p className="page-sub">The master list — every opportunity and its quotes in one place. Click any column heading to sort it — click again to flip the order. Star an opportunity to pin it to the team&apos;s focus board.</p>
      {notQuoted > 0 && (
        <div className="banner" style={{ background: "#fff4e0", borderColor: "#e4b55a" }}>
          ⚠ {notQuoted} active {notQuoted === 1 ? "opportunity has" : "opportunities have"} no quote yet.{" "}
          <Link href="/projects?quoted=no" style={{ fontWeight: 700 }}>Show the ones that need quoting →</Link>
        </div>
      )}
      <form className="toolbar" method="get">
        <input name="q" placeholder="Search project, #, GC, rep…" defaultValue={q} />
        <select name="gc" defaultValue={gc}>
          <option value="">All contractors</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <select name="quoted" defaultValue={quoted}>
          <option value="">Quoted &amp; not quoted</option>
          <option value="no">Not quoted yet</option>
          <option value="yes">Has a quote</option>
        </select>
        <button className="btn ghost" type="submit">Filter</button>
        <span className="pill-note">{liveRows.length} active{soldRows.length ? ` · ${soldRows.length} sold` : ""}</span>
        {isAdmin && <Link href="/projects/new" className="btn" style={{ marginLeft: "auto" }}>+ New opportunity</Link>}
      </form>
      <div className="table-wrap"><table>
        <thead>{headRow}</thead>
        <tbody>
          {liveRows.length === 0 ? (
            <tr><td colSpan={9} className="muted" style={{ padding: 16 }}>No active opportunities match.</td></tr>
          ) : (
            liveRows.map(renderRow)
          )}
        </tbody>
      </table></div>

      {soldRows.length > 0 && (
        <details className="card sold-fold" style={{ marginTop: 16 }}>
          <summary>
            <span>Sold <span className="muted" style={{ fontWeight: 400 }}>— closed won, click to open</span></span>
            <span className="pill-note">{soldRows.length} · {fmt(soldTotal)}</span>
          </summary>
          <div className="table-wrap" style={{ marginTop: 12 }}><table>
            <thead>{headRow}</thead>
            <tbody>{soldRows.map(renderRow)}</tbody>
          </table></div>
        </details>
      )}
    </div>
  );
}
