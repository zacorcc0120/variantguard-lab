'use client';

import { useMemo, useState } from 'react';
import { Card, Button, Mono } from './ui';
import { Finding } from './Finding';
import {
  SEVERITY_ORDER,
  type Category,
  type Risk,
  type Severity,
} from '@/lib/analysis/types';
import type { AnalysisResult } from '@/lib/analysis/engine';
import { reportToJson, risksToCsv, exportDisclaimer } from '@/lib/report/export';
import { useI18n } from '@/i18n/provider';
import { findingText } from '@/i18n';
import { downloadBytes } from '@/lib/report/export';

function Stat({
  label,
  value,
  tone = 'neutral',
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone?: Severity | 'neutral';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === 'high'
      ? 'text-sev-high-fg'
      : tone === 'medium'
        ? 'text-sev-med-fg'
        : 'text-ink-900';
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': active } : {})}
      className={`flex min-w-[92px] flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left transition-colors ${
        onClick ? (active ? 'bg-ink-100' : 'hover:bg-ink-50') : ''
      }`}
    >
      <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      <span className={`text-[18px] font-semibold tabular-nums leading-none ${toneClass}`}>
        {value}
      </span>
    </Comp>
  );
}

export function Report({ result, fileNames }: { result: AnalysisResult; fileNames: { baseline: string; proposed: string } }) {
  const { t, term, locale, dict } = useI18n();
  const [query, setQuery] = useState('');
  const [severities, setSeverities] = useState<ReadonlySet<Severity>>(
    new Set(SEVERITY_ORDER),
  );
  const [category, setCategory] = useState<Category | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return result.risks.filter((r) => {
      if (!severities.has(r.severity)) return false;
      if (category !== 'all' && r.category !== category) return false;
      if (!q) return true;
      // Search the active language plus the stable ids and raw values: a user
      // who learned a rule id in English must still find it while reading
      // Chinese, and vice versa.
      const hay = [
        r.title,
        r.detail,
        r.rationale,
        r.suggestion,
        findingText(r, 'title', dict, locale),
        findingText(r, 'detail', dict, locale),
        findingText(r, 'rationale', dict, locale),
        findingText(r, 'suggestion', dict, locale),
        r.ruleId,
        r.handle ?? '',
        r.variantLabel ?? '',
        r.fieldHeader ?? '',
        String(r.baseline?.location?.line ?? ''),
        String(r.proposed?.location?.line ?? ''),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [result.risks, query, severities, category, dict, locale]);

  const presentCategories = useMemo(() => {
    const set = new Set<Category>();
    for (const r of result.risks) set.add(r.category);
    return [...set];
  }, [result.risks]);

  const toggleSeverity = (s: Severity) => {
    const next = new Set(severities);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setSeverities(next);
  };

  const allOpen = severities.size === SEVERITY_ORDER.length;

  // Headers stay English so any downstream parser keeps working; the four
  // human-readable columns follow the language on screen.
  const exportCsv = () =>
    downloadBytes(
      'variantguard-report.csv',
      'text/csv',
      new TextEncoder().encode(risksToCsv(result.risks, { locale, dict })),
    );

  const exportJson = () =>
    downloadBytes(
      'variantguard-report.json',
      'application/json',
      new TextEncoder().encode(reportToJson(result, { locale, dict })),
    );

  return (
    <div className="space-y-3">
      {/* -------- summary -------- */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-3 py-2">
          <div className="text-[12.5px] text-ink-600">
            <Mono className="font-semibold text-ink-800">{fileNames.baseline}</Mono>
            <span className="mx-1.5 text-ink-300">→</span>
            <Mono className="font-semibold text-ink-800">{fileNames.proposed}</Mono>
            <span className="mx-1.5 text-ink-300">·</span>
            {t('report.variants', {
              count: `${result.summary.baselineVariants} → ${result.summary.proposedVariants}`,
            })}
            <span className="mx-1.5 text-ink-300">·</span>
            {t('report.products', {
              count: `${result.summary.baselineProducts} → ${result.summary.proposedProducts}`,
            })}
            <span className="mx-1.5 text-ink-300">·</span>
            {t('report.analysedIn', { ms: result.durationMs })}
          </div>
          <div className="flex gap-1.5">
            <Button onClick={exportCsv} disabled={result.risks.length === 0}>
              {t('report.exportCsv')}
            </Button>
            <Button onClick={exportJson} disabled={result.risks.length === 0}>
              {t('report.exportJson')}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 px-2 py-1.5">
          <Stat
            label={t('report.statAll')}
            value={result.risks.length}
            active={allOpen}
            onClick={() => setSeverities(new Set(SEVERITY_ORDER))}
          />
          {SEVERITY_ORDER.map((s) => (
            <Stat
              key={s}
              label={term(`severity.${s}`)}
              value={result.summary.severityCounts[s]}
              tone={s as Severity}
              active={severities.has(s)}
              onClick={() => toggleSeverity(s)}
            />
          ))}
          <div className="ml-auto pr-1 text-[11.5px] text-ink-400">
            {result.summary.isClean ? (
              <span>{t('report.isClean')}</span>
            ) : (
              <span>
                {t('report.needsAttention', {
                  count: result.summary.severityCounts.high + result.summary.severityCounts.medium,
                })}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* -------- filters -------- */}
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="relative min-w-[220px] flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('report.searchPlaceholder')}
              className="w-full rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-accent-500 focus:outline-none"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | 'all')}
            className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[13px] text-ink-700 focus:border-accent-500 focus:outline-none"
          >
            <option value="all">{t('report.allCategories')}</option>
            {presentCategories.map((c) => (
              <option key={c} value={c}>
                {term(`category.${c}`)}
              </option>
            ))}
          </select>
          <span className="text-[12px] tabular-nums text-ink-500">
            {t('report.ofTotal', { shown: filtered.length, total: result.risks.length })}
          </span>
        </div>
      </Card>

      {/* -------- findings -------- */}
      <Card>
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-ink-700">
              {result.risks.length === 0
                ? t('report.noFindings')
                : t('report.noMatches')}
            </p>
            <p className="mx-auto mt-1 max-w-lg text-[12px] leading-relaxed text-ink-500">
              {result.risks.length === 0
                ? t('report.emptyExplain')
                : t('report.filterHint')}
            </p>
          </div>
        ) : (
          <ul>
            {filtered.map((r: Risk) => (
              <Finding key={r.id} risk={r} />
            ))}
          </ul>
        )}
      </Card>

      <Card className="border-ink-300 bg-ink-100/50">
        <div className="px-3 py-2.5">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-500">
            {t('report.readFirst')}
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600">
            {exportDisclaimer(dict)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{t('report.exportNote')}</p>
        </div>
      </Card>
    </div>
  );
}
