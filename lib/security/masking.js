// Simple masking helpers for PII displayed in UI

export function maskAccountNumber(account) {
  if (!account) return '';
  const s = String(account);
  if (s.length <= 4) return '****';
  const last = s.slice(-4);
  return `****${last}`;
}

export function maskSwift(swift) {
  if (!swift) return '';
  const s = String(swift);
  // Show first 4 and last 2 characters if length permits
  if (s.length <= 4) return s;
  if (s.length <= 8) {
    return `${s.slice(0,4)}****`;
  }
  return `${s.slice(0,4)}****${s.slice(-2)}`;
}
