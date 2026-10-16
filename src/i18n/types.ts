/**
 * i18n contract.
 *
 * One rule governs the whole system: **a dictionary key is the exact English
 * string the product already ships.** Nothing in the detection engine had to be
 * rewritten to produce a key, an English user sees byte-identical output to the
 * previous build, and a single test can prove that every user-visible string in
 * the codebase has a translation slot.
 *
 * What is deliberately NOT keyed by English: the four texts a rule emits
 * (`title` / `detail` / `rationale` / `suggestion`) interpolate live values — handles, option labels, line numbers and counts — so those keys
 * explicitly at the point the rule builds the finding (`FindingI18n`) and their
 * values are supplied by `FindingI18n.params`. See `docs/I18N.md`.
 */

export const LOCALES = ['en', 'zh-CN'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Persisted user choice. A versioned key so a future migration is a new key. */
export const STORAGE_KEY = 'variantguard.locale:v1';

/** Set on <html> before first paint; drives the font stack and the boot gate. */
export const HTML_LOCALE_ATTR = 'data-vg-locale';
export const HTML_READY_ATTR = 'data-vg-ready';

export type I18nField = 'title' | 'detail' | 'rationale' | 'suggestion';

/** Values available to `{name}` placeholders in a translated template. */
export type I18nParams = Readonly<Record<string, string | number>>;

/**
 * Attached by a rule when it emits a finding. Purely additive metadata: the
 * detection engine ignores it entirely, so switching language can never change
 * which findings exist, their ids, their severity or their ordering.
 */
export interface FindingI18n {
  /** Key for `Risk.title`, e.g. `finding.VG-VAR-001.title`. */
  readonly title?: string;
  /** Key for `Risk.detail`. Defaults to the title key when omitted. */
  readonly detail?: string;
  readonly rationale?: string;
  readonly suggestion?: string;
  /** Extra values this rule interpolates that are not on the Risk itself. */
  readonly params?: I18nParams;
  /**
   * Optional sentence fragments addressed by token.
   *
   * Needed for the rare inline conditional, e.g. `" (SKU abc)"${sku ? … : ''}`.
   * The rule supplies the English fragment so English output is untouched, and
   * the dictionary supplies `finding.note.<token>` so other languages can place
   * the fragment wherever their grammar needs it.
   */
  readonly notes?: Readonly<Record<string, string>>;
}

export interface RuleStrings {
  readonly title: string;
  readonly rationale: string;
  readonly suggestion: string;
}

export interface AssumptionStrings {
  readonly label: string;
  /** What the tool does when the assumption is switched off. */
  readonly whenOff: string;
  readonly caveat: string;
  /**
   * Verbatim source text (a Shopify doc quote, or our own provenance note).
   *
   * Optional because three assumptions render their evidence from a `DOC_*`
   * constant in `shopify/schema.ts` rather than an inline literal; those are
   * shown straight from the assumption object, which is always the real source
   * text. Only the Chinese rendering needs a dictionary entry.
   */
  readonly evidence?: string;
  readonly evidenceZh?: string;
}

export interface ScenarioStrings {
  readonly title: string;
  readonly blurb: string;
  readonly teaches: string;
}

export interface ParseStrings {
  readonly message: string;
  readonly detail?: string;
  /** Short label for the code; the side prefix is composed by the UI. */
  readonly title?: string;
  /** Shared rationale; identical for every parse-level finding. */
  readonly rationale?: string;
  readonly suggestion?: string;
}

export interface Dictionary {
  readonly ui: Readonly<Record<string, string>>;
  readonly term: Readonly<Record<string, string>>;
  readonly rule: Readonly<Record<string, RuleStrings>>;
  /** Flat slot -> template map, e.g. `finding.VG-PRD-001.detail.1`. */
  readonly finding: Readonly<Record<string, string>>;
  readonly assumption: Readonly<Record<string, AssumptionStrings>>;
  readonly scenario: Readonly<Record<string, ScenarioStrings>>;
  readonly parse: Readonly<Record<string, ParseStrings>>;
}
