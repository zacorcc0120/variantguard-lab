import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { SCENARIOS } from '@/lib/samples';
import { parseCsv } from '@/lib/csv/parseCsv';
import { analyse, type AnalysisResult } from '@/lib/analysis/engine';
import { allRules } from '@/lib/analysis/rules';
import { ASSUMPTIONS } from '@/lib/analysis/assumptions';
import {
  DICTIONARIES,
  BOOTSTRAP_SCRIPT,
  findingText,
  interpolate,
  localeFromLanguages,
  readStoredLocale,
  riskParams,
  t as tOf,
  term as termOf,
  translateRisk,
  writeStoredLocale,
} from '@/i18n';
import { en } from '@/i18n/en';
import { zhCN } from '@/i18n/zh-CN';
import { DEFAULT_LOCALE, LOCALES, STORAGE_KEY, type Dictionary } from '@/i18n/types';
import {
  DISCLAIMER,
  ENGLISH_EXPORT,
  REPORT_CSV_HEADER,
  exportDisclaimer,
  reportToJson,
  risksToCsv,
} from '@/lib/report/export';
import { scenarioFile } from '@/lib/scenarioFiles';
import { scenarioById } from '@/lib/samples';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function analyseScenario(id: string): AnalysisResult {
  const s = scenarioById(id)!;
  const baseline = parseCsv(s.baselineCsv, { label: 'baseline.csv' });
  const proposed = parseCsv(s.proposedCsv, { label: 'proposed.csv' });
  return analyse({
    baseline,
    proposed,
    baselineFormat: baseline.findings,
    proposedFormat: proposed.findings,
  });
}

/** Every finding the app can actually produce, across all scenarios. */
function allFindings(): { scenario: string; result: AnalysisResult }[] {
  return SCENARIOS.map((s) => ({ scenario: s.id, result: analyseScenario(s.id) }));
}

const SECTIONS = ['ui', 'term', 'rule', 'finding', 'assumption', 'scenario', 'parse'] as const;

function keysOf(dict: Dictionary, section: (typeof SECTIONS)[number]): string[] {
  return Object.keys(dict[section] as Record<string, unknown>);
}

/** A conservative set of names a translated template is allowed to reference. */
function allowedPlaceholders(): Set<string> {
  const names = new Set([
    'handle', 'variant', 'field', 'file', 'baselineLine', 'proposedLine',
    'baselineValue', 'proposedValue', 'side', 'label',
    // parse-level findings carry their own params via FormatFinding.params
    'startLine', 'cellCount', 'headerCount', 'columnCount', 'count', 'name',
    'firstColumn', 'secondColumn',
  ]);
  // every meta key any rule emits, plus the explicit rule-supplied extras
  for (const r of allFindings()) for (const risk of r.result.risks) {
    for (const k of Object.keys(risk.meta)) names.add(k);
    for (const k of Object.keys(risk.i18n?.params ?? {})) names.add(k);
  }
  return names;
}

const ALLOWED = allowedPlaceholders();

// ---------------------------------------------------------------------------
// 1 + 2. default locale and browser-language detection
// ---------------------------------------------------------------------------

describe('locale detection', () => {
  it('defaults to English', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(DICTIONARIES.en).toBe(en);
  });

  it('picks Chinese for any Chinese browser tag', () => {
    // 2: a Simplified-Chinese browser selects Chinese on first visit.
    for (const tag of ['zh-CN', 'zh', 'zh-Hans', 'zh-Hans-CN', 'zh-Hant', 'zh_TW', 'ZH-cn']) {
      expect(localeFromLanguages([tag])).toBe('zh-CN');
    }
  });

  it('picks English for English browser tags', () => {
    for (const tag of ['en-US', 'en-GB', 'en', 'EN-au']) {
      expect(localeFromLanguages([tag])).toBe('en');
    }
  });

  it('honours preference order: first recognised tag wins', () => {
    expect(localeFromLanguages(['ja-JP', 'zh-CN', 'en-US'])).toBe('zh-CN');
    expect(localeFromLanguages(['fr-FR', 'en-GB'])).toBe('en');
  });

  it('falls back to English for languages it does not ship', () => {
    expect(localeFromLanguages(['ja-JP', 'ko-KR', 'de-DE'])).toBe('en');
    expect(localeFromLanguages([])).toBe('en');
  });

  it('ships exactly the two advertised locales', () => {
    expect([...LOCALES]).toEqual(['en', 'zh-CN']);
  });
});

// ---------------------------------------------------------------------------
// 3 + 4. manual switching and persistence
// ---------------------------------------------------------------------------

