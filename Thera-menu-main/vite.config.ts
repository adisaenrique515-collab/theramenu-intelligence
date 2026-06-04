import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleInternalApiRequest } from './server/internalApi';

function internalApiPlugin() {
  return {
    name: 'theramenu-internal-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const handled = await handleInternalApiRequest(req, res);
        if (!handled) {
          next();
        }
      });
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const handled = await handleInternalApiRequest(req, res);
        if (!handled) {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load .env / .env.local so server-side middleware can read API keys via process.env
  const env = loadEnv(mode, '.', '');

  // Inject keys into process.env for the Node.js middleware layer
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (env.VITE_USDA_FDC_API_KEY) process.env.VITE_USDA_FDC_API_KEY = env.VITE_USDA_FDC_API_KEY;
  if (env.USDA_API_KEY) process.env.USDA_API_KEY = env.USDA_API_KEY;

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), tailwindcss(), internalApiPlugin()],
    define: {
      // Expose only the mock-mode flag to the browser bundle; API keys stay server-side
      'process.env.VITE_USE_MOCK_DATA': JSON.stringify(env.VITE_USE_MOCK_DATA || 'false'),
      // appMode.ts reads ANTHROPIC_API_KEY to determine LIVE vs MOCK
      'process.env.ANTHROPIC_API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY ? '***configured***' : ''),
    },
    build: {
      chunkSizeWarningLimit: 1800,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
