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
  searchParams: Promise<{ q?: string; gc?: string }>;
}) {
  const { q = "", gc = "" } = await searchParams;
  const session = await auth();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [projects, contractors] = await Promise.all([
    prisma.project.findMany({
      include: { contractor: true, quotes: true },
      orderBy: [{ closingPct: "desc" }, { value: "desc" }],
    }),
    prisma.contractor.findMany({ orderBy: { name: "asc" } }),
  ]);
  const ql = q.toLowerCase();
  const rows = projects.filter((p) => {
    const hay = `${p.number} ${p.name} ${p.contractor?.name || ""} ${p.ownerRep || ""}`.toLowerCase();
    return (!q || hay.includes(ql)) && (!gc || p.contractor?.name === gc);
  });

  return (
    <div className="section">
      <h1 className="page">Opportunities</h1>
      <p className="page-sub">The master list — sorted by closing probability so the best bets sit on top. Star an opportunity to pin it to the team&apos;s focus board.</p>
      <form className="toolbar" method="get">
        <input name="q" placeholder="Search project, #, GC, rep…" defaultValue={q} />
        <select name="gc" defaultValue={gc}>
          <option value="">All contractors</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button className="btn ghost" type="submit">Filter</button>
        <span className="pill-note">{rows.length} opportunities</span>
      </form>
      <table>
        <thead>
          <tr>
            <th style={{ width: 32, textAlign: "center", color: "#c9a24a" }} title="Pinned to team focus">★</th>
            <th>#</th><th>Project</th><th>Contractor</th><th>Owner</th><th>Stage</th><th style={{ textAlign: "right" }}>Quotes</th><th style={{ textAlign: "right" }}>Close %</th><th style={{ textAlign: "right" }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
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
                <td className="num-cell">{p.quotes.length}{won > 0 && <span style={{ color: "#1c6b1c" }}> ·{won}W</span>}{lost > 0 && <span style={{ color: "#a52222" }}> ·{lost}L</span>}</td>
                <td className="num-cell"><span className="pct" style={{ justifyContent: "flex-end" }}><span className="dot" style={{ background: pctColor(p.closingPct) }} />{p.closingPct}%</span></td>
                <td className="num-cell">{fmt(oppValue(p) || p.value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
