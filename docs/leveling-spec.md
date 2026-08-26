# TAG CRM — Leveling module

Build spec. Written against the existing schema, conventions and trade codes in `Gabadi-A/TAG-CRM`.

---

## Why this exists

Today `Quote.value` is a single float. It records what we told the client, and nothing about how we got there. But the real estimate does not come from the takeoff — it comes from a live RFP to the factories and vendors who will actually make the work, levelled so the quotes are comparable, plus the costs the factory does not carry, plus margin.

That whole calculation currently happens outside the app, which means the number in the CRM is an answer with no working. This module puts the working next to the answer.

It also solves a problem that has already cost real money: **Atlantic Club cabinetry was quoted in December 2023 and sold in August 2025.** Twenty months. No factory quote holds for twenty months, and nothing anywhere flagged that it had gone stale.

---

## Schema additions

Append to `prisma/schema.prisma`. Existing models are unchanged except `Quote`, noted at the end.

```prisma
enum VendorType {
  FACTORY
  FABRICATOR
  DISTRIBUTOR
  SUBCONTRACTOR
  OTHER
}

enum RfpStatus {
  DRAFT        // building the package
  SENT         // out to vendors
  QUOTED       // at least one quote back
  LEVELLED     // adjustments entered, comparable
  AWARDED      // a vendor has been chosen
  CANCELLED
}

enum VendorQuoteStatus {
  AWAITING     // package sent, nothing back
  CHASED
  QUOTED
  NO_BID
  DECLINED
  AWARDED
}

enum Incoterm {
  FOB
  CIF
  DDP
  EXW
  DAP
  DOMESTIC     // no incoterm — domestic vendor
}

model Vendor {
  id          String        @id @default(cuid())
  name        String        @unique
  type        VendorType    @default(FACTORY)
  country     String?
  contactName String?
  email       String?
  phone       String?
  trades      TradeType[]                        // which trades they quote
  active      Boolean       @default(true)
  notes       String?       @db.Text
  quotes      VendorQuote[]
  createdAt   DateTime      @default(now())
}

/// One RFP per project per trade. This is the thing you level.
model Rfp {
  id         String        @id @default(cuid())
  project    Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  projectId  String
  trade      TradeType
  status     RfpStatus     @default(DRAFT)
  scopeNote  String?       @db.Text             // what is being priced, and what is excluded
  issuedAt   DateTime?
  dueBack    DateTime?
  lines      RfpLine[]
  quotes     VendorQuote[]
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt

  @@unique([projectId, trade])                   // one live RFP per trade per project
}

/// The scope lines being priced. Shared across every vendor on this RFP —
/// that is what makes the quotes comparable.
model RfpLine {
  id      String            @id @default(cuid())
  rfp     Rfp               @relation(fields: [rfpId], references: [id], onDelete: Cascade)
  rfpId   String
  label   String                                 // "Kitchens", "Ocean freight", "Hardware"
  note    String            @default("")
  qty     Float?
  uom     String            @default("")         // EA / SF / LF / SET
  sort    Int               @default(0)
  prices  VendorLinePrice[]
}

model VendorQuote {
  id            String            @id @default(cuid())
  rfp           Rfp               @relation(fields: [rfpId], references: [id], onDelete: Cascade)
  rfpId         String
  vendor        Vendor            @relation(fields: [vendorId], references: [id])
  vendorId      String
  status        VendorQuoteStatus @default(AWAITING)
  quoteRef      String            @default("")   // their reference, e.g. JT-ABA-2609
  quotedAt      DateTime?
  validDays     Int?                             // validity period they stated
  expiresAt     DateTime?                        // quotedAt + validDays, stored so it is queryable
  incoterm      Incoterm?
  leadTimeWeeks Int?
  notes         String?           @db.Text
  prices        VendorLinePrice[]
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@unique([rfpId, vendorId])                    // a vendor quotes an RFP once
}

/// One cell of the leveling matrix.
model VendorLinePrice {
  id               String      @id @default(cuid())
  rfpLine          RfpLine     @relation(fields: [rfpLineId], references: [id], onDelete: Cascade)
  rfpLineId        String
  vendorQuote      VendorQuote @relation(fields: [vendorQuoteId], references: [id], onDelete: Cascade)
  vendorQuoteId    String
  quoted           Float       @default(0)
  adjustment       Float       @default(0)       // add back what this vendor excluded
  adjustmentReason String      @default("")      // why, and where the number came from

  @@unique([rfpLineId, vendorQuoteId])
}

/// The costs the factory does not carry. One set per Quote.
model QuoteCostLine {
  id      String @id @default(cuid())
  quote   Quote  @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  quoteId String
  label   String                                 // "Warehouse assembly labour"
  amount  Float  @default(0)
  source  String @default("")                    // "Pieces x rate", "Trucking quote"
  sort    Int    @default(0)
}
```

