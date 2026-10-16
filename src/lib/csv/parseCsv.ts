import Papa from 'papaparse';

export interface FormatFinding {
  readonly code: FormatCode;
  readonly severity: 'high' | 'medium' | 'low';
  readonly message: string;
  /** 1-based physical line, when the finding is anchored. */
  readonly line?: number;
  readonly detail?: string;
  /**
   * Raw values that produced `message`, so another language can render the
   * same sentence. The English `message` above is still built by
   * interpolation and is unaffected by this.
   */
  readonly params?: Readonly<Record<string, string | number>>;
}

export type FormatCode =
  | 'EMPTY_FILE'
  | 'NO_HEADER'
  | 'NO_DATA_ROWS'
  | 'DUPLICATE_HEADER'
  | 'RAGGED_ROW_EXTRA_CELLS'
  | 'RAGGED_ROW_MISSING_CELLS'
  | 'BOM_UTF8'
  | 'ENCODING_UTF16'
  | 'ENCODING_MOJIBAKE'
  | 'UNUSUAL_FIELD_COUNT'
  | 'NO_HANDLE_COLUMN';

export interface ParsedRow {
  /** Zero-based index among data records (header excluded). */
  readonly recordIndex: number;
  /** 1-based physical line in the decoded file where this record starts. */
  readonly line: number;
  /** How many physical lines this record spans. >1 when a cell held a newline. */
  readonly lineSpan: number;
  readonly cells: readonly string[];
}

export interface ParsedCsv {
  readonly headers: readonly string[];
  /** header index -> column index. Duplicate headers get suffixed names. */
  readonly headerIndex: ReadonlyMap<string, number>;
  readonly rows: readonly ParsedRow[];
  readonly findings: readonly FormatFinding[];
  readonly encoding: EncodingInfo;
  /** Total bytes of the source file before decoding. */
  readonly byteLength: number;
}

export interface EncodingInfo {
  readonly detected: 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'unknown-8bit';
  readonly transcoded: boolean;
}

/**
 * Counts physical line breaks inside a record's raw cells.
 * Matches CRLF as ONE break so a quoted cell containing "a\r\nb" correctly
 * counts as spanning 2 physical lines, not 3.
 */
export function countLineBreaks(text: string): number {
  const re = /\r\n|\r|\n|\u0085|\u2028|\u2029/g;
  let n = 0;
  while (re.exec(text) !== null) n++;
  return n;
}

/**
 * Decodes raw bytes, detecting the encodings that actually break Shopify
 * merchants in practice: Excel's UTF-8 BOM, UTF-16 (Windows "Unicode Text"),
 * and files saved as CP1252/Latin-1 that decode as UTF-8 mojibake.
 *
 * Encoding matters here for a specific reason: a mojibake'd handle is not the
 * same string as the handle in the store, so EVERY comparison silently fails
 * and the user sees "no changes" when in fact the import would create new
 * products. Reporting that is more valuable than any single field diff.
 */
export function decodeBytes(buf: ArrayBuffer): { text: string; info: EncodingInfo } {
  const bytes = new Uint8Array(buf);

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return {
      text: new TextDecoder('utf-16le').decode(bytes.subarray(2)),
      info: { detected: 'utf-16le', transcoded: true },
    };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return {
      text: new TextDecoder('utf-16be').decode(bytes.subarray(2)),
      info: { detected: 'utf-16be', transcoded: true },
    };
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return {
      text: new TextDecoder('utf-8').decode(bytes.subarray(3)),
      info: { detected: 'utf-8-bom', transcoded: false },
    };
  }
  return {
    text: new TextDecoder('utf-8').decode(bytes),
    info: { detected: 'utf-8', transcoded: false },
  };
}

/**
 * Heuristic mojibake check. A single non-ASCII char is normal (a French
 * product title). Mojibake shows up as Latin-1 letters adjacent to symbols in
 * the U+0080-U+00BF block, which no legitimate product data uses at that rate.
 */
export function detectMojibake(text: string): boolean {
  const sample = text.slice(0, 200000);
  let hits = 0;
  const re = /[ÂÃÅåæçèéêëì][\u0080-¿]|\uFFFD/g;
  while (re.exec(sample) !== null) hits++;
  const nonAscii = (sample.match(/[^\x00-\x7F]/g) ?? []).length;
  if (nonAscii === 0) return false;
  return hits >= 2 || hits / Math.max(1, nonAscii) > 0.05;
}

