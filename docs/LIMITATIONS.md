# Known limitations

Ordered by how much they could hurt someone relying on the output.

---

## 1. The core deletion assumption is not documented by Shopify

`VG-VAR-001` — "a variant in the store with no row in the file is deleted" — is the
highest-severity claim this tool makes, and Shopify's product CSV documentation contains
no statement either way. It is sourced from merchant reports and a Shopify Support quote
relayed in a forum thread.

It is surfaced as a toggleable assumption, downgrades to Low when disabled, and the
finding never disappears so the omission stays visible either way. But it remains an
inference. **Verify it on a real store before trusting the High count.**

If it is wrong, the failure mode is noisy false positives, not missed data loss — the
proposed file still cannot silently delete a variant row by any other route the tool
knows of.

## 2. A clean report is not a safe import

The tool has 26 rules. Shopify's importer has behaviour this tool does not model:
theme-specific columns, apps that extend the product model, metafields, staged publishes,
sales-channel availability, pricing rules, and multi-location inventory (which lives in a
separate CSV the tool does not read).

Media upload workflows and cross-platform migrations are outside the scope of a two-file
diff. **Absence of findings means no rule fired.**

## 3. Undocumented restrictions are not checked

Shopify documents these and the tool currently ignores all of them:

- 15 MB file size limit (the tool accepts up to 60 MB before warning, which is above what
  Shopify will take — deliberate, so you can inspect a file you could not otherwise load).
- 10,000 new variants/day for stores at or above 500,000 variants.
- Cannot bulk-delete products, cannot bulk-update sales-channel availability.
- 250 images per product.

A file that trips these fails at Shopify with an error, not silent damage, so they are
lower priority — but they are genuinely not covered.

## 4. Single-location inventory only

The product CSV's `On hand` column is documented as applying only to single-location
stores. Multi-location stores use a separate inventory CSV, which this tool does not
accept. **For a multi-location store, inventory findings are incomplete.** A large
fraction of the target market runs multiple locations.

## 5. Variant metafields are invisible to this tool

Shopify does not support them in the product CSV at all. If a merchant's workflow depends
on variant metafields, the import will silently do nothing for them and this tool can only
flag the column's presence, not its contents.

## 6. Handle matching semantics are assumed strict

Shopify documents that Handle uniquely identifies a product, but not whether the comparison
is case-insensitive or Unicode-normalised. `handleMatchIsExact` assumes strict.

- If Shopify matches loosely, this tool reports some false mismatches.
- The reverse error — reporting a changed product as brand new — is the dangerous one,
  which is why strict was chosen.

Option validation and Handle matching are different questions; one cannot establish the
other.

## 7. Unicode, case and internal whitespace are folded for matching

Option values are normalised to NFC, lowercased, trimmed, and collapsed to single spaces
before variant matching. A case-only change such as `Black` to `black`, an NFC/NFD
difference, or a double space inside the value does not fire the option-change rule.
`VG-FMT-003` reports leading or trailing spaces on Handle and option values. It does not
report case or internal-space differences. Shopify does not document whether its own
match is case-sensitive or Unicode-normalised, so this folding can hide a change the
importer would treat as a new variant, or it can match a change Shopify would ignore.
The original cell text is still what the report shows when some other rule quotes it.

## 8. Heuristic rules have real false-positive risk

`VG-PRD-003` (handle rename), `VG-VAR-009` (SKU duplicates), `VG-VAR-010`/`011` (price
heuristics), `VG-VAR-014`/`015` are all `heuristic`. They are tagged as such in the UI and
capped at Medium/Low, but they can fire on intentional changes. They are for triage, not
for gating an import.

## 9. Row classification is best-effort

Rows are classified as product / variant / image by which columns are filled. Files from
unusual tools, or with an unusual column subset, can misclassify. Specifically:

- A product row that carries an option value is treated as a variant row.
- A variant row with a missing `Handle` is excluded from comparison. If that row still
  has any other cell content, `VG-FMT-005` names the file side and the physical line.
  A completely blank row does not produce a finding. A report with no findings still
  does not mean the import is safe.
- Multiple product rows for one handle: the first wins for product-level fields. Which one
  "should" win is not determined.

## 10. No streaming; everything is held in memory

Both files are fully parsed into memory as string arrays. Measured: 5,000 products /
15,000 variants (two files, ~30,000 rows) analyses in **384 ms** in Node. A real 15 MB
export is larger — roughly 100,000+ rows — and would hold both parsed files plus the
risk list simultaneously. That is likely fine on desktop but is untested at that size, and
a very large catalog on a low-memory machine could struggle. Web Workers would be the fix;
they are not implemented.

## 11. No undo, no preview render

The tool reports; it does not produce a corrected file. There is no "give me the safe
version" output, which is the feature several competitors offer and the obvious next step.

## 12. Interface languages

The interface, rule text and assumptions are available in English and Simplified Chinese.
The choice is stored in `localStorage` under `variantguard.locale:v1`. Product CSV
contents are not stored. See [I18N.md](I18N.md).

## 13. Spreadsheet formula prefixes in exported reports

CSV export quotes fields per RFC 4180. It does not prefix values that start with `=`,
`+`, `-` or `@`. A handle, SKU or title with one of those characters can be interpreted
as a formula if the report is opened in a spreadsheet. JSON export is not affected.
This was checked on 2026-10-17 and left unchanged so the English CSV column contract
stays stable.

## 14. `URL handle` is not a recognised header

Shopify help text uses the phrase "URL handle". This tool recognises the header cell
`Handle` (any letter case) and documented aliases such as `Image Src (URL)`. It does
not treat a column literally named `URL handle` as Handle. Whether a current Shopify
export uses that exact header was not re-checked against a live template in this
acceptance, so a file with that header is reported as having no Handle column.

---

## Things that are deliberately not features

- **No Shopify connection, no token, no import.** By design, and the security constraint
  that makes the "we never saw your data" claim true.
- **No AI/LLM anywhere.** Every finding is a deterministic rule with an inspectable
  implementation. An LLM in this position would be unable to tell you *why* it thinks a
  variant will be deleted, which is the entire product.
- **No persistence.** Reload the page and the analysis is gone. Product data does not go
  to local storage, because a merchant's catalogue is business data and "it is only on
  your machine" should not quietly become "it is on your machine forever".
