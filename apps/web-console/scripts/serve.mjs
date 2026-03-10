import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, normalize, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(scriptDir, '..');
const staticDirArg = process.argv[2] ?? 'src';
const staticDir = resolve(workspaceDir, staticDirArg);
const backendOrigin = (process.env.HUB_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');
const port = Number(process.env.WEB_CONSOLE_PORT ?? 4173);

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function fileContentType(filepath) {
  return MIME_TYPES[extname(filepath)] ?? 'application/octet-stream';
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function isProxyPath(pathname) {
  return pathname === '/health' || pathname.startsWith('/api/');
}

function buildProxyHeaders(headers) {
  const forwarded = {
    accept: headers.accept ?? 'application/json',
  };

  for (const [sourceKey, targetKey] of [
    ['authorization', 'authorization'],
    ['content-type', 'content-type'],
    ['cache-control', 'cache-control'],
    ['last-event-id', 'last-event-id'],
  ]) {
    const value = headers[sourceKey];
    if (typeof value === 'string' && value) {
      forwarded[targetKey] = value;
    }
  }

  return forwarded;
}

function resolveStaticPath(pathname) {
  const candidate = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const normalizedPath = normalize(candidate).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolutePath = resolve(staticDir, normalizedPath);
  if (!absolutePath.startsWith(staticDir)) {
    return null;
  }
  if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
    return absolutePath;
  }
  const fallbackPath = join(staticDir, 'index.html');
  return existsSync(fallbackPath) ? fallbackPath : null;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (url.pathname === '/__console_meta') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: true,
          data: {
            proxyOrigin: backendOrigin,
            staticDir: basename(staticDir),
          },
        }),
      );
      return;
    }

    if (isProxyPath(url.pathname)) {
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readRequestBody(req);
      const controller = new AbortController();
      req.on('close', () => {
        controller.abort();
      });
      const upstream = await fetch(`${backendOrigin}${url.pathname}${url.search}`, {
        method: req.method,
        headers: buildProxyHeaders(req.headers),
        body,
        signal: controller.signal,
      });

      const headers = {};
      upstream.headers.forEach((value, key) => {
        headers[key] = value;
      });
      res.writeHead(upstream.status, headers);
      if (req.method === 'HEAD' || !upstream.body) {
        res.end();
        return;
      }

      const upstreamStream = Readable.fromWeb(upstream.body);
      upstreamStream.on('error', (error) => {
        if (!res.writableEnded) {
          res.destroy(error);
        }
      });
      res.on('close', () => {
        upstreamStream.destroy();
      });
      upstreamStream.pipe(res);
      return;
    }

    const filepath = resolveStaticPath(url.pathname);
    if (!filepath) {
      sendText(res, 404, 'not found');
      return;
    }

    res.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': fileContentType(filepath),
    });
    createReadStream(filepath).pipe(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown server error';
    sendText(res, 500, message);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(
    `web-console ${basename(staticDir)} listening on http://127.0.0.1:${port} (proxy -> ${backendOrigin})`,
  );
});
