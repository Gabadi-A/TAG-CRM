import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { basecampConfigured, basecampConnected, basecampListProjects, type BcProject } from "@/lib/basecamp";
import { disconnectBasecamp } from "@/lib/actions/basecamp";
import ImportEstimating from "@/components/ImportEstimating";

export const dynamic = "force-dynamic";

export default async function BasecampPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string; reason?: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/dashboard");
  const { connected, error, reason } = await searchParams;

  const configured = basecampConfigured();
  const isConnected = configured ? await basecampConnected() : false;
  let projects: BcProject[] = [];
  let apiError: string | null = null;
  if (isConnected) {
    try { projects = await basecampListProjects(); }
    catch (e) { apiError = e instanceof Error ? e.message : String(e); }
  }

  return (
    <div className="section">
      <h1 className="page">Basecamp</h1>
      <p className="page-sub">Connect the CRM to your Basecamp account to see your projects here — and (next) link them to opportunities.</p>

      {error === "state" && <div className="banner">Connection was cancelled or expired — please try again.</div>}
      {error === "exchange" && <div className="banner">Couldn&apos;t complete the connection{reason ? `: ${reason}` : ""}. Double-check the Client Secret and that the redirect URL matches exactly, then retry.</div>}
      {error === "notconfigured" && <div className="banner">Basecamp keys aren&apos;t set yet — add them in Vercel first (see below).</div>}
      {connected && <div className="info-banner">Connected to Basecamp.</div>}

      {!configured && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Not set up yet</h3>
          <p className="page-sub" style={{ margin: "6px 0 0" }}>
            Register an integration at <span className="mono">launchpad.37signals.com/integrations</span> with redirect URL{" "}
            <span className="mono">https://tag-crm.vercel.app/api/basecamp/callback</span>, then add{" "}
            <span className="mono">BASECAMP_CLIENT_ID</span> and <span className="mono">BASECAMP_CLIENT_SECRET</span> in Vercel → Environment Variables and redeploy.
          </p>
        </div>
      )}

      {configured && !isConnected && (
        <a className="btn" href="/api/basecamp/connect">Connect Basecamp</a>
      )}

      {isConnected && (
        <>
          <div className="row-actions" style={{ marginBottom: 14 }}>
            <span className="rel client">Connected</span>
            <form action={disconnectBasecamp}><button className="btn ghost" type="submit">Disconnect</button></form>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Import the Estimating board</h3>
            <p className="page-sub" style={{ margin: "4px 0 0" }}>Pulls every card from the <b>Estimating</b> card table into your opportunities — matched by <span className="mono">#number</span>. Existing opportunities get their board column + a Basecamp link; new cards become new opportunities (you keep all your CRM data like value, contacts, and quotes).</p>
            <ImportEstimating />
          </div>
          {apiError && <div className="banner">Couldn&apos;t load projects: {apiError} — try Disconnect, then Connect again.</div>}
          <div className="table-wrap"><table>
            <thead><tr><th>Project</th><th>Description</th><th></th></tr></thead>
            <tbody>
              {projects.map((pr) => (
                <tr key={pr.id} className="rowlink">
                  <td style={{ fontWeight: 600 }}><Link href={`/basecamp/${pr.id}`}>{pr.name}</Link></td>
                  <td className="muted">{pr.description || pr.purpose || "—"}</td>
                  <td>{pr.app_url && <a href={pr.app_url} target="_blank" rel="noreferrer" className="pill-note">Open ↗</a>}</td>
                </tr>
              ))}
              {projects.length === 0 && !apiError && <tr><td colSpan={3} className="muted">No projects found.</td></tr>}
            </tbody>
          </table></div>
        </>
      )}
    </div>
  );
}
