import type { OfflineClinicalOverview } from '../offlineClinical.types';

let cachedOverviewPromise: Promise<OfflineClinicalOverview> | null = null;

export async function loadOfflineClinicalOverview(): Promise<OfflineClinicalOverview> {
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
