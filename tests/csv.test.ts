import { describe, expect, it } from 'vitest';
import { parseCsv, countLineBreaks, detectMojibake, decodeBytes } from '@/lib/csv/parseCsv';
import { cell, renderShort } from '@/lib/csv/cell';

describe('cell semantics', () => {
  it('distinguishes absent, empty and value', () => {
    expect(cell(undefined).kind).toBe('absent');
    expect(cell(null).kind).toBe('absent');
    expect(cell('').kind).toBe('empty');
    expect(cell('x').kind).toBe('value');
  });

  it('treats whitespace as a real value, not as empty', () => {
    // This is the semantic the whole tool depends on: a padded cell is a
    // different string from an empty one, and both differ from a missing column.
    expect(cell(' ').kind).toBe('value');
    expect(cell(' ').kind).not.toBe(cell('').kind);
  });

  it('renders the three states distinguishably for reports', () => {
    // "(empty)" and "—" mean opposite things to a merchant:
    // one clears a stored value, the other does not touch it.
    expect(renderShort(cell(undefined))).toBe('—');
    expect(renderShort(cell(''))).toBe('(empty)');
    expect(renderShort(cell('v'))).toBe('v');
  });
});

describe('countLineBreaks', () => {
  it('counts CRLF as one break', () => {
    expect(countLineBreaks('a\r\nb')).toBe(1);
  });
  it('counts bare CR and LF separately', () => {
    expect(countLineBreaks('a\rb')).toBe(1);
    expect(countLineBreaks('a\nb\nc')).toBe(2);
  });
  it('handles unicode line separators', () => {
    expect(countLineBreaks('a\u2028b')).toBe(1);
  });
});

describe('encoding detection', () => {
  it('strips a UTF-8 BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x69]); // BOM + "Hi"
    const { text, info } = decodeBytes(bytes.buffer);
    expect(text).toBe('Hi');
    expect(info.detected).toBe('utf-8-bom');
  });

  it('decodes UTF-16LE', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x48, 0x00, 0x69, 0x00]);
    const { text, info } = decodeBytes(bytes.buffer);
    expect(text).toBe('Hi');
    expect(info.detected).toBe('utf-16le');
  });

  it('flags latin-1 text decoded as utf-8 as mojibake', () => {
    // "Caf\xe9" saved as latin-1 then read as utf-8 -> replacement / mangled.
    expect(detectMojibake('Caf\u00e9 cream \u00e0 la mode')).toBe(false);
    expect(detectMojibake('Caf\u00c3\u00a9 cream \u00c3\u00a0 la mode')).toBe(true);
  });

  it('does not flag a plain ascii file as mojibake', () => {
    expect(detectMojibake('Handle,Title\ntee,Classic Tee')).toBe(false);
  });

  it('does not flag a legitimate non-ascii product title as mojibake', () => {
    expect(detectMojibake('Tee,Caf\u00e9 Cr\u00e8me,Cr\u00e8me Br\u00fbl\u00e9e')).toBe(false);
  });
});

describe('parseCsv structure', () => {
  it('parses quoted commas', () => {
    const p = parseCsv('Handle,Title\ntee,"Hello, world"');
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0].cells[1]).toBe('Hello, world');
  });

  it('parses escaped double quotes', () => {
    const p = parseCsv('Handle,Title\ntee,"He said ""hi"""');
    expect(p.rows[0].cells[1]).toBe('He said "hi"');
  });

  it('keeps a quoted newline inside a single record', () => {
    const p = parseCsv('Handle,Title\ntee,"line1\nline2"');
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0].cells[1]).toBe('line1\nline2');
    expect(p.rows[0].lineSpan).toBe(2);
  });

  it('reports the exact physical line of a record containing a newline', () => {
    // header(1), row1 spans 2 lines (2-3), row2 starts at 4
    const p = parseCsv('Handle,Title\ntee,"a\nb"\nsock,"c"');
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0].line).toBe(2);
    expect(p.rows[0].lineSpan).toBe(2);
    expect(p.rows[1].line).toBe(4);
    expect(p.rows[1].lineSpan).toBe(1);
  });

  it('tracks physical lines across several multi-line records', () => {
    const p = parseCsv('Handle,Title\ntee,"a\nb"\nsock,"c\nd\ne"\nhat,"f"');
    expect(p.rows.map((r) => r.line)).toEqual([2, 4, 7]);
    expect(p.rows.map((r) => r.lineSpan)).toEqual([2, 3, 1]);
  });

  it('detects duplicate headers without dropping a column', () => {
    const p = parseCsv('Handle,Title,Title\ntee,A,B');
    expect(p.headers).toEqual(['Handle', 'Title', 'Title (col 3)']);
    expect(p.findings.some((f) => f.code === 'DUPLICATE_HEADER')).toBe(true);
    // both columns remain readable
    expect(p.rows[0].cells[1]).toBe('A');
    expect(p.rows[0].cells[2]).toBe('B');
  });

  it('reports ragged rows with extra cells', () => {
    const p = parseCsv('Handle,Title\ntee,Shirt,extra');
    const f = p.findings.find((x) => x.code === 'RAGGED_ROW_EXTRA_CELLS');
    expect(f).toBeDefined();
    expect(f!.line).toBe(2);
  });

  it('treats missing trailing cells as absent, not empty', () => {
    const p = parseCsv('Handle,Title,On hand\ntee,Shirt');
    const parsed = parseCsv(p.rows.length ? 'Handle,Title,On hand\ntee,Shirt' : '');
    expect(parsed.rows[0].cells[2]).toBeUndefined();
    expect(cell(parsed.rows[0].cells[2]).kind).toBe('absent');
  });

  it('flags a file without a Handle column', () => {
    const p = parseCsv('Name,Title\ntee,Shirt');
    expect(p.findings.some((f) => f.code === 'NO_HANDLE_COLUMN')).toBe(true);
  });

  it('flags an empty file', () => {
    const p = parseCsv('');
    expect(p.findings.some((f) => f.code === 'EMPTY_FILE')).toBe(true);
    expect(p.rows).toHaveLength(0);
  });

  it('flags a header with no data rows', () => {
    const p = parseCsv('Handle,Title\n');
    expect(p.findings.some((f) => f.code === 'NO_DATA_ROWS')).toBe(true);
  });

  it('ignores interior blank lines without shifting later line numbers', () => {
    const p = parseCsv('Handle,Title\ntee,Shirt\n\nsock,Sock');
    expect(p.rows).toHaveLength(2);
    expect(p.rows[1].line).toBe(4);
  });

  it('handles a CRLF file', () => {
    const p = parseCsv('Handle,Title\r\ntee,Shirt\r\nsock,Sock');
    expect(p.rows).toHaveLength(2);
    expect(p.rows[0].cells[1]).toBe('Shirt');
    expect(p.rows[1].cells[1]).toBe('Sock');
  });

  it('parses a 20k-row file', () => {
    const lines = ['Handle,Title,Variant SKU'];
    for (let i = 0; i < 20000; i++) {
      lines.push(`p-${i},Product ${i},SKU-${i}`);
    }
    const p = parseCsv(lines.join('\n'));
    expect(p.rows).toHaveLength(20000);
    expect(p.rows[19999].cells[0]).toBe('p-19999');
    expect(p.rows[19999].line).toBe(20001);
  });
});
