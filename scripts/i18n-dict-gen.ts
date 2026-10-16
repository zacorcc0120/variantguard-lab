/**
 * Generates the i18n dictionary skeleton from the existing English sources.
 *
 * The English dictionary is the authoritative KEY SET: every key is the exact
 * English string the product already ships, so adding a key can never change
 * what an English user sees, and the coverage test can prove that every
 * user-visible string in the codebase has a translation slot.
 */
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';

const FIELDS = ['title', 'detail', 'rationale', 'suggestion'] as const;
type Field = (typeof FIELDS)[number];

function render(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    const parts = node.templateSpans.map((s) => '${' + s.expression.getText() + '}' + s.literal.text);
    return node.head.text + parts.join('');
  }
  return null;
}

// ---------------------------------------------------------------- rules.ts
const rulesPath = 'src/lib/analysis/rules.ts';
const rulesSrc = ts.createSourceFile(rulesPath, readFileSync(rulesPath, 'utf8'), ts.ScriptTarget.ES2022, true);

const ruleLevel: Record<string, Partial<Record<Field, string>>> = {};
const findingLevel: Record<string, Partial<Record<Field, string[]>>> = {};
let currentId = '';
let pendingRuleDef: Partial<Record<Field, string>> | null = null;

const walk = (node: ts.Node) => {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'rule') {
    const arg = node.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) {
      pendingRuleDef = {};
      for (const p of arg.properties) {
        if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
        if (p.name.text === 'id' && ts.isStringLiteral(p.initializer)) currentId = p.initializer.text;
        if ((FIELDS as readonly string[]).includes(p.name.text)) {
          const r = render(p.initializer);
          if (r !== null) pendingRuleDef[p.name.text as Field] = r;
        }
      }
      ruleLevel[currentId] = pendingRuleDef;
    }
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'add') {
    const arg = node.arguments[0];
    if (arg && ts.isObjectLiteralExpression(arg)) {
      const bucket = (findingLevel[currentId] ??= {});
      for (const p of arg.properties) {
        if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name) || !(FIELDS as readonly string[]).includes(p.name.text)) continue;
        const list = (bucket[p.name.text as Field] ??= []);
        const collect = (n: ts.Node) => {
          const r = render(n);
          if (r !== null) {
            if (!list.includes(r)) list.push(r);
          } else if (ts.isConditionalExpression(n)) {
            // Only the two arms are copy. The condition is code — walking it
            // would harvest literals like `'legacy'` as if they were sentences.
            collect(n.whenTrue);
            collect(n.whenFalse);
          } else if (!ts.isBinaryExpression(n)) {
            n.forEachChild(collect);
          }
        };
        collect(p.initializer);
      }
    }
  }
  node.forEachChild(walk);
};
walk(rulesSrc);

// ---------------------------------------------------------------- parseCsv.ts
const parsePath = 'src/lib/csv/parseCsv.ts';
const parseSrc = ts.createSourceFile(parsePath, readFileSync(parsePath, 'utf8'), ts.ScriptTarget.ES2022, true);
const parseFindings: Record<string, { message: string; detail?: string }> = {};
{
  const walk = (n: ts.Node) => {
    // findings.push({ code: 'X', ..., message: `...`, detail: '...' })
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'push') {
      const arg = n.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        let code: string | null = null;
        let message: string | null = null;
        let detail: string | undefined;
        for (const p of arg.properties) {
          if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
          if (p.name.text === 'code' && ts.isStringLiteral(p.initializer)) code = p.initializer.text;
          if (p.name.text === 'message') message = render(p.initializer);
          if (p.name.text === 'detail') detail = render(p.initializer) ?? undefined;
        }
        if (code && message) parseFindings[code] = detail ? { message, detail } : { message };
      }
    }
    n.forEachChild(walk);
  };
  walk(parseSrc);
}

// ---------------------------------------------------------------- assumptions.ts
const asmPath = 'src/lib/analysis/assumptions.ts';
const asmSrc = ts.createSourceFile(asmPath, readFileSync(asmPath, 'utf8'), ts.ScriptTarget.ES2022, true);
const assumptions: Record<string, Record<string, string>> = {};
{
  let key = '';
  const walk = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n)) {
      for (const p of n.properties) {
        if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
        if (p.name.text === 'key' && ts.isStringLiteral(p.initializer)) key = p.initializer.text;
      }
      if (key && Object.keys(assumptions).length < 20) {
        const rec = assumptions[key];
        const target = rec ?? (assumptions[key] = {});
        for (const p of n.properties) {
          if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
          if (['label', 'whenOff', 'evidence', 'caveat'].includes(p.name.text)) {
            const r = render(p.initializer);
            if (r !== null) target[p.name.text] = r;
          }
        }
      }
    }
    n.forEachChild(walk);
  };
  walk(asmSrc);
}

// ---------------------------------------------------------------- samples.ts
const smpPath = 'src/lib/samples.ts';
const smpSrc = ts.createSourceFile(smpPath, readFileSync(smpPath, 'utf8'), ts.ScriptTarget.ES2022, true);
const scenarios: Record<string, Record<string, string>> = {};
{
  let id = '';
  const walk = (n: ts.Node) => {
    if (ts.isObjectLiteralExpression(n)) {
      for (const p of n.properties) {
        if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
        if (p.name.text === 'id' && ts.isStringLiteral(p.initializer)) id = p.initializer.text;
      }
      if (id) {
        const target = scenarios[id] ?? (scenarios[id] = {});
        for (const p of n.properties) {
          if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
          if (['title', 'blurb', 'teaches'].includes(p.name.text)) {
            const r = render(p.initializer);
            if (r !== null) target[p.name.text] = r;
          }
        }
      }
    }
    n.forEachChild(walk);
  };
  walk(smpSrc);
}

writeFileSync(
  process.argv[2],
  JSON.stringify({ ruleLevel, findingLevel, parseFindings, assumptions, scenarios }, null, 2),
);
console.log(
  'rules:', Object.keys(ruleLevel).length,
  '| finding templates:', Object.values(findingLevel).reduce((n, f) => n + Object.values(f).reduce((m, a) => m + (a?.length ?? 0), 0), 0),
  '| parse codes:', Object.keys(parseFindings).length,
  '| assumptions:', Object.keys(assumptions).length,
  '| scenarios:', Object.keys(scenarios).length,
);
