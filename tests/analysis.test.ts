import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/lib/csv/parseCsv';
import { analyse } from '@/lib/analysis/engine';
import { DEFAULT_ASSUMPTIONS, type AssumptionSet } from '@/lib/analysis/assumptions';
import { pairVariants } from '@/lib/analysis/rules';
import { buildCatalog, columnIndex } from '@/lib/shopify/model';
import { lookupField } from '@/lib/shopify/schema';
import { SCENARIOS, scenarioById } from '@/lib/samples';

function run(baselineCsv: string, proposedCsv: string, assumptions?: AssumptionSet) {
  // Format findings are produced by the parser and must be threaded into the
  // engine explicitly — the app does the same when a file is dropped in.
  const baseline = parseCsv(baselineCsv, { label: 'baseline.csv' });
  const proposed = parseCsv(proposedCsv, { label: 'proposed.csv' });
  return analyse({
    baseline,
    proposed,
    baselineFormat: baseline.findings,
    proposedFormat: proposed.findings,
    assumptions,
  });
}

function ruleIds(result: ReturnType<typeof run>): string[] {
  return [...new Set(result.risks.map((r) => r.ruleId))];
}

describe('every demo scenario behaves as advertised', () => {
  it('covers at least 10 scenarios', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(10);
  });

  for (const s of SCENARIOS) {
    describe(`${s.id} — ${s.title}`, () => {
      const result = run(s.baselineCsv, s.proposedCsv);
      const ids = ruleIds(result);

      it('produces the expected rules', () => {
        for (const id of s.expect.mustInclude) {
          expect(ids, `expected ${id} in ${s.id}; got ${ids.join(', ')}`).toContain(id);
        }
        for (const id of s.expect.mustNotInclude ?? []) {
          expect(ids, `did not expect ${id} in ${s.id}; got ${ids.join(', ')}`).not.toContain(id);
        }
      });

      it('respects the expected high-severity bounds', () => {
        const high = result.summary.severityCounts.high;
        if (s.expect.minHigh !== undefined) expect(high).toBeGreaterThanOrEqual(s.expect.minHigh);
        if (s.expect.maxHigh !== undefined) expect(high).toBeLessThanOrEqual(s.expect.maxHigh);
      });

      it('every finding carries a file location where one exists', () => {
        for (const r of result.risks) {
          const hasLoc = !!(r.baseline?.location || r.proposed?.location);
          const locatable = [
            'VG-VAR-001','VG-VAR-002','VG-VAR-003','VG-VAR-004','VG-VAR-005',
            'VG-VAR-006','VG-VAR-007','VG-VAR-008','VG-VAR-009','VG-VAR-012',
            'VG-VAR-013','VG-VAR-015','VG-PRD-002','VG-PRD-003','VG-PRD-004',
            'VG-PRD-005','VG-FMT-003','VG-FMT-004',
          ];
          if (hasLoc || !locatable.includes(r.ruleId)) continue;
          // allowed: PRD-006 / FMT-001 / FMT-002 are file-level, no single row
          expect(r.ruleId, `${r.ruleId} in ${s.id} has no location`).toBe('__unexpected__');
        }
      });

      it('is deterministic across runs', () => {
        const again = run(s.baselineCsv, s.proposedCsv);
        expect(JSON.stringify(again.risks.map((r) => r.id))).toBe(
          JSON.stringify(result.risks.map((r) => r.id)),
        );
      });
    });
  }
});

describe('the clean scenario is genuinely clean', () => {
  it('produces no high or medium findings for a pure price edit', () => {
    const s = scenarioById('clean')!;
    const r = run(s.baselineCsv, s.proposedCsv);
    expect(r.summary.severityCounts.high).toBe(0);
    expect(r.summary.severityCounts.medium).toBe(0);
  });

  it('counts the catalogue correctly', () => {
    const s = scenarioById('clean')!;
    const r = run(s.baselineCsv, s.proposedCsv);
    // classic-tee 6 + studio-mug 1 + field-notebook 4 + heavy-hoodie 4 + canvas-pouch 1
    expect(r.summary.baselineProducts).toBe(5);
    expect(r.summary.baselineVariants).toBe(6 + 1 + 4 + 4 + 1);
  });
});

