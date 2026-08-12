import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US");
}

export default async function ActivityPage() {
  const items = await prisma.activity.findMany({ orderBy: { createdAt: "desc" }, take: 150 });

  return (
    <div className="section">
      <h1 className="page">Activity</h1>
      <p className="page-sub">Who did what across the CRM — most recent first.</p>
      {items.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No activity yet. Actions like logging a contact, moving a stage, or pinning a project will show up here.</div>}
      {items.map((a) => (
        <div className="fu-row" key={a.id} style={{ gridTemplateColumns: "1fr 110px", cursor: "default" }}>
          <div>
            <span style={{ fontWeight: 700 }}>{a.actor}</span> {a.action}
            {a.entity && <> · <span className="muted">{a.entity}</span></>}
          </div>
          <div className="muted" style={{ textAlign: "right", fontSize: 12 }}>{timeAgo(a.createdAt)}</div>
        </div>
      ))}
    </div>
  );
}
