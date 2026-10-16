/**
 * Shopify product CSV column schema.
 *
 * GROUNDING RULES FOR THIS FILE (deliberate, and the reason every entry carries
 * a `confidence` field):
 *
 *  - `official-doc`  — the column's meaning/behaviour is stated in Shopify's
 *                      current help docs (verified 2026-10-16).
 *  - `legacy`        — header seen in older exports, third-party exports, or the
 *                      legacy sample on the troubleshooting page. We still
 *                      detect and compare it, but we never present it as current.
 *  - `heuristic`     — not documented by Shopify; we treat it as meaningful
 *                      because it behaves that way in practice.
 *
 * TWO PREMISES THAT VERIFICATION KILLED — do not reintroduce them:
 *
 *  1. `Type` is NOT a row-type discriminator. Shopify documents it as a
 *     free-text custom category label ("Cooling sheets"). There are no
 *     `Product` / `Variation` / `Image` row-type values. Row meaning is
 *     conveyed purely by which columns are filled on the row. See docs: "This
 *     label doesn't need to conform to any predefined format."
 *
 *  2. There is NO `On hand {location}` column in the product CSV. The docs say
 *     the `On hand` column "applies only to Shopify stores that have a single
 *     location" and that multi-location quantities belong to the separate
 *     inventory CSV. We therefore do not treat `On hand <name>` as a known
 *     product-CSV header.
 */

export type Confidence = 'official-doc' | 'legacy' | 'heuristic';

export type ColumnRole =
  | 'identity'
  | 'product'
  | 'variant'
  | 'inventory'
  | 'image'
  | 'seo'
  | 'category'
  | 'metafield'
  | 'unknown';

export type FieldScope = 'file' | 'product' | 'variant' | 'image';

/** What kind of damage a bad edit to this field can do. */
export type FieldRisk =
  | 'identity' // changes which store object the row maps to
  | 'structure' // changes how variants are grouped / how many exist
  | 'value' // overwrites or clears a stored value
  | 'visibility' // affects storefront visibility, not stored data integrity
  | 'none';

export interface FieldDef {
  /** Stable internal key. Never shown to the user. */
  readonly key: string;
  /** The header exactly as Shopify writes it. */
  readonly header: string;
  /** Alternative/older headers that map to the same field. */
  readonly aliases?: readonly string[];
  readonly role: ColumnRole;
  readonly scope: FieldScope;
  readonly risk: FieldRisk;
  readonly confidence: Confidence;
  /** Verbatim Shopify doc text when confidence === 'official-doc'. */
  readonly doc?: string;
  /** Short user-facing caveat. */
  readonly note?: string;
}

/**
 * The three-state overwrite contract that governs this whole tool.
 * Verbatim from Shopify help, "Overwriting existing products with a CSV file".
 */
export const DOC_OVERWRITE_BLANK_CLEARS =
  'If a non-required column in the import CSV file is blank, then the matching value in the product list is overwritten as blank.';

export const DOC_OVERWRITE_MISSING_PRESERVES =
  "If a non-required column isn't included in the import CSV file, but is included in the existing product list, then the value in the product list remains the same.";

/** The one official statement about a column relying on absent column data. */
export const DOC_INCLUDED_COLUMN_DEPENDENCY_DELETES =
  'If a non-required column is included in the import CSV file that relies on other column data not included in the file, then existing data is deleted or removed. For example, if the SKU column is included in the import CSV file, but not the Option1 value and Option1 name columns, then the product variant option is deleted.';

export const DOC_OPTION_VALUE_CHANGE =
  'Changing data in the Option1 value, Option2 value, or Option3 value columns of the product CSV file deletes existing variant IDs, and creates new variant IDs.';

export const DOC_HANDLE_MATCH =
  'When you import a CSV file, you can select the option Overwrite products with matching handles. If you select this option, then when the handle in the import CSV file matches an existing handle in your products list, the values in the CSV file overwrite the values in the matching columns in the existing product list.';