describe('assumption sensitivity', () => {
  it('downgrades missing-variant findings when absentVariantIsDeleted is off', () => {
    const s = scenarioById('missing-variant')!;
    const on = run(s.baselineCsv, s.proposedCsv);
    const off = run(s.baselineCsv, s.proposedCsv, {
      ...DEFAULT_ASSUMPTIONS,
      absentVariantIsDeleted: false,
    });
    const highOn = on.risks.filter((r) => r.ruleId === 'VG-VAR-001' && r.severity === 'high');
    const highOff = off.risks.filter((r) => r.ruleId === 'VG-VAR-001' && r.severity === 'high');
    expect(highOn.length).toBeGreaterThan(0);
    expect(highOff.length).toBe(0);
    // the finding itself survives, so the user can still see the omission
    expect(off.risks.some((r) => r.ruleId === 'VG-VAR-001')).toBe(true);
  });

  it('escalates missing-product findings when absentProductIsRetained is off', () => {
    const s = scenarioById('column-dropped')!;
    // remove an entire product from the proposed file
    const lines = s.proposedCsv.split('\n').filter((l) => !l.startsWith('studio-mug'));
    const on = run(s.baselineCsv, lines.join('\n'));
    const off = run(s.baselineCsv, lines.join('\n'), {
      ...DEFAULT_ASSUMPTIONS,
      absentProductIsRetained: false,
    });
    const sevOn = on.risks.find((r) => r.ruleId === 'VG-PRD-001' && r.handle === 'studio-mug');
    const sevOff = off.risks.find((r) => r.ruleId === 'VG-PRD-001' && r.handle === 'studio-mug');
    expect(sevOn?.severity).toBe('low');
    expect(sevOff?.severity).toBe('high');
  });

  it('suppresses field-clearing findings when blankClearsMissingPreserves is off', () => {
    const s = scenarioById('inventory-blanked')!;
    const off = run(s.baselineCsv, s.proposedCsv, {
      ...DEFAULT_ASSUMPTIONS,
      blankClearsMissingPreserves: false,
    });
    expect(off.risks.filter((r) => r.ruleId === 'VG-VAR-008' && r.severity === 'high')).toHaveLength(0);
  });

  it('records which findings would change if assumptions were wrong', () => {
    const s = scenarioById('missing-variant')!;
    const r = run(s.baselineCsv, s.proposedCsv);
    expect(r.summary.assumptionSensitive).toBeGreaterThan(0);
  });
});

describe('false-positive control', () => {
  it('does not report a variant as changed when only unrelated columns differ', () => {
    const s = scenarioById('clean')!;
    const r = run(s.baselineCsv, s.proposedCsv);
    expect(r.risks.filter((x) => x.ruleId === 'VG-VAR-002')).toHaveLength(0);
    expect(r.risks.filter((x) => x.ruleId === 'VG-VAR-001')).toHaveLength(0);
  });

  it('does not fire on a file with no changes at all', () => {
    const s = scenarioById('clean')!;
    const r = run(s.baselineCsv, s.baselineCsv);
    expect(r.summary.severityCounts.high).toBe(0);
    expect(r.summary.severityCounts.medium).toBe(0);
  });

  it('treats trailing-whitespace option values as equal for matching', () => {
    const header = 'Handle,Title,Option1 Name,Option1 Value,Variant SKU,Variant Price';
    const base = parseCsv(`${header}\ntee,Shirt,Color,Black,SKU-1,10.00`);
    const prop = parseCsv(`${header}\ntee,Shirt,Color,Black ,SKU-1,10.00`);
    const bp = buildCatalog(base);
    const pp = buildCatalog(prop);
    const pairs = pairVariants(bp.products.get('tee')!.variants, pp.products.get('tee')!.variants);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].matchedBy).toBe('option-key');
  });

  it('does not report a column as dropped when both files lack it', () => {
    const header = 'Handle,Title,Variant Price';
    const a = `${header}\ntee,Shirt,10`;
    const b = `${header}\ntee,Shirt,11`;
    const r = run(a, b);
    expect(r.risks.filter((x) => x.ruleId === 'VG-PRD-006')).toHaveLength(0);
  });
});

