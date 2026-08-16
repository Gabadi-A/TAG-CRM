import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import NewContractorForm from "@/components/NewContractorForm";

export const dynamic = "force-dynamic";

export default async function NewContractorPage() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/contractors");
  return (
    <div className="section">
      <p className="page-sub" style={{ marginBottom: 6 }}><Link href="/contractors">← Contractors</Link></p>
      <h1 className="page">New contractor</h1>
      <p className="page-sub">Add a general contractor. You can add their contacts and see their projects on the next screen.</p>
      <NewContractorForm />
    </div>
  );
}
