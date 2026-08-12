"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { money } from "@/lib/format";

const CODE: Record<string, string> = {
  Cabinetry: "C",
  Countertop: "CT",
  Flooring: "F",
  Tile: "T",
  "Finish Carpentry": "FC",
  Millwork: "M",
};

const TRADE_LABEL: Record<string, string> = {
  CABINETRY: "Cabinetry",
  COUNTERTOP: "Countertop",
  FLOORING: "Flooring",
  TILE: "Tile",
  FINISH_CARPENTRY: "Finish Carpentry",
  MILLWORK: "Millwork",
};

const DEFAULT_PHASE =
  "Pre-production (shop drawings 2–4 wks) · Production 8–10 wks · Pre-installation site verification · Installation NOT in base price · Post-installation QC · OSHA / ADA compliance.\nExclusions: plumbing & electrical, disposal outside building, scribing / shoe moldings / caulking, structural modifications, sales tax.";

export async function createProposal(formData: FormData) {
  const projectId = String(formData.get("projectId"));
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { contractor: { include: { contacts: true } }, takeoffs: true },
  });
  if (!project) throw new Error("Project not found");

  const tradeLabel = TRADE_LABEL[project.takeoffs[0]?.trade || "CABINETRY"] || "Cabinetry";
  const tradeCode = CODE[tradeLabel] || "C";
  const version = (await prisma.proposal.count({ where: { projectId } })) + 1;
  const contact = project.contractor?.contacts?.[0];

  const proposal = await prisma.proposal.create({
    data: {
      projectId,
      tradeCode,
      version,
      quoteNumber: `${project.number}.${tradeCode}.${version}`,
      date: new Date().toLocaleDateString("en-US"),
      billName: project.contractor?.name || "",
      contact: contact?.name || "",
      email: contact?.email || "",
      projName: project.name,
      projAddr: "",
      summaryLines: { create: [{ label: tradeLabel, note: "See scopes for details", amount: 0, sort: 0 }] },
      scopes: {
        create: [
          {
            trade: tradeLabel,
            sort: 0,
            includePhase: true,
            phase: DEFAULT_PHASE,
            products: { create: [{ label: "Total Unit Kitchens", qty: "", sort: 0 }] },
            materials: { create: [{ label: "Door Style", value: "", sort: 0 }] },
          },
        ],
      },
    },
  });

  revalidatePath(`/projects/${projectId}`);
  redirect(`/proposals/${proposal.id}`);
}

export type SaveInput = {
  id: string;
  tradeCode: string;
  version: number | string;
  discountPct: number | string;
  salesTax: number | string;
  header: { quote: string; date: string; bill: string; contact: string; email: string; proj: string; addr: string };
  summary: { label: string; note?: string; amount: number | string }[];
  alternates: { label: string; amount: number | string }[];
  scopes: {
    trade: string;
    includePhase: boolean;
    phase: string;
    products: { label: string; qty: string }[];
    material: { label: string; value: string }[];
  }[];
};

export async function saveProposal(input: SaveInput) {
  const { id } = input;
  await prisma.$transaction(async (tx) => {
    await tx.summaryLine.deleteMany({ where: { proposalId: id } });
    await tx.alternate.deleteMany({ where: { proposalId: id } });
    await tx.scopeSection.deleteMany({ where: { proposalId: id } });
    await tx.proposal.update({
      where: { id },
      data: {
        tradeCode: input.tradeCode,
        version: Number(input.version) || 1,
        quoteNumber: input.header.quote,
        date: input.header.date,
        billName: input.header.bill,
        contact: input.header.contact,
        email: input.header.email,
        projName: input.header.proj,
        projAddr: input.header.addr,
        discountPct: Number(input.discountPct) || 0,
        salesTax: money(input.salesTax),
        summaryLines: {
          create: input.summary.map((l, i) => ({ label: l.label, note: l.note || "", amount: money(l.amount), sort: i })),
        },
        alternates: {
          create: input.alternates.map((l, i) => ({ label: l.label, amount: money(l.amount), sort: i })),
        },
        scopes: {
          create: input.scopes.map((s, i) => ({
            trade: s.trade,
            sort: i,
            includePhase: !!s.includePhase,
            phase: s.phase || "",
            products: { create: s.products.map((p, j) => ({ label: p.label, qty: p.qty || "", sort: j })) },
            materials: { create: s.material.map((m, j) => ({ label: m.label, value: m.value || "", sort: j })) },
          })),
        },
      },
    });
  });
  revalidatePath(`/proposals/${id}`);
  return { ok: true };
}
