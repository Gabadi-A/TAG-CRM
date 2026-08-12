import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import ProposalDoc, { type DocData } from "@/components/ProposalDoc";
import AutoPrint from "@/components/AutoPrint";

export const dynamic = "force-dynamic";

export default async function ProposalPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pr = await prisma.proposal.findUnique({
    where: { id },
    include: {
      summaryLines: { orderBy: { sort: "asc" } },
      alternates: { orderBy: { sort: "asc" } },
      scopes: { orderBy: { sort: "asc" }, include: { products: { orderBy: { sort: "asc" } }, materials: { orderBy: { sort: "asc" } } } },
    },
  });
  if (!pr) notFound();

  const data: DocData = {
    header: { bill: pr.billName, contact: pr.contact, email: pr.email, proj: pr.projName, addr: pr.projAddr, date: pr.date, quote: pr.quoteNumber },
    summary: pr.summaryLines.map((l) => ({ label: l.label, note: l.note, amount: l.amount })),
    alternates: pr.alternates.map((a) => ({ label: a.label, amount: a.amount })),
    scopes: pr.scopes.map((s) => ({
      trade: s.trade, includePhase: s.includePhase, phase: s.phase,
      products: s.products.map((p) => ({ label: p.label, qty: p.qty })),
      material: s.materials.map((m) => ({ label: m.label, value: m.value })),
    })),
    discountPct: pr.discountPct,
    salesTax: pr.salesTax,
  };

  return (
    <div className="section">
      <AutoPrint />
      <ProposalDoc data={data} />
    </div>
  );
}
