import { renderShort } from '@/lib/csv/cell';
import { csvEscape, toCsv } from '@/lib/csv/quote';
import { CATEGORY_LABEL, type Risk } from '@/lib/analysis/types';
import type { AnalysisResult } from '@/lib/analysis/engine';
import { ASSUMPTIONS } from '@/lib/analysis/assumptions';
import { ruleById } from '@/lib/analysis/rules';
import { findingText, t as tOf, term as termOf } from '@/i18n';
import { DEFAULT_LOCALE, type Dictionary, type Locale } from '@/i18n/types';
import type { Bytes } from '@/lib/report/zip';
import { en } from '@/i18n/en';

export { csvEscape, toCsv };

/**
 * CSV header strategy, decided rather than defaulted:
 *
 * **The header row stays English. The four human-readable columns follow the
 * language on screen.**
 *
 * The alternative — headers in the UI language — looks tidier but breaks every
 * existing spreadsheet template, `awk` script and BI import pointed at these
 * files, and the report is the artefact people are most likely to automate
 * against. Human readers get their language in the prose; machines keep a
 * stable contract. `docs/I18N.md` records this and tests/i18n.test.ts pins it.
 */
const REPORT_HEADERS = [
  'severity',
  'category',
  'rule_id',
  'rule_title',
  'basis',
  'handle',
  'variant',
  'field',
  'baseline_file',
  'baseline_line',
  'baseline_value',
  'proposed_file',
  'proposed_line',
  'proposed_value',
  'finding',
  'why',
  'suggestion',
  'depends_on',
] as const;

/**
 * Exported so the CSV strategy is a testable fact rather than a claim in a
 * comment: tests/i18n.test.ts asserts the header row is byte-identical in both
 * languages.
 */
export const REPORT_CSV_HEADER: readonly string[] = REPORT_HEADERS;

/** UTF-8 BOM. Excel on Windows reads a BOM-less UTF-8 CSV as the system codepage. */
export const UTF8_BOM = '\uFEFF';

export interface ExportOptions {
  readonly locale: Locale;
  readonly dict: Dictionary;
}

/**
 * English export, byte-identical to the pre-i18n build.
 *
 * Defaulting here rather than at each call site is deliberate: it keeps the
 * existing report tests untouched, and it means an English export can never
 * drift from what the screen shows.
 */
export const ENGLISH_EXPORT: ExportOptions = { locale: DEFAULT_LOCALE, dict: en };

/**
 * Flattening happens against the *translated* finding so the prose columns
 * follow the reader's language, while severity / category / rule_id / handle /
 * field / line / value stay in their stable machine forms.
 */
function riskToRow(r: Risk, opts: ExportOptions): string[] {
  const { dict, locale } = opts;
  const ruleTitle =
    locale === DEFAULT_LOCALE
      ? (ruleById(r.ruleId)?.title ?? r.ruleId)
      : ruleById(r.ruleId)
        ? tOf(dict, `rule.${r.ruleId}.title`)
        : termOf(dict, `category.${r.category}`);
  return [
    r.severity.toUpperCase(),
    CATEGORY_LABEL[r.category],
    r.ruleId,
    ruleTitle,
    r.basis,
    r.handle ?? '',
    r.variantLabel ?? '',
    r.fieldHeader ?? '',
    r.baseline ? 'baseline.csv' : '',
    r.baseline?.location ? String(r.baseline.location.line) : '',
    r.baseline ? renderShort(r.baseline.cell) : '',
    r.proposed ? 'proposed.csv' : '',
    r.proposed?.location ? String(r.proposed.location.line) : '',
    r.proposed ? renderShort(r.proposed.cell) : '',
    findingText(r, 'title', dict, locale),
    findingText(r, 'detail', dict, locale),
    findingText(r, 'suggestion', dict, locale),
    r.dependsOn.join(' '),
  ];
}

/**
 * Excel compatibility: a Chinese CSV with no BOM opens as mojibake on a
 * default Windows Excel, which reads UTF-8 as the local codepage. The BOM is
 * added for every non-English locale and omitted for English, so an English
 * export is byte-identical to the pre-i18n build.
 */
