import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const STAGE: Record<string, string> = {
  triage: "TRIAGE", takeoff: "TAKEOFF", revision: "REVISION", ready: "READY",
  followup: "FOLLOWUP", status: "STATUS", sold: "SOLD", dead: "DEAD",
};
const TRADE: Record<string, string> = {
  Cabinetry: "CABINETRY", Countertop: "COUNTERTOP", Flooring: "FLOORING",
  Tile: "TILE", "Finish Carpentry": "FINISH_CARPENTRY", Millwork: "MILLWORK",
};
const TSTAT: Record<string, string> = { ready: "READY", prog: "IN_PROGRESS", pend: "PENDING" };

// Per-trade quote status overrides (project number -> { trade: STATUS }).
// Anything not listed falls back to a status derived from the project stage.
const QOVER: Record<string, Record<string, string>> = {
  "2743": { Cabinetry: "SENT", Countertop: "SENT", Flooring: "REVISION" },
  "2720": { Cabinetry: "SENT", Millwork: "SENT" },
  "2765": { Flooring: "SENT", Cabinetry: "DRAFT", Countertop: "DRAFT", Tile: "DRAFT" },
  "2729": { Cabinetry: "SENT", Millwork: "READY" },
  "2871": { Flooring: "SENT", "Finish Carpentry": "REVISION" },
  "2795": { Flooring: "LOST", Countertop: "SENT", Millwork: "SENT" },
  "2779": { Millwork: "REVISION" },
  "2841": { Flooring: "HOLD", Millwork: "HOLD" },
  "2822": { Cabinetry: "HOLD", Countertop: "HOLD", Flooring: "HOLD" },
  "2870": { "Finish Carpentry": "WON" },
};

// Derive a default quote status from the project stage.
function baseStatus(stage: string): string {
  switch (stage) {
    case "sold": return "WON";
    case "dead": return "LOST";
    case "ready": return "READY";
    case "revision": return "REVISION";
    case "takeoff": case "triage": return "DRAFT";
    default: return "SENT"; // followup, status
  }
}
// Stable pseudo version number (1–5) per project+trade.
function tradeVersion(num: string, trade: string): number {
  let seed = 0;
  for (let i = 0; i < num.length; i++) seed += num.charCodeAt(i);
  seed += trade.length * 7;
  return (seed % 5) + 1;
}
const TRADE_WEIGHT: Record<string, number> = {
  Cabinetry: 40, Countertop: 25, Flooring: 20, Tile: 10, "Finish Carpentry": 15, Millwork: 25,
};
// Allocate the project value across its trades (matches the prototype).
function quoteValue(p: P, trade: string): number {
  const ws = p.trades.reduce((s, t) => s + (TRADE_WEIGHT[t] || 15), 0);
  return Math.round(((p.val || 0) * (TRADE_WEIGHT[trade] || 15) / ws) / 1000) * 1000;
}

type P = {
  num: string; name: string; gc: string; arch?: string; resp?: string;
  val?: number; closing: number; stage: string; last?: string | null; notes?: string;
  trades: string[]; takeoff?: Record<string, string>;
};

