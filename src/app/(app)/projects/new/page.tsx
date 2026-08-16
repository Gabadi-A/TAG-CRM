import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import NewOpportunityForm from "@/components/NewOpportunityForm";

export const dynamic = "force-dynamic";

export default async function NewOpportunityPage() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/projects");
  const contractors = await prisma.contractor.findMany({ orderBy: { name: "asc" }, select: { name: true } });

  return (
    <div className="section">
      <p className="page-sub" style={{ marginBottom: 6 }}><Link href="/projects">← Opportunities</Link></p>
      <h1 className="page">New opportunity</h1>
      <p className="page-sub">Add a project. Type a new contractor name and it&apos;ll be created automatically; you can add its contacts on the Contractors page.</p>
      <NewOpportunityForm contractors={contractors.map((c) => c.name)} />
    </div>
  );
}
