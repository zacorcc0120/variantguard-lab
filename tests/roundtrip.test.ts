import { describe, expect, it } from 'vitest';
import { parseCsv, parseCsvFile } from '@/lib/csv/parseCsv';
import { analyse, type AnalysisResult } from '@/lib/analysis/engine';
import { SCENARIOS, type Scenario } from '@/lib/samples';
import {
  CSV_MIME,
  scenarioArchive,
  scenarioFile,
  scenarioFileNames,
  scenarioZipName,
} from '@/lib/scenarioFiles';
import { crc32, createZip, ZIP32_LIMITS, type Bytes } from '@/lib/report/zip';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Builds the File object the browser hands back after a download completes:
 * the exact bytes written to disk, addressed by the filename the browser used.
 */
function downloadedFile(name: string, bytes: Bytes): File {
  return new File([bytes], name, { type: CSV_MIME });
}

function analyseScenario(scenario: Scenario): AnalysisResult {
  const baseline = parseCsv(scenario.baselineCsv, { label: 'baseline.csv' });
  const proposed = parseCsv(scenario.proposedCsv, { label: 'proposed.csv' });
  return analyse({
    baseline,
    proposed,
    baselineFormat: baseline.findings,
    proposedFormat: proposed.findings,
  });
}

/** Re-imports both downloaded files exactly the way a drag-and-drop upload does. */
async function analyseReimported(scenario: Scenario): Promise<AnalysisResult> {
  const upload = (slot: 'baseline' | 'proposed') => {
    const file = scenarioFile(scenario, slot);
    return parseCsvFile(downloadedFile(file.filename, file.bytes), file.filename);
  };
  const [baseline, proposed] = await Promise.all([upload('baseline'), upload('proposed')]);
  return analyse({
    baseline,
    proposed,
    baselineFormat: baseline.findings,
    proposedFormat: proposed.findings,
  });
}

/**
 * Re-imports through the file picker. The page passes the original File to
 * parseCsvFile, so this uses those bytes rather than a UTF-8 text round trip.
 */
async function analyseViaPicker(scenario: Scenario): Promise<AnalysisResult> {
  const pick = (slot: 'baseline' | 'proposed') => {
    const file = scenarioFile(scenario, slot);
    return parseCsvFile(downloadedFile(file.filename, file.bytes), file.filename);
  };
  const [baseline, proposed] = await Promise.all([pick('baseline'), pick('proposed')]);
  return analyse({
    baseline,
    proposed,
    baselineFormat: baseline.findings,
    proposedFormat: proposed.findings,
  });
}

/** The fields a report actually communicates: which rule, how bad, about what. */
function signature(result: AnalysisResult) {
  return result.risks.map((r) => ({
    id: r.id,
    ruleId: r.ruleId,
    severity: r.severity,
    category: r.category,
    basis: r.basis,
    handle: r.handle ?? null,
    field: r.fieldHeader ?? null,
    title: r.title,
  }));
}

const decoder = new TextDecoder('utf-8', { fatal: true });

// ---------------------------------------------------------------------------
// 1. the download payload IS the fixture
// ---------------------------------------------------------------------------

describe('download payloads', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    'baseline download for %s is byte-identical to the fixture',
    (_id, scenario) => {
      const file = scenarioFile(scenario, 'baseline');
      expect(file.bytes).toEqual(new TextEncoder().encode(scenario.baselineCsv));
      expect(decoder.decode(file.bytes)).toBe(scenario.baselineCsv);
    },
  );

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    'proposed download for %s is byte-identical to the fixture',
    (_id, scenario) => {
      const file = scenarioFile(scenario, 'proposed');
      expect(file.bytes).toEqual(new TextEncoder().encode(scenario.proposedCsv));
      expect(decoder.decode(file.bytes)).toBe(scenario.proposedCsv);
    },
  );

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s download carries no UTF-8 BOM',
    (_id, scenario) => {
      // A BOM would survive to the upload and add a BOM_UTF8 finding that the
      // built-in scenario does not have, breaking the re-import guarantee.
      for (const slot of ['baseline', 'proposed'] as const) {
        const { bytes } = scenarioFile(scenario, slot);
        expect([bytes[0], bytes[1], bytes[2]]).not.toEqual([0xef, 0xbb, 0xbf]);
      }
    },
  );

  it('decodes every fixture back to itself under strict UTF-8', () => {
    for (const s of SCENARIOS) {
      expect(decoder.decode(scenarioFileBytesOf(s, 'baseline'))).toBe(s.baselineCsv);
      expect(decoder.decode(scenarioFileBytesOf(s, 'proposed'))).toBe(s.proposedCsv);
    }
  });
});

