import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TopNav from "@/components/TopNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const isAdmin = (session.user as { role?: string } | undefined)?.role === "ADMIN";
  return (
    <>
      <TopNav name={session.user?.name} isAdmin={isAdmin} />
      <div className="app">{children}</div>
    </>
  );
}
