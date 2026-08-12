"use client";

import { useActionState, useRef, useEffect } from "react";
import { createUser } from "@/lib/actions/users";

export default function AddUserForm() {
  const [error, formAction, pending] = useActionState(createUser, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful add (error === undefined once pending finishes)
  useEffect(() => {
    if (!pending && !error) formRef.current?.reset();
  }, [pending, error]);

  return (
    <form ref={formRef} action={formAction} className="card" style={{ marginBottom: 18 }}>
      <h3 style={{ margin: "0 0 12px" }}>Add a team member</h3>
      <div className="toolbar" style={{ marginBottom: error ? 10 : 0 }}>
        <input name="name" placeholder="Full name" required />
        <input name="email" type="email" placeholder="name@theabadigroup.com" required />
        <select name="role" defaultValue="MEMBER">
          <option value="MEMBER">Member (view only)</option>
          <option value="ADMIN">Admin (can edit)</option>
        </select>
        <input name="password" placeholder="Temporary password" required />
        <button className="btn" type="submit" disabled={pending}>{pending ? "Adding…" : "Add user"}</button>
      </div>
      {error && <div className="auth-err" style={{ marginTop: 4 }}>{error}</div>}
    </form>
  );
}
