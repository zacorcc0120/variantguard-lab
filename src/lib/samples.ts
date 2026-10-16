/**
 * Demonstration scenarios.
 *
 * These are the single source of truth for both the in-app demo and the test
 * suite, so a rule that passes in CI is the same rule the user clicks through.
 *
 * Rows are built as objects keyed by column name and serialised in a fixed
 * column order. Hand-written CSV rows drift out of alignment the moment a
 * column is added, and a silently misaligned fixture is worse than no fixture:
 * it produces findings that look real and mean nothing.
 */

export interface Scenario {
  readonly id: string;
  readonly title: string;
  /** One line, shown under the scenario name in the demo picker. */
  readonly blurb: string;
  /** What the user should learn from this scenario. */
  readonly teaches: string;
  readonly baselineCsv: string;
  readonly proposedCsv: string;
  readonly expect: {
    readonly mustInclude: readonly string[];
    readonly mustNotInclude?: readonly string[];
    readonly minHigh?: number;
    readonly maxHigh?: number;
  };
}

/**
 * Only columns verified against Shopify's current product CSV documentation
 * (help.shopify.com/en/manual/products/import-export/using-csv, checked
 * 2026-10-16). `Status` is deliberately absent from the default header so the
 * status-blank scenario can add it.
 */
const COLUMNS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Tags',
  'Published on online store',
  'Option1 Name',
  'Option1 Value',
  'Option2 Name',
  'Option2 Value',
  'Variant SKU',
  'Variant Grams',
  'On hand',
  'On hand (new)',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Variant Barcode',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'SEO Title',
  'SEO Description',
  'Gift Card',
] as const;

type Column = (typeof COLUMNS)[number];
type RowSpec = Partial<Record<Column, string>>;

import { csvEscape } from '@/lib/csv/quote';

function serialise(row: RowSpec, columns: readonly string[] = COLUMNS): string {
  return columns.map((c) => csvEscape((row as Record<string, string>)[c] ?? '')).join(',');
}

function toCsv(rows: readonly RowSpec[], columns: readonly string[] = COLUMNS): string {
  return [columns.join(','), ...rows.map((r) => serialise(r, columns))].join('\n');
}

/** Drops columns from a header and from every row, keeping them aligned. */
function dropColumns(rows: readonly RowSpec[], drop: readonly string[]): string {
  const kept = COLUMNS.filter((c) => !drop.includes(c));
  return toCsv(rows, kept);
}

// ---------------------------------------------------------------------------
// The shared baseline catalogue
// ---------------------------------------------------------------------------

const P = {
  handle: 'classic-tee',
  title: 'Classic Tee',
  body: '<p>Soft cotton tee.</p>',
  vendor: 'Northline Apparel',
  cat: 'Shirts',
  type: 'Tees',
  tags: 'summer, cotton',
  published: 'TRUE',
};

const productFields: RowSpec = {
  Title: P.title,
  'Body (HTML)': P.body,
  Vendor: P.vendor,
  'Product Category': P.cat,
  Type: P.type,
  Tags: P.tags,
  'Published on online store': P.published,
  'SEO Title': 'Classic Tee — Northline',
};

/** classic-tee: Color x Size, 8 variants, full option values on every row. */
const TEE: RowSpec[] = [
  ['Black', 'Small', 'SKU-CT-BK-S', '180', '10', '29.00'],
  ['Black', 'Medium', 'SKU-CT-BK-M', '200', '10', '29.00'],
  ['Black', 'Large', 'SKU-CT-BK-L', '210', '9', '29.00'],
  ['White', 'Small', 'SKU-CT-WH-S', '190', '11', '29.00'],
  ['White', 'Medium', 'SKU-CT-WH-M', '200', '10', '29.00'],
  ['White', 'Large', 'SKU-CT-WH-L', '210', '9', '29.00'],
].map(([color, size, sku, grams, qty, price], i) => ({
  ...(i === 0
    ? {
        ...productFields,
        'Option1 Name': 'Color',
        'Option2 Name': 'Size',
        'Image Src': 'https://cdn.example.com/tee-black-1.jpg',
        'Image Position': '1',
        'Image Alt Text': 'Black tee front',
      }
    : {}),
  Handle: P.handle,
  'Option1 Value': color,
  'Option2 Value': size,
  'Variant SKU': sku,
  'Variant Grams': grams,
  'On hand': qty,
  'Variant Price': price,
  'Variant Requires Shipping': 'TRUE',
  'Variant Taxable': 'TRUE',
}));

