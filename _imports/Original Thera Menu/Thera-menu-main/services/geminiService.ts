import { WeeklyTherapeuticPlan } from '../types';
import { DEFAULT_STANDARDS, CLINICAL_PROTOCOLS } from '../constants';
import { executionMode, hasConfiguredApiKey } from '../utils/appMode';

function parsePlanPayload(serializedPlan: string): WeeklyTherapeuticPlan {
  try {
    return JSON.parse(serializedPlan) as WeeklyTherapeuticPlan;
  } catch {
    throw new Error('invalid JSON in generated plan payload');
  }
}

export async function transformMenu(
  originalMenu: string,
  diagnosis: string,
  patientDetails?: string
): Promise<WeeklyTherapeuticPlan> {
  const parsed = parsePlanPayload(originalMenu);
  const isMockMode = executionMode === 'MOCK';

  if (isMockMode || !hasConfiguredApiKey) {
    const rationale =
      CLINICAL_PROTOCOLS[diagnosis] || parsed.rationale || 'Standard clinical nutritional therapy protocol.';

    return {
      ...parsed,
      standards: parsed.standards || DEFAULT_STANDARDS,
      rationale,
      clinicalAlignmentScore: parsed.clinicalAlignmentScore ?? 0.93,
      preparedBy: 'Mock Gemini Synthesizer',
      updatedDate: new Date().toISOString().slice(0, 10),
      notes: [
        ...(parsed.notes || []),
        patientDetails ? `Clinical narrative: ${patientDetails}` : 'No additional patient narrative provided',
        'Mock path: no external API used',
      ],
    };
  }

  try {
    const genai = await import('@google/genai');
    const client = new (genai as any).GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `Improve this weekly therapeutic plan for diagnosis: ${diagnosis}. Focus on safety and clarity. Return JSON only.`;

    const response = await (client as any).models.generateContent({
      model: 'gemini-3.1-pro',
      contents: [{ role: 'user', parts: [{ text: prompt }, { text: originalMenu }] }],
      config: { responseMimeType: 'application/json' },
    });

    const text =
      (response?.response?.text && response.response.text()) || (response?.text && response.text()) || '';
    const improvedPlan = text ? (JSON.parse(text) as WeeklyTherapeuticPlan) : parsed;

    return {
      ...improvedPlan,
      standards: improvedPlan.standards || DEFAULT_STANDARDS,
    };
  } catch (error) {
    console.warn('Gemini call failed, returning local plan. Error:', error);
    return {
      ...parsed,
      standards: parsed.standards || DEFAULT_STANDARDS,
      notes: [...(parsed.notes || []), 'Live call failed; using local plan'],
    };
  }
}

export async function chatWithDietitian(message: string): Promise<string> {
  const isMockMode = executionMode === 'MOCK';
  if (isMockMode || !hasConfiguredApiKey) {
    const m = message.toLowerCase();
    if (m.includes('iddsi')) {
      return 'IDDSI tip: For dysphagia, prefer level 5 (minced and moist) or level 4 (pureed) based on swallow study. Match fluid thickness to prescription.';
    }
    if (m.includes('cardiac')) {
      return 'Cardiac protocol: limit sodium to 1.5-2.0 g/day, favor unsaturated fats, and avoid deep-fried and heavily processed foods.';
    }
    if (m.includes('renal')) {
      return 'Renal stage 3: moderate protein (~0.8 g/kg), restrict sodium/potassium/phosphorus per labs, and avoid high-potassium fruit and cola-based drinks.';
    }
    return 'Mock Dietitian: ask about a diagnosis, IDDSI level, or nutrient targets.';
  }

  try {
    const genai = await import('@google/genai');
    const client = new (genai as any).GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await (client as any).models.generateContent({
      model: 'gemini-3.1-pro',
      contents: [{ role: 'user', parts: [{ text: message }] }],
    });
    const text =
      (response?.response?.text && response.response.text()) || (response?.text && response.text()) || '';
    return text || 'No response';
  } catch (error) {
    console.warn('Gemini chat failed. Error:', error);
    return 'Chat temporarily unavailable (falling back to mock).';
  }
}
