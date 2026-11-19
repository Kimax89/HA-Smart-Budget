import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { BudgetStore } from './store.js';
import { BudgetError, accountIcons } from './budget.js';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const staticFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);
for (const module of ['budget', 'model', 'validation', 'payments']) {
  staticFiles.set(`/${module}.js`, [`../src/${module}.js`, 'text/javascript; charset=utf-8']);
}
staticFiles.set('/logo.svg', ['logo.svg', 'image/svg+xml']);
for (const icon of accountIcons.filter((icon) => icon !== 'auto'))
  staticFiles.set(`/icons/${icon}.svg`, [`icons/${icon}.svg`, 'image/svg+xml']);
async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json'))
    throw new BudgetError('Brug JSON.', 415);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new BudgetError('Budgettet er for stort.', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new BudgetError('Ugyldig JSON.');
  }
}
export function createServer(store, { ingressOnly = false } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'",
    );
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    try {
      const ip = req.socket.remoteAddress?.replace(/^::ffff:/, '');
      if (ingressOnly && ip !== '172.30.32.2')
        throw new BudgetError('Kun adgang gennem Home Assistant Ingress.', 403);
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/api/health')
        return json(200, { status: 'ok' });
      if (req.method === 'GET' && url.pathname === '/api/ledger')
        return json(200, store.ledger(url.searchParams.get('year') ?? ''));
      const match = /^\/api\/months\/(\d{4}-\d{2})(?:\/(close|reopen))?$/.exec(url.pathname);
      if (match && req.method === 'GET' && !match[2]) return json(200, store.get(match[1]));
      if (match && ['PUT', 'POST'].includes(req.method)) {
        // A custom header + JSON prevents cross-origin form writes; no CORS is enabled.
        if (req.headers['x-budget-request'] !== '1')
          throw new BudgetError('Ugyldig forespørgsel.', 403);
        if (req.headers['sec-fetch-site'] === 'cross-site')
          throw new BudgetError('Forespørgslen skal komme fra budgettet.', 403);
        if (req.headers.origin) {
          let origin;
          try {
            origin = new URL(req.headers.origin);
          } catch {
            throw new BudgetError('Ugyldig oprindelse.', 403);
          }
          // HA's ingress proxy may replace Host; the source IP is verified above in HA mode.
          if (!ingressOnly && origin.host !== req.headers.host)
            throw new BudgetError('Ugyldig oprindelse.', 403);
        }
        const data = await body(req);
        if (!data || typeof data !== 'object' || Array.isArray(data))
          throw new BudgetError('Ugyldige budgetdata.');
        if (req.method === 'PUT' && !match[2])
          return json(200, store.save(match[1], data.state, data.revision));
        if (req.method === 'POST' && match[2])
          return json(200, store.setClosed(match[1], match[2] === 'close', data.revision));
      }
      if (req.method === 'GET' && staticFiles.has(url.pathname)) {
        const [file, type] = staticFiles.get(url.pathname);
        const content = await readFile(path.join(publicDir, file));
        res.writeHead(200, { 'Content-Type': type });
        return res.end(content);
      }
      json(404, { error: 'Siden findes ikke.' });
    } catch (error) {
      if (!(error instanceof BudgetError)) console.error('Request failed:', error.message);
      if (!res.headersSent)
        json(error.status ?? 500, {
          error:
            error instanceof BudgetError ? error.message : 'Serverfejl. Ændringen blev ikke gemt.',
        });
      else res.end();
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = process.env.DATA_DIR ?? './data';
  await mkdir(dataDir, { recursive: true });
  const store = new BudgetStore(path.join(dataDir, 'budget.sqlite'));
  const server = createServer(store, { ingressOnly: process.env.INGRESS_ONLY === 'true' });
  server.listen(Number(process.env.PORT ?? 8099), process.env.HOST ?? '127.0.0.1', () =>
    console.log('HA Smart Budget ready'),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () =>
      server.close(() => {
        store.close();
        process.exit(0);
      }),
    );
}
