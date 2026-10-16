import type { Cell } from '@/lib/csv/cell';
import type { AssumptionKey } from './assumptions';
import type { FindingI18n } from '@/i18n/types';

export type Severity = 'high' | 'medium' | 'low';

export const SEVERITY_ORDER: readonly Severity[] = ['high', 'medium', 'low'];

export type Category =
  | 'variant-loss'
  | 'identity'
  | 'inventory'
  | 'structure'
  | 'visibility'
  | 'format'
  | 'routine';

export const CATEGORY_LABEL: Readonly<Record<Category, string>> = {
  'variant-loss': 'Variant loss',
  identity: 'Product / variant identity',
  inventory: 'Inventory',
  structure: 'Product structure',
  visibility: 'Storefront visibility',
  format: 'File format',
  routine: 'Routine change',
};

/**
 * How well-supported a finding is.
 * - `documented`  : derived from a verbatim Shopify doc statement.
 * - `inference`   : follows from documented behaviour, but Shopify does not
 *                    state it for this exact case.
 * - `heuristic`   : pattern-based judgement with no official basis at all.
 */
export type Basis = 'documented' | 'inference' | 'heuristic';

export const BASIS_LABEL: Readonly<Record<Basis, string>> = {
  documented: 'Shopify-documented',
  inference: 'Inference from documented behaviour',
  heuristic: 'Heuristic',
};

export interface Location {
  /** 1-based physical line in the file. */
  readonly line: number;
  /** How many physical lines the record spans (>1 for embedded newlines). */
  readonly lineSpan: number;
}

export interface ValueRef {
  readonly location: Location | undefined;
  readonly cell: Cell;
}

export interface Risk {
  /** Stable id for cross-referencing and dedupe. */
  readonly id: string;
  /** Rule identifier, e.g. VG-VAR-001. Stable across releases. */
  readonly ruleId: string;
  readonly severity: Severity;
  readonly category: Category;
  readonly basis: Basis;
  readonly title: string;
  /** What is going to happen, in plain language. */
  readonly detail: string;
  /** Why we believe it — doc quote, or the pattern we matched. */
  readonly rationale: string;
  /** What to actually do about it. */
  readonly suggestion: string;
  /** Assumption keys this finding is conditional on. */
  readonly dependsOn: readonly AssumptionKey[];
  readonly handle: string | undefined;
  readonly variantLabel: string | undefined;
  /** Display name of the compared field, e.g. "Option1 Value". */
  readonly fieldHeader: string | undefined;
  readonly baseline: ValueRef | undefined;
  readonly proposed: ValueRef | undefined;
  /** Extra machine-readable context for grouping in the UI. */
  readonly meta: Readonly<Record<string, string | number | boolean>>;
  /**
   * Translation keys for the four texts above. Purely additive metadata for the
   * UI layer: the engine never reads it, so switching language cannot change
   * which findings are produced, their ids, severities or order.
   */
  readonly i18n?: FindingI18n;
}

export interface AnalysisSummary {
  readonly baselineProducts: number;
  readonly baselineVariants: number;
  readonly proposedProducts: number;
  readonly proposedVariants: number;
  readonly severityCounts: Readonly<Record<Severity, number>>;
  readonly categoryCounts: Readonly<Record<Category, number>>;
  readonly rulesFired: readonly { ruleId: string; count: number }[];
  /** Count of findings that would disappear if every non-official assumption were wrong. */
  readonly assumptionSensitive: number;
  readonly isClean: boolean;
}
