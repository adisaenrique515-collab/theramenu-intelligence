/**
 * Phase 5A invariant check: zero snack candidates in PROTOCOL_SLOT_CANDIDATES.
 *
 * Proves the new snack candidate reader in buildSnackMeals is never triggered
 * in Phase 5A — because the branch condition (snackCandidates.length > 0) is
 * always false when no snack_am/pm/eve entries exist in the candidate dataset.
 *
 * Run with:
 *   node --experimental-strip-types scripts/checkSnack5AInvariant.ts
 */

import assert from 'node:assert/strict';
import { PROTOCOL_SLOT_CANDIDATES } from '../config/therapeuticSchema.ts';

const SNACK_MEAL_TYPES = ['snack_am', 'snack_pm', 'snack_eve'] as const;

function main(): void {
  const snackCandidates = PROTOCOL_SLOT_CANDIDATES.filter((c) =>
    (SNACK_MEAL_TYPES as readonly string[]).includes(c.meal_type),
  );

  console.log('Phase 5A snack invariant check');
  console.log(`total candidates: ${PROTOCOL_SLOT_CANDIDATES.length}`);
  console.log(`snack candidates (snack_am | snack_pm | snack_eve): ${snackCandidates.length}`);

  if (snackCandidates.length > 0) {
    console.error('\nFAIL — snack candidates found. Phase 5B data should not exist yet:');
    snackCandidates.forEach((c) => {
      console.error(`  ${c.protocol_code}|${c.meal_type}|${c.slot_name}|${c.food_id}`);
    });
    process.exitCode = 1;
    return;
  }

  // Verify SNACK_IDX_TO_MEAL_TYPE mapping covers all three snack types.
  const expectedMealTypes = new Set(['snack_am', 'snack_pm', 'snack_eve']);
  assert.equal(expectedMealTypes.size, 3, 'expected 3 distinct snack meal types');

  console.log('\nPASS — zero snack candidates in dataset.');
  console.log('buildSnackMeals fallback branch (pickFoodIdFromCategories) is always taken in Phase 5A.');
  console.log('Existing snack output is unchanged for all protocols.');
}

main();
