import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT || 3000);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const candidate = normalize(join(root, pathname));
  const safeCandidate = candidate.startsWith(root) ? candidate : join(root, 'index.html');
  const file = existsSync(safeCandidate) && statSync(safeCandidate).isFile()
    ? safeCandidate
    : join(root, 'index.html');

  response.setHeader('Content-Type', mimeTypes[extname(file)] || 'application/octet-stream');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  createReadStream(file).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`Wazo softphone listening on port ${port}`);
});
