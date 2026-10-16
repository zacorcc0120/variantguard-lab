'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BOOTSTRAP_SCRIPT,
  DICTIONARIES,
  detectLocale,
  term as termOf,
  t as tOf,
  writeStoredLocale,
} from './index';
import {
  DEFAULT_LOCALE,
  HTML_LOCALE_ATTR,
  HTML_READY_ATTR,
  type Dictionary,
  type I18nParams,
  type Locale,
} from './types';

/**
 * SSR has no layout phase, and React warns when useLayoutEffect runs there.
 * Swapping the hook keeps the pre-paint behaviour on the client and the
 * no-warning path on the server.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface I18nValue {
  readonly locale: Locale;
  readonly dict: Dictionary;
  /** Look up a UI string. Unknown keys return the key, never an empty string. */
  readonly t: (key: string, params?: I18nParams) => string;
  /** Look up shared vocabulary (severity, category, basis). */
  readonly term: (key: string) => string;
  readonly setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Server renders English, and `en` is also what an English browser gets, so
  // the hydrated markup matches and React never reports a mismatch.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Pre-paint, not post-paint: the locale has to be applied in the same frame
  // the browser is about to paint, or a Chinese user sees English first and then
  // a reflow when the text swaps.
  useIsomorphicLayoutEffect(() => {
    const next = detectLocale();
    if (next !== DEFAULT_LOCALE) setLocaleState(next);

    const root = document.documentElement;
    root.setAttribute('lang', next);
    root.setAttribute(HTML_LOCALE_ATTR, next);
    // Releasing the boot gate here — not in an effect that runs after paint —
    // is what makes the first visible frame already correct.
    root.removeAttribute('data-vg-pending');
    root.setAttribute(HTML_READY_ATTR, '1');
  }, []);

  // Keep <html lang> honest if anything changes the locale outside React.
  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeStoredLocale(next);
    document.documentElement.setAttribute('lang', next);
    document.documentElement.setAttribute(HTML_LOCALE_ATTR, next);
  }, []);

  const dict = DICTIONARIES[locale];

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dict,
      t: (key, params) => tOf(dict, key, params),
      term: (key) => termOf(dict, key),
      setLocale,
    }),
    [locale, dict, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

/**
 * Two-button switcher rather than a <select>.
 *
 * A select hides the alternative behind a collapsed menu, which is the single
 * biggest reason a language switch goes unnoticed; two labels side by side are
 * visible, and they stay visible on a phone because they are only ~70px wide.
 */
export function LanguageSwitcher() {
  const { locale, t, setLocale } = useI18n();
  return (
    <div
      className="flex items-center gap-0.5 rounded-md p-0.5 ring-1 ring-inset ring-ink-200"
      role="group"
      aria-label={t('lang.label')}
    >
      {(['en', 'zh-CN'] as const).map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            aria-label={t('lang.switchTo', { language: t(code === 'en' ? 'lang.en' : 'lang.zhCN') })}
            className={`rounded px-1.5 py-[3px] text-[11.5px] font-medium transition-colors ${
              active ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800'
            }`}
          >
            {code === 'en' ? 'EN' : '中文'}
          </button>
        );
      })}
    </div>
  );
}

export { BOOTSTRAP_SCRIPT };
