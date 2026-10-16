# Rule inventory

26 rules, plus parse-level findings emitted before any comparison.

Severity shown is the rule's default. Several rules escalate or downgrade per instance
based on the field involved or the active assumptions — `VG-VAR-007` is Medium by default
and High for price and fulfilment-policy fields.

`basis` is the evidential strength:

| basis | meaning |
|---|---|
| `documented` | a verbatim Shopify statement backs the finding (see [SHOPIFY-SEMANTICS.md](SHOPIFY-SEMANTICS.md)) |
| `inference` | follows from documented behaviour, but Shopify does not state it for this exact case |
| `heuristic` | pattern matching with no official basis |

---

## Format and file structure

| Rule | Title | Sev | basis |
|---|---|---|---|
| `VG-FMT-001` | Column is not a recognised Shopify product CSV column | low | documented |
| `VG-FMT-002` | Variant metafield column will not be applied | medium | documented |
| `VG-FMT-003` | Leading or trailing whitespace in an identity column | medium | heuristic |
| `VG-FMT-004` | Status column present but blank | high | documented |
| `VG-FMT-005` | Row with content has no Handle and was not compared | medium | heuristic |

### `VG-FMT-001` — unrecognised column
**Evidence.** Shopify: *"The Collection column is the only column that you can add to the
CSV file that doesn't break the format."*
**Behaviour.** Lists every header in either file that is neither a documented product CSV
column nor a metafield.
**Why it exists.** A column with a typo is silently ignored by the importer. A merchant
who added a column expects it to apply; it will not.
**False positives.** Intended — `Collection` and metafield headers are excluded by the
schema and the metafield matcher, so a correct file produces none.

### `VG-FMT-002` — variant metafield column
**Evidence.** Shopify: *"Variant metafields aren't supported for product CSV import/export."*
**Behaviour.** Reports `[Variant Metafield: ns.key]` columns in either file.
**Why it exists.** A merchant who adds the column, fills it, imports successfully, and sees
nothing change has no way to tell the difference between "not supported" and "I made a
mistake". Silence is the worst outcome here.
**Why Medium not High.** No existing data is destroyed.

### `VG-FMT-003` — whitespace in an identity column
**Basis.** heuristic. Not documented.
**Behaviour.** Flags leading/trailing whitespace in `Handle` and `OptionN Value`.
**Why it exists.** This tool trims before matching, so `"Black "` and `"Black"` match
here. Shopify's exact comparison behaviour is undocumented. Reporting it tells the user
their file has a defect regardless of which way Shopify resolves it.
**False-positive risk.** Low, and the wording does not claim Shopify will or will not
match.

### `VG-FMT-004` — blank `Status` cell
**Evidence.** Shopify: *"If this column is present, then it needs a value."*
**Behaviour.** Any row in the proposed file with a `Status` column present and the cell
blank.
**Why High.** This is a validation failure, not a reset to active. The merchant believes
they left status alone.

### `VG-FMT-005` — content row with no Handle
**Basis.** heuristic. The row is excluded because this tool keys comparison on Handle,
not because Shopify has documented what an empty Handle cell does.
**Behaviour.** A data row whose Handle cell is empty, and which still has another
non-blank cell, produces one Medium finding. The finding names `baseline` or `proposed`
and the physical line. A row of empty cells does not.
**Why it exists.** Without it, those cells are absent from every other rule, and a
report with no findings can be read as "every row was checked".

---

## Product level

| Rule | Title | Sev | basis |
|---|---|---|---|
| `VG-PRD-001` | Product in baseline missing from proposed file | low | documented |
| `VG-PRD-002` | New product appears in the proposed file | low | inference |
| `VG-PRD-003` | Product appears to have been renamed via Handle | medium | heuristic |
| `VG-PRD-004` | Product will become unpublished or hidden | medium | documented |
| `VG-PRD-005` | Title cleared on a row that updates an existing product | high | documented |
| `VG-PRD-006` | Column dropped / added between the two files | medium | documented |

### `VG-PRD-001` — missing product, **Low**
**Evidence.** Shopify: *"CSV files can't be used to delete products in bulk."*
**Behaviour.** A handle in baseline with no rows at all in proposed.
**Why Low, and why this matters.** This is the deliberate asymmetry with `VG-VAR-001`.
A product simply absent from a CSV survives; a *variant* absent from a product that is
present is a different and much more dangerous case. Escalates to High if the user turns
off `absentProductIsRetained`.
**False-positive control.** Listed for completeness so the user can confirm the omission
was deliberate. Not actionable.

### `VG-PRD-002` — new product, **Low**
**Behaviour.** A handle present only in proposed.
**Why it exists.** A typo that creates a second product instead of updating one shows up
here too, as a creation event. Cross-referenced by `VG-PRD-003`.