export const DOC_NO_BULK_DELETE =
  'CSV files can\'t be used to delete products in bulk.';

export const DOC_STATUS_NEEDS_VALUE =
  'Status — Indicates whether the product is available to your customers. If this column is present, then it needs a value. If the column isn\'t present, then the product status is automatically uploaded as active. Valid values are: active (default), draft, archived.';

export const DOC_VARIANT_METAFIELDS_UNSUPPORTED =
  'Variant metafields aren\'t supported for product CSV import/export.';

export const DOC_NO_EXTRA_COLUMNS =
  'The Collection column is the only column that you can add to the CSV file that doesn\'t break the format. You can\'t add any other columns to your CSV file.';

export const DOC_FILE_LIMIT =
  'Your product CSV can\'t exceed 15 MB.';

export const DOC_DUPLICATE_OPTIONS_ERROR =
  'Validation failed: options are not unique. This error is caused when a product has duplicate options. You might have set up a product with two variants with the same option values.';

export const DOC_DUPLICATE_HANDLE_ERROR =
  'Ignored line # because handle already exists.';

export const DOC_OPTION_MOVE_FAILURE =
  'The CSV import fails when a file tries to assign an existing option value to a new option position, creating a conflict as variant options must be unique. For example, if you attempt to move Size from Option 1 to Option 2, and add Type as the new Option 1, then the database validates for duplicate names before importing new values, and the process fails.';

export const DOC_ON_HAND_SINGLE_LOCATION =
  'The number of items you have available in stock of the product or variant. This applies only to Shopify stores that have a single location. The default value is 0 if no value is entered.';

