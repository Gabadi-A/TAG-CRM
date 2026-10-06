"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { logActivity } from "@/lib/activity";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    throw new Error("Not authorized — admins only.");
  }
}

function refresh() {
  revalidatePath("/follow-ups");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
// Store at UTC noon so the calendar's date-key (toISOString slice) never drifts across time zones.
const dateAt = (v: string) => (v ? new Date(`${v}T12:00:00Z`) : null);

export async function addTask(formData: FormData) {
  await requireAdmin();
  const title = str(formData, "title");
  if (!title) return;
  await prisma.task.create({
    data: {
      title,
      owner: str(formData, "owner") || null,
      note: str(formData, "note") || null,
      dueDate: dateAt(str(formData, "dueDate")),
    },
  });
  await logActivity("Added follow-up to-do", title);
  refresh();
}

export async function saveTask(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  if (!id) return;
  await prisma.task.update({
    where: { id },
    data: {
      title: str(formData, "title") || "Untitled",
      owner: str(formData, "owner") || null,
      note: str(formData, "note") || null,
      dueDate: dateAt(str(formData, "dueDate")),
    },
  });
  refresh();
}

export async function toggleTask(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  if (!id) return;
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return;
  await prisma.task.update({ where: { id }, data: { done: !t.done } });
  refresh();
}

export async function deleteTask(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id");
  if (!id) return;
  await prisma.task.delete({ where: { id } });
  refresh();
}

/** Used by the drag-and-drop calendar: moves a follow-up (opportunity) or a to-do to a new date. */
export async function moveCalendarItem(kind: string, id: string, dateISO: string) {
  await requireAdmin();
  const date = new Date(`${dateISO}T12:00:00Z`);
  if (kind === "task") {
    await prisma.task.update({ where: { id }, data: { dueDate: date } });
  } else {
    await prisma.project.update({ where: { id }, data: { followUpDate: date } });
  }
  refresh();
}
