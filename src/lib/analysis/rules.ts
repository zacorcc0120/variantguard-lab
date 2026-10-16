import { renderShort, text, type Cell } from '@/lib/csv/cell';
import {
  DEFAULT_TITLE,
  MAX_OPTIONS,
  FIELDS,
  matchMetafield,
} from '@/lib/shopify/schema';
import type {
  ProductGroup,
  ShopifyCatalog,
  Variant,
} from '@/lib/shopify/model';
import { columnIndex, normaliseOptionValue } from '@/lib/shopify/model';
import { assumptionOn, type AssumptionKey, type AssumptionSet } from './assumptions';
import type {
  Basis,
  Category,
  Risk,
  Severity,
  ValueRef,
} from './types';

// ---------------------------------------------------------------------------
// Rule registry
// ---------------------------------------------------------------------------

export interface RuleContext {
  readonly baseline: ShopifyCatalog;
  readonly proposed: ShopifyCatalog;
  readonly assumptions: AssumptionSet;
  add(risk: Omit<Risk, 'id'>): void;
}

export interface RuleDef {
  readonly id: string;
  readonly title: string;
  readonly category: Category;
  readonly severity: Severity;
  readonly basis: Basis;
  readonly dependsOn: readonly AssumptionKey[];
  readonly rationale: string;
  readonly suggestion: string;
  run(ctx: RuleContext): void;
}