const FIELD_LIST: readonly FieldDef[] = [
  // ---------------------------------------------------------------- identity
  {
    key: 'handle',
    header: 'Handle',
    role: 'identity',
    scope: 'product',
    risk: 'identity',
    confidence: 'official-doc',
    doc: 'The handle is used to uniquely identify each individual product. Make sure you have a unique handle for each product in your CSV.',
    note: 'Shopify help text often says "URL handle" for this column. The header cell this tool recognises is Handle. "URL handle" is not registered as an alias: whether a current export uses that exact header was not re-checked against a live template. "URL and redirect" is a different column, defined below.',
  },

  // ----------------------------------------------------------------- product
  {
    key: 'title',
    header: 'Title',
    role: 'product',
    scope: 'product',
    risk: 'value',
    confidence: 'official-doc',
    doc: 'When you update products using a CSV file, the only required columns are URL handle and Title.',
  },
  {
    key: 'body',
    header: 'Body (HTML)',
    aliases: ['Description'],
    role: 'product',
    scope: 'product',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'vendor',
    header: 'Vendor',
    role: 'product',
    scope: 'product',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'productCategory',
    header: 'Product Category',
    aliases: ['Product category'],
    role: 'category',
    scope: 'product',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'type',
    header: 'Type',
    role: 'category',
    scope: 'product',
    risk: 'value',
    confidence: 'official-doc',
    doc: 'A label that describes the product if you need a custom category to keep your products organized, in addition to Shopify\'s standard category. For example, if the product category is Bed Sheets, a helpful product type could be Cooling sheets. This label doesn\'t need to conform to any predefined format.',
    note: 'Free-text label. NOT a row-type discriminator.',
  },
  {
    key: 'tags',
    header: 'Tags',
    role: 'product',
    scope: 'product',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'status',
    header: 'Status',
    role: 'product',
    scope: 'product',
    risk: 'visibility',
    confidence: 'official-doc',
    doc: DOC_STATUS_NEEDS_VALUE,
    note: 'A present-but-blank Status column is a validation failure, not a reset.',
  },
  {
    key: 'publishedOnlineStore',
    header: 'Published on online store',
    role: 'product',
    scope: 'product',
    risk: 'visibility',
    confidence: 'official-doc',
    doc: 'Valid values are true (default) and false. If false, then the imported product won\'t be visible on the online store.',
  },
  {
    key: 'published',
    header: 'Published',
    role: 'product',
    scope: 'product',
    risk: 'visibility',
    confidence: 'legacy',
    note: 'Legacy header from older exports and the legacy troubleshooting sample.',
  },
  {
    key: 'publishableStatus',
    header: 'Publishable Status',
    role: 'product',
    scope: 'product',
    risk: 'visibility',
    confidence: 'legacy',
    note: 'Seen in older Shopify exports. Not in the current documented column table.',
  },
  {
    key: 'giftCard',
    header: 'Gift Card',
    role: 'product',
    scope: 'product',
    risk: 'value',
    confidence: 'official-doc',
    doc: 'You can\'t create a gift card by importing a product CSV file.',
  },

  // -------------------------------------------------------------- SEO / URL
  {
    key: 'seoTitle',
    header: 'SEO Title',
    role: 'seo',
    scope: 'product',
    risk: 'value',
    confidence: 'official-doc',
    doc: 'If you leave this column blank, then the product Title is used as the product\'s search engine listing page title.',
  },
  {
    key: 'seoDescription',
    header: 'SEO Description',
    role: 'seo',
    scope: 'product',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'templateSuffix',
    header: 'Template suffix',
    role: 'seo',
    scope: 'product',
    risk: 'identity',
    confidence: 'heuristic',
    note: 'Not in the current documented column table. Changes the product URL path.',
  },
  {
    key: 'urlAndRedirect',
    header: 'URL and redirect',
    role: 'seo',
    scope: 'product',
    risk: 'identity',
    confidence: 'legacy',
    note: 'Legacy header. Shopify documents no redirect behaviour for it.',
  },
  {
    key: 'collection',
    header: 'Collection',
    role: 'product',
    scope: 'product',
    risk: 'structure',
    confidence: 'official-doc',
    doc: DOC_NO_EXTRA_COLUMNS,
    note: 'The only column merchants may legally add to a product CSV.',
  },

  // ----------------------------------------------------------- option names
  {
    key: 'option1Name',
    header: 'Option1 Name',
    role: 'variant',
    scope: 'product',
    risk: 'structure',
    confidence: 'official-doc',
  },
  {
    key: 'option2Name',
    header: 'Option2 Name',
    role: 'variant',
    scope: 'product',
    risk: 'structure',
    confidence: 'official-doc',
  },
  {
    key: 'option3Name',
    header: 'Option3 Name',
    role: 'variant',
    scope: 'product',
    risk: 'structure',
    confidence: 'official-doc',
  },

  // ---------------------------------------------------------- option values
  {
    key: 'option1Value',
    header: 'Option1 Value',
    role: 'variant',
    scope: 'variant',
    risk: 'structure',
    confidence: 'official-doc',
    doc: DOC_OPTION_VALUE_CHANGE,
  },
  {
    key: 'option2Value',
    header: 'Option2 Value',
    role: 'variant',
    scope: 'variant',
    risk: 'structure',
    confidence: 'official-doc',
    doc: DOC_OPTION_VALUE_CHANGE,
  },
  {
    key: 'option3Value',
    header: 'Option3 Value',
    role: 'variant',
    scope: 'variant',
    risk: 'structure',
    confidence: 'official-doc',
    doc: DOC_OPTION_VALUE_CHANGE,
  },

  // ---------------------------------------------------------------- variants
  {
    key: 'variantSku',
    header: 'Variant SKU',
    role: 'variant',
    scope: 'variant',
    risk: 'identity',
    confidence: 'official-doc',
    doc: DOC_INCLUDED_COLUMN_DEPENDENCY_DELETES,
  },
  {
    key: 'variantPrice',
    header: 'Variant Price',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantCompareAtPrice',
    header: 'Variant Compare At Price',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantBarcode',
    header: 'Variant Barcode',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantGrams',
    header: 'Variant Grams',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantInventoryTracker',
    header: 'Variant Inventory Tracker',
    role: 'inventory',
    scope: 'variant',
    risk: 'value',
    confidence: 'legacy',
    note: 'Legacy header. Current exports use the inventory columns below.',
  },
  {
    key: 'variantInventoryPolicy',
    header: 'Variant Inventory Policy',
    role: 'inventory',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantFulfillmentService',
    header: 'Variant Fulfillment Service',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantRequiresShipping',
    header: 'Variant Requires Shipping',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantTaxable',
    header: 'Variant Taxable',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantImage',
    header: 'Variant Image',
    role: 'image',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantWeight',
    header: 'Variant Weight',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantWeightUnit',
    header: 'Variant Weight Unit',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'variantTaxCode',
    header: 'Variant Tax Code',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'costPerItem',
    header: 'Cost per item',
    role: 'variant',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },

  // --------------------------------------------------------------- inventory
  {
    key: 'onHand',
    header: 'On hand',
    role: 'inventory',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
    doc: DOC_ON_HAND_SINGLE_LOCATION,
    note: 'Single-location stores only. Multi-location quantity belongs to the separate inventory CSV.',
  },
  {
    key: 'onHandNew',
    header: 'On hand (new)',
    role: 'inventory',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
    doc: 'On hand (new) — The new inventory quantity that you want to set. Leave empty when you don\'t want to change quantities.',
    note: 'The only quantity column documented as safe to leave blank.',
  },
  {
    key: 'incoming',
    header: 'Incoming',
    role: 'inventory',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'committed',
    header: 'Committed',
    role: 'inventory',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'available',
    header: 'Available',
    role: 'inventory',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'inventoryQuantity',
    header: 'Inventory quantity',
    role: 'inventory',
    scope: 'variant',
    risk: 'value',
    confidence: 'official-doc',
  },

  // ------------------------------------------------------------------- image
  {
    key: 'imageSrc',
    header: 'Image Src',
    aliases: ['Image Src (URL)'],
    role: 'image',
    scope: 'image',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'imagePosition',
    header: 'Image Position',
    role: 'image',
    scope: 'image',
    risk: 'value',
    confidence: 'official-doc',
  },
  {
    key: 'imageAltText',
    header: 'Image Alt Text',
    role: 'image',
    scope: 'image',
    risk: 'value',
    confidence: 'official-doc',
  },
];