function scenarioFileBytesOf(s: Scenario, slot: 'baseline' | 'proposed'): Uint8Array {
  return scenarioFile(s, slot).bytes;
}

// ---------------------------------------------------------------------------
// 2. filenames
// ---------------------------------------------------------------------------

describe('download filenames', () => {
  it('prefixes names with the scenario id so downloads cannot collide', () => {
    for (const s of SCENARIOS) {
      const names = scenarioFileNames(s);
      expect(names.baseline).toBe(`variantguard-${s.id}-baseline.csv`);
      expect(names.proposed).toBe(`variantguard-${s.id}-proposed.csv`);
    }
  });

  it('gives every scenario a distinct pair of filenames', () => {
    const all = SCENARIOS.flatMap((s) => {
      const n = scenarioFileNames(s);
      return [n.baseline, n.proposed];
    });
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps scenario ids safe to put in a filename', () => {
    // A change here would silently produce a path separator or a name that the
    // OS rewrites, so the invariant is enforced rather than assumed.
    for (const s of SCENARIOS) {
      expect(s.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it('names the archive after the scenario', () => {
    expect(scenarioZipName(SCENARIOS[0])).toBe(`variantguard-${SCENARIOS[0].id}.zip`);
  });

  it('uses the same member names inside the archive as for the single files', () => {
    // Otherwise "download both" and "download one" would produce files that
    // are not byte-identical, and the round-trip guarantee would depend on
    // which button the user happened to press.
    const s = SCENARIOS[0];
    const names = new Set(readZip(scenarioArchive(s).bytes).map((e) => e.name));
    expect(names).toEqual(new Set([scenarioFileNames(s).baseline, scenarioFileNames(s).proposed]));
  });
});

// ---------------------------------------------------------------------------
// 3. ZIP structure
// ---------------------------------------------------------------------------

describe('ZIP writer', () => {
  it('matches published CRC-32 vectors', () => {
    expect(crc32(new TextEncoder().encode(''))).toBe(0x00000000);
    expect(crc32(new TextEncoder().encode('a'))).toBe(0xe8b7be43);
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new TextEncoder().encode('The quick brown fox jumps over the lazy dog'))).toBe(
      0x414fa339,
    );
  });

  it('agrees with an independent bitwise CRC-32 implementation', () => {
    // The table-driven version in src/lib/report/zip.ts would happily be wrong
    // in a way that still round-trips through its own reader, so the cross
    // check has to be structurally different code.
    for (const s of SCENARIOS) {
      for (const slot of ['baseline', 'proposed'] as const) {
        expect(crc32(scenarioFile(s, slot).bytes)).toBe(referenceCrc32(scenarioFile(s, slot).bytes));
      }
    }
  });

  it('writes a well-formed archive for every scenario', () => {
    for (const s of SCENARIOS) {
      const entries = readZip(scenarioArchive(s).bytes);
      expect(entries.map((e) => e.method)).toEqual([0, 0]); // stored
      expect(entries.every((e) => (e.flags & 0x0800) !== 0)).toBe(true); // UTF-8 names
      expect(entries.every((e) => e.crc === referenceCrc32(e.data))).toBe(true);
      expect(entries.map((e) => e.data)).toEqual([
        scenarioFile(s, 'baseline').bytes,
        scenarioFile(s, 'proposed').bytes,
      ]);
    }
  });

  it('produces byte-identical archives for identical input', () => {
    // Reproducibility is what lets the round-trip test compare bytes rather
    // than "structurally equivalent bytes".
    const s = SCENARIOS[3];
    expect(scenarioArchive(s).bytes).toEqual(scenarioArchive(s).bytes);
    expect(scenarioArchive(s).bytes).not.toEqual(scenarioArchive(SCENARIOS[4]).bytes);
  });

  it('handles an empty file entry', () => {
    const zip = createZip([{ name: 'empty.csv', bytes: new Uint8Array(0) }]);
    const [entry] = readZip(zip);
    expect(entry.name).toBe('empty.csv');
    expect(entry.data.length).toBe(0);
    expect(entry.crc).toBe(0);
  });

  it('rejects duplicate entry names', () => {
    expect(() =>
      createZip([
        { name: 'a.csv', bytes: new Uint8Array(1) },
        { name: 'a.csv', bytes: new Uint8Array(2) },
      ]),
    ).toThrow(/twice/);
  });

  it('rejects absolute and backslash entry paths', () => {
    expect(() => createZip([{ name: '/a.csv', bytes: new Uint8Array(1) }])).toThrow(/relative path/);
    expect(() => createZip([{ name: '..\\a.csv', bytes: new Uint8Array(1) }])).toThrow(/relative path/);
  });

  it('refuses to silently overflow the 16-bit entry count', () => {
    const many = Array.from({ length: ZIP32_LIMITS.maxEntries + 1 }, (_, i) => ({
      name: `f${i}.csv`,
      bytes: new Uint8Array(0),
    }));
    expect(() => createZip(many)).toThrow(/zip64/);
  });
});

// ---------------------------------------------------------------------------
// 4. THE round trip: downloaded file -> re-import -> same report
// ---------------------------------------------------------------------------

describe('re-importing a downloaded file reproduces the built-in scenario', () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s produces the same findings, types and severities after a drop upload',
    async (_id, scenario) => {
      const builtin = signature(analyseScenario(scenario));
      const roundTripped = signature(await analyseReimported(scenario));
      expect(roundTripped).toEqual(builtin);
    },
  );

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s produces the same findings, types and severities after a picker upload',
    async (_id, scenario) => {
      const builtin = signature(analyseScenario(scenario));
      const roundTripped = signature(await analyseViaPicker(scenario));
      expect(roundTripped).toEqual(builtin);
    },
  );

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s round trip preserves the summary counts',
    async (_id, scenario) => {
      const builtin = analyseScenario(scenario);
      const roundTripped = await analyseReimported(scenario);
      expect(roundTripped.summary).toEqual(builtin.summary);
    },
  );

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s round trip preserves every expectation the scenario declares',
    async (_id, scenario) => {
      // The point of a download feature is that a user can reproduce the claim
      // the scenario makes. Re-checking the declaration closes that loop.
      const result = await analyseReimported(scenario);
      const ids = result.risks.map((r) => r.ruleId);
      for (const required of scenario.expect.mustInclude) {
        expect(ids).toContain(required);
      }
      for (const forbidden of scenario.expect.mustNotInclude ?? []) {
        expect(ids).not.toContain(forbidden);
      }
      const high = result.summary.severityCounts.high;
      if (scenario.expect.minHigh !== undefined) expect(high).toBeGreaterThanOrEqual(scenario.expect.minHigh);
      if (scenario.expect.maxHigh !== undefined) expect(high).toBeLessThanOrEqual(scenario.expect.maxHigh);
    },
  );
});

