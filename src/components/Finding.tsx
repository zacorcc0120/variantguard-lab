'use client';

import { useState } from 'react';
import { SeverityPill, BasisTag, Mono } from './ui';
import type { Risk, ValueRef } from '@/lib/analysis/types';
import { getAssumption } from '@/lib/analysis/assumptions';
import { ruleById } from '@/lib/analysis/rules';
import type { Cell } from '@/lib/csv/cell';
import { useI18n } from '@/i18n/provider';
import { findingText } from '@/i18n';

function CellChip({ cell, t }: { cell: Cell; t: (k: string, p?: Record<string, string | number>) => string }) {
  if (cell.kind === 'absent') {
    return (
      <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11.5px] text-ink-500 ring-1 ring-inset ring-ink-200">
        {t('finding.cellAbsent')}
      </span>
    );
  }
  if (cell.kind === 'empty') {
    return (
      <span className="rounded bg-sev-med-bg px-1.5 py-0.5 text-[11.5px] font-medium text-sev-med-fg ring-1 ring-inset ring-sev-med-br">
        {t('finding.cellEmpty')}
      </span>
    );
  }
  return (
    <span className="wrap-anywhere rounded bg-ink-50 px-1.5 py-0.5 text-[12px] text-ink-900 ring-1 ring-inset ring-ink-200">
      {cell.value.length === 0 ? t('finding.cellZeroLength') : cell.value}
    </span>
  );
}

function Side({
  label,
  file,
  ref_,
  t,
}: {
  label: string;
  file: string;
  ref_: ValueRef | undefined;
  t: (k: string, p?: Record<string, string | number>) => string;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
          {label}
        </span>
        <Mono className="text-ink-400">
          {file}
          {ref_?.location ? `:${ref_.location.line}` : ''}
        </Mono>
        {ref_?.location && ref_.location.lineSpan > 1 && (
          <span
            title={t('finding.spansLinesTitle', { count: ref_.location.lineSpan })}
            className="cursor-help rounded bg-ink-100 px-1 text-[10px] text-ink-500"
          >
            {t('finding.spansLines', { count: ref_.location.lineSpan })}
          </span>
        )}
      </div>
      <div className="mt-1">
        {ref_ ? <CellChip cell={ref_.cell} t={t} /> : <span className="text-[12px] text-ink-300">—</span>}
      </div>
    </div>
  );
}

export function Finding({ risk }: { risk: Risk }) {
  const { t, term, locale, dict } = useI18n();
  const [open, setOpen] = useState(false);
  const rule = ruleById(risk.ruleId);
  // File-level findings carry the side ("Baseline file: …") in the engine's
  // English title. The dictionary only holds the part after the colon, so the
  // prefix is composed here from a shared term and stays localised too.
  const parseCode = risk.ruleId.startsWith('VG-FMT-PARSE-')
    ? risk.ruleId.slice('VG-FMT-PARSE-'.length)
    : undefined;
  const side = String(risk.meta.side ?? '');
  // `term()` reads dict.term directly, so the key carries no section prefix.
  const sideLabel = term(`file.${side}`);
  const text = (field: 'title' | 'detail' | 'rationale' | 'suggestion') =>
    parseCode && field === 'title'
      ? `${sideLabel}: ${t(`parse.${parseCode}.title`, { side: sideLabel })}`
      : findingText(risk, field, dict, locale);
  const hasDiff = !!(risk.baseline || risk.proposed);
  const expanded = open && hasDiff;

  return (
    <li className="border-b border-ink-100 last:border-b-0">
      <button
        type="button"
        onClick={() => hasDiff && setOpen((v) => !v)}
        className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors ${
          hasDiff ? 'hover:bg-ink-50' : 'cursor-default'
        }`}
        aria-expanded={hasDiff ? expanded : undefined}
      >
        <SeverityPill severity={risk.severity} />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-medium text-ink-900">{text('title')}</span>
            <BasisTag basis={risk.basis} />
          </span>

          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-500">
            <Mono className="text-ink-500">{risk.ruleId}</Mono>
            <span className="text-ink-300">·</span>
            <span>{term(`category.${risk.category}`)}</span>
            {risk.handle && (
              <>
                <span className="text-ink-300">·</span>
                <Mono className="text-ink-600">{risk.handle}</Mono>
              </>
            )}
            {risk.variantLabel && (
              <>
                <span className="text-ink-300">·</span>
                <Mono className="text-ink-600">{risk.variantLabel}</Mono>
              </>
            )}
            {risk.fieldHeader && (
              <>
                <span className="text-ink-300">·</span>
                <Mono className="text-ink-600">{risk.fieldHeader}</Mono>
              </>
            )}
          </span>
        </span>

        {hasDiff && (
          <span className="mt-0.5 shrink-0 text-ink-300">{expanded ? '▾' : '▸'}</span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-ink-100 bg-ink-50/60 px-3 py-2.5">
          <p className="text-[12.5px] leading-relaxed text-ink-700">{text('detail')}</p>

          <div className="flex flex-col gap-2 rounded-md border border-ink-200 bg-white p-2.5 sm:flex-row sm:gap-4">
            <Side label={t('finding.before')} file="baseline.csv" ref_={risk.baseline} t={t} />
            <Side label={t('finding.after')} file="proposed.csv" ref_={risk.proposed} t={t} />
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                {t('finding.why')}
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600">{text('rationale')}</p>
            </div>
            <div>
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                {t('finding.whatToDo')}
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-900">{text('suggestion')}</p>
            </div>
          </div>

          {risk.dependsOn.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-400">
                {t('finding.dependsOn')}
              </span>
              {risk.dependsOn.map((k) => {
                const a = getAssumption(k);
                return (
                  <span
                    key={k}
                    title={t(`assumption.${a.key}.label`)}
                    className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset ${BASIS_BADGE[a.basis]}`}
                  >
                    {a.key}
                  </span>
                );
              })}
            </div>
          )}

          {rule && (
            <div className="text-[11px] text-ink-400">
              {t('finding.ruleFooter', {
                title: t(`rule.${rule.id}.title`),
                severity: term(`severity.${rule.severity}`),
              })}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

const BASIS_BADGE = {
  'official-doc': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  community: 'bg-amber-50 text-amber-700 ring-amber-200',
  inference: 'bg-ink-100 text-ink-600 ring-ink-200',
} as const;
