import fs from 'node:fs';
import path from 'node:path';
import { createServer, type ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { handleInternalApiRequest } from './internalApi.ts';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function sendFile(res: ServerResponse, filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', CONTENT_TYPES[extension] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  if (await handleInternalApiRequest(req, res)) {
    return;
  }

  const requestPath = req.url && req.url !== '/' ? req.url.split('?')[0] : '/index.html';
  const normalizedPath = requestPath === '/' ? '/index.html' : requestPath || '/index.html';
  const assetPath = path.join(DIST_DIR, normalizedPath.replace(/^\/+/, ''));

  if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    sendFile(res, assetPath);
    return;
  }

  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    sendFile(res, indexPath);
    return;
  }

  res.statusCode = 500;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Build output not found. Run npm run build before starting the standalone server.');
});

server.listen(PORT, HOST, () => {
  console.log(`TheraMenu standalone server listening on http://${HOST}:${PORT}`);
});
