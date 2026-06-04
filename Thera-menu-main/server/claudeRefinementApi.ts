/**
 * Server-side Claude AI module.
 * Handles both plan refinement and dietitian chat.
 * ANTHROPIC_API_KEY is read from process.env (server-side only).
 * Runs inside the Vite dev-server middleware (Node.js process) so the
 * ANTHROPIC_API_KEY never touches the browser.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { WeeklyTherapeuticPlan } from '../types.ts';

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY || '';
  return key.trim();
}

export function isClaudeConfigured(): boolean {
  return getApiKey().length > 0;
}

/**
 * Use Claude claude-sonnet-4-6 to review and improve a therapeutically generated
 * plan.  Returns the improved plan or the original if Claude is unavailable
 * or the API key is not set.
 */
export async function refineWeeklyPlanWithClaude(
  plan: WeeklyTherapeuticPlan,
  diagnosis: string,
  patientDetails?: string,
): Promise<WeeklyTherapeuticPlan> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return {
      ...plan,
      notes: [
        ...(plan.notes ?? []),
        'Claude AI refinement skipped – ANTHROPIC_API_KEY not configured.',
      ],
    };
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are an expert clinical dietitian AI embedded in TheraMenu, a JCI-compliant hospital dietary intelligence system.
Your task: review and improve the attached weekly therapeutic meal-plan JSON for clinical accuracy, safety, and nutritional completeness.

Rules:
- Return ONLY valid JSON that exactly matches the structure of the input (no new or missing keys).
- Improve food name clarity, rationale, and clinical notes.
- Ensure IDDSI texture levels and JCI food-safety standards (temperature, HACCP) are upheld.
- Set "preparedBy" to "Claude claude-sonnet-4-6 Clinical Synthesizer".
- Update "updatedDate" to today: ${new Date().toISOString().slice(0, 10)}.
- Do NOT alter numeric nutrient targets or validation data.
- Output only raw JSON — no markdown fences, no prose.`;

  const userPrompt = `Diagnosis: ${diagnosis}${patientDetails ? `\nPatient context: ${patientDetails}` : ''}

Improve this plan and return only the JSON:\n\n${JSON.stringify(plan)}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText =
      response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

    // Strip accidental markdown fences
    const cleanText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    if (!cleanText) return plan;

    const refined = JSON.parse(cleanText) as WeeklyTherapeuticPlan;
    return {
      ...refined,
      standards: refined.standards ?? plan.standards,
    };
  } catch (error) {
    console.error('[Claude] Refinement failed:', error);
    return {
      ...plan,
      notes: [
        ...(plan.notes ?? []),
        `Claude AI refinement attempted but failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Dietitian chat: answer a clinical nutrition question with Claude.
 */
export async function chatWithClaudeDietitian(message: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return 'Claude AI chat not available – ANTHROPIC_API_KEY not configured. Please add it to .env.local and restart the dev server.';
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are an expert clinical dietitian embedded in TheraMenu, a JCI-compliant hospital dietary intelligence system.
Provide concise, evidence-based clinical nutrition guidance. Keep answers to 3–5 sentences, clinically precise, and grounded in current dietary guidelines.
Topics: therapeutic diets, IDDSI texture levels, JCI food safety, nutrient targets, drug-nutrient interactions, enteral/parenteral nutrition.`,
      messages: [{ role: 'user', content: message }],
    });

    return response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : 'No response from clinical AI.';
  } catch (error) {
    console.error('[Claude] Chat failed:', error);
    return 'Clinical AI temporarily unavailable. Please consult the protocol database or contact the dietetics team.';
  }
}
