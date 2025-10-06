import { rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CERT_DIR = process.env.LOCAL_TLS_DIR || join(__dirname, '..', 'certs');

function log(message) {
  console.log(`[tls:clean] ${message}`);
}

if (existsSync(CERT_DIR)) {
  rmSync(CERT_DIR, { recursive: true, force: true });
  log(`Removed certificates directory: ${CERT_DIR}`);
} else {
  log('No certificates directory found. Nothing to clean.');
}