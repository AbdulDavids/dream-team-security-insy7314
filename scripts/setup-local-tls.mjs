import selfsigned from 'selfsigned';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CERT_DIR = process.env.LOCAL_TLS_DIR || join(__dirname, '..', 'certs');
const KEY_PATH = process.env.LOCAL_TLS_KEY || join(CERT_DIR, 'localhost-key.pem');
const CERT_PATH = process.env.LOCAL_TLS_CERT || join(CERT_DIR, 'localhost-cert.pem');

function log(message) {
  console.log(`[tls:setup] ${message}`);
}

function ensureDirectory() {
  if (!existsSync(CERT_DIR)) {
    mkdirSync(CERT_DIR, { recursive: true });
  }
}

function certificatesExist() {
  return existsSync(KEY_PATH) && existsSync(CERT_PATH);
}

function createCertificate() {
  log(`Generating self-signed certificate in ${CERT_DIR}`);
  
  const attrs = [
    { name: 'commonName', value: process.env.LOCAL_TLS_CN || 'localhost' },
    { name: 'countryName', value: process.env.LOCAL_TLS_C || 'ZA' },
    { name: 'stateOrProvinceName', value: process.env.LOCAL_TLS_ST || 'Local' },
    { name: 'localityName', value: process.env.LOCAL_TLS_L || 'Local' },
    { name: 'organizationName', value: process.env.LOCAL_TLS_O || 'Dev' },
    { name: 'organizationalUnitName', value: process.env.LOCAL_TLS_OU || 'Dev' }
  ];
  
  const options = {
    keySize: 2048,
    days: parseInt(process.env.LOCAL_TLS_DAYS || '365', 10),
    algorithm: 'sha256',
    extensions: [
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' }
        ]
      }
    ]
  };
  
  const pems = selfsigned.generate(attrs, options);
  
  writeFileSync(KEY_PATH, pems.private, 'utf8');
  writeFileSync(CERT_PATH, pems.cert, 'utf8');
  
  log('Created certificate and key files:');
  log(` - ${basename(KEY_PATH)}`);
  log(` - ${basename(CERT_PATH)}`);
}

function main() {
  ensureDirectory();

  if (certificatesExist()) {
    log('Existing certificate found. Skipping regeneration.');
    process.exit(0);
  }

  createCertificate();
  log('Certificate generated successfully!');
  log('Remember to trust the generated certificate in your OS/browser for a warning-free experience.');
}

main();