### Changes to `Quote`

```prisma
model Quote {
  // ... existing fields unchanged ...
  awardedQuote   VendorQuote?    @relation(fields: [awardedQuoteId], references: [id])
  awardedQuoteId String?
  marginPct      Float           @default(0)     // stored as 0.135 for 13.5%
  validUntil     DateTime?                       // our validity to the client
  costLines      QuoteCostLine[]
}
```

Add the matching back-relations on `Project` (`rfps Rfp[]`) and `VendorQuote` (`quotes Quote[]`).

---

## Derived values — compute, never store

Storing these creates two sources of truth, which is the exact failure this whole exercise is about.

| Value | Formula |
|---|---|
| Line levelled | `quoted + adjustment` |
| Vendor quote total | sum of levelled across all its lines |
| Lowest levelled per line | min across quoting vendors |
| Awarded factory cost | sum of levelled on the awarded quote |
| Total cost | awarded factory cost + sum of `QuoteCostLine.amount` |
| Margin USD | `totalCost / (1 - marginPct) - totalCost` |
| Sell price | `totalCost + marginUSD` |
| Quote expired | `expiresAt < now()` |
| Days to expiry | `expiresAt - now()` |

Put these in `src/lib/calc.ts` alongside what is already there.

**Margin is calculated on sell price, not marked up on cost.** On a $1.84m cost at 13.5%, that is a $2.13m sell price, not $2.09m — a $40k difference.

---

## Server actions

`src/lib/actions/leveling.ts`, following the pattern in `projects.ts` — `"use server"`, `requireAdmin()`, `logActivity()`, `revalidateAll()`.

```
createVendor(formData)
updateVendor(formData)
archiveVendor(formData)              // active = false, never delete

createRfp(formData)                  // projectId, trade
addRfpLine(formData)
updateRfpLine(formData)
deleteRfpLine(formData)
issueRfp(formData)                   // sets status SENT, stamps issuedAt, requires >= 1 line

inviteVendor(formData)               // creates VendorQuote at AWAITING
recordQuote(formData)                // amount per line + quotedAt, validDays, incoterm, leadTimeWeeks
markNoBid(formData)
chaseVendor(formData)                // status CHASED, logs activity
setLinePrice(formData)               // quoted, adjustment, adjustmentReason
awardVendor(formData)                // exactly one per RFP; clears any prior award

addCostLine(formData)
updateCostLine(formData)
setMargin(formData)
setQuoteValidity(formData)
syncQuoteValue(formData)             // writes computed sell price into Quote.value
```

`revalidateAll()` should gain `/vendors` and `/projects/[id]/leveling`.

Activity strings, matching the existing voice: `"Issued RFP — Cabinetry"`, `"Recorded quote from PT Cabinets"`, `"Awarded Cabinetry to PT Cabinets"`, `"Set margin to 13.5%"`.

---

## Validation rules

These are the SOP gates, enforced in code rather than remembered.

**Blocking — refuse the action:**

