# Verified Shopify CSV semantics

Checked against Shopify's current product CSV documentation on **2026-10-16**.
Sources:

- <https://help.shopify.com/en/manual/products/import-export/using-csv>
- <https://help.shopify.com/en/manual/products/import-export/import-products>
- <https://help.shopify.com/en/manual/products/import-export/common-import-issues>
- <https://help.shopify.com/en/manual/products/import-export/export-products>
- <https://help.shopify.com/en/manual/inventory-and-locations/setup/inventory-csv>

Every quote below is verbatim. Anything not quoted here is not treated as documented in
this codebase.

---

## The overwrite contract — the core of the tool

> **Blank clears:**
> "If a non-required column in the import CSV file is blank, then the matching value in
> the product list is overwritten as blank."

> **Missing preserves:**
> "If a non-required column isn't included in the import CSV file, but is included in the
> existing product list, then the value in the product list remains the same."

> **Row-level blank:**
> "To leave a saved packed product size unchanged, omit the four columns from your file.
> On any row that includes variant data, such as an option value, four empty cells clear
> the variant's saved packed product size, in the same way as overwriting other blank
> columns."

This is the only part of Shopify's overwrite behaviour that is both documented and
load-bearing for this tool. It is why cells are three-state.

---

## Two of my starting assumptions were wrong

Both were caught by verifying against the docs before writing the rules, and both would
have produced confidently wrong behaviour.

### 1. `Type` is not a row-type discriminator

I had planned to classify rows as `Product` / `Variation` / `Image` using the `Type`
column, which many third-party CSV guides describe. Shopify documents something else:

> "A label that describes the product if you need a custom category to keep your products
> organized, in addition to Shopify's standard category. For example, if the product
> category is `Bed Sheets`, a helpful product type could be `Cooling sheets`. **This
> label doesn't need to conform to any predefined format.**"

There are no `Product` / `Variation` / `Image` row-type values. The current official
template's `Type` column contains values like `Graphic shirt`, `Digital book`,
`Perfume`.

Row meaning is conveyed by which columns are filled:

> "Product with variants: If you upload a product that has variants, then enter all the
> fields for the product in the first row along with the URL for the first image. In the
> following rows, enter the URL handle. Then skip the `Title`, `Description`, `Vendor`,
> and `Tags` columns."

`src/lib/shopify/model.ts` therefore classifies rows by filled columns and never reads
`Type` for structure. `OptionN Value` filled → variant row; `Image Src` filled with no
option value → image row; otherwise → product row.

### 2. There is no `On hand {location}` column

I expected a per-location inventory column pattern. Shopify documents the opposite:

> "The number of items you have available in stock of the product or variant. **This
> applies only to Shopify stores that have a single location.** The default value is `0`
> if no value is entered."

Multi-location quantities live in a separate inventory CSV with a `Location` column, or
with location names as column headers. The schema therefore does **not** treat
`On hand <name>` as a known product-CSV header.

---

## Product identity

> "When you import a CSV file, you can select the option **Overwrite products with
> matching handles.** If you select this option, then when the handle in the import CSV
> file matches an existing handle in your products list, the values in the CSV file
> overwrite the values in the matching columns in the existing product list."

> "The handle is used to uniquely identify each individual product. Make sure you have a
> unique handle for each product in your CSV."

> "When you update products using a CSV file, the only required columns are **URL handle**
> and **Title**."

> "CSV files can't be used to delete products in bulk."

Two consequences the rules rely on:

- A **missing product** handle is safe (cannot bulk-delete) → `VG-PRD-001` is Low.
- A **missing variant row** is a different question, and is not documented — see below.

### What is NOT documented

**Shopify's documentation contains no statement about variants that exist in the store
but have no row in the uploaded CSV.** Not deletion, not preservation. This is the single
most important open question in this tool.

The nearest official statement is about a related failure mode:

> "If a non-required column is included in the import CSV file that relies on other column
> data not included in the file, then existing data is deleted or removed. For example, if
> the **SKU** column is included in the import CSV file, but not the **Option1 value** and
> **Option1 name** columns, then the product variant option is deleted."

That officially documents a mechanism by which file structure destroys existing variant
data. It does not document what happens to a variant row that is simply absent.

Community evidence, quoted in the UI but never presented as official:

