import type { ResourcePackSummary } from '../resourcePack.types';

let cachedSummaryPromise: Promise<ResourcePackSummary> | null = null;

export async function loadResourcePackSummary(): Promise<ResourcePackSummary> {
  if (!cachedSummaryPromise) {
    cachedSummaryPromise = fetch('/api/internal/resource-pack/summary').then(async (response) => {
      if (!response.ok) {
        throw new Error(`Internal API request failed with status ${response.status}.`);
      }

      return (await response.json()) as ResourcePackSummary;
    });
  }

  return cachedSummaryPromise;
}
