import selfsigned from 'selfsigned';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
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
    { name: 'commonName', value: 'localhost' },
    { name: 'countryName', value: 'ZA' },
    { name: 'stateOrProvinceName', value: 'Local' },
    { name: 'localityName', value: 'Local' },
    { name: 'organizationName', value: 'Dev' },
    { name: 'organizationalUnitName', value: 'Dev' }
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
          { type: 7, ip: '127.0.0.1' }
        ]
      }
    ]
  };
  
  const pems = selfsigned.generate(attrs, options);
  
  writeFileSync(KEY_PATH, pems.private, 'utf8');
  writeFileSync(CERT_PATH, pems.cert, 'utf8');
  
  log('Created:');
  log(` - ${KEY_PATH}`);
  log(` - ${CERT_PATH}`);
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