const rules: RuleDef[] = [];
function rule(def: RuleDef): RuleDef {
  rules.push(def);
  return def;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Builds a ValueRef. An undefined cell is normalised to ABSENT so a rule can
 * pass through a missing field without special-casing.
 */
function ref(
  c: Cell | undefined,
  loc: { line: number; lineSpan: number } | undefined,
): ValueRef | undefined {
  const value = c ?? { kind: 'absent' as const };
  if (value.kind === 'absent' && loc === undefined) return undefined;
  return { cell: value, location: loc };
}

/**
 * Accepts either a row-bearing object (Variant, ImageRow) or a bare ParsedRow,
 * because product rows are optional in the model while variant rows are not.
 */
function rowLoc(
  v:
    | { row?: { line: number; lineSpan: number } | undefined }
    | { line: number; lineSpan: number }
    | undefined
    | null,
): { line: number; lineSpan: number } | undefined {
  if (!v) return undefined;
  const row = 'line' in v ? v : v.row;
  if (!row) return undefined;
  return { line: row.line, lineSpan: row.lineSpan };
}

const VARIANT_SCOPED = FIELDS.filter(
  (f) => f.scope === 'variant' && f.key !== 'option1Value' && f.key !== 'option2Value' && f.key !== 'option3Value',
);

/** Fields whose silent clearing is worth reporting even at Medium. */
const HIGH_IMPACT_FIELDS = new Set([
  'variantPrice',
  'variantInventoryPolicy',
  'variantFulfillmentService',
  'variantRequiresShipping',
  'variantTaxable',
]);

function parseNum(c: Cell): number | undefined {
  if (c.kind !== 'value') return undefined;
  const cleaned = c.value.replace(/[\s,]/g, '');
  if (cleaned.length === 0) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export interface VariantPair {
  readonly base: Variant | undefined;
  readonly prop: Variant | undefined;
  readonly matchedBy: 'option-key' | 'sku' | 'ordinal' | 'none';
}

const DEFAULT_TITLE_LOWER = DEFAULT_TITLE.toLowerCase();

function skuOf(v: Variant | ProductGroup): Cell {
  return v instanceof Object && 'values' in v
    ? (v as Variant).values.get('variantSku') ?? { kind: 'absent' as const }
    : { kind: 'absent' as const };
}

/**
 * Pairs baseline variants with proposed variants.
 *
 * Exact option-key matching alone is not enough to report anything useful
 * about an option-value edit: if you rename "Red" to "Crimson", both keys
 * vanish and the naive diff says "one variant deleted, one created", which
 * loses the single fact the merchant needs. So we match in passes — option key,
 * then unique SKU, then ordinal — and record how each pair was matched.
 */
export function pairVariants(
  baseVariants: readonly Variant[],
  propVariants: readonly Variant[],
): VariantPair[] {
  const pairs: VariantPair[] = [];
  const usedProp = new Set<number>();

  const byKey = new Map<string, number>();
  propVariants.forEach((v, i) => {
    const k = v.key;
    if (!byKey.has(k)) byKey.set(k, i);
  });

  const matchedBase = new Set<number>();
  // pass 1: option key
  baseVariants.forEach((bv, bi) => {
    const pi = byKey.get(bv.key);
    if (pi !== undefined && !usedProp.has(pi)) {
      usedProp.add(pi);
      matchedBase.add(bi);
      pairs.push({ base: bv, prop: propVariants[pi], matchedBy: 'option-key' });
    }
  });

  // pass 2: unique SKU
  const skuToProp = new Map<string, number[]>();
  propVariants.forEach((v, i) => {
    const s = normaliseOptionValue(text(skuOf(v)));
    if (s.length === 0) return;
    const arr = skuToProp.get(s) ?? [];
    arr.push(i);
    skuToProp.set(s, arr);
  });

  baseVariants.forEach((bv, bi) => {
    if (matchedBase.has(bi)) return;
    const s = normaliseOptionValue(text(skuOf(bv)));
    if (s.length === 0) return;
    const candidates = (skuToProp.get(s) ?? []).filter((i) => !usedProp.has(i));
    if (candidates.length === 1) {
      const pi = candidates[0];
      usedProp.add(pi);
      matchedBase.add(bi);
      pairs.push({ base: bv, prop: propVariants[pi], matchedBy: 'sku' });
    }
  });

  // pass 3: ordinal, only when the variant count is unchanged
  const sameCount = baseVariants.length === propVariants.length;
  if (sameCount) {
    baseVariants.forEach((bv, bi) => {
      if (matchedBase.has(bi)) return;
      const pi = bi;
      if (usedProp.has(pi)) return;
      usedProp.add(pi);
      matchedBase.add(bi);
      pairs.push({ base: bv, prop: propVariants[pi], matchedBy: 'ordinal' });
    });
  }

  baseVariants.forEach((bv, bi) => {
    if (!matchedBase.has(bi)) pairs.push({ base: bv, prop: undefined, matchedBy: 'none' });
  });
  propVariants.forEach((pv, pi) => {
    if (!usedProp.has(pi)) pairs.push({ base: undefined, prop: pv, matchedBy: 'none' });
  });

  pairs.sort((a, b) => {
    const ao = a.base?.ordinal ?? a.prop?.ordinal ?? 0;
    const bo = b.base?.ordinal ?? b.prop?.ordinal ?? 0;
    return ao - bo;
  });
  return pairs;
}

function optionValueCells(v: Variant): readonly [Cell, Cell, Cell] {
  return v.options;
}

function optionsDiffer(a: readonly [Cell, Cell, Cell], b: readonly [Cell, Cell, Cell]): boolean {
  return a.some((c, i) => normaliseOptionValue(text(c)) !== normaliseOptionValue(text(b[i])));
}

function countFilledOptions(v: Variant): number {
  return optionValueCells(v).filter((c) => text(c).trim().length > 0).length;
}

// ===========================================================================
// FORMAT RULES
// ===========================================================================

rule({
  id: 'VG-FMT-001',
  title: 'Column is not a recognised Shopify product CSV column',
  category: 'format',
  severity: 'low',
  basis: 'documented',
  dependsOn: [],
  rationale:
    'Shopify documents that the Collection column is the only column that may be added to a product CSV without breaking the format.',
  suggestion:
    'If this column was meant to be Collection, rename it. If it is a custom column, Shopify may reject the file or ignore it — either way your intent will not be applied.',
  run(ctx) {
    const cols = [...new Set([...ctx.baseline.unknownColumns, ...ctx.proposed.unknownColumns])];
    for (const c of cols) {
      const inBaseline = ctx.baseline.unknownColumns.includes(c);
      const inProposed = ctx.proposed.unknownColumns.includes(c);
      ctx.add({
        ruleId: 'VG-FMT-001',
        i18n: {
          title: 'finding.VG-FMT-001.title',
          detail: inBaseline && inProposed
            ? 'finding.VG-FMT-001.detail.1'
            : inProposed
              ? 'finding.VG-FMT-001.detail.2'
              : 'finding.VG-FMT-001.detail.3',
          rationale: 'finding.VG-FMT-001.rationale',
          suggestion: 'finding.VG-FMT-001.suggestion',
        },
        severity: 'low',
        category: 'format',
        basis: 'documented',
        title: `Unrecognised column "${c}"`,
        detail:
          inBaseline && inProposed
            ? 'This column exists in both files but is not a documented Shopify product CSV column.'
            : inProposed
              ? 'This column is added by the proposed file and is not a documented Shopify product CSV column.'
              : 'This column exists in the baseline export but not in the proposed file.',
        rationale:
          'Shopify: "The Collection column is the only column that you can add to the CSV file that doesn\'t break the format."',
        suggestion:
          'Confirm the header spelling, or confirm you do not need it. Values in unknown columns cannot be applied by the native importer.',
        dependsOn: [],
        handle: undefined,
        variantLabel: undefined,
        fieldHeader: c,
        baseline: undefined,
        proposed: undefined,
        meta: { inBaseline, inProposed },
      });
    }
  },
});

rule({
  id: 'VG-FMT-002',
  title: 'Variant metafield column will not be applied',
  category: 'format',
  severity: 'medium',
  basis: 'documented',
  dependsOn: [],
  rationale:
    'Shopify: "Variant metafields aren\'t supported for product CSV import/export. To edit your variant metafields in bulk, you need to use the variant bulk editor, and then add metafield columns."',
  suggestion:
    'Treat these columns as documentation only. Applying variant metafields requires the variant bulk editor or the Admin API — not the product CSV.',
  run(ctx) {
    const cols = [...new Set([...ctx.baseline.metafieldColumns, ...ctx.proposed.metafieldColumns])];
    for (const c of cols) {
      const m = matchMetafield(c);
      if (!m || m.scope !== 'variant') continue;
      ctx.add({
        ruleId: 'VG-FMT-002',
        i18n: {
          title: 'finding.VG-FMT-002.title',
          detail: 'finding.VG-FMT-002.detail',
          rationale: 'finding.VG-FMT-002.rationale',
          suggestion: 'finding.VG-FMT-002.suggestion',
        },
        severity: 'medium',
        category: 'format',
        basis: 'documented',
        title: `Variant metafield column "${c}" is not importable`,
        detail:
          'Values in this column will not be written to your store by the native product CSV import, even though the import may report success.',
        rationale:
          'Shopify documents variant metafields as unsupported for product CSV import/export.',
        suggestion:
          'Use the variant bulk editor (Settings → Custom data → Variants → add column) or the Admin API for this data. Do not treat a successful import as confirmation these values applied.',
        dependsOn: [],
        handle: undefined,
        variantLabel: undefined,
        fieldHeader: c,
        baseline: undefined,
        proposed: undefined,
        meta: { namespace: m.namespace, key: m.key },
      });
    }
  },
});

rule({
  id: 'VG-FMT-003',
  title: 'Leading or trailing whitespace in an identity column',
  category: 'identity',
  severity: 'medium',
  basis: 'heuristic',
  dependsOn: ['handleMatchIsExact'],
  rationale:
    'We compare Handle and Option values after trimming, so a stray space produces a match where Shopify (matching on the literal string) may not.',
  suggestion:
    'Strip leading/trailing spaces from the Handle and Option value columns before importing.',
  run(ctx) {
    for (const [name, cat] of [
      ['baseline', ctx.baseline],
      ['proposed', ctx.proposed],
    ] as const) {
      const handleIdx = columnIndex(cat.headerIndex, 'Handle');
      for (const row of cat.rows) {
        const raw = handleIdx === undefined ? '' : (row.cells[handleIdx] ?? '');
        if (raw.length > 0 && raw !== raw.trim()) {
          ctx.add({
            ruleId: 'VG-FMT-003',
            i18n: {
              title: 'finding.VG-FMT-003.title.1',
              detail: 'finding.VG-FMT-003.detail.1',
              params: { file: name, baselineLine: row.line },
              rationale: 'finding.VG-FMT-003.rationale.1',
              suggestion: 'finding.VG-FMT-003.suggestion.1',
            },
            severity: 'medium',
            category: 'identity',
            basis: 'heuristic',
            title: 'Handle has leading or trailing whitespace',
            detail: `The ${name} file, line ${row.line}, has a Handle value surrounded by spaces.`,
            rationale: 'Literal whitespace in an identity column prevents an exact match against the store value.',
            suggestion: 'Trim the Handle cell and re-check.',
            dependsOn: ['handleMatchIsExact'],
            handle: raw.trim(),
            variantLabel: undefined,
            fieldHeader: 'Handle',
            baseline: undefined,
            proposed: { location: { line: row.line, lineSpan: row.lineSpan }, cell: { kind: 'value', value: raw } },
            meta: { file: name },
          });
        }
      }
      for (const header of ['Option1 Value', 'Option2 Value', 'Option3 Value']) {
        const idx = columnIndex(cat.headerIndex, header);
        if (idx === undefined) continue;
        for (const row of cat.rows) {
          const raw = row.cells[idx] ?? '';
          if (raw.length > 0 && raw !== raw.trim()) {
            ctx.add({
              ruleId: 'VG-FMT-003',
              i18n: {
                title: 'finding.VG-FMT-003.title.2',
                detail: 'finding.VG-FMT-003.detail.2',
                params: { file: name, baselineLine: row.line },
                rationale: 'finding.VG-FMT-003.rationale.2',
                suggestion: 'finding.VG-FMT-003.suggestion.2',
              },
              severity: 'medium',
              category: 'identity',
              basis: 'heuristic',
              title: `${header} has leading or trailing whitespace`,
              detail: `The ${name} file, line ${row.line}, has a ${header} value surrounded by spaces.`,
              rationale: 'Literal whitespace in a variant identity column prevents an exact match against the store value.',
              suggestion: 'Trim the cell and re-check.',
              dependsOn: ['handleMatchIsExact'],
              handle: undefined,
              variantLabel: undefined,
              fieldHeader: header,
              baseline: undefined,
              proposed: { location: { line: row.line, lineSpan: row.lineSpan }, cell: { kind: 'value', value: raw } },
              meta: { file: name },
            });
          }
        }
      }
    }
  },
});

rule({
  id: 'VG-FMT-004',
  title: 'Status column present but blank',
  category: 'visibility',
  severity: 'high',
  basis: 'documented',
  dependsOn: [],
  rationale:
    'Shopify: "If this column is present, then it needs a value. If the column isn\'t present, then the product status is automatically uploaded as active."',
  suggestion:
    'Fill every Status cell with active / draft / archived, or remove the Status column entirely so existing status is left alone.',
  run(ctx) {
    const idx = columnIndex(ctx.proposed.headerIndex, 'Status');
    if (idx === undefined) return;
    for (const row of ctx.proposed.rows) {
      const raw = row.cells[idx] ?? '';
      if (raw.trim().length > 0) continue;
      const handleIdx = columnIndex(ctx.proposed.headerIndex, 'Handle');
      const handle = handleIdx === undefined ? '' : (row.cells[handleIdx] ?? '').trim();
      ctx.add({
        ruleId: 'VG-FMT-004',
        i18n: {
          title: 'finding.VG-FMT-004.title',
          detail: 'finding.VG-FMT-004.detail',
          rationale: 'finding.VG-FMT-004.rationale',
          suggestion: 'finding.VG-FMT-004.suggestion',
        },
        severity: 'high',
        category: 'visibility',
        basis: 'documented',
        title: 'Blank Status cell in the proposed file',
        detail:
          'The proposed file has a Status column but this row leaves it blank. Shopify documents that a present Status column must carry a value.',
        rationale:
          'Shopify: "If this column is present, then it needs a value." A blank here is a validation failure, not a reset to active.',
        suggestion:
          'Set the cell to active / draft / archived, or delete the whole Status column so the existing status is preserved.',
        dependsOn: [],
        handle: handle || undefined,
        variantLabel: undefined,
        fieldHeader: 'Status',
        baseline: undefined,
        proposed: { location: { line: row.line, lineSpan: row.lineSpan }, cell: { kind: 'empty' } },
        meta: { handle },
      });
    }
  },
});

// ===========================================================================
// PRODUCT-LEVEL RULES
// ===========================================================================

rule({
  id: 'VG-PRD-001',
  title: 'Product present in baseline is missing from the proposed file',
  category: 'structure',
  severity: 'low',
  basis: 'documented',
  dependsOn: ['absentProductIsRetained'],
  rationale:
    'Shopify: "CSV files can\'t be used to delete products in bulk." A handle absent from the file leaves the product untouched.',
  suggestion:
    'The product will stay as-is. Listed for completeness so you can confirm this was intentional and not an accidental row loss.',
  run(ctx) {
    const deletes = !assumptionOn(ctx.assumptions, 'absentProductIsRetained');
    for (const handle of ctx.baseline.products.keys()) {
      if (ctx.proposed.products.has(handle)) continue;
      const p = ctx.baseline.products.get(handle)!;
      ctx.add({
        ruleId: 'VG-PRD-001',
        i18n: {
          title: 'finding.VG-PRD-001.title',
          detail: deletes ? 'finding.VG-PRD-001.detail.1' : 'finding.VG-PRD-001.detail.2',
          rationale: 'finding.VG-PRD-001.rationale',
          suggestion: deletes ? 'finding.VG-PRD-001.suggestion.1' : 'finding.VG-PRD-001.suggestion.2',
        },
        severity: deletes ? 'high' : 'low',
        category: 'structure',
        basis: 'documented',
        title: `Product "${handle}" is not in the proposed file`,
        detail: deletes
          ? `All ${p.variants.length} variant(s) of "${handle}" have no row in the proposed file, and you have turned off the assumption that absent products are retained.`
          : `All ${p.variants.length} variant(s) of "${handle}" have no row in the proposed file. Shopify cannot bulk-delete products via CSV, so the product should remain in your store unchanged.`,
        rationale:
          'Shopify: "CSV files can\'t be used to delete products in bulk." This is why a missing product handle is low risk, unlike a missing variant row.',
        suggestion: deletes
          ? 'Restore the product rows if you did not intend to remove this product.'
          : 'No action needed for the product itself — but check its variants below, since a product present with variants missing is a different rule.',
        dependsOn: ['absentProductIsRetained'],
        handle,
        variantLabel: undefined,
        fieldHeader: undefined,
        baseline: undefined,
        proposed: undefined,
        meta: { variants: p.variants.length },
      });
    }
  },
});

rule({
  id: 'VG-PRD-002',
  title: 'New product appears in the proposed file',
  category: 'structure',
  severity: 'low',
  basis: 'documented',
  dependsOn: ['overwriteMatchingHandles'],
  rationale:
    'Shopify matches by Handle; a handle with no match in the store has nothing to overwrite, so it is created.',
  suggestion: 'Confirm this is a product you meant to add.',
  run(ctx) {
    for (const handle of ctx.proposed.products.keys()) {
      if (ctx.baseline.products.has(handle)) continue;
      const p = ctx.proposed.products.get(handle)!;
      ctx.add({
        ruleId: 'VG-PRD-002',
        i18n: {
          title: 'finding.VG-PRD-002.title',
          detail: 'finding.VG-PRD-002.detail',
          rationale: 'finding.VG-PRD-002.rationale',
          suggestion: 'finding.VG-PRD-002.suggestion',
        },
        severity: 'low',
        category: 'structure',
        basis: 'inference',
        title: `New product "${handle}" will be created`,
        detail: `${p.variants.length} variant row(s) reference a handle that does not exist in the baseline export.`,
        rationale: 'No matching handle exists to overwrite, so Shopify has nothing to update and will create the product.',
        suggestion: 'Verify the handle is not a typo of an existing product.',
        dependsOn: ['overwriteMatchingHandles'],
        handle,
        variantLabel: undefined,
        fieldHeader: undefined,
        baseline: undefined,
        proposed: ref(
          { kind: 'value', value: handle },
          p.productRow ? rowLoc(p.productRow) : undefined,
        ),
        meta: { variants: p.variants.length },
      });
    }
  },
});

rule({
  id: 'VG-PRD-003',
  title: 'Product appears to have been renamed via Handle',
  category: 'identity',
  severity: 'medium',
  basis: 'heuristic',
  dependsOn: ['overwriteMatchingHandles', 'handleMatchIsExact'],
  rationale:
    'Heuristic: the handle disappeared and a new handle appeared carrying the same SKUs, title and price. Shopify matches by Handle, so a changed handle has nothing to overwrite.',
  suggestion:
    'If this was meant to be an update, keep the original Handle and change the field you actually wanted. If you meant to move the product, remember the old product stays in the store.',
  run(ctx) {
    const missing = [...ctx.baseline.products.keys()].filter(
      (h) => !ctx.proposed.products.has(h),
    );
    const added = [...ctx.proposed.products.keys()].filter(
      (h) => !ctx.baseline.products.has(h),
    );
    if (missing.length === 0 || added.length === 0) return;

    const skusOf = (p: ProductGroup): Set<string> =>
      new Set(
        p.variants
          .map((v) => normaliseOptionValue(text(skuOf(v))))
          .filter((s) => s.length > 0),
      );

    for (const oldHandle of missing) {
      const bp = ctx.baseline.products.get(oldHandle)!;
      const bSkus = skusOf(bp);
      const bTitle = normaliseOptionValue(text(bp.values.get('title') ?? { kind: 'absent' }));

      let best: { handle: string; score: number; why: string } | undefined;

      for (const newHandle of added) {
        const pp = ctx.proposed.products.get(newHandle)!;
        const pSkus = skusOf(pp);
        let overlap = 0;
        for (const s of pSkus) if (bSkus.has(s)) overlap++;

        const pTitle = normaliseOptionValue(text(pp.values.get('title') ?? { kind: 'absent' }));
        const titleMatch = bTitle.length > 0 && bTitle === pTitle;

        if (overlap > 0) {
          const score = overlap / Math.max(1, Math.min(bSkus.size, pSkus.size));
          if (!best || score > best.score) {
            best = {
              handle: newHandle,
              score,
              why: `${overlap} shared SKU${overlap > 1 ? 's' : ''}${titleMatch ? ' and the same title' : ''}`,
            };
          }
        } else if (titleMatch) {
          const score = 0.5;
          if (!best || score > best.score) {
            best = { handle: newHandle, score, why: 'the same title' };
          }
        }
      }

      if (!best || best.score < 0.5) continue;

      ctx.add({
        ruleId: 'VG-PRD-003',
        i18n: {
          title: 'finding.VG-PRD-003.title',
          detail: 'finding.VG-PRD-003.detail',
          rationale: 'finding.VG-PRD-003.rationale',
          suggestion: 'finding.VG-PRD-003.suggestion',
          params: { why: best.why },
        },
        severity: 'medium',
        category: 'identity',
        basis: 'heuristic',
        title: `"${oldHandle}" looks like it was renamed to "${best.handle}"`,
        detail:
          'The old handle is gone from the proposed file and a new one appears with matching content. Because Shopify matches by Handle, the new handle will not update the old product — it creates a second product and leaves the original in place.',
        rationale: `Heuristic match on content: ${best.why}.`,
        suggestion:
          'Keep the original Handle in the CSV if you meant to update this product. Handle changes are the usual cause of "imported but nothing happened" or of accidental duplicate products.',
        dependsOn: ['overwriteMatchingHandles', 'handleMatchIsExact'],
        handle: oldHandle,
        variantLabel: undefined,
        fieldHeader: 'Handle',
        baseline: ref({ kind: 'value', value: oldHandle }, bp.productRow ? rowLoc(bp.productRow) : undefined),
        proposed: ref({ kind: 'value', value: best.handle }, ctx.proposed.products.get(best.handle)?.productRow ? rowLoc(ctx.proposed.products.get(best.handle)!.productRow!) : undefined),
        meta: { newHandle: best.handle, confidenceScore: Math.round(best.score * 100) },
      });
    }
  },
});

rule({
  id: 'VG-PRD-004',
  title: 'Product will become unpublished or hidden',
  category: 'visibility',
  severity: 'medium',
  basis: 'documented',
  dependsOn: ['blankClearsMissingPreserves'],
  rationale:
    'Shopify documents the Status values active / draft / archived and the "Published on online store" true / false column.',
  suggestion: 'Re-publish in the admin after import, or remove the change if it was not intended.',
  run(ctx) {
    for (const [handle, pp] of ctx.proposed.products) {
      const bp = ctx.baseline.products.get(handle);
      if (!bp) continue;
      const checks: { header: string; key: string; hides: (v: string) => boolean }[] = [
        {
          header: 'Status',
          key: 'status',
          hides: (v) => ['draft', 'archived'].includes(v.trim().toLowerCase()),
        },
        {
          header: 'Published on online store',
          key: 'publishedOnlineStore',
          hides: (v) => v.trim().toLowerCase() === 'false',
        },
        {
          header: 'Published',
          key: 'published',
          hides: (v) => v.trim().toLowerCase() === 'false',
        },
        {
          header: 'Publishable Status',
          key: 'publishableStatus',
          hides: (v) => v.trim().toLowerCase() === 'false',
        },
      ];
      for (const c of checks) {
        const pv = pp.values.get(c.key);
        const bv = bp.values.get(c.key);
        if (!pv || pv.kind !== 'value' || !c.hides(pv.value)) continue;
        const beforeVisible =
          bv && bv.kind === 'value'
            ? !c.hides(bv.value)
            : undefined;
        if (beforeVisible === false) continue; // already hidden, nothing changes
        ctx.add({
          ruleId: 'VG-PRD-004',
          i18n: {
            title: 'finding.VG-PRD-004.title',
            detail: 'finding.VG-PRD-004.detail',
            rationale: 'finding.VG-PRD-004.rationale',
            suggestion: 'finding.VG-PRD-004.suggestion',
          },
          severity: 'medium',
          category: 'visibility',
          basis: 'documented',
          title: `"${handle}" will be hidden from the storefront`,
          detail: `${c.header} changes from ${bv ? renderShort(bv) : 'not set'} to ${renderShort(pv)}.`,
          rationale: `Shopify documents ${c.header} as controlling storefront availability.`,
          suggestion:
            'Set it back to the visible value, or re-publish the product in the admin after the import.',
          dependsOn: ['blankClearsMissingPreserves'],
          handle,
          variantLabel: undefined,
          fieldHeader: c.header,
          baseline: ref(bv ?? { kind: 'absent' }, bp.productRow ? rowLoc(bp.productRow) : undefined),
          proposed: ref(pv, pp.productRow ? rowLoc(pp.productRow) : undefined),
          meta: {},
        });
      }
    }
  },
});

rule({
  id: 'VG-PRD-005',
  title: 'Title cleared on a row that updates an existing product',
  category: 'structure',
  severity: 'high',
  basis: 'documented',
  dependsOn: ['blankClearsMissingPreserves'],
  rationale:
    'Shopify: "When you update products using a CSV file, the only required columns are URL handle and Title."',
  suggestion: 'Restore the Title on the product\'s first row. Keep Title blank only on continuation rows for the same product.',
  run(ctx) {
    const clears = assumptionOn(ctx.assumptions, 'blankClearsMissingPreserves');
    for (const [handle, pp] of ctx.proposed.products) {
      if (!ctx.baseline.products.has(handle)) continue;
      const row = pp.productRow;
      if (!row) continue;
      const pv = pp.values.get('title');
      if (!pv || pv.kind !== 'empty') continue;
      const bv = ctx.baseline.products.get(handle)!.values.get('title');
      if (!bv || bv.kind !== 'value') continue;
      ctx.add({
        ruleId: 'VG-PRD-005',
        i18n: {
          title: 'finding.VG-PRD-005.title',
          detail: clears ? 'finding.VG-PRD-005.detail.1' : 'finding.VG-PRD-005.detail.2',
          rationale: 'finding.VG-PRD-005.rationale',
          suggestion: 'finding.VG-PRD-005.suggestion',
        },
        severity: 'high',
        category: 'structure',
        basis: 'documented',
        title: `Title is blank for "${handle}"`,
        detail: clears
          ? 'Title has a value in the baseline and is blank in the proposed file. A blank cell overwrites the existing value with blank, and Title is one of the two columns required to update a product.'
          : 'Title is blank in the proposed file.',
        rationale:
          'Shopify documents blank cells as overwriting the matching value with blank, and names URL handle and Title as the only required columns for an update.',
        suggestion:
          'Put the title back on this product\'s first row. Title only needs to be blank on the continuation rows of the same product.',
        dependsOn: ['blankClearsMissingPreserves'],
        handle,
        variantLabel: undefined,
        fieldHeader: 'Title',
        baseline: ref(bv, ctx.baseline.products.get(handle)!.productRow ? rowLoc(ctx.baseline.products.get(handle)!.productRow!) : undefined),
        proposed: ref(pv, rowLoc(row)),
        meta: {},
      });
    }
  },
});

rule({
  id: 'VG-PRD-006',
  title: 'Column dropped between baseline and proposed',
  category: 'structure',
  severity: 'medium',
  basis: 'documented',
  dependsOn: ['blankClearsMissingPreserves'],
  rationale:
    'Shopify: "If a non-required column isn\'t included in the import CSV file, but is included in the existing product list, then the value in the product list remains the same." AND "If a non-required column is included in the import CSV file that relies on other column data not included in the file, then existing data is deleted or removed."',
  suggestion:
    'To leave a field alone, drop the column (already the case). To clear a field, keep the column and blank the cells. Do not do neither.',
  run(ctx) {
    const baseHeaders = new Set(ctx.baseline.headers);
    const propHeaders = new Set(ctx.proposed.headers);
    const dropped = ctx.baseline.headers.filter((h) => !propHeaders.has(h));
    const added = ctx.proposed.headers.filter((h) => !baseHeaders.has(h));

    for (const h of dropped) {
      const field = FIELDS.find((f) => f.header.toLowerCase() === h.toLowerCase());
      const isDependencyCritical =
        !!field &&
        ((h === 'Variant SKU' && !propHeaders.has('Option1 Value')) ||
          (h === 'Option1 Name' && !propHeaders.has('Option1 Value')));
      ctx.add({
        ruleId: 'VG-PRD-006',
        i18n: {
          title: 'finding.VG-PRD-006.title.1',
          detail: isDependencyCritical
            ? 'finding.VG-PRD-006.detail.1'
            : 'finding.VG-PRD-006.detail.2',
          rationale: 'finding.VG-PRD-006.rationale.1',
          suggestion: isDependencyCritical
            ? 'finding.VG-PRD-006.suggestion.1'
            : 'finding.VG-PRD-006.suggestion.2',
        },
        severity: isDependencyCritical ? 'high' : 'medium',
        category: 'structure',
        basis: 'documented',
        title: `Column "${h}" is not in the proposed file`,
        detail: isDependencyCritical
          ? `"${h}" is dropped while its dependency columns are still present. Shopify documents that including a column whose supporting columns are missing causes existing data to be deleted.`
          : `Every value in "${h}" will be left untouched by the import, because the column is absent from the file.`,
        rationale:
          'Shopify documents both halves of this contract: a blank cell overwrites with blank, and an absent column leaves the existing value alone.',
        suggestion: isDependencyCritical
          ? `Restore "${h}", or drop the columns it depends on. Do not leave the file half-way.`
          : `That is the correct way to leave "${h}" alone. If you meant to clear it instead, keep the column and blank the cells.`,
        dependsOn: ['blankClearsMissingPreserves'],
        handle: undefined,
        variantLabel: undefined,
        fieldHeader: h,
        baseline: undefined,
        proposed: undefined,
        meta: { dependencyCritical: isDependencyCritical, droppedCount: dropped.length },
      });
    }

    for (const h of added) {
      const field = FIELDS.find((f) => f.header.toLowerCase() === h.toLowerCase());
      ctx.add({
        ruleId: 'VG-PRD-006',
        i18n: {
          title: 'finding.VG-PRD-006.title.2',
          detail: 'finding.VG-PRD-006.detail.3',
          rationale:
            field && field.confidence === 'legacy'
              ? 'finding.VG-PRD-006.rationale.2'
              : 'finding.VG-PRD-006.rationale.3',
          suggestion:
            field && field.confidence === 'legacy'
              ? 'finding.VG-PRD-006.suggestion.3'
              : 'finding.VG-PRD-006.suggestion.4',
        },
        severity: field && field.confidence === 'legacy' ? 'medium' : 'low',
        category: 'structure',
        basis: 'heuristic',
        title: `Column "${h}" is new in the proposed file`,
        detail: 'Every row in the proposed file carries this column, so every matched product will be written with it.',
        rationale:
          field && field.confidence === 'legacy'
            ? `"${h}" is a legacy header that is not in Shopify's current documented column table.`
            : 'The column did not exist in the baseline export.',
        suggestion:
          field && field.confidence === 'legacy'
            ? `Check the header spelling against Shopify's current template; a wrong header will not be applied.`
            : 'Confirm the column is filled correctly and intentionally.',
        dependsOn: [],
        handle: undefined,
        variantLabel: undefined,
        fieldHeader: h,
        baseline: undefined,
        proposed: undefined,
        meta: { addedCount: added.length },
      });
    }
  },
});

// ===========================================================================
// VARIANT-LEVEL RULES
// ===========================================================================

rule({
  id: 'VG-VAR-001',
  title: 'Variant has no row in the proposed file',
  category: 'variant-loss',
  severity: 'high',
  basis: 'inference',
  dependsOn: ['absentVariantIsDeleted', 'overwriteMatchingHandles'],
  rationale:
    'Not documented by Shopify. Based on the community-reported behaviour that an overwrite import treats the file as the complete variant list for each matching handle, plus Shopify\'s own statement that editing an option value "sees this as creating new variants. Consequently, the previous variants and their inventory are removed." (Support, quoted by a merchant in community.shopify.com/t/inventory-values-deleted-from-csv-upload/260795).',
  suggestion:
    'Add the missing variant row back. If the variant should be discontinued, remove it deliberately in the admin so you can see it happen.',
  run(ctx) {
    const deletes = assumptionOn(ctx.assumptions, 'absentVariantIsDeleted');
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      const pairs = pairVariants(bp.variants, pp?.variants ?? []);
      for (const pair of pairs) {
        if (pair.prop || !pair.base) continue;
        // A whole product missing from the file is PRD-001's job.
        const sku = text(skuOf(pair.base)).trim();
        ctx.add({
          ruleId: 'VG-VAR-001',
          i18n: {
            title: 'finding.VG-VAR-001.title',
            detail: deletes ? 'finding.VG-VAR-001.detail.1' : 'finding.VG-VAR-001.detail.2',
            rationale: deletes ? 'finding.VG-VAR-001.rationale.1' : 'finding.VG-VAR-001.rationale.2',
            suggestion: deletes ? 'finding.VG-VAR-001.suggestion.1' : 'finding.VG-VAR-001.suggestion.2',
            // The SKU clause appears only when a SKU exists; a dictionary entry
            // can place the equivalent fragment wherever Chinese grammar needs.
            notes: sku ? { sku: ` (SKU ${sku})` } : {},
            // `meta.variantCount` is this rule's own name for the count; the
            // template uses the neutral `variants` that other rules also use.
            params: { variants: bp.variants.length },
          },
          severity: deletes ? 'high' : 'low',
          category: 'variant-loss',
          basis: 'inference',
          title: `Variant "${pair.base.label}" is missing from the proposed file`,
          detail: deletes
            ? `"${handle}" exists in the baseline with ${bp.variants.length} variant(s). Variant "${pair.base.label}"${sku ? ` (SKU ${sku})` : ''} has no row in the proposed file, and every row in this product's file is expected to represent a variant.`
            : `"${handle}": variant "${pair.base.label}" has no row in the proposed file.`,
          rationale: deletes
            ? 'Assumes the community-reported "the file is the complete variant list" behaviour. Shopify does not document this.'
            : 'You have turned off the "absent variant is deleted" assumption, so this is informational.',
          suggestion: deletes
            ? 'Re-add the variant row. To retire a variant on purpose, remove it in the admin instead so the change is visible and reversible.'
            : 'No deletion is assumed. Listed so you can confirm the omission was deliberate.',
          dependsOn: ['absentVariantIsDeleted', 'overwriteMatchingHandles'],
          handle,
          variantLabel: pair.base.label,
          fieldHeader: undefined,
          baseline: ref(
            { kind: 'value', value: pair.base.label },
            rowLoc(pair.base.row),
          ),
          proposed: undefined,
          meta: { sku, variantCount: bp.variants.length },
        });
      }
    }
  },
});

rule({
  id: 'VG-VAR-002',
  title: 'Option value changed — Shopify will recreate the variant',
  category: 'variant-loss',
  severity: 'high',
  basis: 'documented',
  dependsOn: ['variantIdentityIsOptionValues'],
  rationale:
    'Shopify: "Changing data in the Option1 value, Option2 value, or Option3 value columns of the product CSV file deletes existing variant IDs, and creates new variant IDs. Any change to variant IDs values can break third-party dependencies on variant IDs."',
  suggestion:
    'If the rename is intentional, accept it and expect the variant ID to change. If not, keep the original option values. To rename an option without recreating variants, do it in the admin.',
  run(ctx) {
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      if (!pp) continue;
      const pairs = pairVariants(bp.variants, pp.variants);
      for (const pair of pairs) {
        if (!pair.base || !pair.prop) continue;
        if (pair.matchedBy === 'option-key') continue;
        if (!optionsDiffer(pair.base.options, pair.prop.options)) continue;

        for (let i = 0; i < MAX_OPTIONS; i++) {
          const b = pair.base.options[i];
          const p = pair.prop.options[i];
          if (normaliseOptionValue(text(b)) === normaliseOptionValue(text(p))) continue;
          const header = `Option${i + 1} Value`;
          ctx.add({
            ruleId: 'VG-VAR-002',
            i18n: {
              title: 'finding.VG-VAR-002.title',
              detail: 'finding.VG-VAR-002.detail',
              rationale: 'finding.VG-VAR-002.rationale',
              suggestion: 'finding.VG-VAR-002.suggestion',
            },
            severity: 'high',
            category: 'variant-loss',
            basis: 'documented',
            title: `${header} changed on "${pair.base.label || 'variant'}"`,
            detail: `${header} changes from "${text(b) || '(blank)'}" to "${text(p) || '(blank)'}". Shopify documents that changing an option value deletes the existing variant ID and creates a new one, which breaks anything referencing that variant — order history exports, feed connectors, and the variant ID itself.`,
            rationale:
              'Shopify: "Changing data in the Option1 value, Option2 value, or Option3 value columns of the product CSV file deletes existing variant IDs, and creates new variant IDs."',
            suggestion:
              'Expect a new variant ID. Any integration keyed on variant ID must be updated. If you only meant to relabel, rename in the admin instead.',
            dependsOn: ['variantIdentityIsOptionValues'],
            handle,
            variantLabel: pair.base.label || pair.prop.label,
            fieldHeader: header,
            baseline: ref(b, rowLoc(pair.base.row)),
            proposed: ref(p, rowLoc(pair.prop.row)),
            meta: { matchedBy: pair.matchedBy },
          });
        }
      }
    }
  },
});

