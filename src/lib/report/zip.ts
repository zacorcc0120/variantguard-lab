/**
 * Minimal ZIP writer — STORE method only, no dependencies.
 *
 * Why hand-rolled rather than a library: the only thing this app ever archives
 * is two short CSV fixtures. A deflate implementation would be roughly ten
 * times the code and one more supply-chain dependency in a tool whose entire
 * pitch is "your files are read here and nothing else". CSV text barely
 * compresses anyway, so STORE costs a few kB per download and nothing else.
 *
 * Why STORE rather than two separate downloads: browsers routinely block or
 * silently drop the second automatic download in a single click handler, and
 * "I got one of the two files" is a support problem, not a download problem.
 *
 * The output is byte-for-byte reproducible — see DOS_TIME/DOS_DATE — which is
 * what lets tests/roundtrip.test.ts assert equality rather than "close
 * enough".
 */

/**
 * Bytes backed by a plain ArrayBuffer.
 *
 * Distinct from `Uint8Array` on purpose: since TS 5.7 a bare `Uint8Array` may be
 * backed by a SharedArrayBuffer, and `Blob` rejects that. Everything this module
 * produces comes from `new Uint8Array(...)` or `TextEncoder`, so it is always a
 * real ArrayBuffer — the narrower type states that instead of leaving callers to
 * discover it through a type error at the `new Blob(...)` call site.
 */
export type Bytes = Uint8Array<ArrayBuffer>;

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

/** General purpose bit 11: file names are UTF-8. */
const FLAG_UTF8_NAMES = 0x0800;

/** Method 0 = stored. */
const METHOD_STORE = 0;

/** Spec version 1.0, which is all STORE with no zip64 needs. */
const VERSION_STORE = 10;
/** "Version made by": MS-DOS host (0) with spec version 1.0. */
const VERSION_MADE_BY = 0x0014;

/**
 * Fixed timestamp of 1980-01-01 00:00:00 — the earliest value the DOS date
 * format can express, and the ZIP epoch.
 *
 * Deliberately not `Date.now()`: these archives are built from static
 * fixtures, so identical input must produce identical output. A real-time
 * stamp would make every download of the same scenario differ, which defeats
 * the byte comparison the round-trip test relies on, and would tell the user
 * a generation time that has nothing to do with their data.
 */
const DOS_TIME = 0; // 00:00:00
const DOS_DATE = (1 << 5) | 1; // month 1, day 1, year 1980 - 1980 = 0

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIR_SIZE = 22;

const CRC_POLYNOMIAL_REFLECTED = 0xedb88320;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let bit = 0; bit < 8; bit++) {
      c = (c & 1) !== 0 ? CRC_POLYNOMIAL_REFLECTED ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 as used by ZIP (IEEE 802.3, reflected). Returns an unsigned 32-bit int. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Entry name. Stored as UTF-8; keep it to a relative path, no leading slash. */
  readonly name: string;
  readonly bytes: Bytes;
}

export interface ZipLimits {
  readonly maxEntries: number;
  readonly maxBytesPerEntry: number;
}

export const ZIP32_LIMITS: ZipLimits = {
  // The entry count and central-directory size are 16-bit in the end record.
  maxEntries: 0xffff,
  maxBytesPerEntry: 0xffffffff,
};

/**
 * Builds a ZIP archive containing `entries`, stored uncompressed.
 *
 * Rejects inputs that would silently produce a corrupt archive rather than
 * truncating: a duplicate name would make most extractors keep only the first
 * copy, and overflowing the 16-bit entry count would corrupt the central
 * directory. Neither can happen with two fixture files, but "cannot happen"
 * is not a reason to emit a broken archive.
 */
