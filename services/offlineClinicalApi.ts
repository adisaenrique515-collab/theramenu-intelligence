import type { OfflineClinicalOverview } from '../offlineClinical.types';
import { isCloudflareMode } from '../utils/appMode';

let cachedOverviewPromise: Promise<OfflineClinicalOverview> | null = null;

export async function loadOfflineClinicalOverview(): Promise<OfflineClinicalOverview> {
  if (isCloudflareMode) {
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
