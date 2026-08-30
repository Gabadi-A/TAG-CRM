"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { basecampDisconnect, basecampFindProject, basecampCardTable } from "@/lib/basecamp";
import { logActivity } from "@/lib/activity";

type Stage = "TRIAGE" | "TAKEOFF" | "REVISION" | "READY" | "FOLLOWUP" | "STATUS" | "SOLD" | "DEAD";

async function requireAdmin() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") throw new Error("Not authorized — admins only.");
}

export async function disconnectBasecamp() {
  await requireAdmin();
  await basecampDisconnect();
  await logActivity("Disconnected Basecamp");
  revalidatePath("/basecamp");
}

/** Best-effort map from a card-table column name to a CRM stage. The exact column is stored separately. */
function mapColumnToStage(col: string): Stage {
  const c = col.toLowerCase();
  if (c.includes("sold") || c.includes("won") || c.includes("awarded")) return "SOLD";
  if (c.includes("dead") || c.includes("lost") || c.includes("passed") || c.includes("declined") || c.includes("no bid")) return "DEAD";
  if (c.includes("triage")) return "TRIAGE";
  if (c.includes("revision")) return "REVISION";
  if (c.includes("ready")) return "READY";
  if (c.includes("submitted") || c.includes("follow") || c.includes("active")) return "FOLLOWUP";
  if (c.includes("progress") || c.includes("pending")) return "TAKEOFF";
  if (c.includes("completed")) return "READY";
  return "STATUS"; // on hold / not now / status? / anything else
}

/** Parse a card title like "Sparrow Square- (Kingsboro)_#2743" → { name, number }. Skips template cards. */
function parseCard(title: string): { number: string; name: string } | null {
  const t = (title || "").trim();
  if (!t || /template/i.test(t) || /^pro[jy]ect name/i.test(t)) return null;
  const idx = t.lastIndexOf("_#");
  if (idx < 0) return null; // no number — skip for now
  const name = t.slice(0, idx).trim();
  const number = t.slice(idx + 2).trim();
  if (!number || !/^\d/.test(number)) return null;
  return { number, name: name || `Project ${number}` };
}

export type ImportResult = { created: number; updated: number; skipped: number; columns: number; error?: string };

export async function importEstimatingCardTable(_prev: ImportResult | undefined, _formData: FormData): Promise<ImportResult> {
  await requireAdmin();
  try {
    const project = await basecampFindProject("Estimating");
    if (!project) return { created: 0, updated: 0, skipped: 0, columns: 0, error: "No Basecamp project named 'Estimating' was found." };
    const columns = await basecampCardTable(String(project.id));
    let created = 0, updated = 0, skipped = 0;
    for (const col of columns) {
      const stage = mapColumnToStage(col.title);
      for (const card of col.cards) {
        const parsed = parseCard(card.title);
        if (!parsed) { skipped++; continue; }
        const existing = await prisma.project.findUnique({ where: { number: parsed.number } });
        if (existing) {
          // Sync only the board-owned fields; keep CRM data (value, contacts, quotes, notes) intact.
          await prisma.project.update({
            where: { number: parsed.number },
            data: { stage: stage as never, basecampUrl: card.app_url || null, basecampColumn: col.title, basecampProjectId: String(card.id), ...(stage === "SOLD" ? { closingPct: 100 } : stage === "DEAD" ? { closingPct: 0 } : {}) },
          });
          updated++;
        } else {
          await prisma.project.create({
            data: { number: parsed.number, name: parsed.name, stage: stage as never, basecampUrl: card.app_url || null, basecampColumn: col.title, basecampProjectId: String(card.id), closingPct: stage === "SOLD" ? 100 : stage === "DEAD" ? 0 : 50 },
          });
          created++;
        }
      }
    }
    await logActivity(`Imported Estimating card table (${created} new, ${updated} updated)`);
    ["/dashboard", "/projects", "/quotes", "/contractors", "/follow-ups", "/activity", "/basecamp"].forEach((p) => revalidatePath(p));
    return { created, updated, skipped, columns: columns.length };
  } catch (e) {
    return { created: 0, updated: 0, skipped: 0, columns: 0, error: e instanceof Error ? e.message : String(e) };
  }
}