export interface ParseOptions {
  readonly label?: string;
}

/**
 * Parses CSV text into a structural grid.
 *
 * Header handling is done here rather than by PapaParse because we need three
 * things it does not give us together: duplicate-header detection, ragged-row
 * reporting, and exact physical line numbers for records that contain quoted
 * newlines (record index != physical line in that case, and merchants paste
 * both into tickets).
 */
export function parseCsv(input: string, options: ParseOptions = {}): ParsedCsv {
  const findings: FormatFinding[] = [];
  const label = options.label ?? 'file';

  if (input.length === 0 || input.trim().length === 0) {
    findings.push({
      code: 'EMPTY_FILE',
      severity: 'high',
      message: `${label} is empty. Nothing to compare.`,
      params: { label },
    });
    return {
      headers: [],
      headerIndex: new Map(),
      rows: [],
      findings,
      encoding: { detected: 'utf-8', transcoded: false },
      byteLength: 0,
    };
  }

  // Parsed as raw string arrays on purpose: we do our own header handling so
  // that duplicate headers, ragged rows and per-record physical line numbers
  // are all observable. PapaParse's `header: true` mode hides the raw record.
  const result = Papa.parse<string[]>(input, {
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
  }) as Papa.ParseResult<string[]>;

  const records = (result.data ?? []) as string[][];
  if (records.length === 0) {
    findings.push({
      code: 'NO_HEADER',
      severity: 'high',
      message: `${label} could not be split into any CSV records.`,
      params: { label },
    });
    return {
      headers: [],
      headerIndex: new Map(),
      rows: [],
      findings,
      encoding: { detected: 'utf-8', transcoded: false },
      byteLength: input.length,
    };
  }

  // ---- header row -------------------------------------------------------
  const rawHeader = records[0] ?? [];
  // A BOM survives decodeBytes for text input that was not byte-decoded.
  const firstRaw = rawHeader[0];
  if (firstRaw && firstRaw.charCodeAt(0) === 0xfeff) {
    rawHeader[0] = firstRaw.slice(1);
  }

  const headers: string[] = [];
  const headerIndex = new Map<string, number>();
  const seen = new Map<string, number>();

  rawHeader.forEach((h, i) => {
    const name = (h ?? '').trim();
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) {
      // Keep both columns addressable instead of silently dropping one.
      const unique = `${name} (col ${i + 1})`;
      headers.push(unique);
      headerIndex.set(unique, i);
      findings.push({
        code: 'DUPLICATE_HEADER',
        severity: 'medium',
        message: `Header "${name}" appears ${count + 1} times (columns ${(headers.indexOf(name) + 1)} and ${i + 1}). Only the first is compared.`,
        params: {
          name,
          count: count + 1,
          firstColumn: headers.indexOf(name) + 1,
          secondColumn: i + 1,
        },
        line: 1,
      });
      return;
    }
    headers.push(name);
    headerIndex.set(name, i);
  });

  const nonEmptyHeaders = headers.filter((h) => h.length > 0);
  if (nonEmptyHeaders.length === 0) {
    findings.push({
      code: 'NO_HEADER',
      severity: 'high',
      message: `${label} has a blank first row. A header row is required.`,
      params: { label },
      line: 1,
    });
  } else if (nonEmptyHeaders.length < 3) {
    findings.push({
      code: 'UNUSUAL_FIELD_COUNT',
      severity: 'medium',
      message: `${label} has only ${nonEmptyHeaders.length} column(s). A Shopify product CSV normally has far more.`,
      params: { label, count: nonEmptyHeaders.length, columnCount: nonEmptyHeaders.length },
      line: 1,
    });
  }

  if (!headers.some((h) => h.toLowerCase() === 'handle')) {
    findings.push({
      code: 'NO_HANDLE_COLUMN',
      severity: 'high',
      message: `${label} has no "Handle" column. Every comparison in this tool keys off Handle, so results would be meaningless.`,
      params: { label },
      line: 1,
    });
  }

  // ---- physical line accounting ----------------------------------------
  // Exact because records are separated by a single newline and we count the
  // newlines embedded inside each record's own cells.
  // The header record occupies physical lines 1..(1 + headerBreaks), so the
  // first data record starts at 2 + headerBreaks.
  const headerBreaks = rawHeader.reduce((n, c) => n + countLineBreaks(c ?? ''), 0);
  let line = 2 + headerBreaks;

  const rows: ParsedRow[] = [];
  let recordIndex = 0;
  let reportedExtra = 0;
  let reportedMissing = 0;
  let maxCells = headers.length;

  for (let r = 1; r < records.length; r++) {
    const rec = records[r] ?? [];
    const breaksInRecord = rec.reduce((n, c) => n + countLineBreaks(c ?? ''), 0);
    const startLine = line;

    const isBlankRecord = rec.every((c) => (c ?? '').length === 0);
    if (!isBlankRecord) {
      maxCells = Math.max(maxCells, rec.length);
      if (rec.length > headers.length) {
        if (reportedExtra < 3) {
          findings.push({
            code: 'RAGGED_ROW_EXTRA_CELLS',
            severity: 'medium',
            message: `Row at line ${startLine} has ${rec.length} cells but the header has ${headers.length}. Extra cells are ignored.`,
            params: {
              startLine,
              cellCount: rec.length,
              headerCount: headers.length,
            },
            line: startLine,
            detail: 'Usually means an unescaped comma in an unquoted field.',
          });
        }
        reportedExtra++;
      } else if (rec.length < headers.length) {
        if (reportedMissing < 3) {
          findings.push({
            code: 'RAGGED_ROW_MISSING_CELLS',
            severity: 'low',
            message: `Row at line ${startLine} has ${rec.length} cells but the header has ${headers.length}. Missing trailing cells are read as absent, not empty.`,
            params: {
              startLine,
              cellCount: rec.length,
              headerCount: headers.length,
            },
            line: startLine,
            detail: 'A short row does NOT clear the missing columns; an absent trailing cell is read as ABSENT.',
          });
        }
        reportedMissing++;
      }
      rows.push({
        recordIndex,
        line: startLine,
        lineSpan: breaksInRecord + 1,
        cells: rec,
      });
      recordIndex++;
    }

    line += breaksInRecord + 1;
  }

  if (reportedExtra > 3 || reportedMissing > 3) {
    findings.push({
      code: 'RAGGED_ROW_EXTRA_CELLS',
      severity: 'low',
      message: `${reportedExtra + reportedMissing} ragged row(s) in total. Only the first few are listed.`,
      params: { count: reportedExtra + reportedMissing },
    });
  }

  if (rows.length === 0) {
    findings.push({
      code: 'NO_DATA_ROWS',
      severity: 'high',
      message: `${label} has a header but no data rows.`,
      params: { label },
    });
  }

  return {
    headers,
    headerIndex,
    rows,
    findings,
    encoding: { detected: 'utf-8', transcoded: false },
    byteLength: input.length,
  };
}

