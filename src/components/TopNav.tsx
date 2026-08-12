"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import { doSignOut } from "@/lib/actions/session";

const LINKS = [
  ["/dashboard", "Dashboard"],
  ["/quotes", "Quotes"],
  ["/projects", "Opportunities"],
  ["/contractors", "Contractors"],
  ["/follow-ups", "Follow-ups"],
];

export default function TopNav({ name }: { name?: string | null }) {
  const path = usePathname();
  const initials = (name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="topbar no-print">
      <div className="topbar-inner">
        <Link href="/dashboard"><Logo /></Link>
        <nav className="nav">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={path.startsWith(href) ? "active" : ""}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="spacer" />
        <div className="badge-user">
          <span>{name || "User"}</span>
          <div className="avatar">{initials}</div>
          <form action={doSignOut}>
            <button className="linkbtn" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
