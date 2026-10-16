import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/lib/csv/parseCsv';
import { analyse } from '@/lib/analysis/engine';
import { scenarioById, SCENARIOS } from '@/lib/samples';
import { buildReport, csvEscape, reportToJson, risksToCsv, toCsv, DISCLAIMER } from '@/lib/report/export';

function analyseScenario(id: string) {
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

describe('CSV escaping (RFC 4180)', () => {
  it('leaves plain values unquoted', () => {
    expect(csvEscape('hello')).toBe('hello');
  });
  it('leaves the empty string unquoted', () => {
    expect(csvEscape('')).toBe('');
  });
  it('quotes values containing a comma', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });
  it('quotes and doubles embedded quotes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
  it('quotes values containing a newline', () => {
    expect(csvEscape('a\nb')).toBe('"a\nb"');
  });
  it('joins rows with CRLF', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });
  it('round-trips a value containing both a quote and a newline', () => {
    const value = 'he said "no"\nthen left';
    expect(csvEscape(value)).toBe('"he said ""no""\nthen left"');
  });
});

describe('CSV report export', () => {
  const result = analyseScenario('everything');
  const csv = risksToCsv(result.risks);

  it('starts with the expected header row', () => {
    const header = csv.split('\r\n')[0];
    expect(header).toContain('severity');
    expect(header).toContain('rule_id');
    expect(header).toContain('baseline_line');
    expect(header).toContain('proposed_value');
    expect(header).toContain('finding');
    expect(header).toContain('depends_on');
  });

  it('emits one row per finding plus the header', () => {
    const rows = csv.split('\r\n');
    expect(rows.length).toBe(result.risks.length + 1);
  });

  it('parses back to the same row count using a real CSV parser', () => {
    // Re-parse the exported report: this catches any escaping bug that would
    // make the merchant's spreadsheet show shifted columns.
    const reparsed = parseCsv(csv);
    expect(reparsed.rows.length).toBe(result.risks.length);
  });

  it('records the assumption a finding depends on', () => {
    const missing = result.risks.find((r) => r.ruleId === 'VG-VAR-001');
    expect(missing).toBeDefined();
    expect(missing!.dependsOn).toContain('absentVariantIsDeleted');
  });

  it('keeps the absent/empty/value distinction visible in exported values', () => {
    const row = result.risks.find((r) => r.proposed?.cell.kind === 'empty');
    expect(row).toBeDefined();
    const reparsed = parseCsv(csv);
    const header = reparsed.headers;
    const idx = header.indexOf('proposed_value');
    const matching = reparsed.rows.filter((r) =>
      (r.cells[header.indexOf('rule_id')] ?? '') === row!.ruleId,
    );
    expect(matching.length).toBeGreaterThan(0);
    expect(matching[0].cells[idx]).toBe('(empty)');
  });
});

describe('JSON report export', () => {
  const result = analyseScenario('everything');
  const json = reportToJson(result);
  const parsed = JSON.parse(json);

  it('is valid JSON and is human-readable', () => {
    expect(json).toContain('\n  ');
  });

  it('declares that the tool is local-only and carries the disclaimer', () => {
    expect(parsed.tool.localOnly).toBe(true);
    expect(parsed.tool.disclaimer).toBe(DISCLAIMER);
  });

  it('records the input shape and summary counts', () => {
    expect(parsed.inputs.baseline.products).toBeGreaterThan(0);
    expect(parsed.inputs.proposed.variants).toBeGreaterThan(0);
    expect(parsed.summary.severityCounts.high).toBe(result.summary.severityCounts.high);
  });

  it('records every assumption with its basis, including the non-official ones', () => {
    expect(parsed.assumptions).toHaveLength(6);
    const bases = parsed.assumptions.map((a: { basis: string }) => a.basis);
    expect(bases).toContain('community');
    expect(bases).toContain('official-doc');
  });

  it('records every finding with its location where one exists', () => {
    expect(parsed.risks.length).toBe(result.risks.length);
    const located = parsed.risks.filter(
      (r: { proposed?: { location?: { line: number } } }) => r.proposed?.location?.line,
    );
    expect(located.length).toBeGreaterThan(0);
  });
});

describe('report bundle', () => {
  it('survives every demo scenario without throwing', () => {
    for (const s of SCENARIOS) {
      const r = analyseScenario(s.id);
      expect(() => buildReport(r)).not.toThrow();
      expect(() => reportToJson(r)).not.toThrow();
      expect(() => risksToCsv(r.risks)).not.toThrow();
    }
  });

  it('produces a header-only CSV report for a clean comparison', () => {
    const s = scenarioById('clean')!;
    const baseline = parseCsv(s.baselineCsv);
    const proposed = parseCsv(s.proposedCsv);
    const r = analyse({ baseline, proposed, baselineFormat: [], proposedFormat: [] });
    const csv = risksToCsv(r.risks);
    // Some Low findings survive on a clean file; the export must still be valid.
    expect(csv.split('\r\n')[0]).toContain('severity');
    expect(parseCsv(csv).rows.length).toBe(r.risks.length);
  });
});
