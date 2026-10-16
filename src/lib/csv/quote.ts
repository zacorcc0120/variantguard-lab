/**
 * RFC 4180 field quoting.
 *
 * This lives in its own module rather than in `report/export.ts` because two
 * unrelated callers need it: the report writer, and the demo/test fixture
 * builder. They previously had separate copies of the same three-line
 * function, which is exactly the kind of duplication that lets a report writer
 * and its fixtures disagree about quoting.
 *
 * Deliberately NOT delegated to PapaParse: PapaParse is a *parser*, and it does
 * not expose a quote-only serializer.
 */

/** Quote a single field only when it needs it. */
export function csvEscape(value: string): string {
  if (value === '') return '';
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Join a matrix of fields into CSV text, CRLF-separated per the spec. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}
