import type { ParsedCsv, FormatFinding } from '@/lib/csv/parseCsv';
import { buildCatalog, type ShopifyCatalog } from '@/lib/shopify/model';
import { DEFAULT_ASSUMPTIONS, type AssumptionSet } from './assumptions';
import { allRules } from './rules';
import type { AnalysisSummary, Category, Risk, Severity } from './types';
import { SEVERITY_ORDER } from './types';

export interface AnalysisInput {
  readonly baseline: ParsedCsv;
  readonly proposed: ParsedCsv;
  readonly assumptions?: AssumptionSet;
  /** Findings produced while parsing the two files. */
  readonly baselineFormat?: readonly FormatFinding[];
  readonly proposedFormat?: readonly FormatFinding[];
}

export interface AnalysisResult {
  readonly risks: readonly Risk[];
  readonly summary: AnalysisSummary;
  readonly baselineCatalog: ShopifyCatalog;
  readonly proposedCatalog: ShopifyCatalog;
  readonly assumptions: AssumptionSet;
  readonly durationMs: number;
}

function severityRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s);
}

function formatToRisk(
  f: FormatFinding,
  side: 'baseline' | 'proposed',
): Omit<Risk, 'id'> {
  return {
    ruleId: `VG-FMT-PARSE-${f.code}`,
    // Purely additive: the English title/detail/suggestion below are unchanged.
    // The UI looks these up so a file-level warning reads in the user's language
    // without the parser or the engine knowing anything about i18n.
    i18n: {
      detail: `parse.${f.code}.message`,
      rationale: `parse.${f.code}.rationale`,
      suggestion:
        f.code === 'ENCODING_MOJIBAKE'
          ? `parse.${f.code}.suggestion`
          : 'parse._suggestion',
      params: { ...f.params, side },
    },
    severity: f.severity,
    category: 'format' as Category,
    basis: 'heuristic' as const,
    title: `${side === 'baseline' ? 'Baseline' : 'Proposed'} file: ${codeLabel(f.code)}`,
    detail: f.message + (f.detail ? ` ${f.detail}` : ''),
    rationale:
      'Detected while parsing the file, before any comparison. A structural problem in the file can make every downstream comparison unreliable.',
    suggestion:
      f.code === 'ENCODING_MOJIBAKE'
        ? 'Re-save the file as UTF-8 CSV, then upload it again. Do not import a file whose text you have not verified.'
        : 'Fix the file before relying on this report.',
    dependsOn: [],
    handle: undefined,
    variantLabel: undefined,
    fieldHeader: undefined,
    baseline: undefined,
    proposed: undefined,
    meta: f.line ? { line: f.line, side } : { side },
  };
}

function codeLabel(code: string): string {
  return code
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function analyse(input: AnalysisInput): AnalysisResult {
  const started = Date.now();
  const assumptions = input.assumptions ?? DEFAULT_ASSUMPTIONS;

  const baselineCatalog = buildCatalog(input.baseline);
  const proposedCatalog = buildCatalog(input.proposed);

  const collected: Omit<Risk, 'id'>[] = [];
  const ctx = {
    baseline: baselineCatalog,
    proposed: proposedCatalog,
    assumptions,
    add: (risk: Omit<Risk, 'id'>) => collected.push(risk),
  };

  for (const r of allRules()) {
    r.run(ctx);
  }

  for (const f of input.baselineFormat ?? []) collected.push(formatToRisk(f, 'baseline'));
  for (const f of input.proposedFormat ?? []) collected.push(formatToRisk(f, 'proposed'));

  // Deterministic ids: stable across runs for the same input pair, which makes
  // them usable as React keys and lets a report be diffed against a re-run.
  let n = 0;
  const risks: Risk[] = collected
    .map((r) => ({
      ...r,
      id: `${r.ruleId}:${String(++n).padStart(4, '0')}:${r.handle ?? '-'}:${r.fieldHeader ?? '-'}`,
    }))
    .sort((a, b) => {
      const s = severityRank(a.severity) - severityRank(b.severity);
      if (s !== 0) return s;
      const l = (a.baseline?.location?.line ?? a.proposed?.location?.line ?? 0) -
        (b.baseline?.location?.line ?? b.proposed?.location?.line ?? 0);
      if (l !== 0) return l;
      return a.ruleId.localeCompare(b.ruleId);
    });

  return {
    risks,
    summary: summarise(risks, baselineCatalog, proposedCatalog),
    baselineCatalog,
    proposedCatalog,
    assumptions,
    durationMs: Date.now() - started,
  };
}

function summarise(
  risks: readonly Risk[],
  baseline: ShopifyCatalog,
  proposed: ShopifyCatalog,
): AnalysisSummary {
  const severityCounts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  const categoryCounts = {} as Record<Category, number>;
  const ruleTally = new Map<string, number>();

  for (const r of risks) {
    severityCounts[r.severity] += 1;
    categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;
    ruleTally.set(r.ruleId, (ruleTally.get(r.ruleId) ?? 0) + 1);
  }

  const assumptionSensitive = risks.filter(
    (r) => r.dependsOn.some((k) => k === 'absentVariantIsDeleted' || k === 'handleMatchIsExact'),
  ).length;

  const baselineVariants = [...baseline.products.values()].reduce(
    (n, p) => n + p.variants.length,
    0,
  );
  const proposedVariants = [...proposed.products.values()].reduce(
    (n, p) => n + p.variants.length,
    0,
  );

  return {
    baselineProducts: baseline.products.size,
    baselineVariants,
    proposedProducts: proposed.products.size,
    proposedVariants,
    severityCounts,
    categoryCounts,
    rulesFired: [...ruleTally.entries()]
      .map(([ruleId, count]) => ({ ruleId, count }))
      .sort((a, b) => b.count - a.count || a.ruleId.localeCompare(b.ruleId)),
    assumptionSensitive,
    isClean: severityCounts.high === 0 && severityCounts.medium === 0,
  };
}
