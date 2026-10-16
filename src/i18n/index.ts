import { renderShort } from '@/lib/csv/cell';
import type { Risk } from '@/lib/analysis/types';
import {
  DEFAULT_LOCALE,
  HTML_LOCALE_ATTR,
  LOCALES,
  STORAGE_KEY,
  type Dictionary,
  type I18nParams,
  type Locale,
} from './types';
import { en } from './en';
import { zhCN } from './zh-CN';

export const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = {
  en,
  'zh-CN': zhCN,
};

/**
 * Substitutes `{name}` placeholders.
 *
 * Unknown placeholders are left in place rather than blanked: an empty string
 * where a handle should be would read as "the handle is empty", which is a
 * different — and wrong — claim. A visible `{name}` is a bug report; a silent
 * empty is a false statement about someone's store.
 */
export function interpolate(template: string, params: I18nParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const v = params[name];
    return v === undefined ? match : String(v);
  });
}

/** Picks the right locale for an arbitrary browser language list. */
export function localeFromLanguages(languages: readonly string[]): Locale {
  for (const raw of languages) {
    const tag = raw.toLowerCase();
    // Any Chinese tag counts: zh, zh-CN, zh-Hans, zh-Hant-SG …
    if (tag === 'zh' || tag.startsWith('zh-') || tag.startsWith('zh_')) return 'zh-CN';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Reads the persisted manual choice. Never throws: private mode can reject writes. */
export function readStoredLocale(): Locale | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage unavailable — the choice still applies for this session */
  }
}

/**
 * Resolves the locale to start from, in priority order:
 * manual choice > browser languages > default.
 */
export function detectLocale(): Locale {
  return readStoredLocale() ?? localeFromLanguages(navigator.languages ?? [navigator.language]);
}