rule({
  id: 'VG-VAR-003',
  title: 'Product now uses fewer option positions',
  category: 'variant-loss',
  severity: 'high',
  basis: 'inference',
  dependsOn: ['variantIdentityIsOptionValues'],
  rationale:
    'Shopify documents that option values form the variant identity and that changing them recreates variants. Dropping a position leaves existing variant rows unmatched by any row in the file.',
  suggestion: 'Keep the third option position filled, or accept that the variants collapse into fewer variants.',
  run(ctx) {
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      if (!pp) continue;
      const bMax = bp.variants.reduce(
        (m, v) => Math.max(m, countFilledOptions(v)),
        0,
      );
      const pMax = pp.variants.reduce(
        (m, v) => Math.max(m, countFilledOptions(v)),
        0,
      );
      if (pMax < bMax) {
        ctx.add({
          ruleId: 'VG-VAR-003',
          i18n: {
            title: 'finding.VG-VAR-003.title',
            detail: 'finding.VG-VAR-003.detail',
            rationale: 'finding.VG-VAR-003.rationale',
            suggestion: 'finding.VG-VAR-003.suggestion',
          },
          severity: 'high',
          category: 'variant-loss',
          basis: 'inference',
          title: `"${handle}" drops from ${bMax} option position(s) to ${pMax}`,
          detail: `Variant rows in the baseline fill ${bMax} option position(s); the proposed file fills at most ${pMax}. The variant rows that carried the dropped position have no counterpart in the proposed file.`,
          rationale:
            'Derived from Shopify\'s documented option-value identity: a row that no longer fills the same positions is a different variant.',
          suggestion:
            'Re-check the Option columns in the file. Merging two option positions into one is the most common cause of accidental variant collapse.',
          dependsOn: ['variantIdentityIsOptionValues'],
          handle,
          variantLabel: undefined,
          fieldHeader: `Option${bMax} Value`,
          baseline: ref({ kind: 'value', value: `${bMax} positions` }, bp.variants[0] ? rowLoc(bp.variants[0].row) : undefined),
          proposed: ref({ kind: 'value', value: `${pMax} positions` }, pp.variants[0] ? rowLoc(pp.variants[0].row) : undefined),
          meta: { baselineOptions: bMax, proposedOptions: pMax },
        });
      }
    }
  },
});

