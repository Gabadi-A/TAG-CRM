import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = { only?: string; sort?: string; dir?: string };

export default async function ContractorsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { only = "all", sort = "openVal", dir = "desc" } = await searchParams;

  const contractors = await prisma.contractor.findMany({
    include: { projects: { include: { quotes: true } } },
  });

  const rows0 = contractors.map((c) => {
    let openVal = 0, wonVal = 0, lostVal = 0, wonC = 0, lostC = 0;
    c.projects.forEach((p) =>
      p.quotes.forEach((q) => {
        if (q.status === "WON") { wonVal += q.value; wonC++; }
        else if (q.status === "LOST") { lostVal += q.value; lostC++; }
        else openVal += q.value;
      })
    );
    const activeOpps = c.projects.filter((p) => p.stage !== "SOLD" && p.stage !== "DEAD").length;
    const decided = wonC + lostC;
    return {
      name: c.name,
      openVal, wonVal, lostVal, activeOpps,
      winRate: decided ? Math.round((wonC / decided) * 100) : null,
      isClient: wonC > 0,
    };
  });

  const filtered = rows0.filter((c) => (only === "all" ? true : only === "client" ? c.isClient : !c.isClient));
  const dirMul = dir === "asc" ? 1 : -1;
  const key = sort as keyof (typeof rows0)[number];
  const rows = filtered.slice().sort((a, b) => {
    let va = a[key] as string | number | null;
    let vb = b[key] as string | number | null;
    if (va == null) va = -Infinity;
    if (vb == null) vb = -Infinity;
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dirMul;
    return ((va as number) - (vb as number)) * dirMul;
  });
  const clients = rows0.filter((c) => c.isClient).length;

  const th = (k: string, label: string, right = false) => {
    const active = sort === k;
    const params = new URLSearchParams();
    if (only !== "all") params.set("only", only);
    params.set("sort", k);
    params.set("dir", active && dir === "desc" ? "asc" : "desc");
    const arrow = active ? (dir === "desc" ? " ▼" : " ▲") : "";
    return (
      <th style={right ? { textAlign: "right" } : undefined}>
        <Link href={`/contractors?${params.toString()}`}>{label}{arrow}</Link>
      </th>
    );
  };

  return (
    <div className="section">
      <h1 className="page">Contractors</h1>
      <p className="page-sub">The relationships that compound. Crack one opportunity, perform, and the same builder brings the next job — this is the land-and-expand scoreboard.</p>
      <div className="info-banner"><b>{clients} existing clients</b> have already awarded us work — the warm base to expand. The rest are prospects: one win turns a prospect into a repeat client.</div>

      <form className="toolbar" method="get">
        <select name="only" defaultValue={only}>
          <option value="all">All contractors</option>
          <option value="client">Clients only</option>
          <option value="prospect">Prospects only</option>
        </select>
        <button className="btn ghost" type="submit">Filter</button>
        <span className="pill-note">{rows.length} contractors</span>
      </form>

      <table>
        <thead>
          <tr>
            {th("name", "Contractor")}
            <th>Relationship</th>
            {th("openVal", "Open pipeline", true)}
            {th("activeOpps", "Active opps", true)}
            {th("wonVal", "Won to date", true)}
            {th("winRate", "Win rate", true)}
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={i} className="rowlink">
              <td style={{ fontWeight: 600 }}><Link href={`/projects?gc=${encodeURIComponent(c.name)}`}>{c.name}</Link></td>
              <td><span className={"rel " + (c.isClient ? "client" : "prospect")}>{c.isClient ? "Client" : "Prospect"}</span></td>
              <td className="num-cell">{c.openVal ? fmt(c.openVal) : "—"}</td>
              <td className="num-cell">{c.activeOpps}</td>
              <td className="num-cell">{c.wonVal ? fmt(c.wonVal) : "—"}</td>
              <td className="num-cell">{c.winRate == null ? "—" : c.winRate + "%"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
