/**
 * types-clinical.ts — Phase 2 clinical type extensions.
 *
 * All types here are ADDITIVE. Nothing in types.ts is modified or removed.
 * Types from types.ts that overlap are aliased here for forward compatibility.
 * A compatibility adapter (schemaFoodItemToFoodItem) bridges the two models.
 */

import type {
  NutrientVector,
  ProtocolCode,
  SchemaTextureClass,
  SchemaFoodCategory,
  SchemaFoodItem,
  WeeklyTherapeuticPlan,
  MealPlan,
  DayPlan,
} from './types';

// Re-export NutrientVector so consumers of this file can import it from here.
export type { NutrientVector };

// ── Primitive union types ─────────────────────────────────────────────────

/**
 * EU-14 regulated allergens plus common additions.
 * Add new codes here without breaking existing code.
 */
export type AllergenCode =
  | 'GLUTEN'
  | 'MILK'
  | 'EGG'
  | 'PEANUT'
  | 'TREE_NUT'
  | 'SOY'
  | 'FISH'
  | 'SHELLFISH'
  | 'SESAME'
  | 'SULPHITES'
  | 'LUPIN'
  | 'MOLLUSCS';

/**
 * TextureLevel — alias for the existing SchemaTextureClass.
 * Kept separate so the clinical model is not coupled to schema naming.
 */
export type TextureLevel = SchemaTextureClass;

/**
 * FoodCategory — alias for SchemaFoodCategory.
 */
export type FoodCategory = SchemaFoodCategory;

/**
 * DiagnosisCode — the canonical protocol identifiers used by the engine.
 * Distinct from the legacy DiagnosisType enum in types.ts.
 */
export type DiagnosisCode = ProtocolCode;

/**
 * Governance lifecycle state for foods and protocols.
 * draft → pending_review → approved → retired
 * Production generation may only use approved items.
 */
export type FoodApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'retired';
export type GovernanceState    = 'draft' | 'pending_review' | 'approved' | 'retired';

/**
 * Data provenance for nutrient values.
 * ESTIMATED values must not be treated as clinical truth.
 */
export type NutrientSource =
  | 'USDA_FDC'
  | 'AUSNUT'
  | 'LOCAL_TRUSTED'
  | 'CURATED'
  | 'ESTIMATED'
  | 'RESEARCH';

/**
 * Four-level severity — ordered from least to most severe.
 * BLOCKER issues must set exportBlocked = true.
 */
export type ValidationSeverity = 'info' | 'warning' | 'critical' | 'blocker';

export type MealTypeKey =
  | 'Breakfast'
  | 'Snack AM'
  | 'Lunch'
  | 'Snack PM'
  | 'Dinner'
  | 'Snack Eve';

export type PreparationState =
  | 'raw'
  | 'cooked'
  | 'canned'
  | 'frozen'
  | 'dried'
  | 'processed';

/**
 * ConfidenceLevel — trustworthiness of a nutrient value.
 * verified   = clinician-confirmed against a cited source
 * curated    = manually entered from a reliable reference
 * estimated  = inferred from category averages; flag in reports
 * unverified = imported but not yet reviewed
 */
export type ConfidenceLevel = 'verified' | 'curated' | 'estimated' | 'unverified';

// ── Evidence ──────────────────────────────────────────────────────────────

/**
 * A link to a clinical guideline, systematic review, or regulatory standard.
 * Every clinical protocol must cite at least one EvidenceReference.
 */
export interface EvidenceReference {
  readonly code: string;              // e.g. "KDIGO_2024_CKD"
  readonly title: string;
  readonly organization: string;      // e.g. "KDIGO", "ESPEN", "ADA"
  readonly year: number;
  readonly url?: string;
  readonly section?: string;          // e.g. "Table 2.1.3"
  readonly evidenceLevel: 'A' | 'B' | 'C' | 'expert_opinion';
}

