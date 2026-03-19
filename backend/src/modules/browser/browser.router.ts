/**
 * Browser proxy — fetches URLs server-side, rewrites HTML links,
 * strips X-Frame-Options so any page can be embedded in the FLOW browser.
 */
import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { IncomingMessage } from 'http';

const router = Router();
const PROXY_BASE = '/api/v1/browser/proxy?url=';

// ─── HTTP fetch with redirect support ──────────────────────────
function fetchUrl(
  urlStr: string,
  redirectCount = 0
): Promise<{ body: Buffer; contentType: string; finalUrl: string; statusCode: number }> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 8) return reject(new Error('Too many redirects'));

    let urlObj: URL;
    try { urlObj = new URL(urlStr); } catch { return reject(new Error('URL non valido')); }

    const lib = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port
        ? parseInt(urlObj.port)
        : urlObj.protocol === 'https:' ? 443 : 80,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      rejectUnauthorized: false, // allow self-signed certs for local dev
    };

    const request = (lib as typeof https).request(options as any, (res: IncomingMessage) => {
      // Handle redirects
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        try {
          const nextUrl = new URL(res.headers.location, urlStr).href;
          res.resume(); // drain
          return resolve(fetchUrl(nextUrl, redirectCount + 1));
        } catch {
          return reject(new Error('Redirect URL non valido'));
        }
      }

      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        resolve({
          body: Buffer.concat(chunks),
          contentType: (res.headers['content-type'] as string) || 'text/html',
          finalUrl: urlStr,
          statusCode: res.statusCode || 200,
        });
      });
      res.on('error', reject);
    });

    request.on('error', reject);
    request.setTimeout(15000, () => { request.destroy(); reject(new Error('Timeout richiesta')); });
    request.end();
  });
}