/** studio-mug: single option, documented as needing "Default Title". */
const MUG: RowSpec[] = [
  {
    ...productFields,
    Handle: 'studio-mug',
    Title: 'Studio Mug',
    'Body (HTML)': '<p>Matte ceramic mug, 350ml.</p>',
    'Product Category': 'Drinkware',
    Type: 'Mugs',
    Tags: 'ceramic',
    'SEO Title': 'Studio Mug — Northline',
    'Option1 Name': 'Title',
    'Option1 Value': 'Default Title',
    'Variant SKU': 'SKU-SM-01',
    'Variant Grams': '340',
    'On hand': '4',
    'Variant Price': '18.00',
    'Variant Barcode': '4001234580',
    'Image Src': 'https://cdn.example.com/mug-1.jpg',
    'Image Position': '1',
    'Image Alt Text': 'Studio mug',
    'Gift Card': 'FALSE',
  },
];

/** field-notebook: 2 options, 4 variants. */
const NOTEBOOK: RowSpec[] = [
  ['Olive', 'A5', 'SKU-FN-OL-A5', '150', '10', '12.50'],
  ['Olive', 'A6', 'SKU-FN-OL-A6', '170', '7', '13.50'],
  ['Navy', 'A5', 'SKU-FN-NV-A5', '150', '6', '12.50'],
  ['Navy', 'A6', 'SKU-FN-NV-A6', '170', '3', '13.50'],
].map(([color, size, sku, grams, qty, price], i) => ({
  ...(i === 0
    ? {
        ...productFields,
        Title: 'Field Notebook',
        'Body (HTML)': '<p>Ruled notebook.</p>',
        'Product Category': 'Stationery',
        Type: 'Notebooks',
        Tags: 'paper, ruled',
        'SEO Title': 'Northline Field Notebook',
        'Option1 Name': 'Color',
        'Option2 Name': 'Size',
      }
    : {}),
  Handle: 'field-notebook',
  'Option1 Value': color,
  'Option2 Value': size,
  'Variant SKU': sku,
  'Variant Grams': grams,
  'On hand': qty,
  'Variant Price': price,
  'Variant Requires Shipping': 'TRUE',
  'Variant Taxable': 'TRUE',
}));

/** heavy-hoodie: 2 options, 4 variants, already on sale. */
const HOODIE: RowSpec[] = [
  ['Charcoal', 'M', 'SKU-HH-CH-M', '420', '12', '74.00', '89.00', 'hoodie-1.jpg'],
  ['Charcoal', 'L', 'SKU-HH-CH-L', '440', '8', '74.00', '89.00', ''],
  ['Ecru', 'M', 'SKU-HH-EC-M', '420', '5', '74.00', '89.00', 'hoodie-2.jpg'],
  ['Ecru', 'L', 'SKU-HH-EC-L', '440', '3', '74.00', '89.00', ''],
].map(([color, size, sku, grams, qty, price, compare, img], i) => ({
  ...(i === 0
    ? {
        ...productFields,
        Title: 'Heavy Hoodie',
        'Body (HTML)': '<p>Heavyweight hoodie.</p>',
        'Product Category': 'Sweatshirts',
        Type: 'Hoodies',
        Tags: 'winter, heavy',
        'SEO Title': 'Heavy Hoodie',
        'Option1 Name': 'Color',
        'Option2 Name': 'Size',
        'Image Position': '1',
        'Image Alt Text': 'Hoodie front',
      }
    : {}),
  Handle: 'heavy-hoodie',
  'Option1 Value': color,
  'Option2 Value': size,
  'Variant SKU': sku,
  'Variant Grams': grams,
  'On hand': qty,
  'Variant Price': price,
  'Variant Compare At Price': compare,
  'Image Src': img ? `https://cdn.example.com/${img}` : '',
  'Image Alt Text': img ? `${color} hoodie` : '',
  'Variant Requires Shipping': 'TRUE',
  'Variant Taxable': 'TRUE',
}));

/** canvas-pouch: single variant, sold out. */
const POUCH: RowSpec[] = [
  {
    ...productFields,
    Handle: 'canvas-pouch',
    Title: 'Canvas Pouch',
    'Body (HTML)': '<p>Small cotton pouch.</p>',
    'Product Category': 'Bags',
    Type: 'Pouches',
    Tags: 'clearance',
    'SEO Title': 'Canvas Pouch',
    'Option1 Name': 'Title',
    'Option1 Value': 'Default Title',
    'Variant SKU': 'SKU-CP-TAN',
    'Variant Grams': '60',
    'On hand': '2',
    'Variant Price': '9.00',
    'Variant Barcode': '4001234567',
    'Image Src': 'https://cdn.example.com/pouch-1.jpg',
    'Image Position': '1',
    'Image Alt Text': 'Canvas pouch',
  },
];

