import {
  DOC_HANDLE_MATCH,
  DOC_NO_BULK_DELETE,
  DOC_OPTION_VALUE_CHANGE,
  DOC_OVERWRITE_BLANK_CLEARS,
  DOC_OVERWRITE_MISSING_PRESERVES,
} from '@/lib/shopify/schema';

export type AssumptionKey =
  | 'overwriteMatchingHandles'
  | 'blankClearsMissingPreserves'
  | 'absentVariantIsDeleted'
  | 'absentProductIsRetained'
  | 'variantIdentityIsOptionValues'
  | 'handleMatchIsExact';

export type AssumptionBasis = 'official-doc' | 'community' | 'inference';

export interface Assumption {
  readonly key: AssumptionKey;
  readonly label: string;
  /** What the tool does when this is off. */
  readonly whenOff: string;
  readonly basis: AssumptionBasis;
  /** Verbatim Shopify text, or the provenance note for non-doc bases. */
  readonly evidence: string;
  /**
   * `official-doc` — Shopify states this.
   * `community`   — widely reported in merchant forums; NOT stated by Shopify.
   * `inference`   — derived by us from documented behaviour.
   */
  readonly caveat: string;
}

/**
 * Every rule in this tool declares which assumptions it depends on. Findings
 * produced under a non-default assumption are badged in the UI, so the user
 * can always see what would change if Shopify behaved differently than we think.
 */
export const ASSUMPTIONS: readonly Assumption[] = [
  {
    key: 'overwriteMatchingHandles',
    label: 'Import uses "Overwrite products with matching handles"',
    whenOff: 'Matching products are ignored on import. Almost every finding here becomes moot — this is why the tool assumes overwrite mode.',
    basis: 'official-doc',
    evidence: DOC_HANDLE_MATCH,
    caveat: 'Shopify states this option exists and that matching handles are overwritten in matching columns.',
  },
  {
    key: 'blankClearsMissingPreserves',
    label: 'A blank cell clears the value; a column missing from the file leaves it alone',
    whenOff: 'Field-level "will clear / will overwrite" findings are suppressed. Structural findings (variant loss, handle change) still run.',
    basis: 'official-doc',
    evidence: `${DOC_OVERWRITE_BLANK_CLEARS} — ${DOC_OVERWRITE_MISSING_PRESERVES}`,
    caveat: 'The single most load-bearing assumption in the tool, and the best documented.',
  },
  {
    key: 'absentVariantIsDeleted',
    label: 'A variant that exists in the store but has no row in the file is deleted by the import',
    whenOff: 'Findings about variants missing from the proposed file are downgraded to informational "removed from file" notes, not deletion warnings.',
    basis: 'community',
    evidence:
      'Not stated in Shopify\'s product CSV documentation. Repeatedly reported by merchants, e.g. Shopify Community thread "CSV product import deleted variants" (community.shopify.com/t/csv-product-import-deleted-variants-shopify-you-got-some-explaining-to-do/582717) and Shopify Support\'s quoted explanation in "Inventory values deleted from CSV upload" that modifying option values "sees this as creating new variants. Consequently, the previous variants and their inventory are removed."',
    caveat:
      'NOT DOCUMENTED BY SHOPIFY. We could not find an official statement either way. This is the assumption most worth verifying against a real store, because it decides whether our highest-severity findings are correct.',
  },
  {
    key: 'absentProductIsRetained',
    label: 'A product absent from the file is NOT deleted',
    whenOff: 'Products missing from the proposed file are reported as possible deletions instead of being marked safe.',
    basis: 'official-doc',
    evidence: DOC_NO_BULK_DELETE,
    caveat: 'Shopify states product CSV cannot bulk-delete products, so a handle simply missing from the file leaves the product alone.',
  },
  {
    key: 'variantIdentityIsOptionValues',
    label: 'A variant is identified by its Handle plus its Option1–3 values',
    whenOff: 'Variants are matched positionally instead, which removes all option-change findings. Not recommended.',
    basis: 'official-doc',
    evidence: DOC_OPTION_VALUE_CHANGE,
    caveat:
      'Shopify documents that editing an option VALUE deletes and recreates variant IDs, which only makes sense if the option values form the variant identity.',
  },
  {
    key: 'handleMatchIsExact',
    label: 'Handle matching is exact — case and Unicode form must match',
    whenOff: 'Handles are compared case-insensitively and after Unicode normalisation, so "Tee-Shirt" and "tee-shirt" are treated as the same product.',
    basis: 'inference',
    evidence:
      'Shopify documents that Handle uniquely identifies a product and that matching handles are overwritten, but does not document whether the comparison is case-insensitive or Unicode-normalised.',
    caveat:
      'INFERRED BY US. If Shopify matches loosely, this tool reports some false mismatches; if it matches strictly, it is right. The reverse error — claiming a product is new when it is not — is the dangerous direction, so we default to strict.',
  },
];

export const DEFAULT_ASSUMPTIONS: Readonly<Record<AssumptionKey, boolean>> = {
  overwriteMatchingHandles: true,
  blankClearsMissingPreserves: true,
  absentVariantIsDeleted: true,
  absentProductIsRetained: true,
  variantIdentityIsOptionValues: true,
  handleMatchIsExact: true,
};

export type AssumptionSet = Readonly<Record<AssumptionKey, boolean>>;

export function assumptionOn(set: AssumptionSet, key: AssumptionKey): boolean {
  return set[key] === true;
}

export function getAssumption(key: AssumptionKey): Assumption {
  const a = ASSUMPTIONS.find((x) => x.key === key);
  if (!a) throw new Error(`Unknown assumption: ${key}`);
  return a;
}