// ── Validation ────────────────────────────────────────────────────────────

/**
 * A single validation finding with structured location metadata.
 */
export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly code: string;              // machine-readable, e.g. "POTASSIUM_EXCEEDED"
  readonly message: string;           // human-readable
  readonly field?: string;            // nutrient name or field path
  readonly dayName?: string;
  readonly mealType?: MealTypeKey;
  readonly slotName?: string;
}

export interface ClinicalValidationSummary {
  readonly blockerCount: number;
  readonly criticalCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
  readonly nutrientChecksPassed: number;
  readonly nutrientChecksTotal: number;
  readonly weeklyUniqueFoods: number;
  readonly maxRepeatPerFood: number;
  readonly textureMismatchCount: number;
}

/**
 * ClinicalValidationReport — v2 validation result.
 *
 * Does NOT replace PlanValidationReport (UI contract preserved).
 * exportBlocked is true if any blocker-severity issue is present.
 * Used by Phase 6 validation engine and stored in AuditMetadata.
 */
export interface ClinicalValidationReport {
  readonly passed: boolean;
  readonly exportBlocked: boolean;
  readonly issues: ReadonlyArray<ValidationIssue>;
  readonly clinicalAlignmentScore: number;
  readonly summary: ClinicalValidationSummary;
}

// ── Patient profile ───────────────────────────────────────────────────────

/**
 * PatientProfile — exported, canonical form used by the clinical engine.
 * The server-local interface in localClinicalEngineApi.ts is a superset;
 * this is the typed contract for inter-module use.
 */
export interface PatientProfile {
  readonly diagnosisCode: DiagnosisCode;
  readonly weightKg: number;
  readonly heightCm?: number;
  readonly ageYears: number;
  readonly sex: 'male' | 'female';
  readonly activityLevel?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  readonly mealCount: 3 | 4 | 5 | 6;
  readonly textureLevel: TextureLevel;
  readonly allergens?: ReadonlyArray<AllergenCode>;
  // ── Renal-specific — clinician-supplied, mandatory for RENAL_STAGE_4 ──
  readonly dialysisStatus?: 'pre_dialysis' | 'haemodialysis' | 'peritoneal_dialysis';
  readonly eGfrMlMin?: number;
  readonly acrMgMmol?: number;
  readonly urineOutputMlDay?: number;
  readonly serumPotassiumMEqL?: number;
  readonly serumPhosphorusMgDl?: number;
  readonly fluidRestrictionMl?: number;
  readonly clinicianOverrideRequired?: boolean;
  // ── General ───────────────────────────────────────────────────────────
  readonly malnourished?: boolean;
  readonly goal?: string;
}

// ── Food item ─────────────────────────────────────────────────────────────

export interface ServingRule {
  readonly minGrams: number;
  readonly maxGrams: number;
  readonly defaultGrams: number;
  readonly unit: 'g' | 'ml';
  readonly notes?: string;
}

/**
 * FoodItem — extended food model with governance, allergens, and source metadata.
 *
 * Coexists with SchemaFoodItem; use schemaFoodItemToFoodItem() to adapt.
 * nutrientsPer100g: all 12 NutrientVector fields required.
 * missingNutrients: fields where the source had no data; value is 0 but untrustworthy.
 * approvalStatus: only 'approved' foods are eligible for production generation.
 */