describe('variant pairing', () => {
  const header = 'Handle,Title,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Variant SKU,Variant Price';

  it('matches by option key first', () => {
    const bp = buildCatalog(parseCsv(`${header}\ntee,T,Color,Black,Size,S,SKU-1,10`));
    const pp = buildCatalog(parseCsv(`${header}\ntee,T,Color,Black,Size,S,SKU-1,10`));
    const pairs = pairVariants(bp.products.get('tee')!.variants, pp.products.get('tee')!.variants);
    expect(pairs[0].matchedBy).toBe('option-key');
  });

  it('falls back to SKU when an option value is renamed', () => {
    const bp = buildCatalog(parseCsv(`${header}\ntee,T,Color,Black,Size,S,SKU-1,10`));
    const pp = buildCatalog(parseCsv(`${header}\ntee,T,Color,Jet,Size,S,SKU-1,10`));
    const pairs = pairVariants(bp.products.get('tee')!.variants, pp.products.get('tee')!.variants);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].matchedBy).toBe('sku');
    expect(pairs[0].base).toBeDefined();
    expect(pairs[0].prop).toBeDefined();
  });

  it('falls back to ordinal when the variant count is unchanged', () => {
    const bp = buildCatalog(parseCsv(`${header}\ntee,T,Color,Black,Size,S,SKU-1,10\ntee,,Color,White,Size,S,SKU-2,10`));
    const pp = buildCatalog(parseCsv(`${header}\ntee,T,Color,Onyx,Size,S,SKU-9,10\ntee,,Color,Ivory,Size,S,SKU-8,10`));
    const pairs = pairVariants(bp.products.get('tee')!.variants, pp.products.get('tee')!.variants);
    expect(pairs).toHaveLength(2);
    expect(pairs.every((p) => p.matchedBy === 'ordinal')).toBe(true);
  });

  it('reports an unmatched baseline variant as removed', () => {
    const bp = buildCatalog(parseCsv(`${header}\ntee,T,Color,Black,Size,S,SKU-1,10\ntee,,Color,White,Size,S,SKU-2,10`));
    const pp = buildCatalog(parseCsv(`${header}\ntee,T,Color,Black,Size,S,SKU-1,10`));
    const pairs = pairVariants(bp.products.get('tee')!.variants, pp.products.get('tee')!.variants);
    expect(pairs.filter((p) => p.matchedBy === 'none' && p.base)).toHaveLength(1);
    expect(pairs.filter((p) => p.matchedBy === 'none' && p.prop)).toHaveLength(0);
  });
});

describe('row classification', () => {
  it('does not use the Type column to classify rows', () => {
    // "Type" is a free-text category label in Shopify, not a row discriminator.
    const header = 'Handle,Title,Type,Option1 Name,Option1 Value,Variant Price';
    const cat = buildCatalog(parseCsv(`${header}\ntee,Shirt,Cooling sheets,Color,Black,10`));
    expect(cat.products.get('tee')!.variants).toHaveLength(1);
  });

  it('treats a row with an image but no option value as an image row', () => {
    const header = 'Handle,Title,Image Src,Image Position';
    const cat = buildCatalog(parseCsv(`${header}\ntee,Shirt,https://x/a.jpg,1\ntee,,https://x/b.jpg,2`));
    expect(cat.products.get('tee')!.images).toHaveLength(2);
    expect(cat.products.get('tee')!.variants).toHaveLength(0);
  });

  it('collects rows with no handle separately', () => {
    const header = 'Handle,Title,Variant Price';
    const cat = buildCatalog(parseCsv(`${header}\n,Orphan,10\ntee,Shirt,10`));
    expect(cat.headerlessRows).toHaveLength(1);
    expect(cat.products.size).toBe(1);
  });

  it('tells the user which file and line were skipped when a content row has no Handle', () => {
    const header = 'Handle,Title,Variant Price';
    const result = run(
      `${header}\ntee,Shirt,10\n`,
      `${header}\ntee,Shirt,10\n,Orphan title,12\n,,\n`,
    );
    const skipped = result.risks.filter((r) => r.ruleId === 'VG-FMT-005');
    expect(skipped).toHaveLength(1);
    expect(skipped[0].severity).toBe('medium');
    expect(skipped[0].meta).toMatchObject({ file: 'proposed', line: 3 });
    expect(skipped[0].proposed?.location?.line).toBe(3);
    expect(skipped[0].detail).toContain('proposed');
    expect(skipped[0].detail).toContain('line 3');
    expect(result.summary.isClean).toBe(false);
  });

  it('does not flag a completely blank row as an unanalysed content row', () => {
    const header = 'Handle,Title,Variant Price';
    const result = run(`${header}\ntee,Shirt,10\n,,\n`, `${header}\ntee,Shirt,10\n`);
    expect(result.risks.filter((r) => r.ruleId === 'VG-FMT-005')).toHaveLength(0);
  });
});