1. `issueRfp` requires at least one `RfpLine`.
2. `recordQuote` requires `quotedAt`, `validDays`, `incoterm` and `leadTimeWeeks`. A quote without them cannot be levelled or compared.
3. `awardVendor` requires that quote's status to be `QUOTED`.
4. Moving a `Quote` to `READY` or `SENT` fails if the awarded vendor quote has expired.
5. `Quote.validUntil` cannot exceed the awarded vendor quote's `expiresAt`. **Selling a twelve-month price on a ninety-day quote sells margin you do not have.**

**Warning — allow, but surface it:**

6. Fewer than three vendors at `QUOTED` on an awarded RFP. One quote is not a price, it is an opinion.
7. A `VendorLinePrice` with a non-zero `adjustment` and an empty `adjustmentReason`. Six months later that reason is the only record of why the cheap quote was not the cheap quote.
8. Any vendor quote expiring within 21 days on a project not yet `SOLD`.
9. Awarding a vendor who is not lowest on levelled total, without a note.

---

## Screens

### `/vendors`
List with name, type, country, trades, active. Row opens an editor. Filter by trade — that is how you build an RFP distribution list.

### `/projects/[id]/leveling`
The main screen. Tabs across the six trades; only trades with a `Takeoff` or `Quote` are enabled.

Per trade:

- **Header** — RFP status, issued date, due back, days out, a chase button.
- **Vendor strip** — invited vendors as columns, each showing status, quote reference, lead time, incoterm, and days-to-expiry. **Red when expired, amber under 21 days.**
- **Leveling matrix** — rows are `RfpLine`, columns are vendors, three sub-columns each: quoted, adjustment, levelled. Lowest levelled per row highlighted. Totals row at the bottom.
- **Award** — one button per vendor column. Awarding clears any previous award and logs it.

### `/projects/[id]/quotes/[quoteId]/price`
The sell-price buildup.

```
A   Awarded factory cost (levelled)     — read-only, from the award
B…  Cost lines                          — editable, with a source note on each
    Total cost                          — computed
    Margin %                            — input
    Margin USD                          — computed
    SELL PRICE                          — computed
```

A single button writes the sell price into `Quote.value` and stamps `validUntil`. Nobody types the sell price by hand.

Default cost lines to seed on a new quote: freight and duty not in the factory quote · hardware bought separately · warehouse assembly labour · delivery to site · installation labour · site supervision · contingency.

### Dashboard additions
Two widgets, matching the urgent-follow-ups one already there:

- **Quotes expiring** — awarded vendor quotes inside 21 days on projects not yet `SOLD`.
- **RFPs overdue** — past `dueBack` with vendors still `AWAITING`.

---

## Permissions

Same model as everywhere else: `requireAdmin()` on every write, MEMBER read-only. Worth considering later whether estimators should write to leveling without full admin — but not in v1.

---

## Migration

```
npx prisma migrate dev --name leveling
```

Additive only; nothing existing changes shape. `Quote.awardedQuoteId`, `marginPct` and `validUntil` are nullable or defaulted, so existing rows are unaffected.

Extend `prisma/seed.ts` with the vendors already in use: PT Cabinets / Felix C.L.K. (factory, Taiwan), Chinatown Building Materials (hardware), plus your flooring vendors.

---

## What this replaces

`TAG-TPL-03 — RFP and Vendor Leveling.xlsx` retires the day this ships. Everything in it maps across: the RFP log becomes `Rfp` + `VendorQuote`, the leveling matrix becomes `RfpLine` × `VendorLinePrice`, the sell-price buildup becomes `QuoteCostLine` + margin, and the CHECK tab becomes the validation rules above.

`TAG-SOP-02 — Sales` gets rewritten against these screens and the eight pipeline stages, so the procedure describes what the team actually clicks.

**One rule to hold onto:** once this ships, the app owns vendor pricing and the spreadsheet does not. Keeping both alive for a transition period is how you end up with two numbers and no way to tell which is right.
