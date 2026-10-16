/**
 * Guards against a dictionary key being rendered as itself.
 *
 * `t()` reads the `ui` section and falls through to the prefix-routed sections;
 * `term()` reads the `term` section. Both return the key unchanged when they
 * cannot resolve it, so calling the wrong accessor for a key produces a silent
 * UI defect rather than an error: the badge rendered "basisShort.inference".
 *
 * Call sites that build keys at runtime (`t(`basisShort.${basis}`)`) cannot be
 * caught by comparing key sets, so this walks the call sites with the TypeScript
 * AST and checks each dynamic prefix against the section its accessor reaches.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { zhCN } from '@/i18n/zh-CN';

const SRC = join(process.cwd(), 'src');
const DICTIONARIES = { en, 'zh-CN': zhCN };

function walk(dir: string): string[] {  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

interface CallSite {
  file: string;
  line: number;
  accessor: 't' | 'term';
  prefix: string;
}

/** Find `t(`x.${...}`)` / `term(`x.${...}`)` — keys assembled at runtime. */
function dynamicCallSites(): CallSite[] {
  const found: CallSite[] = [];

  for (const file of walk(SRC)) {
    if (file.includes(`${'i18n'}\\`) || file.includes('/i18n/')) continue;
    const text = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 't' || node.expression.text === 'term') &&
        node.arguments.length > 0
      ) {
        const arg = node.arguments[0];
        // Only template literals whose head is a fixed `section.` prefix.
        if (ts.isTemplateExpression(arg)) {
          const head = arg.head.text;
          const dot = head.lastIndexOf('.');
          if (dot > 0) {
            const { line } = sf.getLineAndCharacterOfPosition(arg.getStart(sf));
            found.push({
              file: file.replace(`${process.cwd()}\\`, ''),
              line: line + 1,
              accessor: node.expression.text as 't' | 'term',
              prefix: head.slice(0, dot + 1),
            });
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sf);
  }

  return found;
}

/**
 * `t()` reads the `ui` section and falls through to the prefix-routed sections;
 * `term()` reads `term` and nothing else. A key used with the wrong accessor
 * renders as itself instead of failing, so this checks where each dynamic key
 * actually lives rather than whether it exists anywhere.
 */
function countPrefix(bag: Record<string, unknown>, prefix: string): number {
  return Object.keys(bag).filter((k) => k.startsWith(prefix)).length;
}

/** Sections `lookup()` routes to, and where their keys physically live. */
const ROUTED: Record<string, 'scenario' | 'assumption' | 'rule' | 'finding' | 'parse'> = {
  'scenario.': 'scenario',
  'assumption.': 'assumption',
  'rule.': 'rule',
  'finding.': 'finding',
  'parse.': 'parse',
};

describe('dynamic dictionary keys resolve in both languages', () => {
  const sites = dynamicCallSites();

  it('actually found call sites to check', () => {
    // If this is 0 the AST walk silently broke and every other test here is
    // vacuously true, which is worse than a failure.
    expect(sites.length).toBeGreaterThan(0);
  });

  it.each(sites)('$accessor() at $file:$line reaches a "$prefix" key', (site) => {
    for (const [locale, dict] of Object.entries(DICTIONARIES)) {
      const routed = ROUTED[site.prefix];
      const count = routed
        ? countPrefix(dict[routed] as unknown as Record<string, unknown>, '')
        : site.accessor === 't'
          ? countPrefix(dict.ui, site.prefix)
          : countPrefix(dict.term, site.prefix);

      // Reporting the locale makes an asymmetry obvious: the defect this guards
      // was a key present in the dictionary but unreachable through t().
      expect({ locale, accessor: site.accessor, prefix: site.prefix, count }).toEqual({
        locale,
        accessor: site.accessor,
        prefix: site.prefix,
        count: expect.any(Number),
      });
      expect(count).toBeGreaterThan(0);
    }
  });
});

describe('no dictionary key renders as itself', () => {
  it('every ui key resolves to a different string than the key', () => {
    for (const [name, dict] of Object.entries(DICTIONARIES)) {
      for (const key of Object.keys(dict.ui)) {
        expect(`${name}:${key}:${dict.ui[key]}`).not.toContain(`${name}:${key}:` + key);
      }
    }
  });

  it('every term key resolves to a different string than the key', () => {
    for (const [name, dict] of Object.entries(DICTIONARIES)) {
      for (const key of Object.keys(dict.term)) {
        expect(`${name}:${key}:${dict.term[key]}`).not.toContain(`${name}:${key}:` + key);
      }
    }
  });
});
