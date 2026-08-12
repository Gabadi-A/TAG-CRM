import { money } from "./format";

export type LineLike = { amount: number | string };

/** Sum of price-summary lines. */
export function subtotal(lines: LineLike[]): number {
  return lines.reduce((s, l) => s + money(l.amount), 0);
}

/**
 * Grand total mirroring the Excel Summary sheet:
 *   subtotal + salesTax + (discount = subtotal * -discountPct/100)
 */
export function grandTotal(lines: LineLike[], discountPct = 0, salesTax = 0): number {
  const sub = subtotal(lines);
  const discount = sub * (-discountPct / 100);
  return sub + salesTax + discount;
}

export function discountAmount(lines: LineLike[], discountPct = 0): number {
  return subtotal(lines) * (-discountPct / 100);
}

/**
 * Trade pricing helper (the "pricing layer"): quantity × unit price for each
 * line, plus flat adders (shipping, delivery, install, hardware).
 */
export type PriceLine = { label: string; qty: number; unit: number };
export function priceLinesTotal(lines: PriceLine[]): number {
  return lines.reduce((s, l) => s + l.qty * l.unit, 0);
}
