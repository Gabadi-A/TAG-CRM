import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { basecampExchangeCode } from "@/lib/basecamp";

export async function GET(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const saved = jar.get("bc_state")?.value;
  if (!code || !state || state !== saved) {
    return NextResponse.redirect(new URL("/basecamp?error=state", req.url));
  }
  try {
    await basecampExchangeCode(code);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[basecamp] token exchange failed:", reason);
    return NextResponse.redirect(new URL(`/basecamp?error=exchange&reason=${encodeURIComponent(reason.slice(0, 240))}`, req.url));
  }
  jar.set("bc_state", "", { path: "/", maxAge: 0 });
  return NextResponse.redirect(new URL("/basecamp?connected=1", req.url));
}