rule({
  id: 'VG-VAR-004',
  title: 'Duplicate option combination in the proposed file',
  category: 'structure',
  severity: 'high',
  basis: 'documented',
  dependsOn: [],
  rationale:
    'Shopify: "Validation failed: options are not unique. This error is caused when a product has duplicate options. You might have set up a product with two variants with the same option values."',
  suggestion:
    'Make each variant\'s option values unique, or move the difference into a field that is not an option value.',
  run(ctx) {
    for (const [handle, pp] of ctx.proposed.products) {
      const seen = new Map<string, Variant[]>();
      for (const v of pp.variants) {
        const arr = seen.get(v.key) ?? [];
        arr.push(v);
        seen.set(v.key, arr);
      }
      for (const [key, group] of seen) {
        if (group.length < 2) continue;
        for (const v of group) {
          ctx.add({
            ruleId: 'VG-VAR-004',
            i18n: {
              title: 'finding.VG-VAR-004.title',
              detail: 'finding.VG-VAR-004.detail',
              rationale: 'finding.VG-VAR-004.rationale',
              suggestion: 'finding.VG-VAR-004.suggestion',
            },
            severity: 'high',
            category: 'structure',
            basis: 'documented',
            title: `Duplicate option combination on "${handle}"`,
            detail: `${group.length} rows in the proposed file share the option values "${v.label}". Shopify rejects duplicate option combinations with "Validation failed: options are not unique".`,
            rationale:
              'Shopify documents this exact validation error and its cause.',
            suggestion:
              'Give each variant a distinct option value, or drop the extra row. Note our comparison treats trailing spaces and Unicode form differences as equal, so two rows that look different to you may be flagged here.',
            dependsOn: [],
            handle,
            variantLabel: v.label,
            fieldHeader: undefined,
            baseline: undefined,
            proposed: ref({ kind: 'value', value: v.label }, rowLoc(v)),
            meta: { count: group.length, key: key.replace(/\u0000/g, '|') },
          });
        }
      }
    }
  },
});

