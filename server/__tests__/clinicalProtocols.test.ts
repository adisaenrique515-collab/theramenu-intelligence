/**
 * server/__tests__/clinicalProtocols.test.ts
 *
 * Tests for Phase 4 versioned clinical protocol records.
 * Verifies structure, evidence requirements, and RENAL_STAGE_4 override fields.
 *
 * Run with:
 *   node --experimental-strip-types --test server/__tests__/clinicalProtocols.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PROTOCOL_GENERAL_HOSPITAL,
  PROTOCOL_T2DM,
  PROTOCOL_CARDIAC,
  PROTOCOL_RENAL_STAGE_4,
  CLINICAL_PROTOCOL_REGISTRY,
  getProtocol,
  requiresClinician,
} from '../clinicalProtocols.ts';

import type { VersionedClinicalProtocol, ClinicalTargetRule } from '../../types-clinical.ts';

// ── Helpers ───────────────────────────────────────────────────────────────

const ALL_PROTOCOLS = [
  PROTOCOL_GENERAL_HOSPITAL,
  PROTOCOL_T2DM,
  PROTOCOL_CARDIAC,
  PROTOCOL_RENAL_STAGE_4,
] as const;

function hasManualOverride(protocol: VersionedClinicalProtocol): boolean {
  return Object.values(protocol.targets).some((t) => t.type === 'manual_override');
}

// ── Suite 1: Registry completeness ────────────────────────────────────────

describe('Suite 1 — Protocol registry', () => {
  it('registry contains all 4 required protocols', () => {
    assert.ok(CLINICAL_PROTOCOL_REGISTRY.GENERAL_HOSPITAL, 'GENERAL_HOSPITAL must exist');
    assert.ok(CLINICAL_PROTOCOL_REGISTRY.T2DM,             'T2DM must exist');
    assert.ok(CLINICAL_PROTOCOL_REGISTRY.CARDIAC,           'CARDIAC must exist');
    assert.ok(CLINICAL_PROTOCOL_REGISTRY.RENAL_STAGE_4,     'RENAL_STAGE_4 must exist');
  });

  it('getProtocol returns the correct protocol by code', () => {
    const p = getProtocol('T2DM');
    assert.ok(p, 'T2DM should be returned');
    assert.strictEqual(p!.diagnosisCode, 'T2DM');
  });

  it('getProtocol returns undefined for an unregistered code', () => {
    const p = getProtocol('H_PYLORI');
    assert.strictEqual(p, undefined, 'H_PYLORI is not in the Phase 4 registry');
  });

  it('registry is frozen (immutable)', () => {
    assert.ok(Object.isFrozen(CLINICAL_PROTOCOL_REGISTRY));
  });
});

// ── Suite 2: Required fields on every protocol ────────────────────────────

describe('Suite 2 — Required fields on all protocols', () => {
  for (const protocol of ALL_PROTOCOLS) {
    const name = protocol.diagnosisCode;

    it(`${name}: has diagnosisCode`, () => {
      assert.ok(protocol.diagnosisCode, 'diagnosisCode must be present');
    });

    it(`${name}: has version in semver format`, () => {
      assert.match(protocol.version, /^\d+\.\d+\.\d+$/, 'version must be semver x.y.z');
    });

    it(`${name}: has a valid governance status`, () => {
      const validStatuses = ['draft', 'pending_review', 'approved', 'retired'];
      assert.ok(
        validStatuses.includes(protocol.status),
        `status must be one of ${validStatuses.join(', ')}`,
      );
    });

    it(`${name}: has at least one target rule`, () => {
      const keys = Object.keys(protocol.targets);
      assert.ok(keys.length > 0, 'targets must not be empty');
    });

    it(`${name}: has at least one evidence reference`, () => {
      assert.ok(
        protocol.evidenceReferences.length > 0,
        'evidenceReferences must contain at least one citation',
      );
    });

    it(`${name}: has at least one slot template`, () => {
      assert.ok(
        protocol.slotTemplates.length > 0,
        'slotTemplates must contain at least one entry',
      );
    });

    it(`${name}: all slot templates have required fields`, () => {
      for (const slot of protocol.slotTemplates) {
        assert.ok(slot.slotName,         `slotName missing in slot`);
        assert.ok(slot.mealType,         `mealType missing in slot "${slot.slotName}"`);
        assert.ok(
          typeof slot.required === 'boolean',
          `required must be boolean in "${slot.slotName}"`,
        );
        assert.ok(
          slot.allowedCategories.length > 0,
          `allowedCategories must not be empty in "${slot.slotName}"`,
        );
      }
    });

    it(`${name}: has applicability block`, () => {
      assert.ok(protocol.applicability, 'applicability must be present');
    });

    it(`${name}: has reviewDueAt`, () => {
      assert.ok(protocol.reviewDueAt, 'reviewDueAt must be set');
      assert.match(protocol.reviewDueAt!, /^\d{4}-\d{2}-\d{2}$/, 'reviewDueAt must be ISO date');
    });
  }
});

// ── Suite 3: Target rule type coverage ────────────────────────────────────

describe('Suite 3 — Target rule types', () => {
  it('GENERAL_HOSPITAL has per_kg energy target', () => {
    assert.strictEqual(PROTOCOL_GENERAL_HOSPITAL.targets.energy.type, 'per_kg');
  });

  it('T2DM has a fixed sugar target (configurable maximum)', () => {
    assert.strictEqual(PROTOCOL_T2DM.targets.sugar.type, 'fixed');
    const rule = PROTOCOL_T2DM.targets.sugar as { type: 'fixed'; value: number; unit: string };
    assert.ok(rule.value > 0, 'sugar limit must be positive');
  });

  it('CARDIAC has a fixed saturated fat target', () => {
    assert.strictEqual(PROTOCOL_CARDIAC.targets.saturatedFat.type, 'fixed');
  });

  it('CARDIAC has a fixed cholesterol target', () => {
    assert.strictEqual(PROTOCOL_CARDIAC.targets.cholesterol.type, 'fixed');
  });

  it('RENAL_STAGE_4 protein is per_kg with max set', () => {
    const protein = PROTOCOL_RENAL_STAGE_4.targets.protein;
    assert.strictEqual(protein.type, 'per_kg');
    const p = protein as { type: 'per_kg'; multiplier: number; max?: number };
    assert.ok(p.multiplier > 0, 'protein multiplier must be positive');
    assert.ok(p.max !== undefined, 'protein must have a maximum');
  });

  it('all per_kg rules have a finite positive multiplier', () => {
    for (const protocol of ALL_PROTOCOLS) {
      for (const [key, rule] of Object.entries(protocol.targets)) {
        if (rule.type === 'per_kg') {
          const r = rule as { type: 'per_kg'; multiplier: number };
          assert.ok(
            Number.isFinite(r.multiplier) && r.multiplier > 0,
            `${protocol.diagnosisCode}.${key}: multiplier must be a positive finite number`,
          );
        }
      }
    }
  });

  it('all range rules have min ≤ max', () => {
    for (const protocol of ALL_PROTOCOLS) {
      for (const [key, rule] of Object.entries(protocol.targets)) {
        if (rule.type === 'range') {
          const r = rule as { type: 'range'; min: number; max: number };
          assert.ok(
            r.min <= r.max,
            `${protocol.diagnosisCode}.${key}: range min (${r.min}) must be ≤ max (${r.max})`,
          );
        }
      }
    }
  });
});

// ── Suite 4: Evidence reference structure ─────────────────────────────────

describe('Suite 4 — Evidence references', () => {
  for (const protocol of ALL_PROTOCOLS) {
    const name = protocol.diagnosisCode;

    it(`${name}: each evidence reference has code, title, organization, year`, () => {
      for (const ref of protocol.evidenceReferences) {
        assert.ok(ref.code,         `code missing in evidence ref`);
        assert.ok(ref.title,        `title missing in evidence ref "${ref.code}"`);
        assert.ok(ref.organization, `organization missing in evidence ref "${ref.code}"`);
        assert.ok(
          typeof ref.year === 'number' && ref.year >= 2000,
          `year must be ≥ 2000 in evidence ref "${ref.code}"`,
        );
        const validLevels = ['A', 'B', 'C', 'expert_opinion'];
        assert.ok(
          validLevels.includes(ref.evidenceLevel),
          `evidenceLevel must be one of ${validLevels.join(', ')} in "${ref.code}"`,
        );
      }
    });
  }

  it('RENAL_STAGE_4 cites KDIGO CKD guidelines', () => {
    const refs = PROTOCOL_RENAL_STAGE_4.evidenceReferences;
    const codes = refs.map((r) => r.code);
    assert.ok(codes.includes('KDIGO_CKD_2024'), 'must cite KDIGO_CKD_2024');
    assert.ok(codes.includes('KDOQI_NUTRITION_2020'), 'must cite KDOQI_NUTRITION_2020');
  });

  it('T2DM cites ADA guidelines', () => {
    const codes = PROTOCOL_T2DM.evidenceReferences.map((r) => r.code);
    assert.ok(codes.includes('ADA_SOC_2024'), 'must cite ADA_SOC_2024');
  });

  it('CARDIAC cites ACC/AHA guidelines', () => {
    const codes = PROTOCOL_CARDIAC.evidenceReferences.map((r) => r.code);
    assert.ok(codes.includes('ACC_AHA_PP_2019'), 'must cite ACC_AHA_PP_2019');
    assert.ok(codes.includes('AHA_DIET_2021'),   'must cite AHA_DIET_2021');
  });
});

// ── Suite 5: RENAL_STAGE_4 clinician-override fields ─────────────────────

describe('Suite 5 — RENAL_STAGE_4 clinician-override requirements', () => {
  const renalTargets = PROTOCOL_RENAL_STAGE_4.targets;

  const requiredOverrides = [
    'dialysisProteinAdjustment',
    'potassiumClinicalAdjustment',
    'phosphorusClinicalAdjustment',
    'fluidRestriction',
    'clinicianOverrideRequired',
  ] as const;

  for (const key of requiredOverrides) {
    it(`RENAL_STAGE_4 has manual_override target: ${key}`, () => {
      const target = renalTargets[key];
      assert.ok(target, `Target "${key}" must exist in RENAL_STAGE_4`);
      assert.strictEqual(
        target.type,
        'manual_override',
        `"${key}" must be type manual_override`,
      );
      const override = target as { type: 'manual_override'; requiresClinician: true; description: string };
      assert.strictEqual(override.requiresClinician, true);
      assert.ok(override.description.length > 20, 'description must be substantive');
    });
  }

  it('requiresClinician(RENAL_STAGE_4) returns true', () => {
    assert.strictEqual(requiresClinician(PROTOCOL_RENAL_STAGE_4), true);
  });

  it('requiresClinician(GENERAL_HOSPITAL) returns false', () => {
    assert.strictEqual(requiresClinician(PROTOCOL_GENERAL_HOSPITAL), false);
  });

  it('RENAL_STAGE_4 has potassium range with configurable limits', () => {
    const k = renalTargets.potassium;
    assert.strictEqual(k.type, 'range');
    const r = k as { type: 'range'; min: number; max: number };
    assert.ok(r.min >= 1000 && r.max <= 2500, 'potassium range must be within realistic renal limits');
  });

  it('RENAL_STAGE_4 has phosphorus range with configurable limits', () => {
    const p = renalTargets.phosphorus;
    assert.strictEqual(p.type, 'range');
    const r = p as { type: 'range'; min: number; max: number };
    assert.ok(r.max <= 1000, 'phosphorus max must be ≤ 1000 mg/day for CKD G4');
  });

  it('RENAL_STAGE_4 forbids high-potassium foods', () => {
    assert.ok(
      PROTOCOL_RENAL_STAGE_4.forbiddenTags.includes('high_potassium'),
      'high_potassium must be a forbidden tag',
    );
  });

  it('RENAL_STAGE_4 forbids high-phosphorus foods', () => {
    assert.ok(
      PROTOCOL_RENAL_STAGE_4.forbiddenTags.includes('high_phosphorus'),
      'high_phosphorus must be a forbidden tag',
    );
  });

  it('RENAL_STAGE_4 status is draft (requires individual dietitian sign-off)', () => {
    assert.strictEqual(PROTOCOL_RENAL_STAGE_4.status, 'draft');
  });

  it('RENAL_STAGE_4 has no approvedBy or approvedAt (not yet signed off)', () => {
    assert.strictEqual(PROTOCOL_RENAL_STAGE_4.approvedBy, undefined);
    assert.strictEqual(PROTOCOL_RENAL_STAGE_4.approvedAt, undefined);
  });
});

// ── Suite 6: Slot template coverage ───────────────────────────────────────

describe('Suite 6 — Slot template coverage', () => {
  it('GENERAL_HOSPITAL has Breakfast, Lunch, and Dinner slot templates', () => {
    const types = new Set(PROTOCOL_GENERAL_HOSPITAL.slotTemplates.map((s) => s.mealType));
    assert.ok(types.has('Breakfast'), 'must have Breakfast slots');
    assert.ok(types.has('Lunch'),     'must have Lunch slots');
    assert.ok(types.has('Dinner'),    'must have Dinner slots');
  });

  it('RENAL_STAGE_4 slot templates all forbid high_potassium and high_phosphorus', () => {
    for (const slot of PROTOCOL_RENAL_STAGE_4.slotTemplates) {
      if (slot.slotName === 'beverage') continue; // beverage is a special case
      assert.ok(
        slot.forbiddenTags.includes('high_potassium'),
        `${slot.slotName} must forbid high_potassium`,
      );
      assert.ok(
        slot.forbiddenTags.includes('high_phosphorus'),
        `${slot.slotName} must forbid high_phosphorus`,
      );
    }
  });

  it('CARDIAC slots forbid high_saturated_fat in protein slot', () => {
    const proteinSlot = PROTOCOL_CARDIAC.slotTemplates.find(
      (s) => s.slotName === 'lean_protein_primary',
    );
    assert.ok(proteinSlot, 'CARDIAC must have lean_protein_primary slot');
    assert.ok(
      proteinSlot!.forbiddenTags.includes('high_saturated_fat'),
      'lean_protein_primary must forbid high_saturated_fat',
    );
  });

  it('T2DM controlled_carb_base slot forbids refined_sugar', () => {
    const carbSlot = PROTOCOL_T2DM.slotTemplates.find(
      (s) => s.slotName === 'controlled_carb_base',
    );
    assert.ok(carbSlot, 'T2DM must have controlled_carb_base slot');
    assert.ok(
      carbSlot!.forbiddenTags.includes('refined_sugar'),
      'controlled_carb_base must forbid refined_sugar',
    );
  });
});