/**
 * Shopify exports additional images as their own rows: a Handle, an Image Src,
 * no option values. Without these, multi-image products never produce image
 * rows and the image-removal rule has nothing to compare.
 */
const IMAGE_ROWS: RowSpec[] = [
  {
    Handle: 'classic-tee',
    'Image Src': 'https://cdn.example.com/tee-black-2.jpg',
    'Image Position': '2',
    'Image Alt Text': 'Black tee back',
  },
  {
    Handle: 'classic-tee',
    'Image Src': 'https://cdn.example.com/tee-white-2.jpg',
    'Image Position': '2',
    'Image Alt Text': 'White tee back',
  },
  {
    Handle: 'heavy-hoodie',
    'Image Src': 'https://cdn.example.com/hoodie-3.jpg',
    'Image Position': '3',
    'Image Alt Text': 'Hoodie detail',
  },
];

const BASE: RowSpec[] = [
  ...TEE,
  ...IMAGE_ROWS.filter((r) => r.Handle === 'classic-tee'),
  ...MUG,
  ...NOTEBOOK,
  ...HOODIE,
  ...IMAGE_ROWS.filter((r) => r.Handle === 'heavy-hoodie'),
  ...POUCH,
];

// ---------------------------------------------------------------------------
// Row transforms used to build the "proposed" side of each scenario
// ---------------------------------------------------------------------------

function transform(
  rows: readonly RowSpec[],
  fn: (row: RowSpec, index: number) => RowSpec | null,
): RowSpec[] {
  const out: RowSpec[] = [];
  rows.forEach((row, i) => {
    const next = fn(row, i);
    if (next !== null) out.push(next);
  });
  return out;
}

const isHandle = (h: string) => (row: RowSpec) => row.Handle === h;
const isSku = (sku: string) => (row: RowSpec) => row['Variant SKU'] === sku;

function setCol(rows: readonly RowSpec[], col: Column, value: string, where: (r: RowSpec) => boolean): RowSpec[] {
  return rows.map((r) => (where(r) ? { ...r, [col]: value } : r));
}

function clearCol(rows: readonly RowSpec[], col: Column, where: (r: RowSpec) => boolean): RowSpec[] {
  return setCol(rows, col, '', where);
}