export interface FoodItem {
  readonly id: string;
  readonly canonicalName: string;
  readonly category: FoodCategory;
  readonly mealTypes: ReadonlyArray<MealTypeKey>;
  readonly preparationState: PreparationState;
  readonly nutrientsPer100g: NutrientVector;
  readonly missingNutrients: ReadonlyArray<keyof NutrientVector>;
  readonly textureLevels: ReadonlyArray<TextureLevel>;
  readonly allergens: ReadonlyArray<AllergenCode>;
  readonly contraindicatedFor: ReadonlyArray<DiagnosisCode>;
  readonly allowedFor: ReadonlyArray<DiagnosisCode>;
  readonly servingRules: ServingRule;
  readonly source: NutrientSource;
  readonly confidence: ConfidenceLevel;
  readonly approvalStatus: FoodApprovalStatus;
  readonly verifiedBy?: string;
  readonly verifiedAt?: string;         // ISO 8601
  readonly reviewDueAt?: string;        // ISO 8601
  readonly fdcId?: number;
  readonly rawProviderPayload?: Readonly<Record<string, unknown>>;
  readonly tags?: ReadonlyArray<string>;
}

// ── Meal slot template ────────────────────────────────────────────────────

/**
 * MealSlotTemplate — protocol-level specification of a slot.
 * Extends the existing ProtocolComponentSlot with clinical constraints.
 */
export interface MealSlotTemplate {
  readonly slotName: string;
  readonly mealType: MealTypeKey;
  readonly required: boolean;
  readonly minItems: number;
  readonly maxItems: number;
  readonly slotOrder: number;
  readonly allowedCategories: ReadonlyArray<FoodCategory>;
  readonly forbiddenTags: ReadonlyArray<string>;
  readonly preferredTags: ReadonlyArray<string>;
}

// ── Clinical protocol (versioned) ─────────────────────────────────────────

/**
 * ClinicalTargetRule — a single configurable nutrient target.
 * Supports fixed values, ranges, per-kg formulas, and manual overrides.
 */
export type ClinicalTargetRule =
  | { readonly type: 'fixed';   readonly value: number; readonly unit: string }
  | { readonly type: 'range';   readonly min: number; readonly max: number; readonly unit: string }
  | { readonly type: 'per_kg';  readonly multiplier: number; readonly unit: string; readonly min?: number; readonly max?: number }
  | { readonly type: 'formula'; readonly expression: string; readonly unit: string; readonly description: string }
  | { readonly type: 'manual_override'; readonly description: string; readonly requiresClinician: true };

/**
 * VersionedClinicalProtocol — a protocol record with full governance metadata.
 * Phase 4 will implement concrete records for each diagnosis.
 * Defined here so Phase 3 tests can reference the shape.
 */
export interface VersionedClinicalProtocol {
  readonly diagnosisCode: DiagnosisCode;
  readonly version: string;              // semver, e.g. "1.0.0"
  readonly status: GovernanceState;
  readonly applicability: {
    readonly ageRange?: { readonly min: number; readonly max: number };
    readonly excludeIf?: ReadonlyArray<string>;
  };
  readonly targets: Readonly<Record<string, ClinicalTargetRule>>;
  readonly forbiddenTags: ReadonlyArray<string>;
  readonly requiredTags: ReadonlyArray<string>;
  readonly slotTemplates: ReadonlyArray<MealSlotTemplate>;
  readonly evidenceReferences: ReadonlyArray<EvidenceReference>;
  readonly approvedBy?: string;
  readonly approvedAt?: string;          // ISO 8601
  readonly reviewDueAt?: string;         // ISO 8601
}

// ── Audit metadata ────────────────────────────────────────────────────────

export interface DietitianSignoff {
  readonly reviewedBy: string;
  readonly credentials: string;
  readonly signedAt: string;             // ISO 8601
  readonly notes?: string;
}

/**
 * AuditMetadata — full traceability record for a generated plan.
 * Added as optional field auditMetadata on WeeklyTherapeuticPlan (Phase 7).
 * deterministicHash: SHA-256 over canonical plan JSON + protocol + food DB versions.
 */
export interface AuditMetadata {
  readonly planId: string;
  readonly protocolVersions: ReadonlyArray<{
    readonly diagnosisCode: DiagnosisCode;
    readonly version: string;
  }>;
  readonly foodDbVersion: string;
  readonly engineVersion: string;
  readonly generatedAt: string;          // ISO 8601
  readonly generatedBy: string;
  readonly clinicalValidationReport?: ClinicalValidationReport;
  readonly deterministicHash?: string;   // SHA-256 hex
  readonly dietitianSignoff?: DietitianSignoff;
}

