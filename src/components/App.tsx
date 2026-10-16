'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Intake, isCsvFile, MAX_CSV_BYTES, type LoadedFile } from './Intake';
import { AssumptionPanel } from './AssumptionPanel';
import { Report } from './Report';
import { Button, Mono } from './ui';
import { parseCsv, parseCsvFile, type ParsedCsv } from '@/lib/csv/parseCsv';
import { buildCatalog } from '@/lib/shopify/model';
import { analyse, type AnalysisResult } from '@/lib/analysis/engine';
import { DEFAULT_ASSUMPTIONS, type AssumptionSet } from '@/lib/analysis/assumptions';
import type { Scenario } from '@/lib/samples';
import { LanguageSwitcher, useI18n } from '@/i18n/provider';

interface Side {
  file: LoadedFile;
  parsed: ParsedCsv;
}

export default function App() {
  const { t } = useI18n();
  const [baseline, setBaseline] = useState<Side | undefined>();
  const [proposed, setProposed] = useState<Side | undefined>();
  const [assumptions, setAssumptions] = useState<AssumptionSet>(DEFAULT_ASSUMPTIONS);
  const [scenario, setScenario] = useState<Scenario | undefined>();
  const [dragging, setDragging] = useState(false);
  const [slotError, setSlotError] = useState<Partial<Record<'baseline' | 'proposed', string>>>({});
  // Bumped on every new read and on clear, so a slower earlier read cannot
  // land after a replacement or after the user has emptied the slots.
  const ticket = useRef({ baseline: 0, proposed: 0 });

  const loadText = useCallback((name: string, text: string, bytes: number): Side => {
    const parsed = parseCsv(text, { label: name });
    return { file: { name, text, bytes }, parsed };
  }, []);

  const loadFile = useCallback(
    async (f: File, which: 'baseline' | 'proposed') => {
      const id = ++ticket.current[which];
      const reject = (message: string) => {
        if (ticket.current[which] !== id) return;
        setSlotError((prev) => ({ ...prev, [which]: message }));
      };
      if (!isCsvFile(f)) {
        reject(t('slot.unsupported'));
        return;
      }
      if (f.size > MAX_CSV_BYTES) {
        reject(t('slot.tooLarge'));
        return;
      }
      setSlotError((prev) => ({ ...prev, [which]: undefined }));
      try {
        const parsed = await parseCsvFile(f, f.name);
        if (ticket.current[which] !== id) return;
        setSlotError((prev) => ({ ...prev, [which]: undefined }));
        const side: Side = {
          file: { name: f.name, text: '', bytes: f.size },
          parsed,
        };
        if (which === 'baseline') setBaseline(side);
        else setProposed(side);
        setScenario(undefined);
      } catch {
        reject(t('slot.unreadable'));
      }
    },
    [t],
  );

  const result: AnalysisResult | undefined = useMemo(() => {
    if (!baseline || !proposed) return undefined;
    return analyse({
      baseline: baseline.parsed,
      proposed: proposed.parsed,
      baselineFormat: baseline.parsed.findings,
      proposedFormat: proposed.parsed.findings,
      assumptions,
    });
  }, [baseline, proposed, assumptions]);

  const stats = useCallback(
    (side: Side | undefined) => {
      if (!side) return {};
      const cat = buildCatalog(side.parsed);
      return { rows: side.parsed.rows.length, products: cat.products.size };
    },
    [],
  );

  const loadScenario = (s: Scenario) => {
    ticket.current.baseline += 1;
    ticket.current.proposed += 1;
    setSlotError({});
    setScenario(s);
    setBaseline(loadText('baseline.csv', s.baselineCsv, s.baselineCsv.length));
    setProposed(loadText('proposed.csv', s.proposedCsv, s.proposedCsv.length));
  };

  const ready = !!(baseline && proposed);
  const teach = scenario ? t(`scenario.${scenario.id}.teaches`) : undefined;

  return (
    <div
      className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = [...(e.dataTransfer.files ?? [])];
        if (files.length === 0) return;
        const csvs = files.filter(isCsvFile);
        if (csvs.length === 0) {
          ticket.current.baseline += 1;
          setSlotError({ baseline: t('slot.unsupported') });
          return;
        }
        void loadFile(csvs[0], 'baseline');
        if (csvs[1]) void loadFile(csvs[1], 'proposed');
      }}
    >
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[17px] font-semibold tracking-tight text-ink-900">
            VariantGuard Lab
          </h1>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
            {t('app.badge.localOnly')}
          </span>
          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-500 ring-1 ring-inset ring-ink-200">
            {t('app.badge.noShopify')}
          </span>
          <span className="ml-auto">
            <LanguageSwitcher />
          </span>
        </div>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-ink-600">{t('app.hero')}</p>
      </header>

      <div className="space-y-3">
        <Intake
          baseline={baseline?.file}
          proposed={proposed?.file}
          baselineStats={stats(baseline)}
          proposedStats={stats(proposed)}
          baselineError={slotError.baseline}
          proposedError={slotError.proposed}
          onBaseline={(f) => void loadFile(f, 'baseline')}
          onProposed={(f) => void loadFile(f, 'proposed')}
          onClear={() => {
            ticket.current.baseline += 1;
            ticket.current.proposed += 1;
            setBaseline(undefined);
            setProposed(undefined);
            setScenario(undefined);
            setSlotError({});
          }}
          onLoadScenario={loadScenario}
        />

        {ready && result && (
          <>
            <AssumptionPanel
              value={assumptions}
              onChange={setAssumptions}
              sensitiveCount={result.summary.assumptionSensitive}
            />

            {teach && (
              <div className="rounded-lg border border-accent-400/60 bg-accent-400/5 px-3 py-2.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-accent-600">
                  {t('report.teachesLabel')}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-700">{teach}</p>
              </div>
            )}

            <Report
              result={result}
              fileNames={{
                baseline: baseline!.file.name,
                proposed: proposed!.file.name,
              }}
            />
          </>
        )}

        {!ready && (
          <p className="py-6 text-center text-[12.5px] text-ink-400">
            {t('app.empty')}
          </p>
        )}
      </div>

      <footer className="mt-6 border-t border-ink-200 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="max-w-3xl text-[11.5px] leading-relaxed text-ink-500">
            {t('app.footer.disclaimer')}
          </p>
          <Mono className="text-ink-400">{t('app.footer.version')}</Mono>
        </div>
      </footer>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-ink-950/20">
          <div className="rounded-lg bg-white px-4 py-3 text-[13px] font-medium text-ink-900 shadow-lg ring-1 ring-ink-200">
            {t('app.a11y.dropHint')}
          </div>
        </div>
      )}

      {/* keep the primary action discoverable for keyboard users at the top */}
      {ready && (
        <div className="sr-only" aria-live="polite">
          {t('app.a11y.summary', {
            count: result!.risks.length,
            high: result!.summary.severityCounts.high,
          })}
        </div>
      )}
    </div>
  );
}

export { Button };