// ---------------------------------------------------------------------------

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'clean',
    title: 'Routine price edit',
    blurb: 'Prices changed, nothing structural touched.',
    teaches:
      'This is what a safe edit looks like. The whole report turns on whether the option values, handle and column set survive an edit.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(setCol(BASE, 'Variant Price', '32.00', isHandle('classic-tee'))),
    expect: {
      mustInclude: [],
      mustNotInclude: [
        'VG-VAR-001',
        'VG-VAR-002',
        'VG-VAR-004',
        'VG-VAR-005',
        'VG-VAR-007',
        'VG-VAR-008',
        'VG-VAR-009',
        'VG-PRD-003',
        'VG-PRD-005',
        'VG-PRD-006',
      ],
      maxHigh: 0,
    },
  },

  {
    id: 'missing-variant',
    title: 'A variant row is deleted',
    blurb: 'One row removed from a 6-variant product.',
    teaches:
      'The most common real failure: editing a spreadsheet and losing a row. Nothing in the file says "delete" — the row is simply gone.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(
      transform(BASE, (r) => (isSku('SKU-CT-BK-L')(r) ? null : r)),
    ),
    expect: { mustInclude: ['VG-VAR-001'], minHigh: 1 },
  },

  {
    id: 'option-rename',
    title: 'Option value renamed',
    blurb: '"Black" becomes "Jet" across three Tee variants.',
    teaches:
      'Shopify documents that editing an option value deletes the variant ID and creates a new one. Anything keyed on that variant ID breaks.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(
      setCol(
        setCol(BASE, 'Option1 Value', 'Jet', (r) =>
          (r.Handle === 'classic-tee' && r['Option1 Value'] === 'Black') || false,
        ),
        'Image Alt Text',
        'Jet tee front',
        (r) => r.Handle === 'classic-tee' && r['Option1 Value'] === 'Jet',
      ),
    ),
    expect: { mustInclude: ['VG-VAR-002'], minHigh: 1 },
  },

  {
    id: 'inventory-blanked',
    title: 'Stock cleared by an empty cell',
    blurb: 'On hand emptied on every Hoodie row while updating price.',
    teaches:
      'A blank cell is a payload saying "no value", not an omission. Clearing the numbers to retype them clears the stock.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(
      clearCol(
        clearCol(
          setCol(BASE, 'Variant Price', '69.00', isHandle('heavy-hoodie')),
          'On hand',
          isHandle('heavy-hoodie'),
        ),
        'On hand (new)',
        isHandle('heavy-hoodie'),
      ),
    ),
    expect: { mustInclude: ['VG-VAR-008'], minHigh: 1 },
  },

  {
    id: 'inventory-zeroed',
    title: 'Stock zeroed while retyping quantities',
    blurb: 'On hand set to 0 across the Notebook.',
    teaches:
      'A numeric 0 is written exactly like any other number. This one succeeds silently and is only noticed when a customer cannot buy.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(setCol(BASE, 'On hand', '0', isHandle('field-notebook'))),
    expect: { mustInclude: ['VG-VAR-008'], minHigh: 1 },
  },

  {
    id: 'handle-typo',
    title: 'Handle typo',
    blurb: '"studio-mug" becomes "studio-mugg" with identical SKU.',
    teaches:
      'Shopify matches by Handle, so a changed handle does not update the product — it creates a second one and leaves the original alone.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(setCol(BASE, 'Handle', 'studio-mugg', isHandle('studio-mug'))),
    expect: { mustInclude: ['VG-PRD-003'], minHigh: 1 },
  },

  {
    id: 'column-dropped',
    title: 'Column dropped from the file',
    blurb: '"On hand" removed entirely from the proposed export.',
    teaches:
      'An absent column leaves the stored value alone; a blank column clears it. Two opposite outcomes from two similar-looking files.',
    baselineCsv: toCsv(BASE),
    proposedCsv: dropColumns(BASE, ['On hand']),
    expect: { mustInclude: ['VG-PRD-006'] },
  },

  {
    id: 'duplicate-options',
    title: 'Duplicate option combination',
    blurb: 'A second Black / Medium row for the Tee.',
    teaches:
      'Shopify rejects this with "Validation failed: options are not unique" — but only after you have uploaded the file and waited for the result.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv([
      ...BASE,
      {
        Handle: 'classic-tee',
        'Option1 Value': 'Black',
        'Option2 Value': 'Medium',
        'Variant SKU': 'SKU-CT-BK-M2',
        'Variant Grams': '200',
        'On hand': '10',
        'Variant Price': '29.00',
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
      },
    ]),
    expect: { mustInclude: ['VG-VAR-004'], minHigh: 1 },
  },

  {
    id: 'unpublish',
    title: 'Product hidden',
    blurb: '"Published on online store" flipped to FALSE on the Notebook.',
    teaches:
      'Visibility changes are silent: the import reports success and the product simply vanishes from the storefront.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(
      setCol(BASE, 'Published on online store', 'FALSE', isHandle('field-notebook')),
    ),
    expect: { mustInclude: ['VG-PRD-004'] },
  },

  {
    id: 'option-swap',
    title: 'Option positions swapped',
    blurb: 'Size moved from Option1 to Option2 on the Notebook.',
    teaches:
      'Shopify documents that this specific conflict fails the import outright, because option values must be unique across positions.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(
      BASE.map((r) => {
        if (r.Handle !== 'field-notebook') return r;
        const n1 = r['Option1 Name'];
        const v1 = r['Option1 Value'];
        const n2 = r['Option2 Name'];
        const v2 = r['Option2 Value'];
        return {
          ...r,
          'Option1 Name': n2 ?? '',
          'Option1 Value': v2 ?? '',
          'Option2 Name': n1 ?? '',
          'Option2 Value': v1 ?? '',
        };
      }),
    ),
    expect: { mustInclude: ['VG-VAR-006'], minHigh: 1 },
  },

  {
    id: 'sku-duplicates',
    title: 'One SKU on every variant',
    blurb: 'The Tee now shares a single SKU across all 6 variants.',
    teaches:
      'Not a Shopify validation error, but anything that looks stock up by SKU — feeds, warehouse systems, marketplaces — stops telling the variants apart.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(setCol(BASE, 'Variant SKU', 'SKU-CT-ALL', isHandle('classic-tee'))),
    expect: { mustInclude: ['VG-VAR-009'] },
  },

  {
    id: 'status-blank',
    title: 'Status column left blank',
    blurb: 'A Status column added to the file but never filled in.',
    teaches:
      'Shopify documents that if the Status column is present it must carry a value. Blank is a validation failure, not "leave it active".',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(
      BASE.map((r) => ({ ...r, Status: '' })),
      [...COLUMNS, 'Status'],
    ),
    expect: { mustInclude: ['VG-FMT-004'], minHigh: 1 },
  },

  {
    id: 'quoted-newlines',
    title: 'Commas, quotes and newlines inside cells',
    blurb: 'Body text containing embedded line breaks and quote characters.',
    teaches:
      'Row numbers must survive quoted newlines, or every finding points at the wrong line of the merchant\'s file.',
    baselineCsv: [
      COLUMNS.join(','),
      serialise({
        ...productFields,
        Handle: 'classic-tee',
        'Body (HTML)': '<p>Line one.\nLine two, with a comma.\nAnd "quoted" text.</p>',
        'Option1 Name': 'Color',
        'Option2 Name': 'Size',
        'Option1 Value': 'Black',
        'Option2 Value': 'Small',
        'Variant SKU': 'SKU-CT-BK-S',
        'Variant Grams': '180',
        'On hand': '10',
        'Variant Price': '29.00',
      }),
      serialise({
        Handle: 'classic-tee',
        'Option1 Value': 'Black',
        'Option2 Value': 'Medium',
        'Variant SKU': 'SKU-CT-BK-M',
        'Variant Grams': '200',
        'On hand': '10',
        'Variant Price': '29.00',
      }),
    ].join('\n'),
    proposedCsv: [
      COLUMNS.join(','),
      serialise({
        ...productFields,
        Handle: 'classic-tee',
        'Body (HTML)': '<p>Line one.\nLine two, with a comma.\nAnd "quoted" text.</p>',
        'Option1 Name': 'Color',
        'Option2 Name': 'Size',
        'Option1 Value': 'Black',
        'Option2 Value': 'Small',
        'Variant SKU': 'SKU-CT-BK-S',
        'Variant Grams': '180',
        'On hand': '10',
        'Variant Price': '31.00',
      }),
      serialise({
        Handle: 'classic-tee',
        'Option1 Value': 'Black',
        'Option2 Value': 'Medium',
        'Variant SKU': 'SKU-CT-BK-M',
        'Variant Grams': '200',
        'On hand': '10',
        'Variant Price': '31.00',
      }),
    ].join('\n'),
    expect: { mustInclude: [], maxHigh: 0 },
  },

  {
    id: 'title-wiped',
    title: 'Title wiped from the product row',
    blurb: 'A find-and-replace cleared the Title on every first row.',
    teaches:
      'Shopify names URL handle and Title as the only required columns for an update. A blank Title is a payload clearing a required field.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(
      BASE.map((r) => (r.Title ? { ...r, Title: '' } : r)),
    ),
    expect: { mustInclude: ['VG-PRD-005'], minHigh: 1 },
  },

  {
    id: 'image-rows-removed',
    title: 'Image rows removed',
    blurb: 'Every image row deleted from the Hoodie.',
    teaches:
      'A verification item rather than a prediction: our best reading is that images survive, but Shopify does not document image-row removal and this deserves a single-product test.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(
      setCol(
        setCol(BASE, 'Image Src', '', isHandle('heavy-hoodie')),
        'Image Position',
        '',
        isHandle('heavy-hoodie'),
      ),
    ),
    expect: { mustInclude: ['VG-VAR-013'] },
  },

  {
    id: 'everything',
    title: 'Several problems in one file',
    blurb: 'Deleted row, renamed option, cleared stock, blanked SKU and a hidden product.',
    teaches:
      'What a real hurried Friday export looks like. Use this to see how the report prioritises when nothing is clean.',
    baselineCsv: toCsv(BASE),
    proposedCsv: toCsv(
      (() => {
        let rows: RowSpec[] = [...BASE];
        // 1. a variant row disappears
        rows = transform(rows, (r) => (isSku('SKU-CT-WH-L')(r) ? null : r));
        // 2. an option value is renamed
        rows = setCol(rows, 'Option1 Value', 'Onyx', (r) =>
          r.Handle === 'heavy-hoodie' && r['Option1 Value'] === 'Charcoal' ? true : false,
        );
        // 3. stock cleared on the pouch
        rows = clearCol(rows, 'On hand', isHandle('canvas-pouch'));
        // 4. a product is hidden
        rows = setCol(rows, 'Published on online store', 'FALSE', isHandle('field-notebook'));
        // 5. SKU wiped on the mug
        rows = clearCol(rows, 'Variant SKU', isHandle('studio-mug'));
        return rows;
      })(),
    ),
    expect: {
      mustInclude: ['VG-VAR-001', 'VG-VAR-002', 'VG-VAR-008', 'VG-PRD-004', 'VG-VAR-009'],
      minHigh: 2,
    },
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export const FIXTURE_COLUMNS = COLUMNS;