describe('the round-trip comparison is not vacuous', () => {
  it('compares a substantial number of findings across all scenarios', async () => {
    let compared = 0;
    for (const s of SCENARIOS) compared += (await analyseReimported(s)).risks.length;
    // A suite that only ever compares two empty reports would pass every test
    // above. This pins the total so that cannot happen unnoticed.
    expect(compared).toBeGreaterThan(50);
  });

  it('keeps the deliberately clean scenarios at exactly zero findings', async () => {
    // Two scenarios exist precisely to prove the tool reports nothing when
    // nothing is wrong. Any spurious encoding or parse finding introduced by
    // the download path would show up here as a regression.
    for (const id of ['clean', 'quoted-newlines']) {
      const scenario = SCENARIOS.find((s) => s.id === id)!;
      const result = await analyseReimported(scenario);
      expect(result.risks).toEqual([]);
      expect(result.summary.severityCounts).toEqual({ high: 0, medium: 0, low: 0 });
    }
  });

  it('reproduces the exact finding count, not just a matching set', async () => {
    for (const s of SCENARIOS) {
      const roundTripped = await analyseReimported(s);
      expect(roundTripped.risks.length).toBe(analyseScenario(s).risks.length);
    }
  });
});

describe('the round-trip comparison can actually fail', () => {
  it('detects a single changed byte in the downloaded baseline', async () => {
    // Guards against the whole suite passing because the comparison is
    // vacuous. One character of one handle must break the match.
    const scenario = SCENARIOS.find((s) => s.id === 'missing-variant')!;
    const original = scenarioFile(scenario, 'baseline').bytes;
    const mutated = original.slice();
    const at = decoder.decode(mutated).indexOf('Handle') + 2;
    mutated[at] = mutated[at] === 0x58 ? 0x59 : 0x58; // flip one byte of "Handle"
    expect(mutated).not.toEqual(original);

    const proposed = await parseCsvFile(
      downloadedFile(scenarioFile(scenario, 'proposed').filename, scenarioFile(scenario, 'proposed').bytes),
    );
    const baseline = await parseCsvFile(downloadedFile('baseline.csv', mutated));
    const changed = analyse({
      baseline,
      proposed,
      baselineFormat: baseline.findings,
      proposedFormat: proposed.findings,
    });

    const builtin = analyseScenario(scenario);
    // Renaming the Handle column trips NO_HANDLE_COLUMN, so the reports
    // genuinely differ rather than differing by coincidence.
    expect(signature(changed)).not.toEqual(signature(builtin));
    expect(changed.risks.some((r) => r.ruleId === 'VG-FMT-PARSE-NO_HANDLE_COLUMN')).toBe(true);
  });

  it('detects swapping the baseline and proposed files', async () => {
    const scenario = SCENARIOS.find((s) => s.id === 'title-wiped')!;
    const [b, p] = await Promise.all([
      parseCsvFile(downloadedFile('baseline.csv', scenarioFile(scenario, 'proposed').bytes)),
      parseCsvFile(downloadedFile('proposed.csv', scenarioFile(scenario, 'baseline').bytes)),
    ]);
    const swapped = analyse({
      baseline: b,
      proposed: p,
      baselineFormat: b.findings,
      proposedFormat: p.findings,
    });
    expect(signature(swapped)).not.toEqual(signature(analyseScenario(scenario)));
  });
});