// ─── HTML link rewriting ────────────────────────────────────────
function rewriteHtml(html: string, baseUrl: string): string {
  const resolveAndProxy = (rawUrl: string): string => {
    if (!rawUrl) return rawUrl;
    const trimmed = rawUrl.trim();
    if (
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('mailto:') ||
      trimmed.startsWith('tel:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('/api/v1/browser/')
    ) return rawUrl;
    try {
      const abs = new URL(trimmed, baseUrl).href;
      return PROXY_BASE + encodeURIComponent(abs);
    } catch { return rawUrl; }
  };

  // Rewrite href (except anchors and special schemes)
  html = html.replace(/(\shref\s*=\s*)(["'])([^"']*)\2/gi, (_m, attr, q, url) => {
    return attr + q + resolveAndProxy(url) + q;
  });

  // Rewrite src
  html = html.replace(/(\ssrc\s*=\s*)(["'])([^"']*)\2/gi, (_m, attr, q, url) => {
    return attr + q + resolveAndProxy(url) + q;
  });

  // Rewrite action
  html = html.replace(/(\saction\s*=\s*)(["'])([^"']*)\2/gi, (_m, attr, q, url) => {
    return attr + q + resolveAndProxy(url) + q;
  });

  // Rewrite srcset (multiple URLs)
  html = html.replace(/(\ssrcset\s*=\s*)(["'])([^"']*)\2/gi, (_m, attr, q, srcset) => {
    const rewritten = srcset.replace(/([^\s,]+)(\s+\S+)?/g, (part: string, url: string, descriptor: string) => {
      return resolveAndProxy(url) + (descriptor || '');
    });
    return attr + q + rewritten + q;
  });

  // Rewrite url() in inline styles
  html = html.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (_m, q, url) => {
    return 'url(' + q + resolveAndProxy(url) + q + ')';
  });

  // Inject postMessage navigation tracker + disable service workers
  const injection = `
<script>
(function() {
  // Tell the parent frame our current URL
  function notifyUrl() {
    try { window.parent.postMessage({ type: 'PROXY_NAV', url: '${baseUrl}' }, '*'); } catch {}
  }
  notifyUrl();
  // Intercept pushState/replaceState
  const _push = history.pushState.bind(history);
  history.pushState = function(s,t,u) { _push(s,t,u); notifyUrl(); };
  const _replace = history.replaceState.bind(history);
  history.replaceState = function(s,t,u) { _replace(s,t,u); notifyUrl(); };
  // Unregister service workers (can interfere with proxy)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => { regs.forEach(r => r.unregister()); });
  }
})();
</script>`;

  // Try to inject before </head>, fallback to start
  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, injection + '</head>');
  } else {
    html = injection + html;
  }

  return html;
}

// ─── Rewrite CSS urls ───────────────────────────────────────────
function rewriteCss(css: string, baseUrl: string): string {
  return css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (_m, q, url) => {
    if (!url || url.startsWith('data:') || url.startsWith('/api/v1/browser/')) return _m;
    try {
      const abs = new URL(url.trim(), baseUrl).href;
      return 'url(' + q + PROXY_BASE + encodeURIComponent(abs) + q + ')';
    } catch { return _m; }
  });
}

// ─── Main proxy endpoint ────────────────────────────────────────
router.get('/proxy', async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) return void res.status(400).json({ error: 'Parametro url mancante' });

  let targetUrl: string;
  try { targetUrl = decodeURIComponent(rawUrl); } catch { targetUrl = rawUrl; }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return void res.status(400).json({ error: 'Solo URL http/https sono permessi' });
  }

  try {
    const { body, contentType, finalUrl } = await fetchUrl(targetUrl);

    // Strip headers that block embedding
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Content-Type-Options');

    const ct = contentType.toLowerCase();

    if (ct.includes('text/html')) {
      const html = body.toString('utf-8');
      const rewritten = rewriteHtml(html, finalUrl);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(rewritten);
    } else if (ct.includes('text/css')) {
      const css = body.toString('utf-8');
      const rewritten = rewriteCss(css, finalUrl);
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.send(rewritten);
    } else if (ct.includes('javascript') || ct.includes('application/x-javascript')) {
      // Pass JS through but set content type correctly
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.send(body.toString('utf-8'));
    } else {
      // Binary content (images, fonts, etc.)
      res.setHeader('Content-Type', contentType);
      res.send(body);
    }
  } catch (err: any) {
    const errorPage = `<!DOCTYPE html><html><head><style>
      body { background: #0f1219; color: rgba(224,230,240,0.6); font-family: -apple-system, sans-serif;
             display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .box { text-align: center; max-width: 400px; }
      .icon { font-size: 48px; margin-bottom: 16px; }
      .title { font-size: 18px; font-weight: 600; color: rgba(239,68,68,0.7); margin-bottom: 8px; }
      .msg { font-size: 13px; color: rgba(224,230,240,0.4); line-height: 1.5; }
      .url { font-size: 11px; color: rgba(224,230,240,0.25); margin-top: 12px; word-break: break-all; }
    </style></head><body>
    <div class="box">
      <div class="icon">⚡</div>
      <div class="title">Impossibile caricare la pagina</div>
      <div class="msg">${err.message || 'Errore di rete'}</div>
      <div class="url">${targetUrl}</div>
    </div>
    </body></html>`;
    res.status(502).setHeader('Content-Type', 'text/html; charset=utf-8').send(errorPage);
  }
});

// ─── Text fetch for AI use ──────────────────────────────────────
router.get('/fetch', async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) return void res.status(400).json({ error: 'Parametro url mancante' });

  let targetUrl: string;
  try { targetUrl = decodeURIComponent(rawUrl); } catch { targetUrl = rawUrl; }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return void res.status(400).json({ error: 'Solo URL http/https sono permessi' });
  }

  try {
    const { body, contentType } = await fetchUrl(targetUrl);
    const raw = body.toString('utf-8');

    // Strip scripts and styles, extract text
    const text = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 15000);

    res.json({ url: targetUrl, content: text, contentType });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
