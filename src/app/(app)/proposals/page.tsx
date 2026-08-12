import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const proposals = await prisma.proposal.findMany({
    include: { project: { include: { contractor: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="section">
      <h1 className="page">Proposals</h1>
      <p className="page-sub">Every proposal and version. Start a new one from a project&apos;s page.</p>
      <table>
        <thead>
          <tr><th>Quote #</th><th>Project</th><th>Contractor</th><th>Status</th><th>Updated</th></tr>
        </thead>
        <tbody>
          {proposals.map((pr) => (
            <tr key={pr.id} className="rowlink">
              <td style={{ fontWeight: 600 }}><Link href={`/proposals/${pr.id}`}>{pr.quoteNumber}</Link></td>
              <td><Link href={`/proposals/${pr.id}`}>{pr.project.name}</Link></td>
              <td>{pr.project.contractor?.name || "—"}</td>
              <td><span className="pill-note">{pr.status}</span></td>
              <td>{new Date(pr.updatedAt).toLocaleDateString("en-US")}</td>
            </tr>
          ))}
          {proposals.length === 0 && (
            <tr><td colSpan={5} className="muted">No proposals yet — open a project and click “New proposal”.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