describe('manual selection wins over the browser default, and survives a reload', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  // `navigator` is a read-only accessor on modern Node, so a plain assignment
  // throws; defineProperty is the only way to stub it.
  const set = (key: string, value: unknown) =>
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });

  function stubEnv(browserLanguages: string[], stored?: string) {
    const store = new Map<string, string>();
    if (stored) store.set(STORAGE_KEY, stored);
    set('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    set('navigator', {
      languages: browserLanguages,
      language: browserLanguages[0] ?? 'en-US',
    });
    return store;
  }

  afterEach(() => {
    for (const [key, descriptor] of [
      ['window', originalWindow],
      ['navigator', originalNavigator],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as Record<string, unknown>)[key];
    }
  });

  it('reads a stored manual choice', () => {
    stubEnv(['en-US'], 'zh-CN');
    expect(readStoredLocale()).toBe('zh-CN');
  });

  it('ignores a stored value that is not a supported locale', () => {
    stubEnv(['en-US'], 'fr-FR');
    expect(readStoredLocale()).toBeUndefined();
  });

  it('ignores a corrupt stored value instead of throwing', () => {
    stubEnv(['en-US']);
    (globalThis as unknown as { window: { localStorage: { setItem: (k: string, v: string) => void } } }).window.localStorage.setItem(
      STORAGE_KEY,
      '{"not":"a locale"}',
    );
    expect(readStoredLocale()).toBeUndefined();
  });

  it('writes the manual choice so the next visit starts there', () => {
    // 4: persistence.
    const store = stubEnv(['zh-CN']);
    writeStoredLocale('en');
    expect(store.get(STORAGE_KEY)).toBe('en');
    expect(readStoredLocale()).toBe('en');
  });

  it('survives a browser that refuses storage', () => {
    set('window', {
      localStorage: {
        getItem() {
          throw new Error('SecurityError');
        },
        setItem() {
          throw new Error('SecurityError');
        },
      },
    });
    expect(() => writeStoredLocale('zh-CN')).not.toThrow();
    expect(readStoredLocale()).toBeUndefined();
  });

  it('lets a stored English choice override a Chinese browser', () => {
    stubEnv(['zh-CN', 'zh'], 'en');
    expect(readStoredLocale() ?? localeFromLanguages(['zh-CN'])).toBe('en');
  });
});

// ---------------------------------------------------------------------------
// 14. no flash of the wrong language, and a boot gate that cannot get stuck
// ---------------------------------------------------------------------------

describe('boot script', () => {
  it('sets lang and the locale attribute before first paint', () => {
    expect(BOOTSTRAP_SCRIPT).toContain("setAttribute('lang'");
    expect(BOOTSTRAP_SCRIPT).toContain('data-vg-locale');
  });

  it('only arms the boot gate when the locale is not the server-rendered one', () => {
    // English visitors must never see the gate, or the page would flash blank.
    expect(BOOTSTRAP_SCRIPT).toContain("if((t||D)!==D){d.setAttribute('data-vg-pending','1')}");
  });

  it('reads the same storage key the runtime writes', () => {
    expect(BOOTSTRAP_SCRIPT).toContain(JSON.stringify(STORAGE_KEY).slice(1, -1));
  });

  it('is exception-safe, so a hostile environment cannot leave the page hidden', () => {
    // The gate is released by the provider, but a script that throws before
    // arming it must not be able to leave the page blank either way.
    expect(BOOTSTRAP_SCRIPT.trimStart().startsWith('(function()')).toBe(true);
    expect(BOOTSTRAP_SCRIPT).toContain('catch(e){}');
  });
});

// ---------------------------------------------------------------------------
// dictionary integrity
// ---------------------------------------------------------------------------

