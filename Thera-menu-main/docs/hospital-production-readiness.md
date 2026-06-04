# Hospital-Grade Production Readiness Baseline

## Source Package Reviewed

- `C:\Users\erick\Downloads\2018CLINICALDIETMANUAL.pdf` (479 pages)
- `C:\Users\erick\Downloads\tdm.pdf` (27 pages)
- `C:\Users\erick\Downloads\ah102.pdf` (image-heavy, low extractable text)
- `C:\Users\erick\Downloads\2021-2023 FNDDS At A Glance - Ingredient Nutrient Values.xlsx` (~112k rows)
- `C:\Users\erick\Downloads\2021-2023 FNDDS At A Glance - Portions and Weights.xlsx` (~22k rows)
- `C:\Users\erick\Downloads\supertrackerfooddatabase.xlsx` (11 sheets)
- `C:\Users\erick\Downloads\Download_Field_Descriptions_Oct2020.pdf`
- `C:\Users\erick\Downloads\fruit-and-vegetable-consumption-in-california-residents-2012-2013.pdf`

Parsed extraction artifacts are kept in:

- `C:\Users\erick\Downloads\Thera-menu-main-patched\Thera-menu-main\data\clinical-audit\parsed-summary.json`
- `C:\Users\erick\Downloads\Thera-menu-main-patched\Thera-menu-main\data\clinical-audit\pdf-snippets.txt`

## Hard Requirements for Production

1. Deterministic therapeutic rules per diagnosis, with strict nutrient caps (renal Na/K/P, cardiac sodium/sat-fat, diabetic glycemic control).
2. Per-portion nutrient math from verified food composition data, not placeholder percentages.
3. Portion normalization (`g`/`ml`/household portions) to align meal output with FNDDS portion definitions.
4. Texture safety controls (IDDSI-consistent) with explicit mismatch detection and escalation.
5. Weekly menu variety constraints to prevent repeated meals and repeated single foods.
6. Safety gates before plan release (sodium/protein/fiber/fluid checks, plus potassium/phosphorus when protocol requires).
7. Traceable data provenance (USDA/FNDDS release, protocol source set, generated date).
8. Audit-ready validation report attached to each generated plan.
9. Clinical approval workflow hooks (RD signature and audit logs) before production use.
10. Data quality pipeline for scanned/unstructured inputs (notably `ah102.pdf`) before relying on those sources in rules.

## What This Codebase Now Enforces

- Per-day totals are calculated from actual selected foods and portion weights.
- Weekly plans run through deterministic safety + variety + texture validation.
- Validation issues are written into `validationReport` and affect alignment score.
- Candidate selection rotates by day to reduce repetition.
- Validation metadata is preserved in the generated plan object for UI and audit use.

## Remaining Go-Live Gaps

- EMR integration and physician order reconciliation are not implemented.
- RD digital signature workflow is not implemented.
- Real-time HACCP telemetry ingestion is not implemented.
- OCR/structuring for low-text PDFs (e.g., `ah102.pdf`) is required for full source utilization.
- Formal regulatory mapping (JCI/CMS/local accreditation) still needs compliance sign-off.
