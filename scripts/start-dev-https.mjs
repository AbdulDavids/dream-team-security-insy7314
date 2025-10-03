import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { parse } from 'url';
import next from 'next';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const listenHost = process.env.DEV_HOST || '127.0.0.1';
const displayHost = process.env.DEV_DISPLAY_HOST || 'localhost';
const httpsPort = Number(process.env.HTTPS_PORT || 3443);
const httpPort = Number(process.env.HTTP_PORT || 3000);

const certDir = process.env.LOCAL_TLS_DIR || path.join(__dirname, '../certs');
const keyPath = process.env.LOCAL_TLS_KEY || path.join(certDir, 'localhost-key.pem');
const certPath = process.env.LOCAL_TLS_CERT || path.join(certDir, 'localhost-cert.pem');

function ensureCertificates() {
  const missing = [keyPath, certPath].filter((filePath) => !fs.existsSync(filePath));
  if (missing.length === 0) {
    return;
  }

  console.error('[TLS] Missing local development certificates.');
  missing.forEach((filePath) => console.error(` - ${filePath}`));
  console.error('\nRun "npm run tls:setup" to generate a self-signed certificate before starting the dev server.');
  process.exit(1);
}

function readCertificates() {
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

async function start() {
  ensureCertificates();

  const app = next({ dev, hostname: listenHost, port: httpsPort });
  const handle = app.getRequestHandler();

  await app.prepare();

  const upgradeHandler = app.getUpgradeHandler();

  const reportServerError = (label, port) => (error) => {
    if (error && (error.code === 'EACCES' || error.code === 'EPERM')) {
      console.error(`[${label}] Unable to bind to port ${port}. Another process may be using it or additional privileges may be required.`);
    } else if (error && error.code === 'EADDRINUSE') {
      console.error(`[${label}] Port ${port} is already in use. Stop the other process or choose a different port.`);
    } else {
      console.error(`[${label}] Server error`, error);
    }
    process.exit(1);
  };

  const httpsServer = createHttpsServer(readCertificates(), async (req, res) => {
    try {
      await handle(req, res, parse(req.url || '', true));
    } catch (error) {
      console.error('[HTTPS] Request handling failed', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  httpsServer.on('upgrade', (req, socket, head) => {
    upgradeHandler(req, socket, head);
  });

  httpsServer.on('error', reportServerError('HTTPS', httpsPort));

  httpsServer.listen(httpsPort, listenHost, () => {
    console.log(`✔ HTTPS dev server ready at https://${displayHost}:${httpsPort}`);
  });

  const httpServer = createHttpServer((req, res) => {
    const hostHeader = req.headers.host || `${displayHost}:${httpPort}`;
    const [host] = hostHeader.split(':');
    const target = `https://${host}:${httpsPort}${req.url || ''}`;

    res.statusCode = 307;
    res.setHeader('Location', target);
    res.end();
  });

  httpServer.on('error', reportServerError('HTTP', httpPort));

  httpServer.listen(httpPort, listenHost, () => {
    console.log(`ℹ HTTP requests on http://${displayHost}:${httpPort} are redirected to HTTPS.`);
  });
}

start().catch((error) => {
  console.error('[startup] Failed to boot HTTPS dev server');
  console.error(error);
  process.exit(1);
});
