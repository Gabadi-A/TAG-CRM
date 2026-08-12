"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { logActivity } from "@/lib/activity";

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") throw new Error("Not authorized — admins only.");
  return session;
}

function refresh() {
  revalidatePath("/team");
  revalidatePath("/activity");
}

/** Used with useActionState — returns an error message string, or undefined on success. */
export async function createUser(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  await requireAdmin();
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const role = String(formData.get("role") || "MEMBER") === "ADMIN" ? "ADMIN" : "MEMBER";
  const password = String(formData.get("password") || "");
  if (!name || !email || !password) return "Name, email, and password are all required.";
  if (password.length < 4) return "Password must be at least 4 characters.";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return "A user with that email already exists.";
  await prisma.user.create({ data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) } });
  await logActivity(`Added ${role === "ADMIN" ? "admin" : "member"} ${name}`, email);
  refresh();
  return undefined;
}

export async function resetPassword(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const password = String(formData.get("password") || "");
  if (password.length < 4) return;
  const u = await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  await logActivity("Reset password for", u.email);
  refresh();
}

export async function setUserRole(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const role = String(formData.get("role")) === "ADMIN" ? "ADMIN" : "MEMBER";
  if (role === "MEMBER") {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (target?.role === "ADMIN" && admins <= 1) return; // never remove the last admin
  }
  const u = await prisma.user.update({ where: { id }, data: { role } });
  await logActivity(`Made ${u.name} a${role === "ADMIN" ? "n admin" : " member"}`, u.email);
  refresh();
}

export async function deleteUser(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id"));
  const meEmail = (session?.user as { email?: string } | undefined)?.email;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return;
  if (target.email === meEmail) return; // can't delete yourself
  if (target.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) return; // can't delete the last admin
  }
  await prisma.user.delete({ where: { id } });
  await logActivity("Removed user", target.email);
  refresh();
}
