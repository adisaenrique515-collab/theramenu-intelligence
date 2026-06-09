import { FOODS } from '../config/therapeuticSchema';
import type {
  MealSlot,
  ShadowSafetyGateResult,
  ShadowSafetyGateStatus,
  ShadowSafetyReport,
  WeeklyTherapeuticPlan,
} from '../types';

export interface ShadowSafetyContext {
  readonly planId?: string | null;
  readonly planStatus?: string;
  readonly reviewedBy?: string;
}

const FOOD_BY_ID = new Map(FOODS.map((food) => [food.food_id, food]));
const SHADOW_LABEL = 'Shadow safety evaluation - not yet enforced' as const;

function gate(
  result: Omit<ShadowSafetyGateResult, 'enforced'>,
): ShadowSafetyGateResult {
  return { ...result, enforced: false };
}

function aggregateStatus(gates: readonly ShadowSafetyGateResult[]): ShadowSafetyGateStatus {
  const order: ShadowSafetyGateStatus[] = ['block', 'warn', 'pending', 'not_configured', 'pass'];
  return order.find((status) => gates.some((item) => item.status === status)) ?? 'pass';
}

function allSlots(plan: WeeklyTherapeuticPlan): MealSlot[] {
  return plan.days.flatMap((day) => day.meals.flatMap((meal) => meal.slots ?? []));
}

function hasProtocolMetadata(plan: WeeklyTherapeuticPlan): boolean {
  return Boolean(
    plan.therapeuticEngine?.recommendedDiets?.length ||
    plan.compoundDietCodes?.length ||
    plan.constraints?.nutrientTargets,
  );
}

function buildAllergenGate(): ShadowSafetyGateResult {
  return gate({
    code: 'allergen_screen',
    label: 'G1 Allergen screen',
    status: 'not_configured',
    summary: 'Structured allergy data is not collected or enforced in S1.',
    findings: [
      'No structured patient allergen profile is available to this shadow evaluator.',
      'Allergen synonyms and patient allergen tables are not queried in browser/static mode.',
      'This gate is advisory only and does not filter foods.',
    ],
    requiresStructuredInput: true,
    requiresSupabase: true,
  });
}

function buildMedicationGate(plan: WeeklyTherapeuticPlan): ShadowSafetyGateResult {
  const diabetesFindings = [
    ...(plan.diabetesMnt?.safetyAlerts ?? []),
    ...(plan.diabetesMnt?.treatmentAdjustments ?? []),
    ...(plan.diabetesMnt?.supplementFlags ?? []),
  ].slice(0, 5);

  return gate({
    code: 'medication_interaction_screen',
    label: 'G2 Medication interaction screen',
    status: diabetesFindings.length > 0 ? 'warn' : 'not_configured',
    summary:
      diabetesFindings.length > 0
        ? 'Medication-related notes exist, but the drug-nutrient interaction database is not queried.'
        : 'Structured medication interaction screening is not configured in S1.',
    findings:
      diabetesFindings.length > 0
        ? [
            ...diabetesFindings,
            'Drug-nutrient interaction tables are not queried and do not block this plan.',
          ]
        : [
            'No structured patient medication list is available to this shadow evaluator.',
            'Drug-nutrient interaction tables are not queried in browser/static mode.',
          ],
    requiresStructuredInput: true,
    requiresSupabase: true,
  });
}

function buildProtocolGate(plan: WeeklyTherapeuticPlan): ShadowSafetyGateResult {
  const metadataPresent = hasProtocolMetadata(plan);
  const validationIssues = plan.validationReport?.issues ?? [];
  const protocolIssues = validationIssues.filter((issue) =>
    /protocol|diagnosis|schema|required slot|texture/i.test(issue),
  );

  return gate({
    code: 'diagnosis_protocol_compliance',
    label: 'G3 Diagnosis/protocol compliance',
    status: metadataPresent && protocolIssues.length === 0 ? 'pass' : 'warn',
    summary:
      metadataPresent && protocolIssues.length === 0
        ? 'Current plan includes protocol metadata and no obvious protocol validation issue.'
        : 'Protocol metadata or validation findings require review.',
    findings: [
      metadataPresent
        ? `Protocol evidence present: ${plan.therapeuticEngine?.recommendedDiets?.map((diet) => diet.code).join(', ') || plan.compoundDietCodes?.join(', ') || plan.constraints?.nutrientTargets || plan.diagnosis}.`
        : 'No explicit protocol metadata found on the plan.',
      ...(protocolIssues.length > 0 ? protocolIssues.slice(0, 4) : ['No protocol-specific validation issue detected by current report.']),
    ],
  });
}