/**
 * Flags a handle that starts a second PRODUCT block.
 *
 * Note what this deliberately does NOT do: flag a handle appearing on many
 * rows. Variant and image rows repeat the handle by design — that is the whole
 * structure of a Shopify product CSV. The failure Shopify reports as "Ignored
 * line # because handle already exists" is a handle starting a second product
 * block, which shows up as a second product-level row.
 */
rule({
  id: 'VG-VAR-005',
  title: 'Handle starts a second product block',
  category: 'identity',
  severity: 'high',
  basis: 'documented',
  dependsOn: [],
  rationale:
    'Shopify: "The handle is used to uniquely identify each individual product. Make sure you have a unique handle for each product in your CSV." A repeated product block is reported as "Ignored line # because handle already exists".',
  suggestion:
    'Keep one product row per handle, followed by its variant rows. Two product blocks for one handle usually come from concatenating two exports or restoring a deleted block.',
  run(ctx) {
    for (const [name, cat] of [
      ['baseline', ctx.baseline],
      ['proposed', ctx.proposed],
    ] as const) {
      const handleIdx = columnIndex(cat.headerIndex, 'Handle');
      if (handleIdx === undefined) continue;
      const titleIdx = columnIndex(cat.headerIndex, 'Title');
      const vendorIdx = columnIndex(cat.headerIndex, 'Vendor');
      const nameIdx =
        columnIndex(cat.headerIndex, 'Option1 Name') ?? columnIndex(cat.headerIndex, 'Option1 Value');

      const blocks = new Map<string, ProductBlock[]>();
      for (const row of cat.rows) {
        const handle = (row.cells[handleIdx] ?? '').trim();
        if (handle.length === 0) continue;
        const isProductRow =
          (titleIdx !== undefined && (row.cells[titleIdx] ?? '').trim().length > 0) ||
          (vendorIdx !== undefined && (row.cells[vendorIdx] ?? '').trim().length > 0) ||
          (nameIdx !== undefined && (row.cells[nameIdx] ?? '').trim().length > 0);
        if (!isProductRow) continue;
        const arr = blocks.get(handle) ?? [];
        arr.push({
          line: row.line,
          lineSpan: row.lineSpan,
          title: titleIdx === undefined ? '' : (row.cells[titleIdx] ?? '').trim(),
          vendor: vendorIdx === undefined ? '' : (row.cells[vendorIdx] ?? '').trim(),
        });
        blocks.set(handle, arr);
      }

      for (const [handle, list] of blocks) {
        if (list.length < 2) continue;
        const titles = new Set(list.map((b) => b.title).filter((t) => t.length > 0));
        const vendors = new Set(list.map((b) => b.vendor).filter((t) => t.length > 0));
        const conflict =
          titles.size > 1
            ? ` They disagree on Title: ${[...titles].map((t) => `"${t}"`).join(' vs ')}.`
            : vendors.size > 1
              ? ` They disagree on Vendor: ${[...vendors].map((t) => `"${t}"`).join(' vs ')}.`
              : '';
        for (const b of list) {
          ctx.add({
            ruleId: 'VG-VAR-005',
            i18n: {
              title: 'finding.VG-VAR-005.title',
              detail: 'finding.VG-VAR-005.detail',
              rationale: 'finding.VG-VAR-005.rationale',
              suggestion: 'finding.VG-VAR-005.suggestion',
              params: {
                lines: list.map((x) => x.line).join(', '),
                count: list.length,
              },
              // The Title/Vendor disagreement clause is assembled in English at
              // the call site; it travels as a note so other languages can
              // restate the claim instead of splicing English into a sentence.
              notes: conflict ? { conflict } : {},
            },
            severity: 'high',
            category: 'identity',
            basis: 'documented',
            title: `Handle "${handle}" starts ${list.length} product blocks in the ${name} file`,
            detail: `Rows at lines ${list.map((x) => x.line).join(', ')} each carry product-level data for "${handle}".${conflict} Variant and image rows that repeat the handle are normal and are not flagged.`,
            rationale:
              'Shopify requires a unique handle per product and reports a repeated handle as "Ignored line # because handle already exists".',
            suggestion:
              'Keep exactly one product row per handle, followed by its variant rows. If the rows disagree on Title or Vendor they are probably two different products needing two handles.',
            dependsOn: [],
            handle,
            variantLabel: undefined,
            fieldHeader: 'Handle',
            baseline:
              name === 'baseline'
                ? ref({ kind: 'value', value: handle }, { line: b.line, lineSpan: b.lineSpan })
                : undefined,
            proposed:
              name === 'proposed'
                ? ref({ kind: 'value', value: handle }, { line: b.line, lineSpan: b.lineSpan })
                : undefined,
            meta: { blocks: list.length, file: name },
          });
        }
      }
    }
  },
});

interface ProductBlock {
  line: number;
  lineSpan: number;
  title: string;
  vendor: string;
}

