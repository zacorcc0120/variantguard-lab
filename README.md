# VariantGuard Lab

**Language**: English. 简体中文版见 [README.zh-CN.md](./README.zh-CN.md)。

An experimental browser-only risk checker for Shopify product CSV overwrite imports.

Not validated against a production Shopify store. A clean report does not guarantee a safe import.

You give it two files:

- **`baseline.csv`** — your store's current product export.
- **`proposed.csv`** — the file you are about to import.

It reports, row by row, which parts of your catalogue would change in ways you did
not intend: variants that have no row left in the file, stock cleared by an empty
cell, option values that make Shopify recreate a variant, handles that quietly
create a second product instead of updating the first.

**It never talks to Shopify, never asks for an account or token, and never sends
your data anywhere.** Both files are read with `File.arrayBuffer()` in the page and
decoded there, including UTF-16.

---

## Quick start

```bash
npm install
npm run dev      # http://localhost:4310
```

Production build:

```bash
npm run build
npm run start    # http://localhost:4310
```

Tests:

```bash
npm test              # 383 tests in 7 files, as of 2026-10-17
npm run test:watch
npm run verify        # typecheck + lint + test + production build
```

There is no login, no database, no backend route and no telemetry. `src/app` contains
one page and no API handlers. PapaParse is the CSV parser. Next.js and React are also
runtime dependencies; they draw the page and do not receive the CSV. Tailwind is a
build-time dependency.

---

## The one idea that makes this work

Shopify documents the overwrite contract precisely:

> "If a non-required column in the import CSV file is blank, then the matching value in
> the product list is overwritten as blank."
>
> "If a non-required column isn't included in the import CSV file, but is included in
> the existing product list, then the value in the product list remains the same."

So three states must never be collapsed into each other:

| State | Meaning | Consequence |
|---|---|---|
| **absent** | the column is not in this file | stored value survives |
| **empty** | the column exists, this cell is zero-length | stored value is overwritten with blank |
| **value** | a non-zero-length string | stored value is overwritten with this |

Every cell in this tool is one of those three (`src/lib/csv/cell.ts`). A whitespace-only
cell counts as a **value**, because that is what Shopify sees — and it is a classic
source of silent mismatches.

Almost every rule in this tool is a consequence of that table. `VG-PRD-006` (dropping a
column preserves data) and `VG-VAR-007` (blanking a cell clears it) are the same fact
pointing in opposite directions.

---

## What it is honest about

Three things this tool will not do:

1. **It does not claim to know what Shopify will do.** Findings are inferences from
   Shopify's published CSV rules plus merchant reports. They are not observed import
   results.
2. **It does not detect every risk.** A clean report means no rule fired, not that the
   import is safe.
3. **It does not hide its weak spots.** Each of the six [detection assumptions](src/lib/analysis/assumptions.ts)
   is a toggle in the UI. Flip one and the report recomputes, so you can see exactly how
   many findings depend on a behaviour Shopify has never documented.

Findings are tagged with a basis:

- `documented` — a verbatim Shopify statement backs it.
- `inference` — follows from documented behaviour, but Shopify does not state it for
  this exact case.
- `heuristic` — pattern matching, no official basis.

The single most important caveat is stated in the UI, not buried here:

> **A variant that exists in the store but has no row in the file is deleted by the
> import** — this is `community`-sourced. Shopify documents that editing an option
> value "sees this as creating new variants. Consequently, the previous variants and
> their inventory are removed" (Shopify Support, quoted by a merchant in
> [community.shopify.com/t/inventory-values-deleted-from-csv-upload/260795](https://community.shopify.com/t/inventory-values-deleted-from-csv-upload/260795)),
> and that variants omitted from a file are removed is repeated across merchant reports.
> But Shopify's product CSV documentation contains **no statement either way** about a
> variant missing from the upload. `VG-VAR-001` is therefore labelled `inference`, and
> the assumption it rests on is a toggle, not a footnote.

See [docs/LIMITATIONS.md](docs/LIMITATIONS.md) for the full list, and
[docs/SHOPIFY-SEMANTICS.md](docs/SHOPIFY-SEMANTICS.md) for the verified doc quotes,
including two of my own starting assumptions that verification disproved.

---

## Rules

26 rules, listed in [docs/RULES.md](docs/RULES.md) with the evidence behind each one.
Severity summary:

- **High (9)** — data loss, validation failure, or something that will silently not
  work: missing variant rows, option value changes, blanked inventory, duplicate option
  combinations, blank Title on an update row, blank Status cell.
- **Medium (11)** — real damage that is recoverable or visible, plus a content row that
  has no Handle and was not compared: hidden products, dropped columns, cleared variant
  fields, duplicate SKUs, removed image rows.
- **Low (6)** — informational: new products, large-but-intentional price moves,
  compare-at prices, unrecognised columns.

Parse-level problems (encoding, ragged rows, duplicate headers, missing `Handle`) are
reported as their own `VG-FMT-PARSE-*` findings at the point they are detected, before
any comparison, because a structurally broken file makes every downstream comparison
unreliable.

---

## Demo scenarios

Sixteen scenarios ship in `src/lib/samples.ts`. They are **the same fixtures the test
suite asserts against**, so a rule that passes in CI is the rule you click through in
the demo. They cover normal operation, dangerous operations, malformed input and
false-positive traps:

`clean` · `missing-variant` · `option-rename` · `inventory-blanked` ·
`inventory-zeroed` · `handle-typo` · `column-dropped` · `duplicate-options` ·
`unpublish` · `option-swap` · `sku-duplicates` · `status-blank` · `quoted-newlines` ·
`title-wiped` · `image-rows-removed` · `everything`

No Shopify account is needed to try any of them.

---

## How it is built

```
src/
  lib/
    csv/
      cell.ts        three-state cell semantics — the foundation
      parseCsv.ts    PapaParse wrapper: BOM/encoding, ragged rows,
                     duplicate headers, exact physical line numbers
    shopify/
      schema.ts      column table, each entry carrying its evidence level
      model.ts       rows -> products / variants / images
    analysis/
      assumptions.ts the six toggles and their provenance
      rules.ts       the 26 rules
      engine.ts      orchestration + summary
    report/export.ts CSV and JSON report writers
    samples.ts       demo scenarios / test fixtures
  components/        React UI (report, assumptions, findings, diff preview)
tests/               csv.test.ts + analysis.test.ts
docs/                rules, limitations, verified semantics, competitive overlap
```

### Two parsing details worth knowing

**Physical line numbers are exact even when cells contain newlines.** A quoted cell
containing `\n` means CSV record 5 can start at physical line 9. Merchants paste line
numbers into support tickets, so a finding that points at the wrong line is worse than
no finding. `parseCsv` tracks newlines inside each record's own cells to compute the
exact start line, and reports `lineSpan` when a record covers more than one line. There
is a test for this (`reports the exact physical line of a record containing a newline`).

**`Type` is not a row discriminator.** Shopify documents `Type` as a free-text custom
category label ("Cooling sheets") — not `Product` / `Variation` / `Image`. Using it to
classify rows would misclassify every product with a custom type. Rows are classified by
which columns are filled. See [docs/SHOPIFY-SEMANTICS.md](docs/SHOPIFY-SEMANTICS.md).

### Variant matching

Matching variants by option key alone would report an option rename as "one variant
deleted, one created" — losing the single fact the merchant needs. `pairVariants`
matches in passes and records how each pair was matched:

1. exact option key → `option-key`
2. unique SKU → `sku` (this is how a rename gets identified as a rename)
3. ordinal, only when the variant count is unchanged → `ordinal`

---

## Dependencies

| Package | License | Why |
|---|---|---|
| [PapaParse](https://www.papaparse.com/) 5.7.0 | MIT | RFC 4180 parsing including quoted newlines; actively maintained |
| Next.js 15.5.28 | MIT | App shell |
| React 19 / Tailwind 4 / Vitest 3 | MIT | UI, styling, tests |

PapaParse 5.7.0 declares no `dependencies` of its own. That is a statement about the
parser, not about the app. The app's runtime dependencies are Next.js, React, React DOM
and PapaParse.

PapaParse handles CSV parsing. Framework and dependency versions are recorded in
`package-lock.json`. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution.

## Verification

```bash
npm run verify       # typecheck + lint + test + production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # 383 tests in 7 files, as of 2026-10-17
```

ESLint uses a flat config built from `@next/eslint-plugin-next` + `typescript-eslint` rather than
`eslint-config-next`, because that preset depends on `@rushstack/eslint-patch`, which fails under
ESLint 9.

---

## Competitive overlap

Read this before assuming the tool is novel. It overlaps with existing products, and the
honest summary is in [docs/COMPETITIVE-OVERLAP.md](docs/COMPETITIVE-OVERLAP.md):

- Matrixify, Ablestar, CSVwise, Portaim and others are described in older notes as doing
  validation before writing to Shopify. Those notes were not re-checked for this release.
  This tool does not write, map or schedule imports.
- The experiment compares two files with no shop connection and reports omission
  semantics — "this row is missing, so this variant is not in the file". That is the
  scope. It is not a claim that no other product does this. See
  [docs/COMPETITIVE-OVERLAP.md](docs/COMPETITIVE-OVERLAP.md).
- This is an open-source experiment. Demand, repeat usage and willingness to pay
  have not been validated.

## Licence

MIT. See [LICENSE](LICENSE). Interface languages are described in [docs/I18N.md](docs/I18N.md).

`npm run test:coverage` needs `@vitest/coverage-v8`, which is not installed. The script is not a working coverage command until that devDependency is added.