/** Convenience for callers that hold a File. */
export async function parseCsvFile(file: File, label?: string): Promise<ParsedCsv> {
  const buf = await file.arrayBuffer();
  const { text, info } = decodeBytes(buf);
  const parsed = parseCsv(text, { label });

  const findings: FormatFinding[] = [];
  if (info.detected === 'utf-8-bom') {
    findings.push({
      code: 'BOM_UTF8',
      severity: 'low',
      message: `${label ?? 'file'} starts with a UTF-8 BOM. It was stripped for parsing; the header names compare correctly.`,
      params: { label: label ?? 'file' },
      line: 1,
    });
  } else if (info.detected === 'utf-16le' || info.detected === 'utf-16be') {
    findings.push({
      code: 'ENCODING_UTF16',
      severity: 'medium',
      message: `${label ?? 'file'} is UTF-16 (typical of "Unicode Text" saved by Excel). It was decoded correctly here, but re-save as UTF-8 before uploading to Shopify to avoid mangled product text.`,
      params: { label: label ?? 'file' },
    });
  }
  if (detectMojibake(text)) {
    findings.push({
      code: 'ENCODING_MOJIBAKE',
      severity: 'high',
      message: `${label ?? 'file'} appears to be mis-encoded (UTF-8 bytes read as Latin-1). Product text, handles and SKUs will not match the store, and even a correct diff will read as "everything changed". Re-save the file as UTF-8.`,
      params: { label: label ?? 'file' },
    });
  }

  return {
    ...parsed,
    findings: [...findings, ...parsed.findings],
    encoding: info,
    byteLength: buf.byteLength,
  };
}
