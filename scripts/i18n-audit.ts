import { readFileSync } from 'node:fs';
import { SCENARIOS } from '@/lib/samples';
import { en } from '@/i18n/en';
import { zhCN } from '@/i18n/zh-CN';

console.log('SCENARIOS.length      :', SCENARIOS.length);
console.log('en.scenario keys      :', Object.keys(en.scenario).length);
console.log('zh.scenario keys      :', Object.keys(zhCN.scenario).length);
const real = new Set(SCENARIOS.map((s) => s.id));
console.log('en scenario keys not in SCENARIOS:', Object.keys(en.scenario).filter((k) => !real.has(k)));
console.log('SCENARIOS ids missing from en    :', [...real].filter((k) => !(k in en.scenario)));
console.log('');
for (const sec of ['ui', 'term', 'rule', 'finding', 'assumption', 'scenario', 'parse'] as const) {
  const a = Object.keys((en as any)[sec]).length;
  const b = Object.keys((zhCN as any)[sec]).length;
  const miss = Object.keys((en as any)[sec]).filter((k) => !(k in (zhCN as any)[sec]));
  console.log(`${sec.padEnd(11)} en=${String(a).padStart(4)} zh=${String(b).padStart(4)}  missing in zh: ${miss.length}`);
}
console.log('');
console.log('--- do the existing tests assert on FormatFinding shape? ---');
const csvTest = readFileSync('tests/csv.test.ts', 'utf8');
const repTest = readFileSync('tests/report.test.ts', 'utf8');
console.log('csv.test.ts  toEqual on findings :', /findings\)?\s*\.?\s*toEqual|toEqual\(\s*\[?\s*\{[^}]*code/.test(csvTest));
console.log('csv.test.ts  mentions findings   :', (csvTest.match(/findings/g) || []).length);
console.log('report.test.ts mentions findings:', (repTest.match(/findings/g) || []).length);