export function risksToCsv(risks: readonly Risk[], opts: ExportOptions = ENGLISH_EXPORT): string {
  const body = toCsv([[...REPORT_HEADERS], ...risks.map((r) => riskToRow(r, opts))]);
  return opts.locale === DEFAULT_LOCALE ? body : UTF8_BOM + body;
}

export interface ReportBundle {
  readonly tool: {
    readonly name: string;
    readonly version: string;
    readonly generatedAt: string;
    readonly localOnly: true;
    readonly disclaimer: string;
    readonly locale: Locale;
  };
  readonly inputs: {
    readonly baseline: { readonly products: number; readonly variants: number };
    readonly proposed: { readonly products: number; readonly variants: number };
  };
  readonly summary: AnalysisResult['summary'];
  readonly assumptions: readonly {
    key: string;
    label: string;
    enabled: boolean;
    basis: string;
    caveat: string;
  }[];
  readonly risks: readonly Risk[];
  /**
   * Additive block. The keys above keep their English machine-readable names
   * and their existing shape; nothing existing was renamed or moved, so a
   * consumer written against the previous schema keeps working untouched.
   */
  readonly localized: {
    readonly locale: Locale;
    readonly disclaimer: string;
    readonly rules: Readonly<Record<string, { title: string; rationale: string; suggestion: string }>>;
    readonly risks: readonly {
      id: string;
      rule_id: string;
      severity: string;
      category: string;
      title: string;
      detail: string;
      rationale: string;
      suggestion: string;
    }[];
  };
}

/** Kept for the English wording; `exportDisclaimer` is what the UI now calls. */
export const DISCLAIMER = [
  'VariantGuard Lab analyses two CSV files locally in your browser and reports what it believes an overwrite import would change.',
  'These are inferences about file structure, not observed results from Shopify. Nothing in this report was sent to Shopify, and no Shopify store was contacted.',
  'This tool cannot detect every import risk. A clean report means nothing was found by the rules below, not that the import is safe.',
].join(' ');

export function exportDisclaimer(dict: Dictionary): string {
  return tOf(dict, 'report.disclaimer');
}

export function buildReport(result: AnalysisResult, opts: ExportOptions = ENGLISH_EXPORT): ReportBundle {
  const { dict, locale } = opts;
  const rules: Record<string, { title: string; rationale: string; suggestion: string }> = {};
  for (const id of Object.keys(dict.rule).sort()) {
    rules[id] = dict.rule[id];
  }
  return {
    tool: {
      name: 'VariantGuard Lab',
      version: '0.1.0',
      generatedAt: new Date().toISOString(),
      localOnly: true,
      disclaimer: exportDisclaimer(dict),
      locale,
    },
    inputs: {
      baseline: {
        products: result.summary.baselineProducts,
        variants: result.summary.baselineVariants,
      },
      proposed: {
        products: result.summary.proposedProducts,
        variants: result.summary.proposedVariants,
      },
    },
    summary: result.summary,
    assumptions: ASSUMPTIONS.map((a) => ({
      key: a.key,
      label: tOf(dict, `assumption.${a.key}.label`),
      enabled: result.assumptions[a.key] === true,
      basis: a.basis,
      caveat: tOf(dict, `assumption.${a.key}.caveat`),
    })),
    risks: result.risks,
    localized: {
      locale,
      disclaimer: exportDisclaimer(dict),
      rules,
      risks: result.risks.map((r) => ({
        id: r.id,
        rule_id: r.ruleId,
        severity: r.severity,
        category: CATEGORY_LABEL[r.category],
        title: findingText(r, 'title', dict, locale),
        detail: findingText(r, 'detail', dict, locale),
        rationale: findingText(r, 'rationale', dict, locale),
        suggestion: findingText(r, 'suggestion', dict, locale),
      })),
    },
  };
}

export function reportToJson(result: AnalysisResult, opts: ExportOptions = ENGLISH_EXPORT): string {
  return JSON.stringify(buildReport(result, opts), null, 2);
}

/** Triggers a browser download without any network round trip. */
export function downloadBytes(filename: string, mime: string, bytes: Bytes): void {
  triggerDownload(filename, new Blob([bytes], { type: `${mime};charset=utf-8` }));
}

/** Triggers a browser download without any network round trip. */
export function downloadText(filename: string, mime: string, content: string): void {
  triggerDownload(filename, new Blob([content], { type: `${mime};charset=utf-8` }));
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