export const FIELDS: readonly FieldDef[] = FIELD_LIST;

/** header (exact, case-insensitive) -> FieldDef */
const BY_HEADER = new Map<string, FieldDef>();
for (const f of FIELD_LIST) {
  BY_HEADER.set(f.header.toLowerCase(), f);
  for (const a of f.aliases ?? []) BY_HEADER.set(a.toLowerCase(), f);
}

export function lookupField(header: string): FieldDef | undefined {
  return BY_HEADER.get(header.trim().toLowerCase());
}

/** Field keys that describe a metafield, with the ns/key parsed out. */
export interface MetafieldMatch {
  readonly namespace: string;
  readonly key: string;
  readonly scope: 'product' | 'variant';
}

const METAFIELD_RE = /^\[\s*(variant\s+)?metafield\s*:\s*([^.\]]+)\.([^\]]+)\s*\]$/i;

/**
 * Shopify documents that variant metafields are NOT supported in product CSV
 * import/export. We still parse the column so the user can see that a value
 * they are relying on will not be applied — silence would be worse.
 */
export function matchMetafield(header: string): MetafieldMatch | undefined {
  const m = METAFIELD_RE.exec(header.trim());
  if (!m) return undefined;
  return {
    scope: m[1] ? 'variant' : 'product',
    namespace: m[2].trim(),
    key: m[3].trim(),
  };
}

/** Shopify: "A product can have up to 3 options." */
export const MAX_OPTIONS = 3;

/** Shopify: "If a product has only one option, then this value should be Default Title." */
export const DEFAULT_TITLE = 'Default Title';
