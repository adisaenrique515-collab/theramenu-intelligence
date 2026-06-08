import type { OfflineClinicalOverview } from '../offlineClinical.types';
import { shouldUseLocalInternalApi } from '../utils/appMode';

let cachedOverviewPromise: Promise<OfflineClinicalOverview> | null = null;

export async function loadOfflineClinicalOverview(): Promise<OfflineClinicalOverview> {
  if (!shouldUseLocalInternalApi) {
    return {
      networkStatus: 'offline',
      engineMode: 'internal-api',
      modules: [],
      dataSources: [],
      diagnosisRoutes: [],
      carePaths: [],
      normalizationExample: { rawInputs: [], normalizedRows: [] },
      queryGuardrails: [],
    };
  }

  if (!cachedOverviewPromise) {
    cachedOverviewPromise = fetch('/api/internal/offline-clinical-engine/overview').then(async (response) => {
      if (!response.ok) {
        throw new Error(`Internal API request failed with status ${response.status}.`);
      }

      return (await response.json()) as OfflineClinicalOverview;
    });
  }

  return cachedOverviewPromise;
}
