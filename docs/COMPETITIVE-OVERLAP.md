# Scope and alternatives

VariantGuard Lab compares a baseline Shopify product CSV with a proposed import CSV.
It runs locally in the browser, explains findings and exposes detection assumptions.
These are product choices, not claims of uniqueness or superior detection accuracy.

Historical research identified other local preflight and comparison tools, including
Catalog Precheck, CatalogVigil, Catalog Preflight and CataSift, alongside store-connected
tools such as RowProof, Matrixify and Ablestar. Their current features, prices and
availability have not been independently rechecked for this release.

The project does not import, repair or roll back store data. It does not replace a
backup, Shopify documentation or an established import workflow. It has not been
validated against a production Shopify store or benchmarked against competing tools.

The experiment asks whether explainable findings help users identify an unintended
change before importing. Demand, repeat usage and willingness to pay remain unverified.
Contributions and synthetic reproductions of false positives or missed risks are welcome.

For technical boundaries, see [Known limitations](LIMITATIONS.md) and
[Shopify semantics](SHOPIFY-SEMANTICS.md).