/** Prefers the operating system's list; unknown tags fall back to the default. */
export function preferredLocale(): Locale {
  try {
    return localeFromLanguages(navigator.languages ?? [navigator.language]);
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Inline script run before first paint. Sets `lang` and the locale attribute so
 * the correct font stack and the boot gate are in place for the very first
 * frame, instead of the page appearing in English and then swapping.
 */
export const BOOTSTRAP_SCRIPT = `(function(){try{
var L=${JSON.stringify(LOCALES)},K=${JSON.stringify(STORAGE_KEY)},D=${JSON.stringify(DEFAULT_LOCALE)},A=${JSON.stringify(HTML_LOCALE_ATTR)};
var s=null;try{s=window.localStorage.getItem(K)}catch(e){}
var t=(s&&L.indexOf(s)>-1)?s:null;
if(!t){var n=navigator.languages||[navigator.language];for(var i=0;i<n.length;i++){var x=String(n[i]).toLowerCase();if(x==='zh'||x.indexOf('zh-')===0){t='zh-CN';break}if(x.indexOf('en')===0){t='en';break}}}
var d=document.documentElement;d.setAttribute('lang',t||D);d.setAttribute(A,t||D);
if((t||D)!==D){d.setAttribute('data-vg-pending','1')}
}catch(e){}})();`;

/**
 * Resolves one finding field in the active locale.
 *
 * Fallback chain: explicit finding key -> rule-level key -> the English text
 * the engine produced. Falling back to the engine's own English (rather than to
 * an empty string) means a missing translation degrades to "shown in English"
 * instead of "blank", which is the only honest failure mode here.
 */
/**
 * `finding.*` slots first, then `parse.*` for file-level findings whose keys
 * are shared with the dictionary's parse section.
 */
function lookupTemplate(key: string, dict: Dictionary): string | undefined {
  const fromFinding = dict.finding[key];
  if (fromFinding !== undefined) return fromFinding;
  if (!key.startsWith('parse.')) return undefined;
  const code = key.slice('parse.'.length);
  const field = (code.endsWith('.title') ? 'title' : code.endsWith('.message') ? 'message' : 'detail') as
    | 'title'
    | 'message'
    | 'detail';
  const base = code.replace(/\.(title|message|detail)$/, '');
  return (dict.parse[base] as unknown as Record<string, string> | undefined)?.[field];
}

export function findingText(
  risk: Risk,
  field: 'title' | 'detail' | 'rationale' | 'suggestion',
  dict: Dictionary,
  locale: Locale,
): string {
  // English returns the engine's own string, always.
  //
  // The English dictionary mirrors the sources using `${expr}` syntax, not the
  // `{name}` syntax the other locales use, so running it through interpolate()
  // would be wrong at best. More importantly this makes "English output is
  // byte-identical to the pre-i18n build" a structural guarantee rather than
  // something the test suite has to keep re-proving as rules are edited.
  if (locale === DEFAULT_LOCALE) return risk[field];
  const template = lookupTemplate(risk.i18n?.[field] ?? '', dict);
  if (template === undefined) return risk[field];
  return interpolateWithNotes(template, riskParams(risk), risk.i18n?.notes, dict, locale);
}

/**
 * Interpolation plus the `note:<token>` pass.
 *
 * `{note:x}` resolves to the rule's own English fragment for English, and to the
 * dictionary's `finding.note.<token>` for other languages. An unknown token is
 * left visible rather than dropped, matching `interpolate`: silently removing a
 * clause would turn a qualified statement into a stronger one.
 *
 * The note pass runs BEFORE `{name}` substitution, because a localised note is
 * itself allowed to contain placeholders (`（SKU {sku}）`).
 */
function interpolateWithNotes(
  template: string,
  params: I18nParams,
  notes: Readonly<Record<string, string>> | undefined,
  dict: Dictionary,
  locale: Locale,
): string {
  const withNotes = template.replace(/\{note:(\w+)\}/g, (match, token: string) => {
    const localized = locale === DEFAULT_LOCALE ? undefined : dict.finding[`finding.note.${token}`];
    return localized ?? notes?.[token] ?? match;
  });
  return interpolate(withNotes, params);
}

/**
 * Values available to a translated template.
 *
 * Derived from the Risk's own structured fields plus its `meta` bag, with the
 * rule's explicit `i18n.params` taking precedence. Deriving rather than
 * threading a bag through every `ctx.add()` keeps the detection code unchanged
 * wherever the value it needs is already structured.
 */
export function riskParams(risk: Risk): I18nParams {
  const base: Record<string, string | number> = {
    handle: risk.handle ?? '',
    variant: risk.variantLabel ?? '',
    field: risk.fieldHeader ?? '',
    baselineLine: risk.baseline?.location?.line ?? '',
    proposedLine: risk.proposed?.location?.line ?? '',
    baselineValue: risk.baseline ? renderShort(risk.baseline.cell) : '',
    proposedValue: risk.proposed ? renderShort(risk.proposed.cell) : '',
  };
  for (const [k, v] of Object.entries(risk.meta)) {
    base[k] = typeof v === 'boolean' ? String(v) : v;
  }
  return { ...base, ...risk.i18n?.params };
}

/** Whole-finding projection in one call, for report rows and exports. */
export function translateRisk(
  risk: Risk,
  dict: Dictionary,
  locale: Locale,
): Pick<Risk, 'id' | 'ruleId' | 'severity' | 'category' | 'basis'> & {
  title: string;
  detail: string;
  rationale: string;
  suggestion: string;
} {
  return {
    id: risk.id,
    ruleId: risk.ruleId,
    severity: risk.severity,
    category: risk.category,
    basis: risk.basis,
    title: findingText(risk, 'title', dict, locale),
    detail: findingText(risk, 'detail', dict, locale),
    rationale: findingText(risk, 'rationale', dict, locale),
    suggestion: findingText(risk, 'suggestion', dict, locale),
  };
}

/**
 * Resolves a dotted key against the right dictionary section.
 *
 * Call sites read naturally as `t('scenario.missing-variant.title')` and
 * `t('assumption.absentVariantIsDeleted.label')`; routing on the prefix here
 * keeps every caller from having to know which section a string lives in, and
 * keeps a missing section from silently rendering as a raw key.
 *
 * Sections are matched most-specific-first, because `finding.` and `parse.`
 * are themselves keys rather than section names.
 */
export function lookup(dict: Dictionary, key: string): string | undefined {
  const scenario = /^scenario\.([^.]+)\.([^.]+)$/.exec(key);
  if (scenario) return dict.scenario[scenario[1]]?.[scenario[2] as 'title'];

  const assumption = /^assumption\.([^.]+)\.([^.]+)$/.exec(key);
  if (assumption) return dict.assumption[assumption[1]]?.[assumption[2] as 'label'];

  const rule = /^rule\.([^.]+)\.([^.]+)$/.exec(key);
  if (rule) return dict.rule[rule[1]]?.[rule[2] as 'title'];

  if (key.startsWith('finding.') || key.startsWith('parse.')) return lookupTemplate(key, dict);

  return dict.ui[key];
}

export function t(dict: Dictionary, key: string, params?: I18nParams): string {
  const template = lookup(dict, key) ?? lookup(en, key);
  if (template === undefined) return key;
  return interpolate(template, params);
}

export function term(dict: Dictionary, key: string): string {
  return dict.term[key] ?? en.term[key] ?? key;
}

export { DEFAULT_LOCALE, HTML_LOCALE_ATTR, LOCALES, STORAGE_KEY };
export type { Dictionary, I18nParams, Locale };