describe('header aliases stay consistent from lookup to the catalog', () => {
  it('keeps URL and redirect on its own field, not on Handle', () => {
    expect(lookupField('Handle')?.key).toBe('handle');
    expect(lookupField('URL and redirect')?.key).toBe('urlAndRedirect');
    const cat = buildCatalog(parseCsv('URL and redirect,Title\n/old,/new\n'));
    expect(cat.knownFields.get('URL and redirect')?.key).toBe('urlAndRedirect');
    expect(cat.headerlessRows.length + cat.products.size).toBeGreaterThan(0);
  });

  it('does not treat the prose name URL handle as a Handle header', () => {
    // Shopify help text says "URL handle". The header cell this build recognises
    // is Handle. Whether a live export uses the prose name is unverified here.
    expect(lookupField('URL handle')).toBeUndefined();
    const cat = buildCatalog(parseCsv('URL handle,Title\ntee,Shirt\n'));
    expect(cat.products.size).toBe(0);
    expect(cat.unknownColumns).toContain('URL handle');
  });

  it('recognises a lowercase Handle header and folds option-value case when matching', () => {
    const header = 'handle,Title,Option1 Name,Option1 Value,Variant SKU';
    const cat = buildCatalog(parseCsv(`${header}\ntee,Shirt,Color,Black,SKU-1`));
    expect(cat.knownFields.get('handle')?.key).toBe('handle');
    expect(columnIndex(cat.headerIndex, 'Handle')).toBe(0);
    expect(cat.products.has('tee')).toBe(true);
    const aliased = buildCatalog(parseCsv('Handle,Title,Image Src (URL)\ntee,Shirt,https://x/a.jpg'));
    expect(columnIndex(aliased.headerIndex, 'Image Src')).toBe(2);
    expect(aliased.products.get('tee')?.images).toHaveLength(1);
    const canonical = 'Handle,Title,Option1 Name,Option1 Value,Variant SKU';
    const result = run(
      `${canonical}\ntee,Shirt,Color,Black,SKU-1`,
      `${canonical}\ntee,Shirt,Color,black,SKU-1`,
    );
    // Case-only option changes are folded by normaliseOptionValue, so the
    // option-change rule does not fire. Shopify's own case sensitivity is not
    // documented; this is a recorded limitation, not a claim about the platform.
    expect(result.risks.some((r) => r.ruleId === 'VG-VAR-002')).toBe(false);
  });
});

describe('performance on a large catalogue', () => {
  it('analyses 5k products / 15k variants in reasonable time', () => {
    const header =
      'Handle,Title,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Variant SKU,Variant Price,On hand';
    const base: string[] = [header];
    const prop: string[] = [header];
    for (let p = 0; p < 5000; p++) {
      for (let v = 0; v < 3; v++) {
        const h = `product-${p}`;
        const sku = `SKU-${p}-${v}`;
        // Shopify repeats the full option combination on every variant row.
        const cells = [
          h,
          v === 0 ? `Product ${p}` : '',
          v === 0 ? 'Color' : '',
          'Black',
          v === 0 ? 'Size' : '',
          `S${v}`,
          sku,
          v === 0 ? '12.00' : '10.00',
          '5',
        ];
        base.push([...cells.slice(0, 7), '10.00', '5'].join(','));
        prop.push(cells.join(','));
      }
    }
    const started = Date.now();
    const r = run(base.join('\n'), prop.join('\n'));
    const elapsed = Date.now() - started;
    expect(r.summary.baselineProducts).toBe(5000);
    expect(r.summary.baselineVariants).toBe(15000);
    expect(r.summary.severityCounts.high).toBe(0);
    expect(elapsed).toBeLessThan(10000);
  });

  it('handles a file with only a header', () => {
    const r = run('Handle,Title', 'Handle,Title');
    expect(r.summary.baselineProducts).toBe(0);
    expect(r.risks.some((x) => x.ruleId.startsWith('VG-FMT-PARSE'))).toBe(true);
  });

  it('does not throw when the proposed file is empty', () => {
    const s = scenarioById('clean')!;
    const r = run(s.baselineCsv, '');
    expect(r.risks.length).toBeGreaterThan(0);
  });
});
