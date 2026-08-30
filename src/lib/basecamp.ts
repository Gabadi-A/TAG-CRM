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

/** Active projects (first page — up to ~15/page from Basecamp; enough to get started). */
export async function basecampListProjects(): Promise<BcProject[]> {
  return bcFetch<BcProject[]>(`/projects.json`);
}
