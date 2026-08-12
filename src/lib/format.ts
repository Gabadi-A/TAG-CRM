export const STAGES: { key: string; label: string }[] = [
  { key: "TRIAGE", label: "Triage" },
  { key: "TAKEOFF", label: "Takeoff" },
  { key: "REVISION", label: "In Revision" },
  { key: "READY", label: "Ready to Submit" },
  { key: "FOLLOWUP", label: "Submitted – Follow Up" },
  { key: "STATUS", label: "Status?" },
  { key: "SOLD", label: "Sold" },
  { key: "DEAD", label: "Dead" },
];
export const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  STAGES.map((s) => [s.key, s.label])
);

export const TRADES = [
  "Cabinetry",
  "Countertop",
  "Flooring",
  "Tile",
  "Finish Carpentry",
  "Millwork",
];

// Map between the display trade name and the Prisma TradeType enum value.
export const TRADE_ENUM: Record<string, string> = {
  Cabinetry: "CABINETRY", Countertop: "COUNTERTOP", Flooring: "FLOORING",
  Tile: "TILE", "Finish Carpentry": "FINISH_CARPENTRY", Millwork: "MILLWORK",
};
export const TRADE_LABEL: Record<string, string> = {
  CABINETRY: "Cabinetry", COUNTERTOP: "Countertop", FLOORING: "Flooring",
  TILE: "Tile", FINISH_CARPENTRY: "Finish Carpentry", MILLWORK: "Millwork",
};
export const TRADE_CODE: Record<string, string> = {
  Cabinetry: "C", Countertop: "T", Flooring: "F", Tile: "TL", "Finish Carpentry": "FC", Millwork: "M",
};

// Quote status: label + CSS class (see globals.css .qs.*)
export const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "draft" },
  READY: { label: "Ready to submit", cls: "ready" },
  SENT: { label: "Sent", cls: "sent" },
  REVISION: { label: "In revision", cls: "revision" },
  HOLD: { label: "On hold", cls: "hold" },
  WON: { label: "Won", cls: "won" },
  LOST: { label: "Lost", cls: "lost" },
};
export const QUOTE_STATUS_KEYS = ["DRAFT", "READY", "SENT", "REVISION", "HOLD", "WON", "LOST"];
export const isOpenQuote = (s: string): boolean => s !== "WON" && s !== "LOST";

// Quote number, e.g. 2743.C.5 — matches the proposal builder's format.
export const quoteNumber = (projectNumber: string, tradeEnum: string, version: number): string =>
  `${projectNumber}.${TRADE_CODE[TRADE_LABEL[tradeEnum]] || "X"}.${version}`;

export const money = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};
export const fmt = (n: number | null | undefined): string =>
  n == null ? "—" : "$" + Math.round(n).toLocaleString();
export const fmtK = (n: number | null | undefined): string =>
  n == null
    ? "—"
    : "$" + (Math.abs(n) / 1_000_000 >= 1
        ? (n / 1_000_000).toFixed(2) + "M"
        : Math.round(n / 1000) + "K");
export const fmtAmt = (n: number): string =>
  n < 0 ? "(" + "$" + Math.round(-n).toLocaleString() + ")" : "$" + Math.round(n).toLocaleString();

export const daysSince = (d: Date | string | null | undefined): number | null => {
  if (!d) return null;
  const t = Date.now() - new Date(d).getTime();
  return Math.floor(t / 86_400_000);
};

export const pctColor = (p: number): string =>
  p >= 90 ? "var(--s6)" : p >= 75 ? "var(--s3)" : p >= 50 ? "var(--s4)" : p >= 30 ? "var(--s2)" : "var(--s8)";
