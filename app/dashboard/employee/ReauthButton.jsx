"use client";

import { useState, useRef, useEffect } from 'react';

export default function ReauthButton({ csrfToken, lastReauthAt = null, reauthWindowSeconds = null }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open || !modalRef.current) return;
    const node = modalRef.current;
    const focusable = node.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first) first.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // This component will listen for 'reauth-success' and 'reauth-expired' events to update
  useEffect(() => {
    try {
      if (lastReauthAt && reauthWindowSeconds) {
        const last = new Date(lastReauthAt).getTime();
        const exp = last + Number(reauthWindowSeconds) * 1000;
        if (exp > Date.now()) setDone(true);
      }
    } catch (e) {
      // ignore
    }
  }, [lastReauthAt, reauthWindowSeconds]);

  // Listen for global reauth events so we can toggle the button visibility  without setting intervals here.
  useEffect(() => {
    function onSuccess(e) {
      setDone(true);
    }
    function onExpired() {
      setDone(false);
    }
    window.addEventListener('reauth-success', onSuccess);
    window.addEventListener('reauth-expired', onExpired);
    return () => {
      window.removeEventListener('reauth-success', onSuccess);
      window.removeEventListener('reauth-expired', onExpired);
    };
  }, []);

  async function submit(e) {
    e?.preventDefault();
    setError(null);
    if (!password || password.length < 8) {
      setError('Please enter your password (at least 8 chars)');
      return;
    }
    setLoading(true);
    try {
  const payload = { reauthPassword: password };
      const res = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Re-auth failed');
      } else {
        const last = data?.lastReauthAt ? new Date(data.lastReauthAt).getTime() : Date.now();
        const windowSec = Number(data?.reauthWindowSeconds || 300);
        setDone(true);
        // Notify other UI components that a reauth just occurred (for countdowns, etc)
        try {
          const ev = new CustomEvent('reauth-success', { detail: { lastReauthAt: data?.lastReauthAt || new Date(last).toISOString(), reauthWindowSeconds: windowSec } });
          window.dispatchEvent(ev);
        } catch (e) {
          // best-effort
        }
        setOpen(false);
        setPassword('');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {!done && (
        <button
          type="button"
          onClick={() => { setOpen(true); setError(null); }}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          Re-authenticate
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <form ref={modalRef} onSubmit={submit} className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6 overflow-y-auto max-h-[80vh]">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Re-authenticate</h3>
            <p className="text-sm text-gray-500 mb-4">Enter your password to perform high-value operations.</p>
            <label className="block text-sm font-medium text-gray-900">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm text-gray-900 px-3 py-2" placeholder="Current password" autoComplete="current-password" />
            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={loading} className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700">{loading ? 'Checking…' : 'Verify'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
