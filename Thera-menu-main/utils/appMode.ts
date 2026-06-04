export type ExecutionMode = 'MOCK' | 'LIVE';

type ImportMetaEnvLike = ImportMeta & { env?: Record<string, string | undefined> };

const env = (import.meta as ImportMetaEnvLike).env || {};
const useMockDataEnv = String(env.VITE_USE_MOCK_DATA || '').toLowerCase() === 'true';
const configuredApiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();

export const hasConfiguredApiKey = configuredApiKey.length > 0;
export const executionMode: ExecutionMode =
  useMockDataEnv || !hasConfiguredApiKey ? 'MOCK' : 'LIVE';
export const isMockMode = executionMode === 'MOCK';
