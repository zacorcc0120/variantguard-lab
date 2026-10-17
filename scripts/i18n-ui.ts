/**
 * UI chrome + shared terminology, authored here and merged into the generated
 * src/i18n/en.ts. Kept apart from the generated rule/parse/scenario entries so
 * that regenerating the dictionary never touches hand-written copy.
 *
 * Placeholders are `{name}` and are documented beside each string that has one.
 */

export const UI: Readonly<Record<string, string>> = {
  // ---- shell / header ----
  'app.badge.localOnly': 'Runs entirely in your browser',
  'app.badge.noShopify': 'No Shopify connection · no account · no upload',
  'app.hero':
    'Diff a baseline Shopify product export against the CSV you are about to re-import, and see which rows would lose variants, clear inventory or quietly create a second product. Files are parsed in this tab and never leave your machine.',
  'app.empty': 'Load both files, or pick a sample scenario, to run the check.',
  'app.footer.version': 'v0.1.0 · offline · MIT',
  'app.footer.disclaimer':
    'This tool reports what it believes an overwrite import would change. Those are inferences from Shopify’s published CSV rules and from merchant reports — not observed results from Shopify. Nothing here was sent to Shopify, and no Shopify store was contacted. A report with no findings does not mean an import is safe.',
  // params: {count} {high}
  'app.a11y.summary': '{count} findings, {high} high severity.',
  'app.a11y.dropHint': 'Drop CSVs — first file is the baseline, second is the proposed import',

  // ---- language switcher ----
  'lang.label': 'Language',
  'lang.en': 'English',
  'lang.zhCN': '中文',
  'lang.switchTo': 'Switch to {language}',

  // ---- upload slots ----
  'slot.baseline.title': 'baseline.csv',
  'slot.baseline.hint': "Your store's current export. This is what is in Shopify right now.",
  'slot.proposed.title': 'proposed.csv',
  'slot.proposed.hint': 'The file you are about to import, after your edits.',
  'slot.clear': 'Clear',
  'slot.dropHere': 'Drop a CSV here, or click to choose',
  'slot.formats': '.csv · UTF-8 · read in your browser only',
  'slot.replace': 'Drop a replacement file here',
  // params: {kb} {rows} {products}
  'slot.loaded': '{kb} KB · {rows} rows · {products} products',
  // params: {title}
  'slot.choose': 'Choose a CSV file for {title}',
  'slot.tooLarge': 'File is larger than 60 MB. Shopify caps product CSVs at 15 MB.',
  'slot.unsupported': 'Only .csv files can be checked. This file was not read.',
  'slot.unreadable': 'Could not read this file.',

  // ---- sample scenarios ----
  'scenarios.heading': 'Or start from a sample scenario',
  'scenarios.blurb':
    'Each scenario is a real editing mistake on a small five-product catalogue. They are the same fixtures the test suite runs against. Download a pair, drop the two files into the upload areas above, and you should get exactly the report you see here.',
  'scenarios.downloadBaselineLabel': 'baseline.csv',
  'scenarios.downloadProposedLabel': 'proposed.csv',
  'scenarios.downloadBothLabel': 'both .zip',
  // params: {title}
  'scenarios.load': 'Load the {title} scenario',
  // params: {title}
  'scenarios.downloadBaseline': 'Download baseline.csv for the {title} scenario',
  // params: {title}
  'scenarios.downloadProposed': 'Download proposed.csv for the {title} scenario',
  // params: {title}
  'scenarios.downloadBoth': 'Download both CSV files for the {title} scenario as a zip archive',

  // ---- detection assumptions ----
  'assumptions.heading': 'Detection assumptions',
  'assumptions.blurb':
    'Every rule below depends on these. Change one and the report is recomputed, so you can see exactly which findings are only as reliable as an assumption.',
  // params: {count}
  'assumptions.sensitiveOne': '{count} finding rests on a non-official assumption',
  // params: {count}
  'assumptions.sensitiveMany': '{count} findings rest on a non-official assumption',
  // The panel folds to one line by default: most runs need the finding, not the
  // methodology. How many assumptions lack official documentation is a property
  // of the ruleset, not of this run, so it is safe to state up front.
  // params: {count}
  'assumptions.summaryCount': '{count} total',
  // params: {count}
  'assumptions.summaryUnofficial': '{count} not officially documented',
  'assumptions.summaryNone': 'no finding here rests on one of them',
  'assumptions.expand': 'Show',
  'assumptions.collapse': 'Hide',
  'assumptions.toggleLabel': 'Show or hide the detection assumptions',
  'assumptions.turnedOff': 'Turned off.',
  'assumptions.evidenceLabel': 'Unofficial translation of the source text above.',

  // ---- report header ----
  // params: {count}
  'report.variants': '{count} variants',
  // params: {count}
  'report.products': '{count} products',
  // params: {ms}
  'report.analysedIn': 'analysed in {ms} ms',
  'report.exportCsv': 'Download CSV report',
  'report.exportJson': 'Download JSON report',
  'report.statAll': 'All',
  'report.isClean': 'No high or medium findings.',
  // params: {count}
  'report.needsAttention': '{count} need attention before import.',
  'report.searchPlaceholder': 'Search handle, variant, field, rule or line number…',
  'report.teachesLabel': 'What this scenario demonstrates',
  'report.allCategories': 'All categories',
  // params: {shown} {total}
  'report.ofTotal': '{shown} of {total}',
  'report.noFindings': 'No findings.',
  'report.noMatches': 'No findings match the current filters.',
  'report.emptyExplain':
    'Nothing in these two files triggered a rule. That is not a guarantee the import is safe — it only means the specific risks this tool checks for were not found.',
  'report.filterHint': 'Clear the search or re-enable a severity filter.',
  'report.readFirst': 'Read this before you trust the report',
  'report.exportNote':
    'CSV column headers stay in English so downstream tooling keeps working; the rule title, finding, why and suggestion columns follow the language you are reading in.',
  'report.disclaimer':
    'VariantGuard Lab analyses two CSV files locally in your browser and reports what it believes an overwrite import would change. These are inferences about file structure, not observed results from Shopify. Nothing in this report was sent to Shopify, and no Shopify store was contacted. This tool cannot detect every import risk. A clean report means nothing was found by the rules below, not that the import is safe.',

  // ---- finding detail ----
  'finding.cellAbsent': 'column not in file',
  'finding.cellEmpty': 'empty cell — clears the value',
  'finding.cellZeroLength': '(zero-length)',
  // params: {count}
  'finding.spansLines': 'spans {count} lines',
  // params: {count}
  'finding.spansLinesTitle':
    'This record spans {count} physical lines because a cell contains a newline.',
  'finding.before': 'Before',
  'finding.after': 'After',
  'finding.why': 'Why we believe it',
  'finding.whatToDo': 'What to do',
  'finding.dependsOn': 'Depends on',
  // params: {title} {severity}
  'finding.ruleFooter': 'Rule: {title} · default severity {severity}',
  'finding.expand': 'Expand finding details',
  'finding.collapse': 'Collapse finding details',
};

export const TERM: Readonly<Record<string, string>> = {
  'severity.high': 'High',
  'severity.medium': 'Medium',
  'severity.low': 'Low',

  'category.variant-loss': 'Variant loss',
  'category.identity': 'Product / variant identity',
  'category.inventory': 'Inventory',
  'category.structure': 'Product structure',
  'category.visibility': 'Storefront visibility',
  'category.format': 'File format',
  'category.routine': 'Routine change',

  'basis.documented': 'Shopify-documented',
  'basis.inference': 'Inference from documented behaviour',
  'basis.heuristic': 'Heuristic',

  // Compact badge form of the same three. The long labels above are too wide
  // for the pill that sits next to a finding title.
  'basisShort.documented': 'documented',
  'basisShort.inference': 'inference',
  'basisShort.heuristic': 'heuristic',

  'assumptionBasis.official-doc': 'Shopify-documented',
  'assumptionBasis.community': 'Community-reported, NOT documented',
  'assumptionBasis.inference': 'Inferred by this tool',

  'file.baseline': 'Baseline file',
  'file.proposed': 'Proposed file',
};