### `VG-PRD-003` — handle rename, **Medium**
**Basis.** heuristic. Shopify documents handle matching but not rename behaviour.
**Behaviour.** For each handle that vanished, looks for a new handle sharing SKUs or the
same title. Requires either a unique SKU match or an identical title.
**Why it matters.** Shopify matches by handle, so a changed handle creates a second
product and leaves the original untouched. This is the "I imported and nothing changed"
failure, and it also silently duplicates catalogue entries.
**False-positive control.** Requires actual content overlap (shared SKU or identical
title), not edit distance, so two unrelated new products are not linked. The score is
shown in the finding.

### `VG-PRD-004` — hidden product, **Medium**
**Evidence.** Shopify documents `Status` and `Published on online store`.
**Behaviour.** Compares `Status`, `Published on online store`, plus legacy `Published` and
`Publishable Status`. Only fires when the product is currently visible.
**Why Medium.** No data is lost and the import succeeds; the product just disappears from
the storefront. Highly visible once noticed, invisible until then.

### `VG-PRD-005` — blank Title, **High**
**Evidence.** Shopify: *"When you update products using a CSV file, the only required
columns are URL handle and Title."* Plus the blank-clears rule.
**Behaviour.** Title has a value in baseline, is blank in proposed, and the handle exists
in both.
**Why High.** A blank clears a required field on the update path. A find-and-replace that
clears titles is a realistic way to break a whole export.
**False-positive control.** Title is only required on the product row; continuation rows
for the same product legitimately have it blank, and the rule checks the product row.

### `VG-PRD-006` — column dropped or added
**Evidence.** Both halves of the overwrite contract, plus: *"If a non-required column is
included in the import CSV file that relies on other column data not included in the file,
then existing data is deleted or removed."*
**Behaviour.** Compares header sets. Escalates to **High** when a dropped column is
dependency-critical — `Variant SKU` dropped while `Option1 Value` remains, or `Option1
Name` dropped while `Option1 Value` remains. This is the exact case Shopify documents as
destructive.
**Why it is not noise.** Dropping a column is usually the *correct* way to preserve a
value. The finding explains that, so it teaches the contract rather than scolding.

---

## Variant level

| Rule | Title | Sev | basis |
|---|---|---|---|
| `VG-VAR-001` | Variant has no row in the proposed file | high | **inference** |
| `VG-VAR-002` | Option value changed — Shopify recreates the variant | high | documented |
| `VG-VAR-003` | Product now uses fewer option positions | high | inference |
| `VG-VAR-004` | Duplicate option combination | high | documented |
| `VG-VAR-005` | Handle starts a second product block | high | documented |
| `VG-VAR-006` | Option value moved to a different position | high | documented |
| `VG-VAR-007` | Variant field will be cleared | medium→high | documented |
| `VG-VAR-008` | Inventory zeroed or reduced sharply | high | documented |
| `VG-VAR-009` | SKU changed, cleared or duplicated | medium | heuristic |
| `VG-VAR-010` | Price change unusually large | low | heuristic |
| `VG-VAR-011` | Compare-at price set | low | heuristic |
| `VG-VAR-012` | Single-option product not using "Default Title" | low | documented |
| `VG-VAR-013` | Image rows removed | medium | inference |
| `VG-VAR-014` | Option name changed | medium | heuristic |
| `VG-VAR-015` | Gap in option positions | medium | heuristic |

### `VG-VAR-001` — missing variant row, **High, inference**
**The most consequential rule in the tool, and the least well documented.**
**Evidence.** None from Shopify. Community reports of silent variant deletion (see [Shopify semantics](SHOPIFY-SEMANTICS.md)) plus Shopify Support's quoted "creating new variants. Consequently, the
previous variants and their inventory are removed."
**Behaviour.** Every baseline variant with no counterpart under a matching handle.
**How it is qualified.** The finding names the assumption (`absentVariantIsDeleted`), shows
the assumption's own provenance, and downgrades to Low when the user toggles it off. The
finding never disappears — only its severity changes — so the user can see the omission
under either reading.
**If this assumption is wrong**, the tool's highest-severity output is wrong in the
noisy direction. That is the first thing to verify against a real store.

### `VG-VAR-002` — option value changed, **High, documented**
**Evidence.** Shopify: *"Changing data in the Option1 value, Option2 value, or Option3
value columns of the product CSV file deletes existing variant IDs, and creates new
variant IDs."*
**Behaviour.** Requires a pair matched by SKU or ordinal — that is, an option key that
did *not* match but whose row did. Reports per changed position.
**Why the pairing matters.** Without the SKU/ordinal fallback pass, renaming "Black" to
"Jet" looks like a deletion plus a creation and the merchant never learns why.
**What it does not claim.** It does not claim inventory is lost. Shopify documents variant
ID destruction, not inventory loss, and the rule does not extend the claim.

### `VG-VAR-003` — fewer option positions, **High, inference**
Compares the maximum filled option positions per product. Documents that collapsing two
positions into one is a common cause of accidental variant collapse.

### `VG-VAR-004` — duplicate option combination, **High, documented**
**Evidence.** *"Validation failed: options are not unique…"*
Compares after normalisation, so trailing spaces and Unicode form differences count as
duplicates. The finding says so explicitly, because the row pair can look distinct to a
human.

