"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { basecampDisconnect } from "@/lib/basecamp";
import { logActivity } from "@/lib/activity";

export async function disconnectBasecamp() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") throw new Error("Not authorized — admins only.");
  await basecampDisconnect();
  await logActivity("Disconnected Basecamp");
  revalidatePath("/basecamp");
}
