import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { basecampAuthorizeUrl, basecampConfigured } from "@/lib/basecamp";

export async function GET(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (!basecampConfigured()) {
    return NextResponse.redirect(new URL("/basecamp?error=notconfigured", req.url));
  }
  const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const jar = await cookies();
  jar.set("bc_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return NextResponse.redirect(basecampAuthorizeUrl(state));
}