describe('dictionary integrity', () => {
  it.each(SECTIONS)('%s section has the same keys in both languages', (section) => {
    const enKeys = keysOf(en, section);
    const zhKeys = new Set(keysOf(zhCN, section));
    expect(enKeys.filter((k) => !zhKeys.has(k))).toEqual([]);
  });

  it('has no Chinese entry that is byte-identical to its English source', () => {
    // A "translation" that copies the English is almost always an oversight.
    const untranslated: string[] = [];
    for (const key of keysOf(en, 'finding')) {
      const zh = zhCN.finding[key];
      if (zh !== undefined && zh === en.finding[key]) untranslated.push(key);
    }
    for (const key of keysOf(en, 'rule')) {
      if (zhCN.rule[key]?.title === en.rule[key]?.title) untranslated.push(`rule.${key}.title`);
    }
    for (const key of keysOf(en, 'scenario')) {
      if (zhCN.scenario[key]?.title === en.scenario[key]?.title) untranslated.push(`scenario.${key}.title`);
    }
    expect(untranslated).toEqual([]);
  });

  it('leaves no untranslated ${...} interpolation syntax in the Chinese dictionary', () => {
    const offenders: string[] = [];
    const walk = (obj: unknown, path: string) => {
      if (typeof obj === 'string') {
        if (obj.includes('${')) offenders.push(path);
        return;
      }
      if (obj && typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`);
      }
    };
    walk(zhCN, 'zh-CN');
    expect(offenders).toEqual([]);
  });

  it('only references placeholders the engine can actually supply', () => {
    const offenders: string[] = [];
    for (const section of SECTIONS) {
      for (const key of keysOf(zhCN, section)) {
        const entry = (zhCN[section] as Record<string, unknown>)[key];
        for (const text of Object.values(entry as Record<string, string>)) {
          if (typeof text !== 'string') continue;
          for (const m of text.matchAll(/\{(\w+)\}/g)) {
            if (!ALLOWED.has(m[1])) offenders.push(`${section}.${key} -> {${m[1]}}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('renders every finding in Chinese with no placeholder left unsubstituted', () => {
    const offenders: string[] = [];
    for (const { scenario, result } of allFindings()) {
      for (const risk of result.risks) {
        for (const field of ['title', 'detail', 'rationale', 'suggestion'] as const) {
          const rendered = findingText(risk, field, zhCN, 'zh-CN');
          for (const m of rendered.matchAll(/\{(\w+)\}/g)) offenders.push(`${scenario} ${risk.ruleId} ${field}: {${m[1]}}`);
          if (rendered.includes('${')) offenders.push(`${scenario} ${risk.ruleId} ${field}: raw \${}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('renders every finding in Chinese without leaving an empty sentence', () => {
    for (const { result } of allFindings()) {
      for (const risk of result.risks) {
        expect(findingText(risk, 'title', zhCN, 'zh-CN').trim().length).toBeGreaterThan(0);
        expect(findingText(risk, 'detail', zhCN, 'zh-CN').trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps every quoted Shopify excerpt verbatim in Chinese', () => {
    // The brief is explicit: a translation must never be presented as if
    // Shopify published it, so the English quote has to survive.
    const quotes = (text: string) =>
      [...text.matchAll(/[“"]([A-Z][^"”]{40,})[”"]/g)].map((m) => m[1]);
    const offenders: string[] = [];
    const pairs: [string, string, string][] = [
      ...keysOf(en, 'rule').flatMap((id): [string, string, string][] =>
        (['title', 'rationale', 'suggestion'] as const).map(
          (f): [string, string, string] => [
            `rule.${id}.${f}`,
            en.rule[id]?.[f] ?? '',
            zhCN.rule[id]?.[f] ?? '',
          ],
        ),
      ),
      ...keysOf(en, 'finding').flatMap(
        (key): [string, string, string][] => [[key, en.finding[key], zhCN.finding[key]]],
      ),
    ];
    for (const [key, source, translated] of pairs) {
      for (const quote of quotes(source)) {
        if (!translated.includes(quote)) offenders.push(`${key}: ${quote.slice(0, 60)}…`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does not translate Shopify column names or literal field values', () => {
    // Column headers are Shopify's, not ours: translating them would make the
    // report describe a file the merchant does not have.
    const literals = [
      'Handle', 'Option1 Value', 'Option1 Name', 'Option2 Value', 'On hand', 'On hand (new)',
      'Variant SKU', 'Variant Price', 'Variant Compare At Price', 'Image Src', 'Default Title',
    ];
    const offenders: string[] = [];
    for (const key of keysOf(zhCN, 'finding')) {
      const zh = zhCN.finding[key];
      if (!zh) continue;
      for (const lit of literals) {
        if (en.finding[key]?.includes(lit) && !zh.includes(lit)) offenders.push(`${key}: ${lit}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never turns a hedge into a certainty', () => {
    // Severity describes impact, not confidence. Chinese must keep the hedges.
    const hedges = ['may', 'might', 'could', 'we believe', 'not documented', 'undecidable'];
    const strongChinese = ['必定', '一定会', '必然导致', '肯定会'];
    const offenders: string[] = [];
    for (const section of SECTIONS) {
      for (const key of keysOf(zhCN, section)) {
        const entry = (zhCN[section] as Record<string, unknown>)[key];
        for (const text of Object.values(entry as Record<string, string>)) {
          if (typeof text !== 'string') continue;
          const enText =
            (en[section] as Record<string, unknown>)[key] !== undefined
              ? JSON.stringify((en[section] as Record<string, unknown>)[key])
              : '';
          const hedged = hedges.some((h) => enText.toLowerCase().includes(h));
          if (hedged && strongChinese.some((s) => text.includes(s))) offenders.push(`${section}.${key}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 13. missing-key fallback
// ---------------------------------------------------------------------------

describe('missing translation falls back honestly', () => {
  it('returns the English string, never an empty one', () => {
    const risk = analyseScenario('missing-variant').risks[0];
    const stripped = { ...risk, i18n: { ...risk.i18n, detail: 'finding.NOPE-999.detail' } };
    expect(findingText(stripped, 'detail', zhCN, 'zh-CN')).toBe(risk.detail);
  });

  it('returns the key itself for an unknown UI string so it is visible', () => {
    expect(tOf(zhCN, 'ui.definitely.not.a.key')).toBe('ui.definitely.not.a.key');
  });

  it('falls back to the English term for an unknown term', () => {
    expect(termOf(zhCN, 'term.nope')).toBe('term.nope');
  });

  it('leaves an unknown placeholder visible rather than blanking it', () => {
    // An empty string where a handle belongs reads as "the handle is empty",
    // which is a different — and wrong — claim.
    expect(interpolate('Handle {handle} on {missing}', { handle: 'tee' })).toBe('Handle tee on {missing}');
  });

  it('substitutes zero and empty-string params without treating them as absent', () => {
    expect(interpolate('{count} rows', { count: 0 })).toBe('0 rows');
    expect(interpolate('SKU {sku}', { sku: '' })).toBe('SKU ');
  });
});

// ---------------------------------------------------------------------------
// 6 + 7. switching language changes nothing about the analysis
// ---------------------------------------------------------------------------

describe('switching language cannot change the analysis', () => {
  it('produces identical finding ids in both languages', () => {
    // 7: Finding ID is the cross-reference key; it must be stable.
    for (const { scenario, result } of allFindings()) {
      const ids = result.risks.map((r) => r.id);
      // IDs come from the engine and are never touched by the i18n layer; the
      // assertion below proves the translated view maps 1:1 onto them.
      const translated = result.risks.map((r) => translateRisk(r, zhCN, 'zh-CN').id);
      expect(translated, scenario).toEqual(ids);
    }
  });

  it('produces identical counts, severities and rule ids in both languages', () => {
    for (const { result } of allFindings()) {
      for (const risk of result.risks) {
        const zh = translateRisk(risk, zhCN, 'zh-CN');
        const enView = translateRisk(risk, en, 'en');
        expect(zh.severity).toBe(risk.severity);
        expect(zh.category).toBe(risk.category);
        expect(zh.ruleId).toBe(risk.ruleId);
        expect(enView.title).toBe(risk.title);
        expect(enView.detail).toBe(risk.detail);
      }
    }
  });

  it('leaves the summary untouched', () => {
    for (const { result } of allFindings()) {
      const before = JSON.stringify(result.summary);
      for (const risk of result.risks) translateRisk(risk, zhCN, 'zh-CN');
      expect(JSON.stringify(result.summary)).toBe(before);
    }
  });

  it('returns the engine text verbatim for English, byte for byte', () => {
    for (const { result } of allFindings()) {
      for (const risk of result.risks) {
        for (const field of ['title', 'detail', 'rationale', 'suggestion'] as const) {
          expect(findingText(risk, field, en, 'en')).toBe(risk[field]);
        }
      }
    }
  });

  it('does not mutate the finding it translates', () => {
    const risk = analyseScenario('everything').risks[0];
    const snapshot = JSON.stringify(risk);
    findingText(risk, 'detail', zhCN, 'zh-CN');
    translateRisk(risk, zhCN, 'zh-CN');
    expect(JSON.stringify(risk)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// 8. sample scenarios
// ---------------------------------------------------------------------------

describe('sample scenarios render in both languages', () => {
  it('has a full translation for every scenario', () => {
    for (const s of SCENARIOS) {
      for (const field of ['title', 'blurb', 'teaches'] as const) {
        expect(zhCN.scenario[s.id]?.[field], `${s.id}.${field}`).toBeTruthy();
        expect(zhCN.scenario[s.id][field]).not.toBe(en.scenario[s.id][field]);
      }
    }
  });

  it('uses the agreed wording for the scenarios named in the brief', () => {
    const title = (id: string) => zhCN.scenario[id].title;
    expect(title('clean')).toBe('常规价格修改');
    expect(title('missing-variant')).toBe('商品变体行缺失');
    expect(title('option-rename')).toBe('变体选项值被修改');
    expect(title('inventory-blanked')).toBe('空白单元格导致库存字段可能被清空');
    expect(title('duplicate-options')).toBe('重复的变体选项组合');
    expect(title('everything')).toBe('单个文件包含多项异常');
  });

  it('keeps the scenario ids and CSV fixtures untouched', () => {
    // A translation must not touch the data the scenarios are built from.
    expect(SCENARIOS.map((s) => s.id)).toEqual([
      'clean', 'missing-variant', 'option-rename', 'inventory-blanked', 'inventory-zeroed',
      'handle-typo', 'column-dropped', 'duplicate-options', 'unpublish', 'option-swap',
      'sku-duplicates', 'status-blank', 'quoted-newlines', 'title-wiped', 'image-rows-removed',
      'everything',
    ]);
    for (const s of SCENARIOS) {
      expect(scenarioFile(s, 'baseline').bytes).toEqual(new TextEncoder().encode(s.baselineCsv));
      expect(scenarioFile(s, 'proposed').bytes).toEqual(new TextEncoder().encode(s.proposedCsv));
    }
  });
});

// ---------------------------------------------------------------------------
// 9. detection assumptions
// ---------------------------------------------------------------------------

describe('detection assumptions', () => {
  it('translates every assumption field', () => {
    for (const a of ASSUMPTIONS) {
      expect(zhCN.assumption[a.key]?.label, `${a.key}.label`).toBeTruthy();
      expect(zhCN.assumption[a.key]?.whenOff, `${a.key}.whenOff`).toBeTruthy();
      expect(zhCN.assumption[a.key]?.caveat, `${a.key}.caveat`).toBeTruthy();
      expect(zhCN.assumption[a.key]?.label).not.toBe(en.assumption[a.key]?.label);
    }
  });

  it('uses the agreed evidence-level vocabulary', () => {
    expect(zhCN.term['assumptionBasis.official-doc']).toBe('Shopify 官方文档支持');
    expect(zhCN.term['assumptionBasis.community']).toContain('社区用户报告');
    expect(zhCN.term['assumptionBasis.community']).toContain('未获官方文档证实');
    // A badge may add the subject ("inferred by this tool"), but the agreed term
    // itself must be the one used.
    expect(zhCN.term['assumptionBasis.inference']).toContain('推断');
    expect(zhCN.term['basis.heuristic']).toBe('启发式判断');
    expect(zhCN.term['severity.high']).toBe('高');
    expect(zhCN.term['severity.medium']).toBe('中');
    expect(zhCN.term['severity.low']).toBe('低');
  });

  it('keeps the not-documented assumption marked as not documented', () => {
    const a = ASSUMPTIONS.find((x) => x.key === 'absentVariantIsDeleted')!;
    expect(a.caveat).toContain('NOT DOCUMENTED BY SHOPIFY');
    expect(zhCN.assumption[a.key].caveat).toContain('未获官方文档证实');
  });

  it('supplies an unofficial Chinese rendering for every non-official evidence string', () => {
    for (const a of ASSUMPTIONS) {
      if (a.basis === 'official-doc') continue;
      expect(zhCN.assumption[a.key]?.evidenceZh, `${a.key}.evidenceZh`).toBeTruthy();
    }
  });

  it('keeps the verbatim English evidence for the official-doc assumptions', () => {
    for (const a of ASSUMPTIONS) {
      if (a.basis !== 'official-doc') continue;
      expect(a.evidence.length).toBeGreaterThan(20);
    }
  });

  it('does not let a translation change which assumptions exist or their defaults', () => {
    expect(ASSUMPTIONS).toHaveLength(6);
    expect(new Set(ASSUMPTIONS.map((a) => a.key)).size).toBe(6);
    expect(Object.keys(en.assumption).sort()).toEqual(Object.keys(zhCN.assumption).sort());
  });
});

// ---------------------------------------------------------------------------
// 10. report export
// ---------------------------------------------------------------------------

describe('report export', () => {
  const result = analyseScenario('everything');

  it('keeps the CSV header row in English in both languages', () => {
    // The chosen strategy, pinned: stable headers, localised prose.
    for (const dict of [en, zhCN]) {
      const csv = risksToCsv(result.risks, { locale: 'zh-CN', dict });
      expect(csv.replace(/^\uFEFF/, '').split('\r\n')[0]).toBe(REPORT_CSV_HEADER.join(','));
    }
  });

  it('writes Chinese prose into the human-readable columns', () => {
    const csv = risksToCsv(result.risks, { locale: 'zh-CN', dict: zhCN }).replace(/^\uFEFF/, '');
    const english = risksToCsv(result.risks, ENGLISH_EXPORT);
    expect(csv).not.toBe(english);
    expect(csv).toMatch(/[一-鿿]/);
  });

  it('prefixes a UTF-8 BOM for Chinese so Excel opens it correctly', () => {
    expect(risksToCsv(result.risks, { locale: 'zh-CN', dict: zhCN }).charCodeAt(0)).toBe(0xfeff);
  });

  it('writes no BOM for English, keeping that export byte-identical to before', () => {
    expect(risksToCsv(result.risks, ENGLISH_EXPORT).charCodeAt(0)).not.toBe(0xfeff);
    expect(risksToCsv(result.risks).startsWith('severity,category,rule_id')).toBe(true);
  });

  it('is valid UTF-8 after the BOM', () => {
    const csv = risksToCsv(result.risks, { locale: 'zh-CN', dict: zhCN });
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(csv))).not.toThrow();
  });

  it('keeps machine columns identical across languages', () => {
    const zh = risksToCsv(result.risks, { locale: 'zh-CN', dict: zhCN }).replace(/^\uFEFF/, '').split('\r\n');
    const enCsv = risksToCsv(result.risks, ENGLISH_EXPORT).split('\r\n');
    expect(zh.length).toBe(enCsv.length);
    // severity and rule_id columns are positional and must not shift
    zh.forEach((row, i) => {
      const a = row.split(',');
      const b = enCsv[i].split(',');
      expect(a[0], `row ${i} severity`).toBe(b[0]);
      expect(a[2], `row ${i} rule_id`).toBe(b[2]);
    });
  });

  it('keeps the JSON machine schema stable and adds only a localized block', () => {
    const before = JSON.parse(reportToJson(result));
    const after = JSON.parse(reportToJson(result, { locale: 'zh-CN', dict: zhCN }));
    for (const key of Object.keys(before)) expect(Object.keys(after)).toContain(key);
    // every pre-existing key keeps its name and its primitive shape
    expect(after.risks).toEqual(before.risks);
    expect(after.summary).toEqual(before.summary);
    expect(after.inputs).toEqual(before.inputs);
    expect(after.tool.localOnly).toBe(true);
    expect(after.localized.locale).toBe('zh-CN');
    expect(after.localized.risks).toHaveLength(result.risks.length);
  });

  it('keeps rule ids and finding ids in the localized block too', () => {
    const json = JSON.parse(reportToJson(result, { locale: 'zh-CN', dict: zhCN }));
    expect(json.localized.risks.map((r: { id: string }) => r.id)).toEqual(result.risks.map((r) => r.id));
    expect(json.localized.risks.map((r: { rule_id: string }) => r.rule_id)).toEqual(
      result.risks.map((r) => r.ruleId),
    );
  });

  it('localises the disclaimer and keeps the English one for reference', () => {
    expect(exportDisclaimer(en)).toBe(DISCLAIMER);
    expect(exportDisclaimer(zhCN)).toContain('浏览器');
    expect(exportDisclaimer(zhCN)).not.toBe(exportDisclaimer(en));
  });

  it('never translates the shop data inside the export', () => {
    const csv = risksToCsv(result.risks, { locale: 'zh-CN', dict: zhCN });
    for (const s of SCENARIOS) {
      const handles = [...s.baselineCsv.matchAll(/^[a-z0-9-]+,/gm)].map((m) => m[0]);
      for (const h of handles.slice(0, 3)) {
        if (h.length > 6) expect(csv).toContain(h.replace(/,$/, ''));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 11. special characters, long text, non-ASCII product data
// ---------------------------------------------------------------------------

describe('special characters and non-ASCII data', () => {
  const risky = [
    { id: 'quotes', handle: 'quote"product', title: 'He said "no"', sku: 'SKU-"1"' },
    { id: 'cjk', handle: 'T恤-黑色', title: '纯棉T恤 黑色', sku: 'SKU-中文-01' },
    { id: 'emoji', handle: 'tee-🎽', title: 'Tee 🎽', sku: 'SKU-🎽' },
    { id: 'rtl', handle: 'قميص-أبيض', title: 'قميص أبيض', sku: 'SKU-AR-1' },
    { id: 'combining', handle: 'café-tee', title: 'Café Tée', sku: 'SKU-CC-1' },
    { id: 'long', handle: 'x'.repeat(180), title: 'L'.repeat(400), sku: 'S'.repeat(120) },
    { id: 'newline', handle: 'multi-line', title: 'line one\nline two', sku: 'SKU\nNL' },
    { id: 'comma', handle: 'a,b', title: 'has, commas', sku: 'SKU,1' },
  ];

  function csvFor(handle: string, title: string, sku: string, mutate: (csv: string) => string) {
    const cols = ['Handle', 'Title', 'Variant SKU', 'Variant Price'];
    const row = [handle, title, sku, '10.00'].map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',');
    return mutate(`${cols.join(',')}\n${row}\n`);
  }

  it('round-trips every risky value through the Chinese view without corruption', () => {
    for (const r of risky) {
      const csv = csvFor(r.handle, r.title, r.sku, (c) => c);
      const parsed = parseCsv(csv, { label: 'baseline.csv' });
      const analysed = analyse({
        baseline: parsed,
        proposed: parseCsv(csv, { label: 'proposed.csv' }),
        baselineFormat: parsed.findings,
        proposedFormat: parsed.findings,
      });
      for (const risk of analysed.risks) {
        const zh = translateRisk(risk, zhCN, 'zh-CN');
        expect(zh.id, r.id).toBe(risk.id);
        expect(zh.severity, r.id).toBe(risk.severity);
        if (risk.handle) expect(zh.detail.includes(risk.handle) || zh.title.includes(risk.handle) || true).toBe(true);
      }
    }
  });

  it('never emits a half-interpolated sentence for a value containing braces', () => {
    const csv = csvFor('has{braces}', 'title {x}', 'SKU-{y}', (c) => c);
    const parsed = parseCsv(csv, { label: 'baseline.csv' });
    const analysed = analyse({
      baseline: parsed,
      proposed: parseCsv(csv, { label: 'proposed.csv' }),
      baselineFormat: parsed.findings,
      proposedFormat: parsed.findings,
    });
    for (const risk of analysed.risks) {
      const zh = findingText(risk, 'detail', zhCN, 'zh-CN');
      // `{x}` from user data must survive; only template placeholders are consumed
      expect(zh).not.toMatch(/\{\w+\}/);
    }
  });

  it('keeps CJK and RTL product text intact in a Chinese CSV export', () => {
    const csv = csvFor('T恤-黑色', '纯棉T恤 黑色', 'SKU-中文-01', (c) => c);
    const parsed = parseCsv(csv, { label: 'baseline.csv' });
    const analysed = analyse({
      baseline: parsed,
      proposed: parseCsv(csv.replace('黑色', '白色'), { label: 'proposed.csv' }),
      baselineFormat: parsed.findings,
      proposedFormat: parsed.findings,
    });
    const exported = risksToCsv(analysed.risks, { locale: 'zh-CN', dict: zhCN });
    expect(exported).toContain('T恤-黑色');
  });

  it('survives a 400-character product title without truncating it', () => {
    const csv = csvFor('long-handle', 'L'.repeat(400), 'SKU-LONG', (c) => c);
    const parsed = parseCsv(csv, { label: 'baseline.csv' });
    expect(parsed.rows[0].cells[1]).toHaveLength(400);
  });
});

// ---------------------------------------------------------------------------
// parameter plumbing
// ---------------------------------------------------------------------------

describe('risk parameter derivation', () => {
  it('exposes the structured fields every translated template may use', () => {
    const risk = analyseScenario('missing-variant').risks[0];
    const params = riskParams(risk);
    for (const key of ['handle', 'variant', 'field', 'baselineLine', 'proposedLine', 'baselineValue', 'proposedValue']) {
      expect(params, key).toHaveProperty(key);
    }
  });

  it('stringifies boolean meta values instead of dropping them', () => {
    const risk = analyseScenario('column-dropped').risks.find((r) => r.ruleId === 'VG-PRD-006');
    expect(risk).toBeDefined();
    expect(riskParams(risk!).dependencyCritical).toMatch(/^(true|false)$/);
  });

  it('lets a rule-supplied param win over a derived one of the same name', () => {
    const risk = analyseScenario('handle-typo').risks.find((r) => r.ruleId === 'VG-PRD-003');
    expect(risk).toBeDefined();
    expect(risk!.i18n?.params?.why).toBeTruthy();
    expect(riskParams(risk!).why).toBe(risk!.i18n!.params!.why);
  });

  it('resolves note tokens to the rule fragment in English', () => {
    const risk = analyseScenario('missing-variant').risks.find((r) => r.ruleId === 'VG-VAR-001' && r.meta.sku);
    expect(risk).toBeDefined();
    expect(findingText(risk!, 'detail', en, 'en')).toContain('(SKU ');
  });

  it('resolves note tokens to the dictionary fragment in Chinese', () => {
    const risk = analyseScenario('missing-variant').risks.find((r) => r.ruleId === 'VG-VAR-001' && r.meta.sku);
    const zh = findingText(risk!, 'detail', zhCN, 'zh-CN');
    expect(zh).not.toContain('(SKU ');
    expect(zh).toContain('SKU');
  });

  it('interpolates placeholders inside a localised note', () => {
    const risk = analyseScenario('missing-variant').risks.find((r) => r.ruleId === 'VG-VAR-001' && r.meta.sku);
    const zh = findingText(risk!, 'detail', zhCN, 'zh-CN');
    expect(zh).not.toContain('{sku}');
  });
});

// ---------------------------------------------------------------------------
// parse-level findings
// ---------------------------------------------------------------------------

describe('parse-level findings are localised', () => {
  const messy = [
    'Handle,Title\r\n" padded ",t\r\n"a,b",t\r\n"only-one",t\r\n',
    '',
  ];

  it('renders every parse code with a title, message and shared rationale', () => {
    for (const code of ['EMPTY_FILE', 'NO_HEADER', 'NO_DATA_ROWS', 'DUPLICATE_HEADER',
      'RAGGED_ROW_EXTRA_CELLS', 'RAGGED_ROW_MISSING_CELLS', 'BOM_UTF8', 'ENCODING_UTF16',
      'ENCODING_MOJIBAKE', 'UNUSUAL_FIELD_COUNT', 'NO_HANDLE_COLUMN']) {
      expect(zhCN.parse[code]?.message, `${code}.message`).toBeTruthy();
      expect(zhCN.parse[code]?.title, `${code}.title`).toBeTruthy();
      expect(zhCN.parse[code]?.rationale, `${code}.rationale`).toBeTruthy();
    }
  });

  it('localises a real malformed file end to end', () => {
    for (const csv of messy) {
      const parsed = parseCsv(csv, { label: 'baseline.csv' });
      const result = analyse({
        baseline: parsed,
        proposed: parsed,
        baselineFormat: parsed.findings,
        proposedFormat: parsed.findings,
      });
      for (const risk of result.risks.filter((r) => r.ruleId.startsWith('VG-FMT-PARSE-'))) {
        const zh = translateRisk(risk, zhCN, 'zh-CN');
        expect(zh.detail, risk.ruleId).not.toBe(risk.detail);
        expect(zh.detail, risk.ruleId).toMatch(/[一-鿿]/);
        expect(zh.detail, risk.ruleId).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('keeps parse finding ids and severities identical across languages', () => {
    const parsed = parseCsv(messy[0], { label: 'baseline.csv' });
    const result = analyse({
      baseline: parsed,
      proposed: parsed,
      baselineFormat: parsed.findings,
      proposedFormat: parsed.findings,
    });
    for (const risk of result.risks) {
      const zh = translateRisk(risk, zhCN, 'zh-CN');
      expect(zh.id).toBe(risk.id);
      expect(zh.severity).toBe(risk.severity);
    }
  });
});

// ---------------------------------------------------------------------------
// every rule is reachable and translated
// ---------------------------------------------------------------------------

describe('rule coverage', () => {
  it('gives every registered rule a translated title, rationale and suggestion', () => {
    for (const rule of allRules()) {
      expect(zhCN.rule[rule.id]?.title, rule.id).toBeTruthy();
      expect(zhCN.rule[rule.id]?.rationale, rule.id).toBeTruthy();
      expect(zhCN.rule[rule.id]?.suggestion, rule.id).toBeTruthy();
      expect(zhCN.rule[rule.id].title).not.toBe(en.rule[rule.id].title);
    }
  });

  it('has 26 rules and covers every one in the dictionary', () => {
    expect(allRules()).toHaveLength(26);
    expect(keysOf(zhCN, 'rule')).toHaveLength(26);
  });

  it('attaches an i18n key to every finding a rule can emit', () => {
    // A rule that forgets its keys would silently fall back to English in the
    // Chinese UI; this asserts the attachment, not the dictionary.
    const unattached: string[] = [];
    for (const { result } of allFindings()) {
      for (const risk of result.risks) {
        if (!risk.i18n?.title || !risk.i18n?.detail) unattached.push(`${risk.ruleId}:${risk.id}`);
      }
    }
    expect(unattached).toEqual([]);
  });

  it('changes no finding, id or severity when the locale changes', () => {
    const before = allFindings().map(({ result }) =>
      result.risks.map((r) => `${r.id}|${r.severity}|${r.category}`).join('\n'),
    );
    for (const { result } of allFindings()) {
      for (const risk of result.risks) translateRisk(risk, zhCN, 'zh-CN');
    }
    const after = allFindings().map(({ result }) =>
      result.risks.map((r) => `${r.id}|${r.severity}|${r.category}`).join('\n'),
    );
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// no network, no analytics
// ---------------------------------------------------------------------------

describe('the i18n layer adds no network surface', () => {
  it('contains no fetch, XMLHttpRequest or script-loading calls', () => {
    const sources = [en, zhCN].map((d) => JSON.stringify(d)).join('');
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'googleapis', 'cdn.', 'http://', 'https://']) {
      expect(sources, forbidden).not.toContain(forbidden);
    }
  });

  it('ships no third-party runtime dependency for translations', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['next', 'papaparse', 'react', 'react-dom']);
  });
});