// ── AuditRecord (session-level) ───────────────────────────────────────────

/**
 * AuditRecord — the full record stored in the plan audit database.
 * Extends planAuditDb.ts PlanAuditRecord with the richer clinical fields.
 */
export interface AuditRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly diagnosis: string;
  readonly patientHash: string;
  readonly plan: WeeklyTherapeuticPlan;
  readonly stageReached: 1 | 2 | 3;
  readonly status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'SENT_TO_KITCHEN' | 'REJECTED';
  readonly clinicalAlignmentScore: number;
  readonly generatedBy: string;
  readonly auditMetadata?: AuditMetadata;
  readonly reviewedBy?: string;
  readonly reviewerCredentials?: string;
  readonly reviewNotes?: string;
  readonly approvedAt?: string;
  readonly nrsRiskLevel?: 'LOW' | 'MODERATE' | 'HIGH';
  readonly nrsScore?: number;
}

// ── Compatibility adapter ─────────────────────────────────────────────────

const DEFAULT_SERVING_RULE: ServingRule = {
  minGrams: 30, maxGrams: 300, defaultGrams: 100, unit: 'g',
};

const CATEGORY_SERVING_RULES: Partial<Record<FoodCategory, ServingRule>> = {
  beverage:  { minGrams: 100, maxGrams: 500, defaultGrams: 200, unit: 'ml' },
  broth:     { minGrams: 100, maxGrams: 400, defaultGrams: 200, unit: 'ml' },
  protein:   { minGrams: 60,  maxGrams: 200, defaultGrams: 120, unit: 'g'  },
  grain:     { minGrams: 80,  maxGrams: 280, defaultGrams: 150, unit: 'g'  },
  starch:    { minGrams: 80,  maxGrams: 280, defaultGrams: 150, unit: 'g'  },
  vegetable: { minGrams: 60,  maxGrams: 200, defaultGrams: 100, unit: 'g'  },
  fruit:     { minGrams: 60,  maxGrams: 200, defaultGrams: 100, unit: 'g'  },
  legume:    { minGrams: 80,  maxGrams: 200, defaultGrams: 120, unit: 'g'  },
  dairy:     { minGrams: 60,  maxGrams: 250, defaultGrams: 150, unit: 'g'  },
};

function inferMealTypes(schema: SchemaFoodItem): MealTypeKey[] {
  const { category } = schema;
  if (category === 'beverage' || category === 'broth' || category === 'condiment') {
    return ['Breakfast', 'Snack AM', 'Lunch', 'Snack PM', 'Dinner', 'Snack Eve'];
  }
  if (category === 'fruit' || category === 'vegetable') {
    return ['Breakfast', 'Snack AM', 'Lunch', 'Snack PM', 'Dinner', 'Snack Eve'];
  }
  return ['Breakfast', 'Lunch', 'Dinner'];
}

function inferPreparationState(schema: SchemaFoodItem): PreparationState {
  const n = schema.name.toLowerCase();
  if (n.includes('raw'))                                       return 'raw';
  if (n.includes('canned'))                                    return 'canned';
  if (n.includes('dried'))                                     return 'dried';
  if (n.includes('frozen'))                                    return 'frozen';
  if (
    n.includes('cooked') || n.includes('steamed') ||
    n.includes('boiled') || n.includes('baked')  ||
    n.includes('roasted')|| n.includes('mash')   ||
    n.includes('plain')  || n.includes('poached')
  ) return 'cooked';
  return 'cooked'; // safe default for curated clinical foods
}

/**
 * Infer contraindications from clinical_tags[].
 * This is a PROVISIONAL mapping — all results are marked confidence: 'curated'.
 * A clinician must verify before approving any FoodItem.
 */
