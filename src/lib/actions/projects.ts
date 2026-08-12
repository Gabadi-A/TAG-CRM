"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

/** Only ADMINs may change data — MEMBER accounts are read-only ("you curate, team views"). */
async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") throw new Error("Not authorized — admins only.");
}

function revalidateAll(id?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/quotes");
  revalidatePath("/contractors");
  revalidatePath("/follow-ups");
  if (id) revalidatePath(`/projects/${id}`);
}

export async function logContact(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.project.update({ where: { id }, data: { lastContact: new Date() } });
  revalidateAll(id);
}

export async function setStage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage")) as
    | "TRIAGE" | "TAKEOFF" | "REVISION" | "READY" | "FOLLOWUP" | "STATUS" | "SOLD" | "DEAD";
  await prisma.project.update({ where: { id }, data: { stage } });
  revalidateAll(id);
}

/** Pin / unpin a project on the team "Where to focus" board. */
export async function toggleFocus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const project = await prisma.project.findUnique({ where: { id }, select: { focus: true } });
  await prisma.project.update({ where: { id }, data: { focus: !project?.focus } });
  revalidateAll(id);
}