### `VG-VAR-005` — handle starts a second product block, **High, documented**
**Evidence.** *"Ignored line # because handle already exists."*
**Behaviour.** Counts rows carrying product-level data (Title, Vendor or an option name)
per handle. Two such rows for one handle means two product blocks.
**Why it is not "duplicate handle".** The naive implementation — flag any handle appearing
on more than one row — fires on every multi-variant product, because repeating the handle
across a product's own variant and image rows is the format's normal structure. It did
exactly that during development. The rule also surfaces the Title/Vendor disagreement when
there is one, which is the more actionable half.

### `VG-VAR-006` — option value moved position, **High, documented**
**Evidence.** *"The CSV import fails when a file tries to assign an existing option value
to a new option position…"*
**Behaviour.** A value present in the baseline at position *j* now appears at position *i*
where it never appeared in the baseline. Detects a swapped Size/Color pair.
**Why High.** Documented hard failure — the import fails outright rather than corrupting.

### `VG-VAR-007` — variant field cleared, **Medium, escalates to High**
**Evidence.** The blank-clears rule.
**Behaviour.** For each matched variant pair, any variant-scoped field with a baseline
value and a blank proposed cell.
**Escalates to High** for `Variant Price` and the fulfilment/tax/inventory-policy fields,
because an empty price takes a variant off sale and a changed policy changes fulfilment
behaviour. Category switches to `inventory` for inventory fields.
**Suppressed** to Low when `blankClearsMissingPreserves` is off.

### `VG-VAR-008` — inventory, **High**
**Evidence.** Blank-clears, plus `On hand (new)` being the documented set-quantity column.
**Three branches.**
1. *Blank cell* where baseline had stock → High. Clearing numbers to retype them clears
   the stock. **The single most common accidental inventory loss.**
2. *Zero* where baseline had stock → High.
3. *Large decrease* — at least 50% **and** at least 5 units → Medium, heuristic. Both
   thresholds are required so ordinary stock movement does not fire.
**Suppressed** to Low when `blankClearsMissingPreserves` is off.
**False-positive control.** Skips variants whose baseline quantity was already 0, so
`everything`-style scenarios do not report clearing a zero.

### `VG-VAR-009` — SKU changed, cleared or duplicated, **Medium, heuristic**
Two checks: the same SKU on multiple variants anywhere in proposed, and per-variant
changes against baseline.
**Why SKU duplicates matter without being a validation error.** A shared SKU cannot uniquely identify a variant without additional option data. Shopify will happily accept the file and downstream automation breaks silently.
**Not claimed.** No assertion that Shopify rejects this.

### `VG-VAR-010` / `VG-VAR-011` — routine price changes, **Low**
`|Δ| ≥ 50%` on price, and a compare-at price set above the variant price. Category
`routine`, deliberately separated so merchants can filter noise out.

### `VG-VAR-012` — `Default Title`, **Low, documented**
*"If a product has only one option, then this value should be Default Title."*

### `VG-VAR-013` — image rows removed, **Medium, inference**
**Labelled a verification item, not a prediction.** The documented contract implies
existing images survive, but Shopify does not document image-row removal specifically, so
the finding tells the user to test one product rather than claiming a known outcome.

### `VG-VAR-014` — option name changed, **Medium, heuristic**
Option names are customer-facing (filter labels, theme copy). Shopify documents nothing
either way.

### `VG-VAR-015` — gap in option positions, **Medium, heuristic**
Option1 filled, Option2 blank, Option3 filled — a hole in the matrix, usually a shifted
column during editing.

---

## Parse-level findings

Emitted by `parseCsv` and surfaced as `VG-FMT-PARSE-<CODE>`, before any comparison, so a
structurally broken file is reported as such rather than producing misleading diffs.

| Code | Sev | Trigger |
|---|---|---|
| `EMPTY_FILE` | high | file is empty or whitespace only |
| `NO_HEADER` | high | no rows, or a blank first row |
| `NO_DATA_ROWS` | high | header present, no data rows |
| `NO_HANDLE_COLUMN` | high | no `Handle` column — every comparison keys off it, so results would be meaningless |
| `DUPLICATE_HEADER` | medium | repeated header; the duplicate is kept addressable as `Name (col N)` rather than dropped |
| `RAGGED_ROW_EXTRA_CELLS` | medium | more cells than headers — usually an unescaped comma |
| `RAGGED_ROW_MISSING_CELLS` | low | fewer cells than headers — read as **absent**, not empty, and the finding says so |
| `BOM_UTF8` | low | UTF-8 BOM stripped for parsing |
| `ENCODING_UTF16` | medium | UTF-16 decoded correctly, but advise re-saving as UTF-8 |
| `ENCODING_MOJIBAKE` | high | UTF-8 bytes read as Latin-1 — nothing will match the store and a correct diff reads as "everything changed" |
| `UNUSUAL_FIELD_COUNT` | medium | implausibly few columns for a product CSV |
