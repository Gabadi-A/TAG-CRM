import { prisma } from "@/lib/db";

const LAUNCHPAD = "https://launchpad.37signals.com";
const UA = process.env.BASECAMP_USER_AGENT || "TAG CRM (gabriel@theabadigroup.com)";

function env(k: string) {
  return process.env[k] || "";
}
export function basecampConfigured(): boolean {
  return !!(env("BASECAMP_CLIENT_ID") && env("BASECAMP_CLIENT_SECRET"));
}
export function basecampRedirectUri(): string {
  return env("BASECAMP_REDIRECT_URI") || "https://tag-crm.vercel.app/api/basecamp/callback";
}
export function basecampAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    type: "web_server",
    client_id: env("BASECAMP_CLIENT_ID"),
    redirect_uri: basecampRedirectUri(),
    state,
  });
  return `${LAUNCHPAD}/authorization/new?${p.toString()}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number };

async function firstAccountId(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${LAUNCHPAD}/authorization.json`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accounts?: { id: number; product: string }[] };
    const acct = (data.accounts || []).find((a) => a.product === "bc3") || (data.accounts || [])[0];
    return acct ? String(acct.id) : null;
  } catch {
    return null;
  }
}

/** Exchange the OAuth code for tokens and store the connection. */
export async function basecampExchangeCode(code: string): Promise<void> {
  const p = new URLSearchParams({
    type: "web_server",
    client_id: env("BASECAMP_CLIENT_ID"),
    redirect_uri: basecampRedirectUri(),
    client_secret: env("BASECAMP_CLIENT_SECRET"),
    code,
  });
  const res = await fetch(`${LAUNCHPAD}/authorization/token?${p.toString()}`, {
    method: "POST",
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  const tok = (await res.json()) as TokenResponse;
  const accountId = env("BASECAMP_ACCOUNT_ID") || (await firstAccountId(tok.access_token));
  const expiresAt = new Date(Date.now() + (tok.expires_in || 1209600) * 1000);
  await prisma.integration.upsert({
    where: { provider: "basecamp" },
    update: { accessToken: tok.access_token, refreshToken: tok.refresh_token || "", expiresAt, accountId },
    create: { provider: "basecamp", accessToken: tok.access_token, refreshToken: tok.refresh_token || "", expiresAt, accountId },
  });
}

type Conn = { accessToken: string; refreshToken: string; expiresAt: Date; accountId: string | null };

async function refreshToken(row: Conn): Promise<string> {
  const p = new URLSearchParams({
    type: "refresh",
    refresh_token: row.refreshToken,
    client_id: env("BASECAMP_CLIENT_ID"),
    client_secret: env("BASECAMP_CLIENT_SECRET"),
  });
  const res = await fetch(`${LAUNCHPAD}/authorization/token?${p.toString()}`, {
    method: "POST",
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Token refresh failed (${res.status})`);
  const tok = (await res.json()) as TokenResponse;
  const expiresAt = new Date(Date.now() + (tok.expires_in || 1209600) * 1000);
  const updated = await prisma.integration.update({
    where: { provider: "basecamp" },
    data: { accessToken: tok.access_token, refreshToken: tok.refresh_token || row.refreshToken, expiresAt },
  });
  return updated.accessToken;
}

/** Returns a live token + accountId, refreshing if near expiry. null if not connected. */
export async function basecampConnection(): Promise<{ token: string; accountId: string | null } | null> {
  const row = await prisma.integration.findUnique({ where: { provider: "basecamp" } });
  if (!row) return null;
  let token = row.accessToken;
  if (row.expiresAt.getTime() < Date.now() + 60_000) {
    try {
      token = await refreshToken(row);
    } catch {
      return null; // needs reconnect
    }
  }
  return { token, accountId: row.accountId };
}

export async function basecampConnected(): Promise<boolean> {
  return !!(await prisma.integration.findUnique({ where: { provider: "basecamp" } }));
}

export async function basecampDisconnect(): Promise<void> {
  await prisma.integration.deleteMany({ where: { provider: "basecamp" } });
}

async function bcFetch<T>(path: string): Promise<T> {
  const conn = await basecampConnection();
  if (!conn || !conn.accountId) throw new Error("Basecamp is not connected.");
  const res = await fetch(`https://3.basecampapi.com/${conn.accountId}${path}`, {
    headers: { Authorization: `Bearer ${conn.token}`, "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Basecamp API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export type BcProject = {
  id: number;
  name: string;
  description?: string | null;
  app_url?: string;
  purpose?: string;
};

/** All active projects — follows Basecamp's pagination (Link header) to get every page. */
export async function basecampListProjects(): Promise<BcProject[]> {
  const conn = await basecampConnection();
  if (!conn || !conn.accountId) throw new Error("Basecamp is not connected.");
  const all: BcProject[] = [];
  let url: string | null = `https://3.basecampapi.com/${conn.accountId}/projects.json`;
  let guard = 0;
  while (url && guard < 50) {
    guard++;
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${conn.token}`, "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Basecamp API ${res.status}: ${await res.text()}`);
    all.push(...((await res.json()) as BcProject[]));
    const link = res.headers.get("link");
    const next = link ? link.match(/<([^>]+)>;\s*rel="next"/) : null;
    url = next ? next[1] : null;
  }
  all.sort((a, b) => a.name.localeCompare(b.name));
  return all;
}

/** Fetch any absolute Basecamp API URL (the dock entries hand us full urls). */
async function bcGet<T>(absoluteUrl: string): Promise<T> {
  const conn = await basecampConnection();
  if (!conn) throw new Error("Basecamp is not connected.");
  const res = await fetch(absoluteUrl, {
    headers: { Authorization: `Bearer ${conn.token}`, "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Basecamp API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export type BcDock = { id: number; title: string; name: string; enabled: boolean; url: string; app_url: string };
export type BcProjectFull = BcProject & { dock: BcDock[] };
export type BcDoc = { id: number; title: string; app_url?: string };
export type BcFile = { id: number; title?: string; filename?: string; app_url?: string; content_type?: string; byte_size?: number };
export type BcTodolist = { id: number; title: string; completed?: boolean; completed_ratio?: string; app_url?: string };

export async function basecampProjectContents(id: string): Promise<{
  project: BcProjectFull;
  docs: BcDoc[];
  files: BcFile[];
  todolists: BcTodolist[];
}> {
  const project = await bcFetch<BcProjectFull>(`/projects/${id}.json`);
  const vault = project.dock.find((d) => d.name === "vault" && d.enabled);
  const todoset = project.dock.find((d) => d.name === "todoset" && d.enabled);
  let docs: BcDoc[] = [];
  let files: BcFile[] = [];
  let todolists: BcTodolist[] = [];
  if (vault) {
    const v = await bcGet<{ documents_url?: string; uploads_url?: string }>(vault.url);
    if (v.documents_url) { try { docs = await bcGet<BcDoc[]>(v.documents_url); } catch { /* ignore */ } }
    if (v.uploads_url) { try { files = await bcGet<BcFile[]>(v.uploads_url); } catch { /* ignore */ } }
  }
  if (todoset) {
    const ts = await bcGet<{ todolists_url?: string }>(todoset.url);
    if (ts.todolists_url) { try { todolists = await bcGet<BcTodolist[]>(ts.todolists_url); } catch { /* ignore */ } }
  }
  return { project, docs, files, todolists };
}

/** Fetch every page of an absolute Basecamp list endpoint (follows Link: rel="next"). */
async function bcGetAll<T>(startUrl: string): Promise<T[]> {
  const conn = await basecampConnection();
  if (!conn) throw new Error("Basecamp is not connected.");
  const out: T[] = [];
  let url: string | null = startUrl;
  let guard = 0;
  while (url && guard < 60) {
    guard++;
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${conn.token}`, "User-Agent": UA },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Basecamp API ${res.status}: ${await res.text()}`);
    out.push(...((await res.json()) as T[]));
    const link = res.headers.get("link");
    const next = link ? link.match(/<([^>]+)>;\s*rel="next"/) : null;
    url = next ? next[1] : null;
  }
  return out;
}

/** Find a project by (case-insensitive) exact then partial name match. */
export async function basecampFindProject(name: string): Promise<BcProject | null> {
  const list = await basecampListProjects();
  const lower = name.toLowerCase();
  return list.find((p) => p.name.toLowerCase() === lower)
    || list.find((p) => p.name.toLowerCase().includes(lower))
    || null;
}

export type BcCard = { id: number; title: string; content?: string; app_url?: string; due_on?: string | null };
export type BcColumn = { id: number; title: string; cards: BcCard[] };

/** Read a project's card table (kanban) as columns of cards. */
export async function basecampCardTable(projectId: string): Promise<BcColumn[]> {
  const project = await bcFetch<BcProjectFull>(`/projects/${projectId}.json`);
  const dock = project.dock.find((d) => (d.name === "kanban_board" || d.name === "card_table") && d.enabled);
  if (!dock) throw new Error("No card table (kanban board) found in that Basecamp project.");
  const table = await bcGet<{ lists?: { id: number; title: string; cards_url?: string }[]; columns?: { id: number; title: string; cards_url?: string }[] }>(dock.url);
  const lists = table.lists || table.columns || [];
  const columns: BcColumn[] = [];
  for (const list of lists) {
    let cards: BcCard[] = [];
    if (list.cards_url) {
      try { cards = await bcGetAll<BcCard>(list.cards_url); } catch { cards = []; }
    }
    columns.push({ id: list.id, title: list.title, cards });
  }
  return columns;
}
