"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { STAGE_LABEL } from "@/lib/format";
import { logActivity } from "@/lib/activity";

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
  revalidatePath("/activity");
  if (id) revalidatePath(`/projects/${id}`);
}

export async function logContact(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const p = await prisma.project.update({ where: { id }, data: { lastContact: new Date() } });
  await logActivity("Logged contact", p.name);
  revalidateAll(id);
}

export async function setStage(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const stage = String(formData.get("stage")) as
    | "TRIAGE" | "TAKEOFF" | "REVISION" | "READY" | "FOLLOWUP" | "STATUS" | "SOLD" | "DEAD";
  const p = await prisma.project.update({ where: { id }, data: { stage } });
  await logActivity(`Moved to ${STAGE_LABEL[stage] || stage}`, p.name);
  revalidateAll(id);
}

/** Pin / unpin a project on the team "Where to focus" board. */
export async function toggleFocus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const current = await prisma.project.findUnique({ where: { id }, select: { focus: true, name: true } });
  const next = !current?.focus;
  await prisma.project.update({ where: { id }, data: { focus: next } });
  await logActivity(next ? "Pinned to team focus" : "Removed from team focus", current?.name);
  revalidateAll(id);
}
