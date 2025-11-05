import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Audit sink: append JSONL audit entries to a local file and HMAC-sign them.
// Uses AUDIT_SINK_PATH (optional) and AUDIT_SIGN_KEY (hex) from env.

const AUDIT_PATH = process.env.AUDIT_SINK_PATH || path.resolve(process.cwd(), 'logs', 'audit.log');
const SIGN_KEY_HEX = process.env.AUDIT_SIGN_KEY || '';
const SEQ_PATH = AUDIT_PATH + '.seq';

// In-memory buffer used when writes fail temporarily. We keep entries
// and attempt to flush them on subsequent writes. This is best-effort.
const pendingBuffer = [];

// Ensure logs dir exists
try {
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
} catch (e) {
  // ignore
}

function signPayload(payload) {
  if (!SIGN_KEY_HEX) return null;
  try {
    const key = Buffer.from(SIGN_KEY_HEX, 'hex');
    const h = crypto.createHmac('sha256', key);
    h.update(payload);
    return h.digest('hex');
  } catch (err) {
    console.error('Failed to sign audit payload:', err);
    return null;
  }
}

export async function sinkAudit(auditDoc) {
  // Write an audit record to the append-only sink. This function is
  // intentionally resilient: audit writes are important but must not
  // block or crash business flows. We sign payloads, persist a sequence
  // number, and attempt to buffer writes on transient failure.
  try {
    const payload = JSON.stringify({ ts: new Date().toISOString(), audit: auditDoc });
    const signature = signPayload(payload);
    const seq = await readAndIncrementSeq();
    const line = JSON.stringify({ seq, payload, signature }) + '\n';

    // If there are buffered lines from a previous failure attempt, flush
    // them first so the sink maintains order as much as possible.
    if (pendingBuffer.length > 0) {
      const lines = pendingBuffer.splice(0).join('');
      await fs.promises.appendFile(AUDIT_PATH, lines, { encoding: 'utf8' });
    }

    // Append this line atomically to the audit file
    await fs.promises.appendFile(AUDIT_PATH, line, { encoding: 'utf8' });
  } catch (err) {
    // On failure, buffer the line in-memory so a later successful write
    // attempt can flush it. This avoids dropping audit records in many
    // common transient failure scenarios (e.g., temporary filesystem
    // lock). Note: in-memory buffering is not durable across restarts.
    try {
      const payload = JSON.stringify({ ts: new Date().toISOString(), audit: auditDoc });
      const signature = signPayload(payload);
      const seq = Date.now();
      const line = JSON.stringify({ seq, payload, signature }) + '\n';
      pendingBuffer.push(line);
    } catch (bufErr) {
      console.error('Failed to buffer audit sink entry:', bufErr);
    }
    console.error('Failed to write audit sink:', err);
  }
}

async function readAndIncrementSeq() {
  try {
    let seq = 1;
    if (fs.existsSync(SEQ_PATH)) {
      const s = await fs.promises.readFile(SEQ_PATH, 'utf8');
      seq = Number(s) || 1;
    }
    await fs.promises.writeFile(SEQ_PATH, String(seq + 1), 'utf8');
    return seq;
  } catch (err) {
    // Fallback to timestamp-based sequence if filesystem fails
    return Date.now();
  }
}
