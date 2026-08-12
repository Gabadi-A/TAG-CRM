import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import AddUserForm from "@/components/AddUserForm";
import { resetPassword, setUserRole, deleteUser } from "@/lib/actions/users";

export const dynamic = "force-dynamic";

const inputStyle = {
  border: "1px solid var(--line-2)", borderRadius: 9, padding: "6px 9px",
  fontSize: 13, fontFamily: "inherit", background: "var(--paper)", width: 150,
} as const;

export default async function TeamPage() {
  const session = await auth();
  const me = session?.user as { role?: string; email?: string } | undefined;
  if (me?.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  return (
    <div className="section">
      <h1 className="page">Team</h1>
      <p className="page-sub">Add teammates, choose who can edit, and reset passwords. Members can view everything; admins can also edit and curate the focus board.</p>

      <AddUserForm />

      <table>
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Reset password</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={{ fontWeight: 600 }}>{u.name}{u.email === me?.email && <span className="muted" style={{ fontWeight: 400 }}> · you</span>}</td>
              <td>{u.email}</td>
              <td>
                <form action={setUserRole} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="hidden" name="id" value={u.id} />
                  <select name="role" defaultValue={u.role} className="pill-note" style={{ padding: "4px 8px" }}>
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button className="btn ghost" type="submit">Save</button>
                </form>
              </td>
              <td>
                <form action={resetPassword} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="hidden" name="id" value={u.id} />
                  <input name="password" placeholder="New temp password" style={inputStyle} />
                  <button className="btn ghost" type="submit">Reset</button>
                </form>
              </td>
              <td style={{ textAlign: "right" }}>
                {u.email !== me?.email && (
                  <form action={deleteUser}>
                    <input type="hidden" name="id" value={u.id} />
                    <button className="danger-btn" type="submit">Remove</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
