import type { Cell } from '@/lib/csv/cell';
import { cell, text } from '@/lib/csv/cell';
import type { ParsedCsv, ParsedRow } from '@/lib/csv/parseCsv';
import {
  FIELDS,
  lookupField,
  matchMetafield,
  type FieldDef,
} from '@/lib/shopify/schema';

export type RowKind = 'product' | 'variant' | 'image' | 'orphan';

export interface FieldValue {
  readonly field: FieldDef;
  readonly cell: Cell;
}

export interface Variant {
  /** handle \u0000 option1 \u0000 option2 \u0000 option3 — the Shopify variant identity. */
  readonly key: string;
  /** Human label, e.g. "Black / M". */
  readonly label: string;
  readonly handle: string;
  readonly options: readonly [Cell, Cell, Cell];
  readonly row: ParsedRow;
  readonly values: ReadonlyMap<string, Cell>;
  /** Index of this variant within its product, by row order. */
  readonly ordinal: number;
}

export interface ImageRow {
  readonly handle: string;
  readonly row: ParsedRow;
  readonly values: ReadonlyMap<string, Cell>;
  readonly ordinal: number;
}

export interface ProductGroup {
  readonly handle: string;
  /** The row carrying product-level data (Title, Vendor, option NAMES...). */
  readonly productRow: ParsedRow | undefined;
  readonly variants: readonly Variant[];
  readonly images: readonly ImageRow[];
  /** Rows carrying a Handle but no usable product data at all. */
  readonly orphanRows: readonly ParsedRow[];
  readonly values: ReadonlyMap<string, Cell>;
  readonly order: number;
}

export interface ShopifyCatalog {
  readonly products: ReadonlyMap<string, ProductGroup>;
  readonly rows: readonly ParsedRow[];
  /** Rows whose Handle cell is empty/unusable. */
  readonly headerlessRows: readonly ParsedRow[];
  readonly metafieldColumns: readonly string[];
  readonly headerIndex: ReadonlyMap<string, number>;
  readonly headers: readonly string[];
  /** header -> field, for the columns we recognised. */
  readonly knownFields: ReadonlyMap<string, FieldDef>;
  readonly unknownColumns: readonly string[];
}

const OPTION_VALUE_HEADERS = ['Option1 Value', 'Option2 Value', 'Option3 Value'] as const;

/**
 * Column lookup shared by the catalog and the rules.
 *
 * Exact header text wins. Otherwise the match is case-insensitive, and a
 * canonical header also resolves its aliases (for example "Image Src (URL)"
 * when a rule asks for "Image Src"). "URL handle" is not an alias of Handle.
 */
export function columnIndex(
  headerIndex: ReadonlyMap<string, number>,
  header: string,
): number | undefined {
  const exact = headerIndex.get(header);
  if (exact !== undefined) return exact;
  const wanted = header.toLowerCase();
  for (const [name, idx] of headerIndex) {
    if (name.toLowerCase() === wanted) return idx;
  }
  const field = lookupField(header);
  if (!field) return undefined;
  const names = new Set([field.header, ...(field.aliases ?? [])].map((n) => n.toLowerCase()));
  for (const [name, idx] of headerIndex) {
    if (names.has(name.toLowerCase())) return idx;
  }
  return undefined;
}

/**
 * Normalised option values.
 *
 * Shopify matches variants on the option value text, so whitespace and
 * Unicode normalisation differences are exactly the class of bug that makes a
 * merchant believe a variant is "unchanged" when the import will treat it as a
 * brand new variant. We normalise for MATCHING only; the original cell is what
 * gets displayed and diffed.
 */