function buildNutrientGate(plan: WeeklyTherapeuticPlan): ShadowSafetyGateResult {
  const report = plan.validationReport;
  const issues = report?.issues ?? [];
  const severeLimitIssues = issues.filter((issue) =>
    /sodium exceeded|potassium exceeded|phosphorus exceeded|protein exceeded|fluid mismatch/i.test(issue),
  );

  if (!report) {
    return gate({
      code: 'nutrient_limit_screen',
      label: 'G4 Nutrient limit screen',
      status: 'pending',
      summary: 'No validation report is attached to the plan.',
      findings: ['Nutrient gate is pending because current validation output is unavailable.'],
    });
  }

  return gate({
    code: 'nutrient_limit_screen',
    label: 'G4 Nutrient limit screen',
    status: severeLimitIssues.length > 0 ? 'block' : report.passed ? 'pass' : 'warn',
    summary:
      severeLimitIssues.length > 0
        ? 'Shadow-only future blocker: nutrient limit exceedance detected.'
        : report.passed
          ? 'Current nutrient validation passed.'
          : 'Current validation report contains nutrient or variety warnings.',
    findings: [
      report.summary
        ? `${report.summary.nutrientChecksPassed}/${report.summary.nutrientChecksTotal} nutrient checks passed.`
        : 'Validation summary is unavailable.',
      ...(issues.length > 0 ? issues.slice(0, 5) : ['No current nutrient validation issues reported.']),
    ],
  });
}

function buildIddsiGate(plan: WeeklyTherapeuticPlan, slots: readonly MealSlot[]): ShadowSafetyGateResult {
  const requestedTexture = String(plan.constraints?.textureLevel ?? '').toLowerCase();
  const mismatches = slots.filter((slot) => {
    const foodId = slot.item?.foodId;
    if (!foodId || !requestedTexture || requestedTexture === 'regular') return false;
    const food = FOOD_BY_ID.get(foodId);
    return Boolean(food && !food.texture_tags.includes(requestedTexture as never));
  });

  return gate({
    code: 'iddsi_texture_documentation',
    label: 'G5 IDDSI/texture documentation',
    status: mismatches.length > 0 ? 'warn' : 'pending',
    summary:
      mismatches.length > 0
        ? 'Texture mismatch evidence was detected, but formal IDDSI attestation is not captured.'
        : 'Texture metadata is present where available; formal IDDSI attestation is still pending.',
    findings: [
      `Requested texture: ${plan.constraints?.textureLevel ?? 'not specified'}.`,
      mismatches.length > 0
        ? `${mismatches.length} slot(s) may not match requested texture metadata.`
        : 'No texture mismatch detected from available food IDs.',
      'Formal meal-level IDDSI attestations are not captured in S1.',
    ],
    requiresAttestation: true,
    requiresSupabase: true,
  });
}

function buildHaccpGate(slots: readonly MealSlot[]): ShadowSafetyGateResult {
  const servedSlots = slots.filter((slot) => slot.item?.name && slot.item.name !== 'N/A');
  const missingTemps = servedSlots.filter((slot) => !slot.item?.operational?.serviceTemp?.trim());

  return gate({
    code: 'haccp_kitchen_documentation',
    label: 'G6 HACCP/kitchen documentation',
    status: missingTemps.length > 0 ? 'warn' : 'pending',
    summary:
      missingTemps.length > 0
        ? 'Some served items do not include service-temperature metadata.'
        : 'Service-temperature metadata is present where available; formal HACCP record is still pending.',
    findings: [
      `${servedSlots.length} served slot(s) inspected.`,
      missingTemps.length > 0
        ? `${missingTemps.length} served slot(s) lack explicit service-temperature metadata.`
        : 'No missing service-temperature metadata detected in served slots.',
      'Formal HACCP/kitchen records are not captured in S1.',
    ],
    requiresAttestation: true,
    requiresSupabase: true,
  });
}

function buildSignoffGate(context?: ShadowSafetyContext): ShadowSafetyGateResult {
  const status = context?.planStatus ?? 'DRAFT';
  const approved = status === 'APPROVED' || status === 'SENT_TO_KITCHEN';
  const hasPlanId = Boolean(context?.planId);
  const hasReviewer = Boolean(context?.reviewedBy);

  return gate({
    code: 'signoff_printability',
    label: 'G7 Sign-off/printability',
    status: approved && hasPlanId && hasReviewer ? 'pass' : hasPlanId ? 'pending' : 'not_configured',
    summary:
      approved && hasPlanId && hasReviewer
        ? 'Current App context shows dietitian approval, but generated_plans.printable is not enforced.'
        : 'Printability and sign-off safety gates are not enforced in S1.',
    findings: [
      `Current UI status: ${status}.`,
      hasPlanId ? `Plan ID present: ${context?.planId}.` : 'Plan ID is not available.',
      hasReviewer ? `Reviewed by: ${context?.reviewedBy}.` : 'Reviewer sign-off is not available.',
      'generated_plans.safety_status, printable, and locked_at are not read or written in S1.',
    ],
    requiresAttestation: true,
    requiresSupabase: true,
  });
}

export function buildShadowSafetyReport(
  plan: WeeklyTherapeuticPlan,
  context?: ShadowSafetyContext,
): ShadowSafetyReport {
  const slots = allSlots(plan);
  const gates = [
    buildAllergenGate(),
    buildMedicationGate(plan),
    buildProtocolGate(plan),
    buildNutrientGate(plan),
    buildIddsiGate(plan, slots),
    buildHaccpGate(slots),
    buildSignoffGate(context),
  ];

  return {
    mode: 'shadow_only',
    enforced: false,
    generatedAt: new Date().toISOString(),
    overallStatus: aggregateStatus(gates),
    disclaimer: SHADOW_LABEL,
    gates,
  };
}
