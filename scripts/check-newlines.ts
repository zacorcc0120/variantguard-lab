import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e === '.git' || e === 'out') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css|md|json)$/.test(e)) out.push(p);
  }
  return out;
}

const rows: { file: string; nl: string; bom: boolean }[] = [];
for (const f of walk('.')) {
  const b = readFileSync(f);
  const s = b.toString('utf8');
  const crlf = (s.match(/\r\n/g) ?? []).length;
  const lf = (s.match(/(?<!\r)\n/g) ?? []).length;
  const nl = crlf > 0 && lf === 0 ? 'CRLF' : lf > 0 && crlf === 0 ? 'LF' : crlf > 0 ? 'MIXED' : 'none';
  const bom = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
  if (nl !== 'LF' || bom) rows.push({ file: f, nl, bom });
}
console.log(rows.length === 0 ? 'every source file is LF with no BOM' : 'non-LF or BOM files:');
for (const r of rows) console.log(`  ${r.nl.padEnd(6)} bom=${r.bom ? 'yes' : 'no '}  ${r.file}`);