export function createZip(entries: readonly ZipEntry[]): Bytes {
  if (entries.length > ZIP32_LIMITS.maxEntries) {
    throw new Error(
      `ZIP holds at most ${ZIP32_LIMITS.maxEntries} entries without zip64; got ${entries.length}.`,
    );
  }
  const encoder = new TextEncoder();
  const names = entries.map((e) => encoder.encode(e.name));

  const seen = new Set<string>();
  for (const entry of entries) {
    if (entry.bytes.length > ZIP32_LIMITS.maxBytesPerEntry) {
      throw new Error(`ZIP entry "${entry.name}" exceeds the 4 GB single-entry limit.`);
    }
    if (entry.name.includes('\\') || entry.name.startsWith('/')) {
      throw new Error(`ZIP entry "${entry.name}" must be a relative path with forward slashes.`);
    }
    if (seen.has(entry.name)) {
      throw new Error(`ZIP entry "${entry.name}" is listed twice; extraction would be ambiguous.`);
    }
    seen.add(entry.name);
  }

  const localSize = entries.reduce(
    (n, e, i) => n + LOCAL_HEADER_SIZE + names[i].length + e.bytes.length,
    0,
  );
  const centralSize = entries.reduce((n, _e, i) => n + CENTRAL_HEADER_SIZE + names[i].length, 0);

  const out = new Uint8Array(localSize + centralSize + END_OF_CENTRAL_DIR_SIZE);
  const view = new DataView(out.buffer);
  let offset = 0;

  // ---- local file headers, each immediately followed by its data -------
  entries.forEach((entry, i) => {
    const name = names[i];
    view.setUint32(offset, LOCAL_HEADER_SIG, true);
    view.setUint16(offset + 4, VERSION_STORE, true);
    view.setUint16(offset + 6, FLAG_UTF8_NAMES, true);
    view.setUint16(offset + 8, METHOD_STORE, true);
    view.setUint16(offset + 10, DOS_TIME, true);
    view.setUint16(offset + 12, DOS_DATE, true);
    view.setUint32(offset + 14, crc32(entry.bytes), true);
    view.setUint32(offset + 18, entry.bytes.length, true); // compressed
    view.setUint32(offset + 22, entry.bytes.length, true); // uncompressed
    view.setUint16(offset + 26, name.length, true);
    view.setUint16(offset + 28, 0, true); // extra field length
    offset += LOCAL_HEADER_SIZE;
    out.set(name, offset);
    offset += name.length;
    out.set(entry.bytes, offset);
    offset += entry.bytes.length;
  });

  // ---- central directory ----------------------------------------------
  const centralStart = offset;
  let localOffset = 0;
  entries.forEach((entry, i) => {
    const name = names[i];
    view.setUint32(offset, CENTRAL_HEADER_SIG, true);
    view.setUint16(offset + 4, VERSION_MADE_BY, true);
    view.setUint16(offset + 6, VERSION_STORE, true);
    view.setUint16(offset + 8, FLAG_UTF8_NAMES, true);
    view.setUint16(offset + 10, METHOD_STORE, true);
    view.setUint16(offset + 12, DOS_TIME, true);
    view.setUint16(offset + 14, DOS_DATE, true);
    view.setUint32(offset + 16, crc32(entry.bytes), true);
    view.setUint32(offset + 20, entry.bytes.length, true);
    view.setUint32(offset + 24, entry.bytes.length, true);
    view.setUint16(offset + 28, name.length, true);
    view.setUint16(offset + 30, 0, true); // extra field length
    view.setUint16(offset + 32, 0, true); // file comment length
    view.setUint16(offset + 34, 0, true); // disk number start
    view.setUint16(offset + 36, 0, true); // internal file attributes
    view.setUint32(offset + 38, 0, true); // external file attributes
    view.setUint32(offset + 42, localOffset, true);
    offset += CENTRAL_HEADER_SIZE;
    out.set(name, offset);
    offset += name.length;

    localOffset += LOCAL_HEADER_SIZE + name.length + entry.bytes.length;
  });

  // ---- end of central directory record ---------------------------------
  view.setUint32(offset, END_OF_CENTRAL_DIR_SIG, true);
  view.setUint16(offset + 4, 0, true); // this disk
  view.setUint16(offset + 6, 0, true); // disk holding the central directory
  view.setUint16(offset + 8, entries.length, true);
  view.setUint16(offset + 10, entries.length, true);
  view.setUint32(offset + 12, offset - centralStart, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true); // archive comment length

  // Every byte should have been consumed. If the size arithmetic above ever
  // drifts from the writes, the archive is malformed and silent — a hard
  // failure here is far cheaper to diagnose than a broken download.
  if (offset + END_OF_CENTRAL_DIR_SIZE !== out.length) {
    throw new Error(
      `ZIP size mismatch: wrote ${offset + END_OF_CENTRAL_DIR_SIZE} of ${out.length} bytes.`,
    );
  }

  return out;
}
