/**
 * Client-side Claude AI service.
 * All AI calls proxy through the Vite middleware (/api/ai/*) so the
 * ANTHROPIC_API_KEY never leaves the server process.
 *
 * The chatWithDietitian function calls the server, which uses claude-sonnet-4-6.
 * In mock/offline mode the responses are handled locally.
 */

import type { WeeklyTherapeuticPlan } from '../types';
import { CLINICAL_PROTOCOLS } from '../constants';
import { isMockMode } from '../utils/appMode';

const FETCH_TIMEOUT_MS = 60000;

// ── Plan refinement ──────────────────────────────────────────────────────────

/**
 * Send a generated plan to Claude for clinical review and improvement.
 * Returns the (possibly improved) plan.  Fails soft back to the original.
 */
export async function refineMenuWithClaude(
  plan: WeeklyTherapeuticPlan,
  diagnosis: string,
  patientDetails?: string,
): Promise<WeeklyTherapeuticPlan> {
  if (isMockMode) {
    const rationale = CLINICAL_PROTOCOLS[diagnosis] || plan.rationale;
    return {
      ...plan,
      rationale,
      preparedBy: 'Clinical Engine (offline mode)',
      updatedDate: new Date().toISOString().slice(0, 10),
      notes: [
        ...(plan.notes ?? []),
        patientDetails
          ? `Clinical narrative: ${patientDetails}`
          : 'No additional patient narrative provided.',
        'Claude AI refinement skipped – running in offline/mock mode.',
      ],
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('/api/ai/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, diagnosis, patientDetails }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn('[Claude Client] Refinement endpoint returned', response.status);
      return plan;
    }

    return (await response.json()) as WeeklyTherapeuticPlan;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[Claude Client] Refinement request timed out after', FETCH_TIMEOUT_MS, 'ms');
    } else {
      console.warn('[Claude Client] Refinement failed:', err);
    }
    return plan;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Dietitian chat ───────────────────────────────────────────────────────────

const MOCK_RESPONSES: Record<string, string> = {
  iddsi:
    'IDDSI tip: For dysphagia, prefer level 5 (minced and moist) or level 4 (pureed) based on a swallow study. Always match fluid thickness to the clinical prescription.',
  cardiac:
    'Cardiac protocol: limit sodium to 1.5–2.0 g/day, favour unsaturated fats, and avoid deep-fried or heavily processed foods. Soluble fibre (oat bran, psyllium) is beneficial.',
  renal:
    'Renal Stage 3: moderate protein (~0.8 g/kg), restrict sodium/potassium/phosphorus per labs, and avoid high-potassium fruit and cola-based drinks.',
  diabetic:
    'T2DM protocol: 45–60 % unrefined carbohydrates, high dietary fibre (25–35 g/day), limit added sugar, and space meals evenly to blunt glycaemic spikes.',
  hepatic:
    'Hepatic protocol: moderate protein (0.8–1.2 g/kg), low sodium (<2 g/day), avoid raw shellfish, and monitor fat-soluble vitamins if cirrhosis is present.',
  jci:
    'JCI food-safety: hot food must reach the patient at ≥ 63 °C, cold food at ≤ 8 °C. HACCP documentation and tray checks are mandatory at every service point.',
};

function mockReply(message: string): string {
  const lower = message.toLowerCase();
  for (const [keyword, reply] of Object.entries(MOCK_RESPONSES)) {
    if (lower.includes(keyword)) return reply;
  }
  return 'TheraMenu Clinical AI: ask about a diagnosis, IDDSI level, nutrient targets, or JCI food-safety standards.';
}

export async function chatWithDietitian(message: string): Promise<string> {
  if (isMockMode) return mockReply(message);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn('[Claude Client] Chat endpoint returned', response.status);
      return mockReply(message);
    }

    const data = (await response.json()) as { reply?: string };
    return data.reply || mockReply(message);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('[Claude Client] Chat request timed out after', FETCH_TIMEOUT_MS, 'ms');
    } else {
      console.warn('[Claude Client] Chat call failed:', err);
    }
    return 'Clinical AI temporarily unavailable. Please consult the protocol database or contact the dietetics team.';
  } finally {
    clearTimeout(timeout);
  }
}
