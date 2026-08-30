import { prisma } from "@/lib/db";

/**
 * Keep a project's quotes in sync with a decided stage, so the Quotes and
 * Opportunities tabs always agree: Sold → every quote Won, Dead → every quote Lost.
 * No-op for any other stage.
 */
export async function syncQuotesToStage(projectId: string, stage: string): Promise<void> {
  if (stage === "SOLD") {
    await prisma.quote.updateMany({ where: { projectId }, data: { status: "WON" as never } });
  } else if (stage === "DEAD") {
    await prisma.quote.updateMany({ where: { projectId }, data: { status: "LOST" as never } });
  }
}
