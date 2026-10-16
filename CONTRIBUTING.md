# Contributing

This is an experimental local tool. A small change with a test is more useful than a new product feature.

## Before you open a change

1. `npm install`
2. `npm.cmd run verify` on Windows, or `npm run verify` elsewhere. That is typecheck, lint, tests and a production build.
3. If you change a rule, update `docs/RULES.md` and both language dictionaries. English UI strings also live in `scripts/i18n-ui.ts`.

Do not add a Shopify connection, telemetry, or a server that receives product CSV files.

## Reporting a problem

Use the bug report template. Include the rule id, whether it was the baseline or the proposed file, and the physical line. Do not paste a real store export. A few synthetic rows that reproduce the finding are enough.

Findings are risk signals under stated assumptions. A report with no findings is not evidence that a Shopify import is safe.
