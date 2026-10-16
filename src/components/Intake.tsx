'use client';

import { useCallback, useRef, useState } from 'react';
import { Card, Button, Mono } from './ui';
import { SCENARIOS, type Scenario } from '@/lib/samples';
import { CSV_MIME, ZIP_MIME, scenarioArchive, scenarioFile } from '@/lib/scenarioFiles';
import { downloadBytes } from '@/lib/report/export';
import { useI18n } from '@/i18n/provider';

export interface LoadedFile {
  readonly name: string;
  readonly text: string;
  readonly bytes: number;
}

/** Tool acceptance cap. Shopify's documented product CSV limit is 15 MB. */
export const MAX_CSV_BYTES = 60 * 1024 * 1024;

export function isCsvFile(file: File): boolean {
  return /\.csv$/i.test(file.name) || file.type.toLowerCase().includes('csv');
}

interface DropZoneProps {
  slot: 'baseline' | 'proposed';
  file: LoadedFile | undefined;
  onFile: (file: File) => void;
  onClear: () => void;
  rows: number | undefined;
  products: number | undefined;
  error: string | undefined;
}

const SLOT_ACCENT = {
  baseline: 'text-ink-600',
  proposed: 'text-accent-600',
} as const;

function DropZone({ slot, file, onFile, onClear, rows, products, error }: DropZoneProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const title = t(`slot.${slot}.title`);
  const accent = SLOT_ACCENT[slot];

  const accept = useCallback(
    (f: File | undefined) => {
      if (!f) return;
      onFile(f);
    },
    [onFile],
  );

  return (
    <Card className={`flex flex-col overflow-hidden transition-colors ${over ? 'border-accent-400 bg-accent-400/5' : ''}`}>
      <div className="flex items-center justify-between border-b border-ink-200 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <Mono className={`font-semibold ${accent}`}>{title}</Mono>
          <span className="text-[11px] text-ink-400">{t(`slot.${slot}.hint`)}</span>
        </div>
        {file && (
          <Button variant="ghost" onClick={onClear}>
            {t('slot.clear')}
          </Button>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className="flex flex-1 flex-col items-center justify-center gap-1.5 px-4 py-7 text-center"
      >
        {file ? (
          <>
            <Mono className="font-semibold text-ink-900">{file.name}</Mono>
            <span className="text-[12px] text-ink-500">
              {t('slot.loaded', {
                kb: (file.bytes / 1024).toFixed(1),
                rows: rows ?? '—',
                products: products ?? '—',
              })}
            </span>
            <span className="text-[11px] text-ink-400">{t('slot.replace')}</span>
          </>
        ) : (
          <>
            <span className="text-[13px] font-medium text-ink-700">{t('slot.dropHere')}</span>
            <span className="text-[11px] text-ink-400">{t('slot.formats')}</span>
          </>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        aria-label={t('slot.choose', { title })}
        /*
         * Visually hidden but NOT `display:none`, and not `hidden`: a
         * display-none input is unreachable for keyboard and screen-reader
         * users, which would make the drop zone unusable without a mouse.
         * `sr-only` keeps it focusable and announced.
         */
        className="sr-only"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {error && <div className="border-t border-ink-200 px-3 py-2 text-[12px] text-sev-high-fg">{error}</div>}
    </Card>
  );
}

/**
 * One small download action inside a scenario card.
 *
 * Sits beside the load button rather than inside it: nesting a <button> in a
 * <button> is invalid HTML, and browsers resolve the resulting event target
 * inconsistently, which is a reliable way to make a file download fire twice
 * or not at all.
 */
function ScenarioDownload({
  label,
  ariaLabel,
  accent,
  onDownload,
}: {
  label: string;
  ariaLabel: string;
  accent?: string;
  onDownload: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDownload}
      aria-label={ariaLabel}
      className={`rounded px-1.5 py-[3px] font-mono text-[11px] transition-colors hover:bg-ink-100 ${accent ?? 'text-ink-500'}`}
    >
      ↓&nbsp;{label}
    </button>
  );
}

function ScenarioCard({ scenario, onLoad }: { scenario: Scenario; onLoad: (s: Scenario) => void }) {
  const { t } = useI18n();
  const download = (slot: 'baseline' | 'proposed') => {
    const file = scenarioFile(scenario, slot);
    downloadBytes(file.filename, CSV_MIME, file.bytes);
  };
  const downloadBoth = () => {
    const archive = scenarioArchive(scenario);
    downloadBytes(archive.filename, ZIP_MIME, archive.bytes);
  };
  const title = t(`scenario.${scenario.id}.title`);

  return (
    <div className="group flex flex-col bg-white transition-colors hover:bg-ink-50">
      {/* The accessible name has to match the visible name (WCAG 2.5.3), so it
          reads the translated title rather than the scenario's own English. */}
      <button
        type="button"
        onClick={() => onLoad(scenario)}
        aria-label={t('scenarios.load', { title: t(`scenario.${scenario.id}.title`) })}
        className="flex-1 px-3 pb-1 pt-2.5 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-medium text-ink-900 group-hover:text-accent-600">
            {t(`scenario.${scenario.id}.title`)}
          </span>
          <span className="shrink-0 text-[11px] text-ink-300 group-hover:text-ink-400">→</span>
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
          {t(`scenario.${scenario.id}.blurb`)}
        </p>
      </button>
      <div className="flex flex-wrap items-center gap-0.5 px-2 pb-2 pt-0.5">
        <ScenarioDownload
          label={t('scenarios.downloadBaselineLabel')}
          ariaLabel={t('scenarios.downloadBaseline', { title })}
          onDownload={() => download('baseline')}
        />
        <ScenarioDownload
          label={t('scenarios.downloadProposedLabel')}
          accent="text-ink-500"
          ariaLabel={t('scenarios.downloadProposed', { title })}
          onDownload={() => download('proposed')}
        />
        <ScenarioDownload
          label={t('scenarios.downloadBothLabel')}
          accent="text-accent-600"
          ariaLabel={t('scenarios.downloadBoth', { title })}
          onDownload={downloadBoth}
        />
      </div>
    </div>
  );
}

export function Intake({
  baseline,
  proposed,
  onBaseline,
  onProposed,
  onClear,
  onLoadScenario,
  baselineStats,
  proposedStats,
  baselineError,
  proposedError,
}: {
  baseline: LoadedFile | undefined;
  proposed: LoadedFile | undefined;
  onBaseline: (f: File) => void;
  onProposed: (f: File) => void;
  baselineError?: string;
  proposedError?: string;
  onClear: () => void;
  onLoadScenario: (s: Scenario) => void;
  baselineStats: { rows?: number; products?: number };
  proposedStats: { rows?: number; products?: number };
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <DropZone
          slot="baseline"
          file={baseline}
          onFile={onBaseline}
          onClear={onClear}
          rows={baselineStats.rows}
          products={baselineStats.products}
          error={baselineError}
        />
        <DropZone
          slot="proposed"
          file={proposed}
          onFile={onProposed}
          onClear={onClear}
          rows={proposedStats.rows}
          products={proposedStats.products}
          error={proposedError}
        />
      </div>

      <Card>
        <div className="border-b border-ink-200 px-3 py-2">
          <span className="text-[13px] font-semibold text-ink-800">{t('scenarios.heading')}</span>
          <p className="mt-0.5 text-[11.5px] text-ink-500">{t('scenarios.blurb')}</p>
        </div>
        <div className="grid gap-px bg-ink-200 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s) => (
            <ScenarioCard key={s.id} scenario={s} onLoad={onLoadScenario} />
          ))}
        </div>
      </Card>
    </div>
  );
}