rule({
  id: 'VG-VAR-006',
  title: 'Option value moved to a different position',
  category: 'variant-loss',
  severity: 'high',
  basis: 'documented',
  dependsOn: ['variantIdentityIsOptionValues'],
  rationale:
    'Shopify: "The CSV import fails when a file tries to assign an existing option value to a new option position, creating a conflict as variant options must be unique."',
  suggestion:
    'Swap the column contents, not the column names, so each option name keeps its original position.',
  run(ctx) {
    for (const [handle, pp] of ctx.proposed.products) {
      const bp = ctx.baseline.products.get(handle);
      if (!bp) continue;
      const bValues = new Set<string>();
      for (const v of bp.variants) for (const o of v.options) {
        const n = normaliseOptionValue(text(o));
        if (n.length > 0) bValues.add(n);
      }
      // Position index -> set of values seen in baseline at that position.
      const bByPos = [new Set<string>(), new Set<string>(), new Set<string>()];
      for (const v of bp.variants) {
        v.options.forEach((o, i) => {
          const n = normaliseOptionValue(text(o));
          if (n.length > 0) bByPos[i].add(n);
        });
      }
      for (const v of pp.variants) {
        v.options.forEach((p, i) => {
          const n = normaliseOptionValue(text(p));
          if (n.length === 0) return;
          // Appears in baseline, but never at THIS position.
          const atThisPos = bByPos[i].has(n);
          const elsewhere = [...bByPos].some((s, j) => j !== i && s.has(n));
          if (atThisPos || !elsewhere) return;
          ctx.add({
            ruleId: 'VG-VAR-006',
            i18n: {
              title: 'finding.VG-VAR-006.title',
              detail: 'finding.VG-VAR-006.detail',
              rationale: 'finding.VG-VAR-006.rationale',
              suggestion: 'finding.VG-VAR-006.suggestion',
              params: { value: n, position: i + 1 },
            },
            severity: 'high',
            category: 'variant-loss',
            basis: 'documented',
            title: `"${n}" moved to a different option position`,
            detail: `On "${handle}", the option value "${text(p)}" was used in the baseline in another position and is now in Option${i + 1}. Shopify documents that this conflict fails the import.`,
            rationale:
              'Shopify documents the import failing when an existing option value is assigned to a new option position.',
            suggestion:
              'This usually means Option1 Name and Option2 Name were swapped along with their values. Restore the original positions.',
            dependsOn: ['variantIdentityIsOptionValues'],
            handle,
            variantLabel: v.label,
            fieldHeader: `Option${i + 1} Value`,
            baseline: undefined,
            proposed: ref(p, rowLoc(v)),
            meta: { value: text(p) },
          });
        });
      }
    }
  },
});

rule({
  id: 'VG-VAR-007',
  title: 'Variant field will be cleared',
  category: 'inventory',
  severity: 'medium',
  basis: 'documented',
  dependsOn: ['blankClearsMissingPreserves'],
  rationale:
    'Shopify: "If a non-required column in the import CSV file is blank, then the matching value in the product list is overwritten as blank."',
  suggestion:
    'Put the value back, or delete the column from the file entirely — an absent column is the documented way to leave a value alone.',
  run(ctx) {
    const clears = assumptionOn(ctx.assumptions, 'blankClearsMissingPreserves');
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      if (!pp) continue;
      const pairs = pairVariants(bp.variants, pp.variants);
      for (const pair of pairs) {
        if (!pair.base || !pair.prop || pair.matchedBy === 'none') continue;
        for (const field of VARIANT_SCOPED) {
          const bv = pair.base.values.get(field.key);
          const pv = pair.prop.values.get(field.key);
          if (!bv || bv.kind !== 'value') continue;
          if (!pv || pv.kind !== 'empty') continue;

          const isPrice = field.key === 'variantPrice';
          const highImpact = isPrice || HIGH_IMPACT_FIELDS.has(field.key);

          ctx.add({
            ruleId: 'VG-VAR-007',
            i18n: {
              title: 'finding.VG-VAR-007.title',
              detail: clears ? 'finding.VG-VAR-007.detail.1' : 'finding.VG-VAR-007.detail.2',
              rationale: 'finding.VG-VAR-007.rationale',
              suggestion: clears ? 'finding.VG-VAR-007.suggestion.1' : 'finding.VG-VAR-007.suggestion.2',
              // The price clause is conditional in the English sentence; Chinese
              // needs it after the sentence, so it travels as a note token.
              notes: isPrice
                ? {
                    titleNote: ' — this may take the variant off sale',
                    priceNote: ' A variant with no price will not sell.',
                  }
                : {},
            },
            severity: clears ? (highImpact ? 'high' : 'medium') : 'low',
            category: isPrice || field.role === 'inventory' ? 'inventory' : 'structure',
            basis: 'documented',
            title: `${field.header} will be cleared${isPrice ? ' — this may take the variant off sale' : ''}`,
            detail: clears
              ? `"${pair.base.label}" has ${field.header} = "${renderShort(bv)}" in the baseline and a blank cell in the proposed file. The blank is a payload, not an omission, so the stored value will be overwritten with blank.${isPrice ? ' A variant with no price will not sell.' : ''}`
              : `"${pair.base.label}": ${field.header} is blank in the proposed file.`,
            rationale:
              'Shopify: "If a non-required column in the import CSV file is blank, then the matching value in the product list is overwritten as blank."',
            suggestion: clears
              ? 'Restore the cell. If the field should keep whatever is in the store, remove the whole column from the file instead.'
              : 'No clearing is assumed. Restore the cell if the value matters.',
            dependsOn: ['blankClearsMissingPreserves'],
            handle,
            variantLabel: pair.base.label,
            fieldHeader: field.header,
            baseline: ref(bv, rowLoc(pair.base.row)),
            proposed: ref(pv, rowLoc(pair.prop.row)),
            meta: { oldValue: renderShort(bv) },
          });
        }
      }
    }
  },
});

rule({
  id: 'VG-VAR-008',
  title: 'Inventory quantity will be zeroed or reduced sharply',
  category: 'inventory',
  severity: 'high',
  basis: 'documented',
  dependsOn: ['blankClearsMissingPreserves'],
  rationale:
    'The blank-clears rule applies to On hand / On hand (new) exactly as it does to any other column. Merchants most often intend to change price, not stock, and lose stock as a side effect.',
  suggestion:
    'Restore the quantity. Shopify documents "On hand (new)" as the column to use for setting a new quantity, and as safe to leave blank when you do not want to change quantities.',
  run(ctx) {
    const clears = assumptionOn(ctx.assumptions, 'blankClearsMissingPreserves');
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      if (!pp) continue;
      const pairs = pairVariants(bp.variants, pp.variants);
      for (const pair of pairs) {
        if (!pair.base || !pair.prop) continue;
        for (const key of ['onHand', 'onHandNew', 'inventoryQuantity'] as const) {
          const bv = pair.base.values.get(key);
          const pv = pair.prop.values.get(key);
          if (!bv || bv.kind !== 'value') continue;
          const bNum = parseNum(bv);
          if (bNum === undefined || bNum <= 0) continue;
          if (!pv) continue;

          const pNum = parseNum(pv);
          const header = key === 'onHandNew' ? 'On hand (new)' : key === 'inventoryQuantity' ? 'Inventory quantity' : 'On hand';

          if (pv.kind === 'empty') {
            ctx.add({
              ruleId: 'VG-VAR-008',
              i18n: {
                title: 'finding.VG-VAR-008.title.1',
                detail: clears ? 'finding.VG-VAR-008.detail.1' : 'finding.VG-VAR-008.detail.2',
                rationale: 'finding.VG-VAR-008.rationale.1',
                suggestion: clears ? 'finding.VG-VAR-008.suggestion.1' : 'finding.VG-VAR-008.suggestion.2',
              },
              severity: clears ? 'high' : 'low',
              category: 'inventory',
              basis: 'documented',
              title: `${header} will be cleared on "${pair.base.label}"`,
              detail: clears
                ? `This variant has ${header} = ${bNum} in the baseline and a blank cell in the proposed file. A blank cell is written as blank, so the quantity will not be preserved.`
                : `This variant has ${header} = ${bNum} in the baseline and a blank cell in the proposed file. With the blank-clears assumption turned off we do not claim the quantity will change.`,
              rationale:
                'Shopify: a blank cell in the import file overwrites the matching value with blank. This applies to inventory columns like any other.',
              suggestion: clears
                ? `Restore the quantity, or delete the ${header} column from the file so quantities are left untouched.`
                : 'Restore the quantity if the value matters.',
              dependsOn: ['blankClearsMissingPreserves'],
              handle,
              variantLabel: pair.base.label,
              fieldHeader: header,
              baseline: ref(bv, rowLoc(pair.base.row)),
              proposed: ref(pv, rowLoc(pair.prop.row)),
              meta: { baselineQty: bNum },
            });
            continue;
          }

          if (pNum === undefined) continue;
          if (pNum === 0 && bNum > 0) {
            ctx.add({
              ruleId: 'VG-VAR-008',
              i18n: {
                title: 'finding.VG-VAR-008.title.2',
                detail: 'finding.VG-VAR-008.detail.3',
                rationale: 'finding.VG-VAR-008.rationale.2',
                suggestion: 'finding.VG-VAR-008.suggestion.3',
              },
              severity: 'high',
              category: 'inventory',
              basis: 'documented',
              title: `${header} set to 0 on "${pair.base.label}"`,
              detail: `Quantity drops from ${bNum} to 0. The variant will be out of stock and, depending on inventory policy, stop selling.`,
              rationale: 'A numeric value in the file is written over the stored quantity.',
              suggestion: 'Confirm this is intentional — a 0 here is as irreversible as a deleted row once imported.',
              dependsOn: ['blankClearsMissingPreserves'],
              handle,
              variantLabel: pair.base.label,
              fieldHeader: header,
              baseline: ref(bv, rowLoc(pair.base.row)),
              proposed: ref(pv, rowLoc(pair.prop.row)),
              meta: { baselineQty: bNum, proposedQty: 0 },
            });
            continue;
          }

          const dropRatio = (bNum - pNum) / bNum;
          if (pNum < bNum && dropRatio >= 0.5 && bNum - pNum >= 5) {
            ctx.add({
              ruleId: 'VG-VAR-008',
              i18n: {
                title: 'finding.VG-VAR-008.title.3',
                detail: 'finding.VG-VAR-008.detail.4',
                rationale: 'finding.VG-VAR-008.rationale.3',
                suggestion: 'finding.VG-VAR-008.suggestion.4',
              },
              severity: 'medium',
              category: 'inventory',
              basis: 'heuristic',
              title: `${header} drops ${Math.round(dropRatio * 100)}% on "${pair.base.label}"`,
              detail: `Quantity falls from ${bNum} to ${pNum}. That is a large change for a single import and is easy to produce by an accidental formula fill.`,
              rationale: `Heuristic: the decrease is at least 50% and at least 5 units (${bNum} → ${pNum}).`,
              suggestion: 'Confirm this quantity is correct before importing.',
              dependsOn: [],
              handle,
              variantLabel: pair.base.label,
              fieldHeader: header,
              baseline: ref(bv, rowLoc(pair.base.row)),
              proposed: ref(pv, rowLoc(pair.prop.row)),
              meta: { baselineQty: bNum, proposedQty: pNum, dropPct: Math.round(dropRatio * 100) },
            });
          }
        }
      }
    }
  },
});

