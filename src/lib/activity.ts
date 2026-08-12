import { prisma } from "@/lib/db";
import { auth } from "@/auth";

/**
 * Record something a user did, for the Activity feed.
 * Never throws — logging must not break the action it's tracking.
 */
export async function logActivity(action: string, entity?: string | null) {
  try {
    const session = await auth();
    const u = session?.user as { name?: string | null; email?: string | null } | undefined;
    const actor = u?.name || u?.email || "Someone";
    await prisma.activity.create({ data: { actor, action, entity: entity ?? null } });
  } catch {
    // ignore logging failures
  }
}
