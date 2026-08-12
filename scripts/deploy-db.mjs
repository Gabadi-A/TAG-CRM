// Runs before `next build` (see package.json). Pushes the Prisma schema to the
// database so the deployed app always matches schema.prisma. Skips gracefully
// when no DATABASE_URL is present (e.g. local `next build` smoke tests).
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("[deploy-db] No DATABASE_URL set — skipping schema push.");
  process.exit(0);
}

try {
  console.log("[deploy-db] Pushing Prisma schema to database…");
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
  console.log("[deploy-db] Done.");
} catch (err) {
  console.error("[deploy-db] Schema push failed:", err?.message || err);
  process.exit(1);
}
