# App resource pack

This pack converts the uploaded AUSNUT spreadsheets and the uploaded KDIGO + ESPEN PDFs into app-ready resources.

## Included resources

- `ausnut/foods-core.json`
  - 3741 food records
  - one record per `publicFoodKey`
  - merged from nutrient profiles + food details
  - includes energy, protein, fat, carbs, sugars, fibre, sodium, potassium, phosphorus, calcium, iron, magnesium, saturated fat, cholesterol
  - includes group/classification metadata

- `ausnut/food-measures-by-key.json`
  - household / serving measures grouped by `publicFoodKey`

- `ausnut/food-recipes-by-key.json`
  - recipe-style composition for composite AUSNUT foods
  - ingredients grouped by parent `publicFoodKey`

- `ausnut/nutrients-meta.json`
  - nutrient dictionary from AUSNUT

- `clinical/kdigo-ckd-rule-seed.json`
  - starter CKD rule seed extracted from the uploaded KDIGO PDF
  - includes protein target, sodium target, and monitored nutrient list

- `clinical/espen-hospital-rule-seed.json`
  - starter hospital-nutrition workflow seed extracted from the uploaded ESPEN PDF
  - includes screening, reassessment, therapeutic-diet, and escalation logic

- `ts/`
  - TypeScript wrappers and import helpers

## Fastest integration path

1. Copy the `ausnut/` and `clinical/` folders into `src/resources/`.
2. Enable `resolveJsonModule` in `tsconfig.json`.
3. Import from `ts/index.ts`.
4. Build diagnosis-specific rule engines on top of the seed JSON instead of hardcoding values inside UI files.

## Important limits

- The AUSNUT files are quantitative nutrient resources.
- The two uploaded PDFs only support CKD + hospital-nutrition starter rules.
- This pack does **not** infer food contraindications for every diagnosis. That still needs a diagnosis-specific clinical rule layer.
- A food-level filter should be built by combining:
  - diagnosis rule seed
  - nutrient thresholds chosen by your clinical team
  - patient-specific labs / stage / comorbidities

## Suggested next files to add later

- ADA diabetes guideline resources
- liver / pancreatitis clinical nutrition guideline resources
- diagnosis-to-threshold config files
- clinician override tables