- "on every product that had multiple options… some of the variants got deleted. … We
  didn't get any error message" —
  [community.shopify.com/t/csv-product-import-deleted-variants…/582717](https://community.shopify.com/t/csv-product-import-deleted-variants-shopify-you-got-some-explaining-to-do/582717)
- Shopify Support, quoted by a merchant: "When you modify option values… the system sees
  this as creating new variants. Consequently, the previous variants and their inventory
  are removed." —
  [community.shopify.com/t/inventory-values-deleted-from-csv-upload/260795](https://community.shopify.com/t/inventory-values-deleted-from-csv-upload/260795)

`VG-VAR-001` is therefore `inference`, and the assumption behind it is a UI toggle.

---

## Variants and options

> "Changing data in the **Option1 value**, **Option2 value**, or **Option3 value**
> columns of the product CSV file deletes existing variant IDs, and creates new variant
> IDs. Any change to variant IDs values can break third-party dependencies on variant IDs."

This is `VG-VAR-002`, and it is the strongest evidence for treating option values as the
variant identity. It says nothing about inventory surviving, so no inventory claim is
made on its basis.

> "The CSV import fails when a file tries to assign an existing option value to a new
> option position, creating a conflict as variant options must be unique. For example, if
> you attempt to move `Size` from Option 1 to Option 2, and add `Type` as the new Option 1,
> then the database validates for duplicate names before importing new values, and the
> process fails."

This is `VG-VAR-006`.

> "A product can have up to 3 options. If a product has only one option, then this value
> should be `Default Title`."

This is `VG-VAR-012`.

---

## Validation errors

> "Validation failed: options are not unique. This error is caused when a product has
> duplicate options. You might have set up a product with two variants with the same
> option values (for example, 2 medium products, both in black)."

`VG-VAR-004`.

> "Ignored line # because handle already exists"

Note this refers to a handle opening a **second product block**, not to variant and image
rows sharing a handle — repeating the handle across a product's own rows is the normal
structure of the format. `VG-VAR-005` implements it that way, after the naive version
produced a false positive on every multi-variant product.

---

## Inventory

> "**On hand (new)** — The new inventory quantity that you want to set. Leave empty when
> you don't want to change quantities."

`On hand (new)` is the documented safe column for setting a new quantity. There is no
equivalent "leave empty" guarantee for `On hand`.

> "**Available** — Contains location names as column headers with available quantities
> listed below." (inventory CSV)

---

## Status and visibility

> "**Status** — Indicates whether the product is available to your customers. **If this
> column is present, then it needs a value.** If the column isn't present, then the
> product status is automatically uploaded as `active`. Valid values are: `active`
> (default), `draft`, `archived`."

A present-but-blank `Status` cell is a validation failure, not a reset. `VG-FMT-004`.

> "**Published on online store** — Valid values are `true` (default): the imported product
> is visible on the online store and can be sold. `false`: the imported product won't be
> visible on the online store."

`Publishable Status`, `Published` and `URL and redirect` do not appear in the current
column table or the current official template header. They appear in older exports and in
a legacy sample on the troubleshooting page, so they are recognised but tagged `legacy`
and are never presented as current.

---

## SEO

> "If you leave this column blank, then the product **Title** is used as the product's
> search engine listing page title."

`SEO Title` has a documented fallback, which is why blanking it is Low rather than High.

---

## Custom columns and metafields

> "**Variant metafields aren't supported** for product CSV import/export. To edit your
> variant metafields in bulk, you need to use the variant bulk editor, and then add
> metafield columns."

> "The **Collection** column is the only column that you can add to the CSV file that
> doesn't break the format. You can't add any other columns to your CSV file."

`VG-FMT-001` and `VG-FMT-002`.

---

## Documented restrictions

> "Your product CSV can't exceed 15 MB."

> "CSV files can't be used to bulk update product availability on other sales channels."

> "For stores with 500,000 or more product variants (excluding Plus stores), no more than
> 10,000 new variants can be created by CSV uploads (or API) within a 24 hour timeframe."

None of these are currently checked by the tool — see `LIMITATIONS.md`.

---

## Unknowns this document does not resolve

- Whether Handle matching is case-insensitive or Unicode-normalised. Assumed strict
  (`handleMatchIsExact`), because assuming the opposite risks reporting a changed
  product as new, which is the dangerous direction.
- Whether removing an image row detaches the image. Reported as a verification item
  (`VG-VAR-013`), not a prediction.
- Whether the variant-omission behaviour described above is real. It is the highest-value
  thing to verify against a real store.
