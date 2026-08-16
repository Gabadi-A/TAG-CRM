"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { money } from "@/lib/format";
import { logActivity } from "@/lib/activity";

type Stage = "TRIAGE" | "TAKEOFF" | "REVISION" | "READY" | "FOLLOWUP" | "STATUS" | "SOLD" | "DEAD";
const STAGE_KEYS: Stage[] = ["TRIAGE", "TAKEOFF", "REVISION", "READY", "FOLLOWUP", "STATUS", "SOLD", "DEAD"];

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") throw new Error("Not authorized — admins only.");
}
function s(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}
async function contractorIdForName(name: string): Promise<string | undefined> {
  if (!name) return undefined;
  const c = await prisma.contractor.upsert({ where: { name }, update: {}, create: { name } });
  return c.id;
}
function refreshOpps(id?: string) {
  ["/dashboard", "/projects", "/quotes", "/contractors", "/follow-ups", "/activity"].forEach((p) => revalidatePath(p));
  if (id) revalidatePath(`/projects/${id}`);
}

/* ---------------- Opportunities ---------------- */
export async function createOpportunity(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  await requireAdmin();
  const number = s(formData, "number");
  const name = s(formData, "name");
  if (!number || !name) return "A project number and name are both required.";
  if (await prisma.project.findUnique({ where: { number } })) return `Project #${number} already exists.`;
  const stage = (STAGE_KEYS.includes(s(formData, "stage") as Stage) ? s(formData, "stage") : "TRIAGE") as Stage;
  const closingPct = Math.max(0, Math.min(100, parseInt(s(formData, "closingPct"), 10) || 50));
  const valueRaw = s(formData, "value");
  const project = await prisma.project.create({
    data: {
      number, name,
      contractorId: await contractorIdForName(s(formData, "gc")),
      architect: s(formData, "architect") || null,
      ownerRep: s(formData, "ownerRep") || null,
      stage, closingPct,
      value: valueRaw ? money(valueRaw) : null,
      notes: s(formData, "notes") || null,
    },
  });
  await logActivity("Created opportunity", name);
  refreshOpps(project.id);
  redirect(`/projects/${project.id}`);
}

export async function updateOpportunity(formData: FormData) {
  await requireAdmin();
  const id = s(formData, "id");
  const stage = (STAGE_KEYS.includes(s(formData, "stage") as Stage) ? s(formData, "stage") : "TRIAGE") as Stage;
  const closingPct = Math.max(0, Math.min(100, parseInt(s(formData, "closingPct"), 10) || 0));
  const valueRaw = s(formData, "value");
  const lastRaw = s(formData, "lastContact");
  const contactId = s(formData, "contactId");
  const p = await prisma.project.update({
    where: { id },
    data: {
      name: s(formData, "name"),
      contractorId: (await contractorIdForName(s(formData, "gc"))) ?? null,
      contactId: contactId || null,
      architect: s(formData, "architect") || null,
      ownerRep: s(formData, "ownerRep") || null,
      stage, closingPct,
      value: valueRaw ? money(valueRaw) : null,
      lastContact: lastRaw ? new Date(lastRaw) : null,
      notes: s(formData, "notes") || null,
    },
  });
  await logActivity("Edited opportunity", p.name);
  refreshOpps(id);
}

/* ---------------- Contractors ---------------- */
export async function createContractor(_prev: string | undefined, formData: FormData): Promise<string | undefined> {
  await requireAdmin();
  const name = s(formData, "name");
  if (!name) return "A contractor name is required.";
  if (await prisma.contractor.findUnique({ where: { name } })) return `"${name}" already exists.`;
  const c = await prisma.contractor.create({
    data: { name, address: s(formData, "address") || null, notes: s(formData, "notes") || null },
  });
  await logActivity("Added contractor", name);
  revalidatePath("/contractors");
  revalidatePath("/activity");
  redirect(`/contractors/${c.id}`);
}

export async function updateContractor(formData: FormData) {
  await requireAdmin();
  const id = s(formData, "id");
  const c = await prisma.contractor.update({
    where: { id },
    data: { name: s(formData, "name"), address: s(formData, "address") || null, notes: s(formData, "notes") || null },
  });
  await logActivity("Edited contractor", c.name);
  revalidatePath(`/contractors/${id}`);
  revalidatePath("/contractors");
}

/* ---------------- Contacts ---------------- */
export async function addContact(formData: FormData) {
  await requireAdmin();
  const contractorId = s(formData, "contractorId");
  const name = s(formData, "name");
  if (!contractorId || !name) return;
  await prisma.contact.create({
    data: { contractorId, name, email: s(formData, "email") || null, phone: s(formData, "phone") || null },
  });
  await logActivity("Added contact", name);
  revalidatePath(`/contractors/${contractorId}`);
}

export async function updateContact(formData: FormData) {
  await requireAdmin();
  const id = s(formData, "id");
  const c = await prisma.contact.update({
    where: { id },
    data: { name: s(formData, "name"), email: s(formData, "email") || null, phone: s(formData, "phone") || null },
  });
  revalidatePath(`/contractors/${c.contractorId}`);
}

export async function deleteContact(formData: FormData) {
  await requireAdmin();
  const id = s(formData, "id");
  const c = await prisma.contact.findUnique({ where: { id } });
  if (!c) return;
  await prisma.contact.delete({ where: { id } });
  revalidatePath(`/contractors/${c.contractorId}`);
}