function inferContraindications(schema: SchemaFoodItem): DiagnosisCode[] {
  const tags = schema.clinical_tags;
  const out = new Set<DiagnosisCode>();
  if (tags.includes('high_potassium')) {
    out.add('RENAL_STAGE_3'); out.add('RENAL_STAGE_4');
  }
  if (tags.includes('high_phosphorus')) {
    out.add('RENAL_STAGE_3'); out.add('RENAL_STAGE_4');
  }
  if (tags.includes('high_sodium')) {
    out.add('HTN'); out.add('CARDIAC');
    out.add('RENAL_STAGE_3'); out.add('RENAL_STAGE_4');
  }
  if (tags.includes('acidic') || tags.includes('spicy')) {
    out.add('GASTRIC'); out.add('PEPTIC_ULCER'); out.add('H_PYLORI');
  }
  if (tags.includes('fried')) {
    out.add('GASTRIC'); out.add('PEPTIC_ULCER');
    out.add('H_PYLORI'); out.add('CARDIAC');
  }
  if (tags.includes('high_saturated_fat')) { out.add('CARDIAC'); }
  if (tags.includes('refined_sugar'))      { out.add('T2DM'); }
  if (tags.includes('processed_meat'))     { out.add('CARDIAC'); out.add('HEPATIC'); }
  if (tags.includes('fruit_juice'))        { out.add('HEPATIC'); }
  return [...out];
}

/**
 * schemaFoodItemToFoodItem — compatibility adapter.
 *
 * Bridges SchemaFoodItem (existing model) to FoodItem (new model).
 * Fields missing in SchemaFoodItem are filled with 0 and recorded in missingNutrients.
 * All adapted foods have approvalStatus: 'draft' — they need clinical review.
 * contraindicatedFor is PROVISIONAL — inferred from clinical_tags[], not verified.
 */
export function schemaFoodItemToFoodItem(schema: SchemaFoodItem): FoodItem {
  const missing: Array<keyof NutrientVector> = [];

  function val(v: number | undefined, key: keyof NutrientVector): number {
    if (v === undefined || v === null) {
      missing.push(key);
      return 0;
    }
    return v;
  }

  const nutrients: NutrientVector = {
    caloriesKcal:  schema.kcal_per_100,
    proteinG:      schema.protein_g_per_100,
    carbsG:        schema.carbs_g_per_100,
    fatG:          schema.fat_g_per_100,
    fiberG:        val(schema.fiber_g_per_100,    'fiberG'),
    sodiumMg:      schema.sodium_mg_per_100,
    potassiumMg:   val(schema.potassium_mg_per_100,  'potassiumMg'),
    phosphorusMg:  val(schema.phosphorus_mg_per_100, 'phosphorusMg'),
    // SchemaFoodItem has no cholesterol, saturatedFat, sugar, or fluid fields.
    cholesterolMg: (missing.push('cholesterolMg'), 0),
    saturatedFatG: (missing.push('saturatedFatG'), 0),
    sugarG:        (missing.push('sugarG'),        0),
    fluidMl:       (missing.push('fluidMl'),       0),
  };

  return {
    id:               schema.food_id,
    canonicalName:    schema.name,
    category:         schema.category,
    mealTypes:        inferMealTypes(schema),
    preparationState: inferPreparationState(schema),
    nutrientsPer100g: nutrients,
    missingNutrients: missing,
    textureLevels:    schema.texture_tags,
    allergens:        [],     // SchemaFoodItem has no allergen field
    contraindicatedFor: inferContraindications(schema),
    allowedFor:       [],
    servingRules:     CATEGORY_SERVING_RULES[schema.category] ?? DEFAULT_SERVING_RULE,
    source:           'CURATED',
    confidence:       'curated',
    approvalStatus:   'draft',
    tags:             schema.clinical_tags,
  };
}
