/**
 * Titles and shared copy for parse-level findings.
 *
 * Kept apart from the generator because these are not lifted from source: the
 * engine assembles a parse finding's title from its code label, and its
 * rationale is one constant shared by all of them. Both languages live here so
 * the two dictionaries cannot drift apart on the same key set.
 */

export const PARSE_TITLE = {
  EMPTY_FILE: ['file is empty', '文件为空'],
  NO_HEADER: ['header row is missing or unusable', '缺少可用的表头行'],
  NO_DATA_ROWS: ['header but no data rows', '有表头但没有数据行'],
  DUPLICATE_HEADER: ['duplicate column name', '列名重复'],
  RAGGED_ROW_EXTRA_CELLS: ['row has more cells than the header', '该行的单元格数多于表头列数'],
  RAGGED_ROW_MISSING_CELLS: ['row has fewer cells than the header', '该行的单元格数少于表头列数'],
  BOM_UTF8: ['UTF-8 BOM stripped', '已剥离 UTF-8 BOM'],
  ENCODING_UTF16: ['file is UTF-16, not UTF-8', '文件是 UTF-16 编码，不是 UTF-8'],
  ENCODING_MOJIBAKE: ['file looks mis-encoded', '文件疑似编码错误'],
  UNUSUAL_FIELD_COUNT: ['implausibly few columns', '列数明显偏少'],
  NO_HANDLE_COLUMN: ['no Handle column', '缺少 Handle 列'],
} as const satisfies Record<string, readonly [string, string]>;

export const PARSE_RATIONALE = [
  'Detected while parsing the file, before any comparison. A structural problem in the file can make every downstream comparison unreliable.',
  '该问题在解析文件阶段就已发现，早于任何比对。文件本身存在结构问题，会让后续所有比对结果变得不可靠。',
] as const;

export const PARSE_SUGGESTION = [
  'Fix the file before relying on this report.',
  '请先修复文件，再参考本报告的结论。',
] as const;

/**
 * The mojibake case gets its own, stronger advice, matching the English branch
 * in `engine.formatToRisk`.
 */
export const PARSE_SUGGESTION_MOJIBAKE = [
  'Re-save the file as UTF-8 CSV, then upload it again. Do not import a file whose text you have not verified.',
  '请将文件重新另存为 UTF-8 编码的 CSV 后再上传。在确认文件文本无误之前，请勿导入。',
] as const;
