import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const useHttps = process.env.DEV_USE_HTTPS === '1' || args.includes('--https');
const filteredArgs = args.filter((arg) => arg !== '--https');

function forwardExit(child) {
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

if (useHttps) {
  const httpsScript = path.join(__dirname, 'start-dev-https.mjs');
  const child = spawn(process.execPath, [httpsScript, ...filteredArgs], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  forwardExit(child);
} else {
  const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
  const isWindows = process.platform === 'win32';
  
  const child = spawn(nextBin, ['dev', '--turbopack', ...filteredArgs], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  
  forwardExit(child);
}
