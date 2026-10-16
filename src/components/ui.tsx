'use client';

import type { ReactNode } from 'react';
import { type Basis, type Severity } from '@/lib/analysis/types';
import { useI18n } from '@/i18n/provider';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-ink-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">
      {children}
    </div>
  );
}

const SEV_STYLE: Record<Severity, string> = {
  high: 'bg-sev-high-bg text-sev-high-fg ring-1 ring-inset ring-sev-high-br',
  medium: 'bg-sev-med-bg text-sev-med-fg ring-1 ring-inset ring-sev-med-br',
  low: 'bg-sev-low-bg text-sev-low-fg ring-1 ring-inset ring-sev-low-br',
};

const SEV_BAR: Record<Severity, string> = {
  high: 'bg-sev-high-solid',
  medium: 'bg-sev-med-solid',
  low: 'bg-ink-300',
};

export function SeverityPill({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${SEV_STYLE[severity]}`}
    >
      {severity}
    </span>
  );
}

export function severityBar(severity: Severity): string {
  return SEV_BAR[severity];
}

const BASIS_STYLE: Record<Basis, string> = {
  documented: 'text-emerald-700 bg-emerald-50 ring-emerald-200',
  inference: 'text-amber-700 bg-amber-50 ring-amber-200',
  heuristic: 'text-ink-500 bg-ink-50 ring-ink-200',
};

export function BasisTag({ basis }: { basis: Basis }) {
  const { term } = useI18n();
  return (
    <span
      title={term(`basis.${basis}`)}
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${BASIS_STYLE[basis]}`}
    >
      {term(`basisShort.${basis}`)}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  title?: string;
}) {
  const styles = {
    primary:
      'bg-ink-900 text-white hover:bg-ink-800 border border-transparent disabled:bg-ink-300',
    secondary:
      'bg-white text-ink-700 hover:bg-ink-50 border border-ink-200 disabled:text-ink-300',
    ghost: 'bg-transparent text-ink-500 hover:text-ink-800 hover:bg-ink-100 border border-transparent',
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed ${styles}`}
    >
      {children}
    </button>
  );
}

export function Mono({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[12px] ${className}`}>{children}</span>;
}