rule({
  id: 'VG-VAR-009',
  title: 'SKU changed, cleared, or duplicated',
  category: 'identity',
  severity: 'medium',
  basis: 'heuristic',
  dependsOn: ['blankClearsMissingPreserves'],
  rationale:
    'SKU is not documented as recreating a variant, but Shopify documents that a SKU column included without its Option columns causes the variant option to be deleted. SKUs are also the usual join key for feeds, inventory systems and order exports.',
  suggestion:
    'Keep SKUs stable unless you are deliberately re-keying your catalogue, and make sure every SKU is unique within the file.',
  run(ctx) {
    // duplicates within the proposed file
    const skuOwner = new Map<string, { handle: string; label: string; line: number }[]>();
    for (const [handle, pp] of ctx.proposed.products) {
      for (const v of pp.variants) {
        const s = text(skuOf(v)).trim();
        if (s.length === 0) continue;
        const arr = skuOwner.get(normaliseOptionValue(s)) ?? [];
        arr.push({ handle, label: v.label, line: v.row.line });
        skuOwner.set(normaliseOptionValue(s), arr);
      }
    }
    for (const [sku, owners] of skuOwner) {
      if (owners.length < 2) continue;
      for (const o of owners) {
        ctx.add({
          ruleId: 'VG-VAR-009',
          i18n: {
            title: 'finding.VG-VAR-009.title.1',
            detail: 'finding.VG-VAR-009.detail.1',
            rationale: 'finding.VG-VAR-009.rationale.1',
            suggestion: 'finding.VG-VAR-009.suggestion.1',
            params: {
              sku,
              count: owners.length,
              owners: owners
                .map((x) => `${x.handle} / ${x.label} (line ${x.line})`)
                .join(', '),
            },
          },
          severity: 'medium',
          category: 'identity',
          basis: 'heuristic',
          title: `SKU "${sku}" is used by ${owners.length} variants`,
          detail: `"${sku}" appears on ${owners.map((x) => `${x.handle} / ${x.label} (line ${x.line})`).join(', ')}. One SKU shared by several variants makes inventory automation ambiguous — a system that looks stock up by SKU cannot tell which variant it found.`,
          rationale:
            'Merchant-reported practice: duplicated SKUs across variants break feed and inventory syncs. This is a pattern we flag, not a Shopify validation error.',
          suggestion: 'Give each variant its own SKU if anything looks stock up by SKU.',
          dependsOn: [],
          handle: o.handle,
          variantLabel: o.label,
          fieldHeader: 'Variant SKU',
          baseline: undefined,
          proposed: ref({ kind: 'value', value: sku }, { line: o.line, lineSpan: 1 }),
          meta: { occurrences: owners.length },
        });
      }
    }

    // changed or cleared
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      if (!pp) continue;
      const pairs = pairVariants(bp.variants, pp.variants);
      for (const pair of pairs) {
        if (!pair.base || !pair.prop) continue;
        const bv = pair.base.values.get('variantSku');
        const pv = pair.prop.values.get('variantSku');
        if (!bv || bv.kind !== 'value') continue;
        if (pv && pv.kind === 'value' && pv.value === bv.value) continue;
        if (pv && pv.kind === 'absent') continue;

        const cleared = !!pv && pv.kind === 'empty';
        ctx.add({
          ruleId: 'VG-VAR-009',
          i18n: {
            title: cleared ? 'finding.VG-VAR-009.title.2' : 'finding.VG-VAR-009.title.3',
            detail: cleared ? 'finding.VG-VAR-009.detail.2' : 'finding.VG-VAR-009.detail.3',
            rationale: 'finding.VG-VAR-009.rationale.2',
            suggestion: cleared ? 'finding.VG-VAR-009.suggestion.2' : 'finding.VG-VAR-009.suggestion.3',
          },
          severity: cleared ? 'medium' : 'low',
          category: 'identity',
          basis: 'heuristic',
          title: cleared
            ? `SKU will be cleared on "${pair.base.label}"`
            : `SKU changes on "${pair.base.label}"`,
          detail: cleared
            ? `SKU "${bv.value}" becomes blank. A blank cell is written as blank, so the SKU is removed.`
            : `SKU "${bv.value}" becomes "${pv ? renderShort(pv) : '(absent)'}".`,
          rationale:
            'SKU is the usual join key between the store, inventory systems and sales channels. Shopify separately documents that a SKU column included without Option columns deletes the variant option.',
          suggestion: cleared
            ? 'Restore the SKU. Keep the SKU unique per variant.'
            : 'Confirm the new SKU is intended and unique, and that downstream systems are updated.',
          dependsOn: ['blankClearsMissingPreserves'],
          handle,
          variantLabel: pair.base.label,
          fieldHeader: 'Variant SKU',
          baseline: ref(bv, rowLoc(pair.base.row)),
          proposed: ref(pv, rowLoc(pair.prop.row)),
          meta: { oldValue: bv.value },
        });
      }
    }
  },
});

rule({
  id: 'VG-VAR-010',
  title: 'Price change is unusually large',
  category: 'routine',
  severity: 'low',
  basis: 'heuristic',
  dependsOn: [],
  rationale: 'Heuristic: a price moves by more than 50% in either direction, or drops to 0.',
  suggestion: 'Spot-check the price column before importing.',
  run(ctx) {
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      if (!pp) continue;
      for (const pair of pairVariants(bp.variants, pp.variants)) {
        if (!pair.base || !pair.prop) continue;
        const bv = pair.base.values.get('variantPrice');
        const pv = pair.prop.values.get('variantPrice');
        if (!bv || bv.kind !== 'value' || !pv || pv.kind !== 'value') continue;
        const b = parseNum(bv);
        const p = parseNum(pv);
        if (b === undefined || p === undefined || b <= 0) continue;
        const ratio = Math.abs(p - b) / b;
        if (ratio < 0.5) continue;
        ctx.add({
          ruleId: 'VG-VAR-010',
          i18n: {
            title: 'finding.VG-VAR-010.title',
            detail: 'finding.VG-VAR-010.detail',
            rationale: 'finding.VG-VAR-010.rationale',
            suggestion: 'finding.VG-VAR-010.suggestion',
            params: { ratioPct: Math.round(ratio * 100) },
          },
          severity: 'low',
          category: 'routine',
          basis: 'heuristic',
          title: `Price moves ${Math.round(ratio * 100)}% on "${pair.base.label}"`,
          detail: `Variant Price changes from ${bv.value} to ${pv.value}.`,
          rationale: `Heuristic: a change of at least 50% (${bv.value} → ${pv.value}).`,
          suggestion: 'Confirm the new price is intended.',
          dependsOn: [],
          handle,
          variantLabel: pair.base.label,
          fieldHeader: 'Variant Price',
          baseline: ref(bv, rowLoc(pair.base.row)),
          proposed: ref(pv, rowLoc(pair.prop.row)),
          meta: { oldValue: bv.value, newValue: pv.value },
        });
      }
    }
  },
});

rule({
  id: 'VG-VAR-011',
  title: 'Compare-at price set, which puts the variant on sale',
  category: 'routine',
  severity: 'low',
  basis: 'heuristic',
  dependsOn: ['blankClearsMissingPreserves'],
  rationale: 'Heuristic: Compare at Price was absent or blank and now carries a value above the variant price.',
  suggestion: 'Confirm the sale is intentional — this changes what customers see on the storefront.',
  run(ctx) {
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      if (!pp) continue;
      for (const pair of pairVariants(bp.variants, pp.variants)) {
        if (!pair.base || !pair.prop) continue;
        const bv = pair.base.values.get('variantCompareAtPrice');
        const pv = pair.prop.values.get('variantCompareAtPrice');
        if (bv && bv.kind === 'value') continue;
        if (!pv || pv.kind !== 'value') continue;
        const price = parseNum(pair.prop.values.get('variantPrice') ?? { kind: 'absent' });
        const compare = parseNum(pv);
        if (compare === undefined) continue;
        if (price !== undefined && compare <= price) continue;
        ctx.add({
          ruleId: 'VG-VAR-011',
          i18n: {
            title: 'finding.VG-VAR-011.title',
            detail: 'finding.VG-VAR-011.detail',
            rationale: 'finding.VG-VAR-011.rationale',
            suggestion: 'finding.VG-VAR-011.suggestion',
          },
          severity: 'low',
          category: 'routine',
          basis: 'heuristic',
          title: `Compare-at price set on "${pair.base.label}"`,
          detail: `Variant Compare At Price goes from ${bv ? renderShort(bv) : 'not set'} to "${pv.value}", making the variant display as on sale.`,
          rationale:
            'Compare At Price above Variant Price is what renders a sale badge and strikethrough on the storefront.',
          suggestion: 'Confirm the sale is intended.',
          dependsOn: ['blankClearsMissingPreserves'],
          handle,
          variantLabel: pair.base.label,
          fieldHeader: 'Variant Compare At Price',
          baseline: ref(bv ?? { kind: 'absent' }, rowLoc(pair.base.row)),
          proposed: ref(pv, rowLoc(pair.prop.row)),
          meta: {},
        });
      }
    }
  },
});