export function normaliseOptionValue(raw: string): string {
  return raw.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function makeVariantKey(
  handle: string,
  options: readonly [Cell, Cell, Cell],
): string {
  const parts = options.map((o) => normaliseOptionValue(text(o)));
  return `${normaliseOptionValue(handle)}\u0000${parts[0]}\u0000${parts[1]}\u0000${parts[2]}`;
}

function collectValues(
  row: ParsedRow,
  headerIndex: ReadonlyMap<string, number>,
  knownFields: ReadonlyMap<string, FieldDef>,
): Map<string, Cell> {
  const out = new Map<string, Cell>();
  for (const [header, idx] of headerIndex) {
    const field = knownFields.get(header);
    if (!field) continue;
    out.set(field.key, cell(row.cells[idx]));
  }
  return out;
}

/**
 * Classifies a row by which columns are filled, never by the `Type` column —
 * Shopify documents `Type` as a free-text category label, not a row tag.
 */
export function classifyRow(
  row: ParsedRow,
  headerIndex: ReadonlyMap<string, number>,
): RowKind {
  const handleIdx = columnIndex(headerIndex, 'Handle');
  const handle = handleIdx === undefined ? '' : (row.cells[handleIdx] ?? '').trim();
  if (handle.length === 0) return 'orphan';

  const hasOptionValue = OPTION_VALUE_HEADERS.some((h) => {
    const idx = columnIndex(headerIndex, h);
    return idx !== undefined && (row.cells[idx] ?? '').trim().length > 0;
  });
  if (hasOptionValue) return 'variant';

  const imageIdx = columnIndex(headerIndex, 'Image Src');
  const hasImage = imageIdx !== undefined && (row.cells[imageIdx] ?? '').trim().length > 0;
  if (hasImage) return 'image';

  return 'product';
}

/**
 * Builds the product/variant/image tree.
 *
 * Note this deliberately does NOT look at the `Type` column for row kind:
 * Shopify documents `Type` as a free-text category label, so using it as a
 * discriminator would misclassify every product with a custom type.
 */
export function buildCatalog(parsed: ParsedCsv): ShopifyCatalog {
  const knownFields = new Map<string, FieldDef>();
  const unknownColumns: string[] = [];
  const metafieldColumns: string[] = [];

  for (const h of parsed.headers) {
    const field = FIELDS.find((f) => f.header.toLowerCase() === h.toLowerCase());
    if (field) {
      knownFields.set(h, field);
      continue;
    }
    // Aliases (e.g. "Image Src (URL)") still resolve to their field.
    const aliased = FIELDS.find((f) =>
      (f.aliases ?? []).some((a) => a.toLowerCase() === h.toLowerCase()),
    );
    if (aliased) {
      knownFields.set(h, aliased);
      continue;
    }
    if (matchMetafield(h)) {
      metafieldColumns.push(h);
      continue;
    }
    unknownColumns.push(h);
  }

  const products = new Map<string, ProductGroup>();
  const headerlessRows: ParsedRow[] = [];

  interface Builder {
    handle: string;
    productRow?: ParsedRow;
    variants: Variant[];
    images: ImageRow[];
    orphanRows: ParsedRow[];
    order: number;
  }
  const builders = new Map<string, Builder>();

  for (const row of parsed.rows) {
    const kind = classifyRow(row, parsed.headerIndex);
    if (kind === 'orphan') {
      headerlessRows.push(row);
      continue;
    }
    const handleIdx = columnIndex(parsed.headerIndex, 'Handle')!;
    const handle = (row.cells[handleIdx] ?? '').trim();

    let b = builders.get(handle);
    if (!b) {
      b = { handle, variants: [], images: [], orphanRows: [], order: builders.size };
      builders.set(handle, b);
    }

    const values = collectValues(row, parsed.headerIndex, knownFields);

    switch (kind) {
      case 'variant': {
        const options = OPTION_VALUE_HEADERS.map((h) => {
          const i = columnIndex(parsed.headerIndex, h);
          return cell(i === undefined ? undefined : row.cells[i]);
        }) as unknown as [Cell, Cell, Cell];
        const labelParts = options.map((o) => text(o).trim()).filter((s) => s.length > 0);
        b.variants.push({
          key: makeVariantKey(handle, options),
          label: labelParts.join(' / '),
          handle,
          options,
          row,
          values,
          ordinal: b.variants.length,
        });
        // A variant row may still carry option NAMES on the first variant row.
        if (!b.productRow) b.productRow = row;
        break;
      }
      case 'image': {
        b.images.push({
          handle,
          row,
          values,
          ordinal: b.images.length,
        });
        if (!b.productRow) b.productRow = row;
        break;
      }
      case 'product': {
        // Shopify carries product-level data on the first row of a product.
        // Later duplicate product rows are ambiguous; keep the first.
        if (!b.productRow) b.productRow = row;
        break;
      }
    }
  }

  for (const [handle, b] of builders) {
    const values = b.productRow
      ? collectValues(b.productRow, parsed.headerIndex, knownFields)
      : new Map<string, Cell>();
    products.set(handle, {
      handle,
      productRow: b.productRow,
      variants: b.variants,
      images: b.images,
      orphanRows: b.orphanRows,
      values,
      order: b.order,
    });
  }

  return {
    products,
    rows: parsed.rows,
    headerlessRows,
    metafieldColumns,
    headerIndex: parsed.headerIndex,
    headers: parsed.headers,
    knownFields,
    unknownColumns,
  };
}
