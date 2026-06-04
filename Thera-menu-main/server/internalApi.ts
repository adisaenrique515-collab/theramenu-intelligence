import type { IncomingMessage, ServerResponse } from 'node:http';
import { generateLocalTherapeuticPlan } from './localClinicalEngineApi.ts';
import { getLocalNutritionDbStatus } from './localNutritionDb.ts';
import { getOfflineClinicalOverview } from './offlineClinicalApi.ts';
import { getResourcePackSummary } from './resourcePackApi.ts';
import { refineWeeklyPlanWithClaude, chatWithClaudeDietitian, isClaudeConfigured } from './claudeRefinementApi.ts';
import { enrichPlanWithUsdaFdcData, isUsdaConfigured } from './usdaEnrichmentApi.ts';
import type { WeeklyTherapeuticPlan } from '../types.ts';

async function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function respondJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function inferStatusCode(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Nutrition DB not ready')) {
    return 503;
  }
  if (message.includes('Unexpected end of JSON input') || message.includes('JSON')) {
    return 400;
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return 408;
  }
  return 500;
}

export async function handleInternalApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (!req.url) {
    return false;
  }

  try {
    if (req.url === '/api/internal/health' && req.method === 'GET') {
      respondJson(res, 200, { status: 'ok', mode: 'LOCAL_ONLY' });
      return true;
    }

    if (req.url === '/api/internal/resource-pack/summary' && req.method === 'GET') {
      respondJson(res, 200, getResourcePackSummary());
      return true;
    }

    if (req.url === '/api/internal/offline-clinical-engine/overview' && req.method === 'GET') {
      respondJson(res, 200, getOfflineClinicalOverview());
      return true;
    }

    if (req.url === '/api/internal/nutrition-db/status' && req.method === 'GET') {
      respondJson(res, 200, getLocalNutritionDbStatus());
      return true;
    }

    if (req.url === '/api/internal/clinical-engine/generate' && req.method === 'POST') {
      const body = await readRequestBody(req);
      let payload: unknown;
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {
        respondJson(res, 400, { message: 'Invalid JSON in request body' });
        return true;
      }
      const { diagnosis, patientData } = payload as Record<string, unknown>;
      if (!diagnosis || !patientData) {
        respondJson(res, 400, {
          message: 'Missing required fields: diagnosis and patientData are required',
        });
        return true;
      }
      respondJson(res, 200, generateLocalTherapeuticPlan(payload as Parameters<typeof generateLocalTherapeuticPlan>[0]));
      return true;
    }

    // ── Claude AI chat ──────────────────────────────────────────────────────
    if (req.url === '/api/ai/chat' && req.method === 'POST') {
      const body = await readRequestBody(req);
      let parsed: unknown;
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        respondJson(res, 400, { message: 'Invalid JSON in request body' });
        return true;
      }
      const { message } = parsed as Record<string, unknown>;
      const reply = await chatWithClaudeDietitian(String(message ?? ''));
      respondJson(res, 200, { reply });
      return true;
    }

    // ── Claude AI refinement ────────────────────────────────────────────────
    if (req.url === '/api/ai/refine' && req.method === 'POST') {
      const body = await readRequestBody(req);
      let parsed: unknown;
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        respondJson(res, 400, { message: 'Invalid JSON in request body' });
        return true;
      }
      const { plan, diagnosis } = parsed as Record<string, unknown>;
      const refined = await refineWeeklyPlanWithClaude(
        plan as WeeklyTherapeuticPlan,
        String(diagnosis ?? ''),
      );
      respondJson(res, 200, refined);
      return true;
    }

    // ── USDA FDC live enrichment ────────────────────────────────────────────
    if (req.url === '/api/usda/enrich' && req.method === 'POST') {
      const body = await readRequestBody(req);
      let parsed: unknown;
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        respondJson(res, 400, { message: 'Invalid JSON in request body' });
        return true;
      }
      const { plan } = parsed as Record<string, unknown>;
      const enriched = await enrichPlanWithUsdaFdcData(plan as WeeklyTherapeuticPlan);
      respondJson(res, 200, enriched);
      return true;
    }

    // ── AI + USDA capabilities status ──────────────────────────────────────
    if (req.url === '/api/internal/ai-status' && req.method === 'GET') {
      respondJson(res, 200, {
        claude: { configured: isClaudeConfigured(), model: 'claude-sonnet-4-6' },
        usda:   { configured: isUsdaConfigured(), source: 'USDA FoodData Central (FDC)' },
      });
      return true;
    }

  } catch (error) {
    respondJson(res, inferStatusCode(error), {
      message: error instanceof Error ? error.message : 'Internal clinical engine failure.',
    });
    return true;
  }

  return false;
}