// ---------------------------------------------------------------------------
// 5. robustness: what a real download / re-save pipeline can do to the bytes
// ---------------------------------------------------------------------------

describe('round-trip robustness against file-system round trips', () => {
  it('survives a CSV editor that rewrites CRLF as LF', async () => {
    // On macOS and Linux a plain text save turns every CRLF into LF. If a
    // fixture depended on CRLF the downloaded sample would stop matching the
    // built-in one, which is exactly the failure this feature could ship with.
    for (const s of SCENARIOS) {
      const lf = (csv: string) => csv.replace(/\r\n/g, '\n');
      const [baseline, proposed] = await Promise.all([
        parseCsvFile(downloadedFile('baseline.csv', new TextEncoder().encode(lf(s.baselineCsv)))),
        parseCsvFile(downloadedFile('proposed.csv', new TextEncoder().encode(lf(s.proposedCsv)))),
      ]);
      const result = analyse({
        baseline,
        proposed,
        baselineFormat: baseline.findings,
        proposedFormat: proposed.findings,
      });
      expect(signature(result)).toEqual(signature(analyseScenario(s)));
    }
  });

  it('survives an editor that rewrites LF as CRLF', async () => {
    for (const s of SCENARIOS) {
      const crlf = (csv: string) => csv.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
      const [baseline, proposed] = await Promise.all([
        parseCsvFile(downloadedFile('baseline.csv', new TextEncoder().encode(crlf(s.baselineCsv)))),
        parseCsvFile(downloadedFile('proposed.csv', new TextEncoder().encode(crlf(s.proposedCsv)))),
      ]);
      const result = analyse({
        baseline,
        proposed,
        baselineFormat: baseline.findings,
        proposedFormat: proposed.findings,
      });
      expect(signature(result)).toEqual(signature(analyseScenario(s)));
    }
  });

  it('adds exactly one BOM finding, and only that one, if a BOM is introduced', async () => {
    // Documented deviation, not a bug: our own downloads are BOM-free, but a
    // user who re-saves one in Excel gets a BOM, and the tool is *supposed* to
    // tell them about it. Everything else must still match.
    const scenario = SCENARIOS.find((s) => s.id === 'missing-variant')!;
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...scenarioFile(scenario, 'baseline').bytes]);
    const baseline = await parseCsvFile(downloadedFile('baseline.csv', withBom));
    expect(baseline.findings.map((f) => f.code)).toContain('BOM_UTF8');

    const proposed = await parseCsvFile(
      downloadedFile(scenarioFile(scenario, 'proposed').filename, scenarioFile(scenario, 'proposed').bytes),
    );
    const result = analyse({
      baseline,
      proposed,
      baselineFormat: baseline.findings,
      proposedFormat: proposed.findings,
    });
    const withoutBomFinding = result.risks.filter((r) => r.ruleId !== 'VG-FMT-PARSE-BOM_UTF8');
    const builtin = analyseScenario(scenario).risks;
    // Ids are positional counters, so the inserted finding shifts them; the
    // rule/severity/title sequence is the label-independent identity.
    expect(withoutBomFinding.map((r) => [r.ruleId, r.severity, r.title])).toEqual(
      builtin.map((r) => [r.ruleId, r.severity, r.title]),
    );
  });

  it('reports no encoding findings for its own downloads', async () => {
    for (const s of SCENARIOS) {
      for (const slot of ['baseline', 'proposed'] as const) {
        const file = scenarioFile(s, slot);
        const parsed = await parseCsvFile(downloadedFile(file.filename, file.bytes));
        expect(parsed.encoding).toEqual({ detected: 'utf-8', transcoded: false });
        expect(parsed.findings.map((f) => f.code)).not.toContain('BOM_UTF8');
        expect(parsed.findings.map((f) => f.code)).not.toContain('ENCODING_UTF16');
        expect(parsed.findings.map((f) => f.code)).not.toContain('ENCODING_MOJIBAKE');
      }
    }
  });
});