const PROJECTS: P[] = [
  { num: "2743", name: "Sparrow Square", gc: "Levine Builders", arch: "Hill West Architects", resp: "Gerardo", val: 1500000, closing: 98, stage: "followup", last: "2026-05-12", notes: "Quote and scope sent corrected.", trades: ["Cabinetry", "Countertop", "Flooring"], takeoff: { Cabinetry: "ready", Countertop: "ready", Flooring: "prog" } },
  { num: "2720", name: "The Atlantic Club", gc: "CNY Group", arch: "Shore Point Architecture", resp: "Rocío", val: 2300000, closing: 100, stage: "followup", last: "2026-04-16", notes: "Se tuvo una junta. Millwork & Doors budget received.", trades: ["Cabinetry", "Millwork", "Finish Carpentry"], takeoff: { Cabinetry: "ready", Millwork: "ready" } },
  { num: "2752", name: "LIDO Condominiums", gc: "SOCO Construction", arch: "Minno-Wasko Architects", resp: "Becarios", val: 4151000, closing: 95, stage: "followup", last: "2025-12-14", notes: "Se mandaron los specs de Vanities.", trades: ["Cabinetry", "Countertop", "Flooring", "Tile"], takeoff: { Cabinetry: "ready", Countertop: "ready" } },
  { num: "2765", name: "540 Degraw", gc: "Mega Contracting", arch: "Handel Architects", resp: "Gerardo", val: 1700000, closing: 95, stage: "followup", last: "2026-04-27", notes: "Flooring completed & submitted.", trades: ["Cabinetry", "Countertop", "Flooring", "Tile"], takeoff: { Flooring: "ready" } },
  { num: "2729", name: "Estates at Hurstmont", gc: "SOCO Construction", arch: "Meyer Architects", resp: "Cristina", val: 2500000, closing: 95, stage: "followup", last: "2026-04-29", notes: "Millwork ready to send.", trades: ["Cabinetry", "Countertop", "Flooring", "Millwork"], takeoff: { Cabinetry: "ready", Millwork: "ready" } },
  { num: "2704", name: "Brightview Livingston", gc: "IMC Construction", arch: "Market Square Architects", resp: "Rocío", val: 1000000, closing: 95, stage: "takeoff", last: "2026-03-06", notes: "Takeoff in progress.", trades: ["Cabinetry", "Countertop", "Flooring", "Finish Carpentry"], takeoff: { Cabinetry: "prog", Flooring: "prog" } },
  { num: "2848", name: "Extell Yonkers – Hudson Piers B", gc: "M Y Developers", arch: "McGinley Design", resp: "Sam", val: 2900000, closing: 95, stage: "ready", last: "2026-05-12", notes: "Ready to submit. Break ground July.", trades: ["Cabinetry", "Countertop", "Flooring", "Finish Carpentry", "Millwork"], takeoff: { Cabinetry: "ready", Countertop: "ready", Flooring: "ready" } },
  { num: "2847", name: "615 River Road", gc: "CNY Group", arch: "Cetra Ruddy Architecture", resp: "Rocío", val: 2150000, closing: 95, stage: "followup", last: "2026-03-23", notes: "New proposal sent.", trades: ["Cabinetry", "Countertop", "Flooring"] },
  { num: "2871", name: "Mendham Village Apartments", gc: "SOCO Construction", resp: "Julieta", val: 2500000, closing: 95, stage: "followup", last: "2026-05-11", notes: "Alternate LVT catalogue sent. Doors ready for revision.", trades: ["Flooring", "Finish Carpentry", "Millwork"], takeoff: { Flooring: "ready" } },
  { num: "2830", name: "Brightview Sr Living – Mt. Pleasant", gc: "IMC Construction", arch: "Market Square Architects", resp: "Rocío", val: 1000000, closing: 90, stage: "status", last: "2026-05-12", notes: "Waiting for owner feedback.", trades: ["Cabinetry", "Finish Carpentry"] },
  { num: "2833", name: "Basking Ridge", gc: "Steve", arch: "Minno & Wasko", resp: "Gabriel", val: 2500000, closing: 90, stage: "status", last: null, notes: "No email — Gabriel to follow up.", trades: ["Cabinetry", "Countertop"] },
  { num: "2834", name: "Brightview – Mount Laurel", gc: "Harkins Builders", arch: "Meyer Architects", resp: "Samantha", val: 1000000, closing: 90, stage: "status", last: "2026-01-08", notes: "En discusión de la adjudicación.", trades: ["Cabinetry", "Countertop", "Flooring"] },
  { num: "2854", name: "32 University (Portnow)", gc: "ARC", arch: "BKV Group", resp: "Javier", val: 1200000, closing: 90, stage: "followup", last: "2026-03-31", notes: "Completed & submitted.", trades: ["Cabinetry", "Countertop"] },
  { num: "2895", name: "Westport Crossing", gc: "Lighthouse Living", arch: "Beinfield Architecture", resp: "Sam", val: 900000, closing: 90, stage: "ready", last: null, notes: "Ready to submit — flooring, doors, closets, blinds.", trades: ["Flooring", "Finish Carpentry"], takeoff: { Flooring: "ready" } },
  { num: "2703", name: "10 Park Place", gc: "CM & Associates", arch: "Rawlings Architects", resp: "Gabriel", val: 1200000, closing: 85, stage: "ready", last: null, notes: "Submitted? Gabriel to follow up.", trades: ["Cabinetry", "Countertop", "Flooring"], takeoff: { Cabinetry: "ready" } },
  { num: "2757", name: "Benchmark East Brunswick", gc: "IMC Construction", arch: "Meyer Architects", resp: "Becarios", val: 1000000, closing: 85, stage: "followup", last: "2026-05-12", notes: "Team will send final questions.", trades: ["Cabinetry", "Countertop", "Flooring", "Tile"] },
  { num: "2779", name: "300 E 42nd Street", gc: "Pavarini McGovern", arch: "Sal Smeke", resp: "Rocío", val: 400000, closing: 85, stage: "status", last: "2026-03-04", notes: "Millwork scope for revision.", trades: ["Millwork"], takeoff: { Millwork: "prog" } },
  { num: "2816", name: "Jennings Hall Expansion", gc: "Mega Contracting", arch: "Curtis + Ginsberg", resp: "Gerardo", val: 680000, closing: 85, stage: "ready", last: "2025-11-03", notes: "Cabinetry ready, flooring in process.", trades: ["Cabinetry", "Flooring"], takeoff: { Cabinetry: "ready", Flooring: "prog" } },
  { num: "2857", name: "1500 Grand", gc: "K L Masters", arch: "MHS Architecture", resp: "Samantha", val: 1200000, closing: 85, stage: "followup", last: "2026-05-12", notes: "Provide cost for quartz backsplash in lieu of tile.", trades: ["Countertop", "Tile"] },
  { num: "2795", name: "305 Broadway Long Branch", gc: "TriCon Construction", arch: "Rotwein+Blake", resp: "Gerardo", val: 1250000, closing: 80, stage: "followup", last: "2026-05-12", notes: "Flooring lost. Millwork & countertops news by May 22.", trades: ["Countertop", "Millwork", "Flooring"] },
  { num: "2824", name: "1111 Webster Ave", gc: "Mega Contracting", arch: "Dattner Architects", resp: "Sam", val: 1900000, closing: 80, stage: "followup", last: "2026-05-12", notes: "Looping in the Buyout Department.", trades: ["Cabinetry", "Countertop", "Flooring"] },
  { num: "2828", name: "245 Clarkson Avenue", gc: "Mega Contracting", arch: "Edelman Sultan Knox Wood", resp: "Sam", val: 1200000, closing: 80, stage: "takeoff", last: "2026-01-05", notes: "Takeoffs in progress.", trades: ["Cabinetry", "Countertop", "Flooring"], takeoff: { Cabinetry: "prog" } },
  { num: "2855", name: "Peapack Senior Living", gc: "ARC", arch: "SBD", resp: "Gabriel", val: 2000000, closing: 80, stage: "revision", last: "2026-04-10", notes: "Invitación al proyecto — Gabriel revision.", trades: ["Cabinetry", "Countertop"] },
  { num: "2876", name: "Haverstraw Chair Factory", gc: "Mega Contracting", arch: "Dattner Architects", resp: "Gerardo", val: 4800000, closing: 80, stage: "followup", last: "2026-04-24", notes: "Confirmaron recepción de propuesta.", trades: ["Cabinetry", "Countertop", "Flooring"], takeoff: { Cabinetry: "prog" } },
  { num: "2889", name: "233 Mott Street", gc: "MJM Associates", arch: "Michael Zenreich PC", resp: "Gerardo", val: 950000, closing: 75, stage: "ready", last: null, notes: "Completed. Full scope.", trades: ["Cabinetry", "Countertop", "Flooring", "Tile", "Finish Carpentry"], takeoff: { Cabinetry: "ready" } },
  { num: "2868", name: "The Franklin at Tenafly", gc: "Calabrese Construction", arch: "MidAtlantic Architecture", resp: "Cristina", val: 1100000, closing: 75, stage: "takeoff", last: null, notes: "Takeoffs in progress.", trades: ["Cabinetry", "Countertop", "Flooring"], takeoff: { Cabinetry: "prog" } },
  { num: "2860", name: "118 Talmage Rd", gc: "Calabrese Construction", arch: "Blackbird Group Architects", resp: "Julieta", val: 700000, closing: 75, stage: "followup", last: "2026-02-10", notes: "Thomas sent Gabriel a link with the plans.", trades: ["Cabinetry", "Countertop"] },
  { num: "2841", name: "110 East 138th Street", gc: "Levine Builders", arch: "Dattner Architects", resp: "Rocío", val: 450000, closing: 95, stage: "followup", last: "2026-07-21", notes: "On hold — millwork scope, flooring proposal.", trades: ["Flooring", "Millwork"] },
  { num: "2892", name: "Denholtz", gc: "TriCon Construction", arch: "Rotwein+Blake", resp: "Rocío", val: 1400000, closing: 80, stage: "followup", last: null, notes: "Full scope takeoffs complete.", trades: ["Cabinetry", "Countertop", "Flooring", "Tile", "Finish Carpentry"] },
  { num: "2822", name: "Asbury Ave Apartments", gc: "CBG Building Company", arch: "Inglese Architecture", resp: "Julieta", val: 660000, closing: 60, stage: "followup", last: "2026-05-12", notes: "Potential design changes; project on hold.", trades: ["Cabinetry", "Countertop", "Flooring"] },
  { num: "2825", name: "293-297 Orange St", gc: "YNH Construction", arch: "Inoa Architecture", resp: "Samantha", val: 900000, closing: 60, stage: "ready", last: "2025-12-08", notes: "Scopes sent — ready to submit.", trades: ["Cabinetry", "Countertop", "Flooring"], takeoff: { Cabinetry: "ready" } },
  { num: "2887", name: "Downtown Urby", gc: "AJD Construction", arch: "HLW", resp: "Sam", val: 1300000, closing: 60, stage: "followup", last: null, notes: "Follow up.", trades: ["Cabinetry", "Countertop", "Flooring"] },
  { num: "2829", name: "The District – S1", gc: "SOCO Construction", arch: "Minno-Wasko", resp: "Cristina", val: 2275000, closing: 50, stage: "status", last: "2026-05-12", notes: "Client didn't answer phone call.", trades: ["Cabinetry", "Countertop"] },
  { num: "2817", name: "Plaza Greene", gc: "March Associates", arch: "Minno-Wasko", resp: "Gabriel", val: 900000, closing: 30, stage: "revision", last: "2025-11-11", notes: "Cabinetry & countertop proposal sent — Gabriel revision.", trades: ["Cabinetry", "Countertop"] },
  { num: "2798", name: "300 Newburgh Polo Club", gc: "March Associates", arch: "Thomas J. Brennan Architects", resp: "Rocío", val: 800000, closing: 30, stage: "followup", last: "2025-09-16", notes: "Cabinetry proposal sent.", trades: ["Cabinetry"] },
  { num: "2701", name: "PG Blvd Apartments", gc: "Rimrock Construction", arch: "Jarrett Architecture", resp: "Becarios", val: 700000, closing: 30, stage: "dead", last: "2025-09-18", notes: "Project in construction phase — passed.", trades: ["Cabinetry", "Countertop", "Flooring", "Tile"] },
  { num: "2735", name: "Wasatch Rock Apartments", gc: "Rimrock Construction", arch: "Beecher Walker", resp: "Rocío", val: 600000, closing: 30, stage: "status", last: "2025-11-11", notes: "RVC invited us to bid.", trades: ["Cabinetry", "Countertop", "Flooring"] },
  { num: "2870", name: "64 Fulton (Finish Carpentry)", gc: "MJM Associates", arch: "SRAA+E", resp: "Gerardo", val: 650000, closing: 100, stage: "sold", last: "2026-03-30", notes: "Completed & submitted — awarded.", trades: ["Finish Carpentry"], takeoff: { "Finish Carpentry": "ready" } },
  { num: "2530", name: "22 Fulton", gc: "CM & Associates", val: 2650000, closing: 100, stage: "sold", last: null, notes: "Awarded.", trades: ["Cabinetry", "Countertop", "Flooring"] },
  { num: "2740", name: "Adamo at Ewing", gc: "FM Construction Group", arch: "Blackbird Group Architects", resp: "Javier", val: 1200000, closing: 100, stage: "sold", last: "2024-10-09", notes: "Awarded — common areas.", trades: ["Cabinetry", "Countertop", "Flooring", "Tile", "Finish Carpentry"] },
  { num: "2762", name: "SOHI Apartments", gc: "Head Waters CC", arch: "Beecher, Walker & Associates", resp: "Samantha", val: 700000, closing: 10, stage: "dead", last: null, notes: "No response — passed.", trades: ["Cabinetry", "Countertop", "Flooring", "Tile"] },
  { num: "2775", name: "Cache Valley Multifamily", gc: "Head Waters CC", arch: "Simonson & Associates", resp: "Rocío", val: 500000, closing: 10, stage: "dead", last: "2025-07-14", notes: "Proposal sent, no response.", trades: ["Cabinetry", "Countertop", "Flooring"] },
  { num: "2708", name: "Snow Park Village Hotel", gc: "Okland Construction", arch: "Sky Lab Architecture", val: 900000, closing: 10, stage: "dead", last: null, notes: "No email — passed.", trades: ["Cabinetry", "Countertop", "Flooring", "Tile", "Finish Carpentry"] },
];