rule({
  id: 'VG-VAR-012',
  title: 'Single-option product does not use "Default Title"',
  category: 'structure',
  severity: 'low',
  basis: 'documented',
  dependsOn: [],
  rationale:
    'Shopify: "A product can have up to 3 options. If a product has only one option, then this value should be Default Title."',
  suggestion: 'Set Option1 Value to "Default Title" if the product truly has one option.',
  run(ctx) {
    for (const [handle, pp] of ctx.proposed.products) {
      const maxFilled = pp.variants.reduce((m, v) => Math.max(m, countFilledOptions(v)), 0);
      if (maxFilled !== 1) continue;
      for (const v of pp.variants) {
        const o = v.options[0];
        const val = text(o).trim();
        if (val.length === 0 || val.toLowerCase() === DEFAULT_TITLE_LOWER) continue;
        ctx.add({
          ruleId: 'VG-VAR-012',
          i18n: {
            title: 'finding.VG-VAR-012.title',
            detail: 'finding.VG-VAR-012.detail',
            rationale: 'finding.VG-VAR-012.rationale',
            suggestion: 'finding.VG-VAR-012.suggestion',
            params: { value: val, defaultTitle: DEFAULT_TITLE },
          },
          severity: 'low',
          category: 'structure',
          basis: 'documented',
          title: `Single-option product "${handle}" uses "${val}" instead of "${DEFAULT_TITLE}"`,
          detail: `Only Option1 Value is filled, and its value is "${val}". Shopify documents that a product with one option should use "${DEFAULT_TITLE}".`,
          rationale:
            'Shopify: "If a product has only one option, then this value should be Default Title."',
          suggestion: `Use "${DEFAULT_TITLE}" unless this product is meant to have a real option.`,
          dependsOn: [],
          handle,
          variantLabel: v.label,
          fieldHeader: 'Option1 Value',
          baseline: undefined,
          proposed: ref(o, rowLoc(v)),
          meta: {},
        });
      }
    }
  },
});

rule({
  id: 'VG-VAR-013',
  title: 'Image rows removed',
  category: 'structure',
  severity: 'medium',
  basis: 'inference',
  dependsOn: ['blankClearsMissingPreserves'],
  rationale:
    'Inferred from the documented overwrite contract: a value absent from the file is left alone, so removed image rows should not delete images. We flag it because merchants expect image rows to be the picture, and this needs confirming on a real store.',
  suggestion:
    'Confirm on a single test product whether removing an image row detaches the image. If it does, re-add the rows.',
  run(ctx) {
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      if (!pp) continue;
      if (bp.images.length === 0) continue;
      if (pp.images.length >= bp.images.length) continue;
      ctx.add({
        ruleId: 'VG-VAR-013',
        i18n: {
          title: 'finding.VG-VAR-013.title',
          detail: 'finding.VG-VAR-013.detail',
          rationale: 'finding.VG-VAR-013.rationale',
          suggestion: 'finding.VG-VAR-013.suggestion',
        },
        severity: 'medium',
        category: 'structure',
        basis: 'inference',
        title: `"${handle}" drops from ${bp.images.length} to ${pp.images.length} image row(s)`,
        detail: `The proposed file has fewer image rows for this product. Based on the documented overwrite contract we expect the existing images to be left in place, but this behaviour is not documented for image rows specifically.`,
        rationale:
          'Shopify documents that values absent from the file are preserved. It does not document image-row removal specifically, so treat this as a verification item rather than a prediction.',
        suggestion: 'Test on one product before importing the whole file.',
        dependsOn: ['blankClearsMissingPreserves'],
        handle,
        variantLabel: undefined,
        fieldHeader: 'Image Src',
        baseline: ref({ kind: 'value', value: `${bp.images.length} image rows` }, bp.images[0] ? rowLoc(bp.images[0].row) : undefined),
        proposed: ref({ kind: 'value', value: `${pp.images.length} image rows` }, pp.images[0] ? rowLoc(pp.images[0].row) : undefined),
        meta: { baselineImages: bp.images.length, proposedImages: pp.images.length },
      });
    }
  },
});

rule({
  id: 'VG-VAR-014',
  title: 'Option name changed',
  category: 'structure',
  severity: 'medium',
  basis: 'heuristic',
  dependsOn: ['variantIdentityIsOptionValues'],
  rationale:
    'Shopify documents variant ID recreation for option VALUE changes. Option NAME changes are not documented either way; we flag them because the option name is customer-facing and changes filter labels and theme copy.',
  suggestion: 'Confirm the option label change is intended; it changes storefront filter text.',
  run(ctx) {
    for (const [handle, bp] of ctx.baseline.products) {
      const pp = ctx.proposed.products.get(handle);
      if (!pp) continue;
      for (const key of ['option1Name', 'option2Name', 'option3Name'] as const) {
        const bv = bp.values.get(key);
        const pv = pp.values.get(key);
        if (!bv || bv.kind !== 'value') continue;
        if (!pv || pv.kind === 'absent') continue;
        if (normaliseOptionValue(text(bv)) === normaliseOptionValue(text(pv))) continue;
        if (pv.kind === 'empty') continue; // covered by VAR-007 style handling at product level
        const header = key.replace('Name', ' Name').replace('option', 'Option').replace('1', '1').replace('2', '2').replace('3', '3');
        ctx.add({
          ruleId: 'VG-VAR-014',
          i18n: {
            title: 'finding.VG-VAR-014.title',
            detail: 'finding.VG-VAR-014.detail',
            rationale: 'finding.VG-VAR-014.rationale',
            suggestion: 'finding.VG-VAR-014.suggestion',
          },
          severity: 'medium',
          category: 'structure',
          basis: 'heuristic',
          title: `${header} changes on "${handle}"`,
          detail: `${header} changes from "${text(bv)}" to "${text(pv)}". The option label is customer-facing: it appears in filter menus, and themes often hard-code option names in copy.`,
          rationale:
            'Not documented by Shopify. Flagged because option names are visible to customers and are frequently localised or standardised in bulk.',
          suggestion: 'If this is a deliberate rename, check any theme copy that references the old name.',
          dependsOn: ['variantIdentityIsOptionValues'],
          handle,
          variantLabel: undefined,
          fieldHeader: header,
          baseline: ref(bv, bp.productRow ? rowLoc(bp.productRow) : undefined),
          proposed: ref(pv, pp.productRow ? rowLoc(pp.productRow) : undefined),
          meta: {},
        });
      }
    }
  },
});

rule({
  id: 'VG-VAR-015',
  title: 'Variant row has an empty option value',
  category: 'structure',
  severity: 'medium',
  basis: 'heuristic',
  dependsOn: ['variantIdentityIsOptionValues'],
  rationale:
    'A row that identifies as a variant because one option is filled, but is missing a value in a later position, leaves a hole in the variant matrix.',
  suggestion: 'Fill the missing option value, or move the data to the earliest filled position.',
  run(ctx) {
    for (const [handle, pp] of ctx.proposed.products) {
      for (const v of pp.variants) {
        const filled = v.options.map((c) => text(c).trim().length > 0);
        const firstFilled = filled.indexOf(true);
        if (firstFilled === -1) continue;
        for (let i = firstFilled + 1; i < MAX_OPTIONS; i++) {
          if (filled[i]) continue;
          const laterFilled = filled.slice(i + 1).some(Boolean);
          if (!laterFilled) continue;
          ctx.add({
            ruleId: 'VG-VAR-015',
            i18n: {
              title: 'finding.VG-VAR-015.title',
              detail: 'finding.VG-VAR-015.detail',
              rationale: 'finding.VG-VAR-015.rationale',
              suggestion: 'finding.VG-VAR-015.suggestion',
              params: { firstPosition: firstFilled + 1, nextPosition: i + 2 },
            },
            severity: 'medium',
            category: 'structure',
            basis: 'heuristic',
            title: `Gap in option positions on "${handle}"`,
            detail: `Option${firstFilled + 1} is filled but Option${i + 1} is blank while Option${i + 2} carries a value. Shopify expects option values to fill positions in order.`,
            rationale: 'Heuristic: a hole in the option matrix usually comes from a shifted column during editing.',
            suggestion: 'Shift the values left so the filled positions are contiguous.',
            dependsOn: ['variantIdentityIsOptionValues'],
            handle,
            variantLabel: v.label,
            fieldHeader: `Option${i + 1} Value`,
            baseline: undefined,
            proposed: ref(v.options[i], rowLoc(v)),
            meta: { gapAt: i + 1 },
          });
        }
      }
    }
  },
});

rule({
  id: 'VG-FMT-005',
  title: 'Row with content has no Handle and was not compared',
  category: 'format',
  severity: 'medium',
  basis: 'heuristic',
  dependsOn: [],
  rationale:
    'Rows with an empty Handle are kept aside and excluded from product and variant comparison. A row that still has other cell values was therefore not checked.',
  suggestion:
    'Give the row a Handle, or delete it if it is leftover editing debris. Do not treat a report with no other findings as proof that every row was checked.',
  run(ctx) {
    for (const [name, cat] of [
      ['baseline', ctx.baseline],
      ['proposed', ctx.proposed],
    ] as const) {
      for (const row of cat.headerlessRows) {
        if (!row.cells.some((c) => c.trim().length > 0)) continue;
        const sideRef = {
          location: { line: row.line, lineSpan: row.lineSpan },
          cell: { kind: 'empty' as const },
        };
        ctx.add({
          ruleId: 'VG-FMT-005',
          i18n: {
            title: 'finding.VG-FMT-005.title',
            detail: 'finding.VG-FMT-005.detail',
            rationale: 'finding.VG-FMT-005.rationale',
            suggestion: 'finding.VG-FMT-005.suggestion',
            params: { file: name, baselineLine: row.line },
          },
          severity: 'medium',
          category: 'format',
          basis: 'heuristic',
          title: 'Row with content has no Handle and was not compared',
          detail: `The ${name} file, line ${row.line}, has values in other cells but no Handle, so this row was not compared. A report that lists nothing else does not mean every row was checked.`,
          rationale:
            'Rows with an empty Handle are kept aside and excluded from product and variant comparison. A row that still has other cell values was therefore not checked.',
          suggestion:
            'Give the row a Handle, or delete it if it is leftover editing debris. Do not treat a report with no other findings as proof that every row was checked.',
          dependsOn: [],
          handle: undefined,
          variantLabel: undefined,
          fieldHeader: 'Handle',
          baseline: name === 'baseline' ? sideRef : undefined,
          proposed: name === 'proposed' ? sideRef : undefined,
          meta: { file: name, line: row.line },
        });
      }
    }
  },
});

// ---------------------------------------------------------------------------

export function allRules(): readonly RuleDef[] {
  return rules;
}

export function ruleById(id: string): RuleDef | undefined {
  return rules.find((r) => r.id === id);
}
