export type ExecutionMode = 'MOCK' | 'LIVE';

type ImportMetaEnvLike = ImportMeta & { env?: Record<string, string | undefined> };

const env = (import.meta as ImportMetaEnvLike).env || {};
const useMockDataEnv = String(env.VITE_USE_MOCK_DATA || '').toLowerCase() === 'true';
const configuredApiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();

export const hasConfiguredApiKey = configuredApiKey.length > 0;
export const executionMode: ExecutionMode =
  useMockDataEnv || !hasConfiguredApiKey ? 'MOCK' : 'LIVE';
export const isMockMode = executionMode === 'MOCK';

// When VITE_SUPABASE_URL is present the bundle is running on Cloudflare Pages.
// No local Node.js server exists; use the browser-side clinical engine and
// Supabase's REST API for persistence instead of /api/* internal endpoints.
export const supabaseUrl = String(env.VITE_SUPABASE_URL || '').trim();
export const supabaseAnonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim();
export const isCloudflareMode = supabaseUrl.length > 0;
