import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { basecampProjectContents } from "@/lib/basecamp";

export const dynamic = "force-dynamic";

function fmtSize(b?: number): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default async function BasecampProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;

  let data: Awaited<ReturnType<typeof basecampProjectContents>> | null = null;
  let error: string | null = null;
  try { data = await basecampProjectContents(id); }
  catch (e) { error = e instanceof Error ? e.message : String(e); }

  return (
    <div className="section">
      <p className="page-sub" style={{ marginBottom: 6 }}><Link href="/basecamp">← Basecamp</Link></p>
      {error && <div className="banner">Couldn&apos;t load this project: {error}</div>}
      {data && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="page" style={{ margin: 0 }}>{data.project.name}</h1>
            {data.project.app_url && <a className="pill-note" href={data.project.app_url} target="_blank" rel="noreferrer">Open in Basecamp ↗</a>}
          </div>
          {data.project.description && <p className="page-sub" style={{ marginTop: 6 }}>{data.project.description}</p>}

          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="sub-h" style={{ marginTop: 0 }}>To-do lists ({data.todolists.length})</div>
              {data.todolists.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No to-do lists.</div>}
              {data.todolists.map((t) => (
                <a key={t.id} href={t.app_url} target="_blank" rel="noreferrer" className="trade-row" style={{ display: "flex" }}>
                  <span>{t.title}</span>
                  <span className="val-sm muted">{t.completed_ratio || ""}</span>
                </a>
              ))}
            </div>

            <div className="card">
              <div className="sub-h" style={{ marginTop: 0 }}>Documents ({data.docs.length})</div>
              {data.docs.length === 0 && <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>No documents.</div>}
              {data.docs.map((d) => (
                <a key={d.id} href={d.app_url} target="_blank" rel="noreferrer" className="trade-row" style={{ display: "flex" }}>
                  <span>{d.title}</span><span className="muted">↗</span>
                </a>
              ))}

              <div className="sub-h">Files ({data.files.length})</div>
              {data.files.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No files.</div>}
              {data.files.map((f) => (
                <a key={f.id} href={f.app_url} target="_blank" rel="noreferrer" className="trade-row" style={{ display: "flex" }}>
                  <span>{f.title || f.filename}</span>
                  <span className="val-sm muted">{fmtSize(f.byte_size)}</span>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