const CONTACTS: Record<string, { name: string; email?: string }> = {
  "Levine Builders": { name: "Zach Barnett", email: "zbarnett@levinebuilders.com" },
  "M Y Developers": { name: "Mayer Spielman", email: "mayer@mydevelopersinc.com" },
  "K L Masters": { name: "Tim Besa", email: "TBESA@klmasters.com" },
};

const TEAM = [
  { name: "Rocío", email: "rocio@theabadigroup.com" },
  { name: "Gerardo", email: "gerardo@theabadigroup.com" },
  { name: "Samantha", email: "samantha@theabadigroup.com" },
  { name: "Cristina", email: "cristina@theabadigroup.com" },
  { name: "Julieta", email: "julieta@theabadigroup.com" },
  { name: "Sam", email: "sam@theabadigroup.com" },
  { name: "Javier", email: "javier@theabadigroup.com" },
];

async function main() {
  // Only seed an empty database — protects live data from being reset on future deploys.
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(`Seed skipped — database already has ${existingUsers} user(s).`);
    return;
  }

  // Users
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "gabriel@theabadigroup.com").toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "changeme-2026";
  const memberPass = "tag-temp-2026";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: "Gabriel", role: "ADMIN", passwordHash: await bcrypt.hash(adminPass, 10) },
  });
  for (const t of TEAM) {
    await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { email: t.email, name: t.name, role: "MEMBER", passwordHash: await bcrypt.hash(memberPass, 10) },
    });
  }

  // Contractors + contacts
  const gcNames = [...new Set(PROJECTS.map((p) => p.gc))];
  const gcMap: Record<string, string> = {};
  for (const name of gcNames) {
    const c = await prisma.contractor.upsert({ where: { name }, update: {}, create: { name } });
    gcMap[name] = c.id;
    const contact = CONTACTS[name];
    if (contact) {
      const exists = await prisma.contact.findFirst({ where: { contractorId: c.id, name: contact.name } });
      if (!exists) await prisma.contact.create({ data: { contractorId: c.id, name: contact.name, email: contact.email } });
    }
  }

  // Projects + takeoffs
  for (const p of PROJECTS) {
    const project = await prisma.project.upsert({
      where: { number: p.num },
      update: {
        name: p.name, contractorId: gcMap[p.gc], architect: p.arch, ownerRep: p.resp,
        stage: STAGE[p.stage] as never, closingPct: p.closing, value: p.val ?? null,
        lastContact: p.last ? new Date(p.last) : null, notes: p.notes ?? null,
      },
      create: {
        number: p.num, name: p.name, contractorId: gcMap[p.gc], architect: p.arch, ownerRep: p.resp,
        stage: STAGE[p.stage] as never, closingPct: p.closing, value: p.val ?? null,
        lastContact: p.last ? new Date(p.last) : null, notes: p.notes ?? null,
      },
    });
    await prisma.takeoff.deleteMany({ where: { projectId: project.id } });
    for (const tr of p.trades) {
      await prisma.takeoff.create({
        data: {
          projectId: project.id,
          trade: TRADE[tr] as never,
          status: (TSTAT[p.takeoff?.[tr] || "pend"] || "PENDING") as never,
        },
      });
    }

    // Quotes: one per trade — the money-and-status line (project·trade·version).
    await prisma.quote.deleteMany({ where: { projectId: project.id } });
    for (const tr of p.trades) {
      const status = QOVER[p.num]?.[tr] || baseStatus(p.stage);
      await prisma.quote.create({
        data: {
          projectId: project.id,
          trade: TRADE[tr] as never,
          version: tradeVersion(p.num, tr),
          value: quoteValue(p, tr),
          status: status as never,
        },
      });
    }
  }

  // Seed one proposal (Sparrow Square) if none exists
  const sparrow = await prisma.project.findUnique({ where: { number: "2743" } });
  if (sparrow && (await prisma.proposal.count({ where: { projectId: sparrow.id } })) === 0) {
    await prisma.proposal.create({
      data: {
        projectId: sparrow.id, tradeCode: "C", version: 5, quoteNumber: "2743.C.5",
        date: "05/20/2026", billName: "Levine Builders", contact: "Zach Barnett",
        email: "zbarnett@levinebuilders.com", projName: "Sparrow Square (Kingsboro)",
        projAddr: "7 Sparrow Way, Brooklyn, NY 11203", status: "SUBMITTED",
        summaryLines: { create: [
          { label: "Cabinetry", note: "See scopes for details", amount: 599462.29, sort: 0 },
          { label: "Distribution + Installation (as Add Alt)", note: "", amount: 0, sort: 1 },
        ] },
        alternates: { create: [
          { label: "Vanities — SHP1", amount: 34791.9, sort: 0 },
          { label: "Vanities — SHP2", amount: 10588.84, sort: 1 },
          { label: "Medicine Cabinets — SHP1", amount: 86940, sort: 2 },
          { label: "Medicine Cabinets — SHP2", amount: 26460, sort: 3 },
          { label: "TAG Cabinetry in lieu of Ketcham (Medicine Cabinets)", amount: -51192, sort: 4 },
          { label: "Cabinetry: TFL in lieu of HPL (incl. Vanities)", amount: -115084.39, sort: 5 },
          { label: "Distribution & Installation — residential & non-residential", amount: 202650.07, sort: 6 },
        ] },
        scopes: { create: [{
          trade: "Cabinetry", sort: 0, includePhase: true,
          phase: "Pre-production (shop drawings 2–4 wks) · Production 8–10 wks · Pre-installation site verification · Installation NOT in base price · Post-installation QC · OSHA / ADA compliance.\nExclusions: plumbing & electrical, disposal outside building, scribing / shoe moldings / caulking, structural modifications, sales tax.",
          products: { create: [
            { label: "Total Unit Kitchens", qty: "261", sort: 0 },
            { label: "Total Unit Kitchen types", qty: "9", sort: 1 },
            { label: "Total Amenities Kitchens", qty: "14", sort: 2 },
            { label: "Total Vanities", qty: "270 (Add Alt)", sort: 3 },
            { label: "Total Medicine Cabinets", qty: "270 (Add Alt)", sort: 4 },
          ] },
          materials: { create: [
            { label: "Door Style", value: "Slab", sort: 0 },
            { label: "Door / Carcass", value: "MDF Core · HPL Mouse 928 · Plywood Framed", sort: 1 },
            { label: "Hardware", value: "Soft-close hinges, full-ext slides, wire pulls", sort: 2 },
          ] },
        }] },
      },
    });
  }

  console.log("Seed complete:", { projects: PROJECTS.length, contractors: gcNames.length, team: TEAM.length + 1 });
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
