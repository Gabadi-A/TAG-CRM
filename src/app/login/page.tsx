"use client";

import { useActionState } from "react";
import Logo from "@/components/Logo";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, undefined);
  return (
    <div className="auth-wrap">
      <form className="auth-card" action={formAction}>
        <Logo />
        <h2>Sign in</h2>
        <p>The Abadi Group — CRM &amp; proposals</p>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        {error && <div className="auth-err">{error}</div>}
        <button className="btn" type="submit" style={{ width: "100%", marginTop: 18 }} disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