// ---------------------------------------------------------------------------
// reference implementations used for cross-checking, deliberately written
// differently from the code under test
// ---------------------------------------------------------------------------

/** Textbook bitwise CRC-32: no lookup table, computed one bit at a time. */
function referenceCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) === 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ReadEntry {
  readonly name: string;
  readonly data: Uint8Array;
  readonly crc: number;
  readonly method: number;
  readonly flags: number;
}

/** Minimal ZIP reader: walks the central directory the way an extractor does. */
function readZip(bytes: Bytes): ReadEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocdSignature = 0x06054b50;
  let eocd = bytes.length - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== eocdSignature) eocd--;
  if (eocd < 0) throw new Error('no end-of-central-directory record');

  const count = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const decoderLocal = new TextDecoder('utf-8', { fatal: true });
  const entries: ReadEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error('bad central header signature');
    const flags = view.getUint16(pointer + 8, true);
    const method = view.getUint16(pointer + 10, true);
    const crc = view.getUint32(pointer + 16, true);
    const size = view.getUint32(pointer + 24, true);
    const nameLen = view.getUint16(pointer + 28, true);
    const localOffset = view.getUint32(pointer + 42, true);
    const name = decoderLocal.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLen));

    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('bad local header signature');
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    entries.push({ name, data: bytes.subarray(dataStart, dataStart + size), crc, method, flags });

    pointer += 46 + nameLen + view.getUint16(pointer + 30, true) + view.getUint16(pointer + 32, true);
  }
  return entries;
}
