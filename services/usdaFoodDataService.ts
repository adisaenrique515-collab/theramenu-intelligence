/**
 * Client-side USDA FDC enrichment service.
 * Delegates to the internal server API (/api/usda/enrich) so the API key
 * stays server-side and is never exposed in the browser bundle.
 */

import type { WeeklyTherapeuticPlan } from '../types';
import { shouldUseLocalInternalApi } from '../utils/appMode';

const FETCH_TIMEOUT_MS = 30000;

/**
 * Enrich a generated plan with real USDA FoodData Central nutrient data.
 * Calls the Vite middleware endpoint which performs the live FDC lookup.
 * Fails soft: returns the original plan if the endpoint is unreachable or times out.
 */
export async function enrichPlanWithUsdaData(
  plan: WeeklyTherapeuticPlan,
): Promise<WeeklyTherapeuticPlan> {
  if (!shouldUseLocalInternalApi) {
    return plan;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('/api/usda/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn('[USDA Client] Enrichment endpoint returned', response.status);
      return plan;
    }

    return (await response.json()) as WeeklyTherapeuticPlan;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[USDA Client] Enrichment request timed out after', FETCH_TIMEOUT_MS, 'ms');
    } else {
      console.warn('[USDA Client] Enrichment call failed:', err);
    }
    return plan;
  } finally {
    clearTimeout(timeout);
  }
}
