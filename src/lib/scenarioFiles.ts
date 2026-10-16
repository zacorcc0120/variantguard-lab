import type { Scenario } from './samples';
import { createZip, type Bytes } from './report/zip';

/**
 * The one definition of what a sample-scenario download contains.
 *
 * The UI and tests/roundtrip.test.ts both import this module on purpose: the
 * requirement is that re-importing a downloaded file reproduces the built-in
 * scenario exactly, and the only way to keep that true over time is for the
 * bytes under test to be the same bytes the button ships — not a second
 * re-implementation of them.
 */

export const CSV_MIME = 'text/csv';
export const ZIP_MIME = 'application/zip';

/** Prefix keeps downloaded files identifiable once they leave the app. */
const FILENAME_PREFIX = 'variantguard-';

const encoder = new TextEncoder();

export interface ScenarioFileNames {
  readonly baseline: string;
  readonly proposed: string;
}

/**
 * Names are prefixed with the scenario id so that downloading `baseline.csv`
 * from three scenarios does not silently overwrite the previous two in a
 * Downloads folder. The slots keep the baseline/proposed names the UI shows,
 * so the download panel and the upload panel still read as the same two files.
 */
export function scenarioFileNames(scenario: Scenario): ScenarioFileNames {
  return {
    baseline: `${FILENAME_PREFIX}${scenario.id}-baseline.csv`,
    proposed: `${FILENAME_PREFIX}${scenario.id}-proposed.csv`,
  };
}

export function scenarioZipName(scenario: Scenario): string {
  return `${FILENAME_PREFIX}${scenario.id}.zip`;
}

/**
 * The exact bytes a download writes: the fixture string encoded as UTF-8.
 *
 * No BOM, no newline rewriting, no round-trip through a parser. Anything that
 * reformatted here would make the downloaded file differ from the built-in
 * scenario on re-import, and re-import fidelity is the whole point.
 */
export function scenarioFileBytes(csv: string): Bytes {
  return encoder.encode(csv);
}

export interface ScenarioDownload {
  readonly filename: string;
  readonly bytes: Bytes;
}

/** A single scenario file, ready for `downloadBytes`. */
export function scenarioFile(scenario: Scenario, slot: 'baseline' | 'proposed'): ScenarioDownload {
  const names = scenarioFileNames(scenario);
  return {
    filename: names[slot],
    bytes: scenarioFileBytes(slot === 'baseline' ? scenario.baselineCsv : scenario.proposedCsv),
  };
}

/**
 * Both files of a scenario as one archive, ready for `downloadBytes`.
 *
 * The member names match the single-file downloads exactly, so the pair and
 * the individual files are byte-identical in content and differ only in how
 * they are packaged.
 */
export function scenarioArchive(scenario: Scenario): ScenarioDownload {
  const files = (['baseline', 'proposed'] as const).map((slot) => scenarioFile(scenario, slot));
  return {
    filename: scenarioZipName(scenario),
    bytes: createZip(files.map((f) => ({ name: f.filename, bytes: f.bytes }))),
  };
}
