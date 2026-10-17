'use client';

import { useState } from 'react';
import { Card, Mono } from './ui';
import { ASSUMPTIONS, type AssumptionKey, type AssumptionSet } from '@/lib/analysis/assumptions';
import { useI18n } from '@/i18n/provider';
import { DEFAULT_LOCALE } from '@/i18n';

const BASIS_BADGE = {
  'official-doc': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  community: 'bg-amber-50 text-amber-700 ring-amber-200',
  inference: 'bg-ink-100 text-ink-600 ring-ink-200',
} as const;

/** How many of the ruleset's assumptions have no official documentation. */
const UNDOCUMENTED = ASSUMPTIONS.filter((a) => a.basis !== 'official-doc').length;

/**
 * Folded by default.
 *
 * The panel used to render all six assumptions expanded above the report, which
 * put ~1600 characters between the user and the finding they came for, 65% of
 * it source citations for two of the six. Most runs need the conclusion, so the
 * panel now sits below the report and opens to one line: how many assumptions
 * exist, how many lack official documentation, and whether this run leans on
 * one. Everything else is one click away.
 */
export function AssumptionPanel({
  value,
  onChange,
  sensitiveCount,
}: {
  value: AssumptionSet;
  onChange: (next: AssumptionSet) => void;
  sensitiveCount: number;
}) {
  const { t, term, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const toggle = (k: AssumptionKey) => onChange({ ...value, [k]: !value[k] });

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t('assumptions.toggleLabel')}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-ink-50"
      >
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            sensitiveCount > 0 ? 'bg-amber-500' : 'bg-ink-300'
          }`}
        />
        <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed">
          <span className="font-semibold text-ink-900">{t('assumptions.heading')}</span>
          <span className="text-ink-500">
            {' · '}
            {t('assumptions.summaryCount', { count: ASSUMPTIONS.length })}
            {' · '}
            {t('assumptions.summaryUnofficial', { count: UNDOCUMENTED })}
            {' · '}
          </span>
          {sensitiveCount > 0 ? (
            <span className="font-medium text-amber-700">
              {t(
                sensitiveCount === 1 ? 'assumptions.sensitiveOne' : 'assumptions.sensitiveMany',
                { count: sensitiveCount },
              )}
            </span>
          ) : (
            <span className="text-ink-500">{t('assumptions.summaryNone')}</span>
          )}
        </span>
        <span className="shrink-0 text-[11.5px] font-medium text-accent-600">
          {t(open ? 'assumptions.collapse' : 'assumptions.expand')}
        </span>
        <span
          aria-hidden="true"
          className={`shrink-0 text-[11px] text-ink-300 transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="border-t border-ink-200">
          <p className="px-3 pt-2.5 text-[11.5px] leading-relaxed text-ink-500">
            {t('assumptions.blurb')}
          </p>
          <ul className="mt-1 divide-y divide-ink-100">
            {ASSUMPTIONS.map((a) => {
              const on = value[a.key] === true;
              return (
                <li key={a.key} className="flex gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={t(`assumption.${a.key}.label`)}
                    onClick={() => toggle(a.key)}
                    className={`mt-0.5 h-4 w-7 shrink-0 rounded-full border transition-colors ${
                      on ? 'border-ink-800 bg-ink-800' : 'border-ink-300 bg-ink-200'
                    }`}
                  >
                    <span
                      className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                        on ? 'translate-x-3.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[13px] font-medium ${
                          on ? 'text-ink-900' : 'text-ink-400 line-through'
                        }`}
                      >
                        {t(`assumption.${a.key}.label`)}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset ${BASIS_BADGE[a.basis]}`}
                      >
                        {term(`assumptionBasis.${a.basis}`)}
                      </span>
                    </div>

                    {on ? (
                      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600">
                        {t(`assumption.${a.key}.caveat`)}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
                        <span className="font-medium">{t('assumptions.turnedOff')}</span>{' '}
                        {t(`assumption.${a.key}.whenOff`)}
                      </p>
                    )}

                    {on && a.basis !== 'official-doc' && (
                      <blockquote className="mt-1.5 border-l-2 border-ink-200 pl-2 text-[11px] leading-relaxed text-ink-500">
                        <Mono className="text-ink-600">{a.evidence}</Mono>
                        {/* The source quote above is the authority and stays in
                            English everywhere. The translation only exists in the
                            Chinese dictionary, so rendering it in an English build
                            would print the key. */}
                        {locale !== DEFAULT_LOCALE && (
                          <p className="mt-1 text-ink-500">
                            <span className="font-medium">{t('assumptions.evidenceLabel')}</span>{' '}
                            {t(`assumption.${a.key}.evidenceZh`)}
                          </p>
                        )}
                      </blockquote>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
