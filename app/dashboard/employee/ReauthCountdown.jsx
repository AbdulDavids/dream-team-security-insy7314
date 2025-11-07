"use client";

import { useState, useEffect } from 'react';

// Small client component that shows a persistent re-auth countdown badge.
// - lastReauthAt: ISO string or timestamp when the server recorded last reauth
// - reauthWindowSeconds: number of seconds the reauth remains valid
export default function ReauthCountdown({ lastReauthAt, reauthWindowSeconds = 300 }) {
  const [remaining, setRemaining] = useState('');
  const [expiry, setExpiry] = useState(null);

  useEffect(() => {
    if (!lastReauthAt) return;
    try {
      const last = new Date(lastReauthAt).getTime();
      const e = last + Number(reauthWindowSeconds) * 1000;
      if (isNaN(e) || e <= Date.now()) return;
      setExpiry(e);
    } catch (e) {
      return;
    }
  }, [lastReauthAt, reauthWindowSeconds]);

  // Listen for reauth-success and reauth-expired events
  useEffect(() => {
    function onReauth(e) {
      try {
        const { lastReauthAt: lr, reauthWindowSeconds: rws } = e.detail || {};
        if (!lr || !rws) return;
        const last = new Date(lr).getTime();
        const eTime = last + Number(rws) * 1000;
        if (isNaN(eTime) || eTime <= Date.now()) return;
        setExpiry(eTime);
      } catch (err) {
        // ignore
      }
    }

    function onExpired() {
      setExpiry(null);
      setRemaining('');
    }

    window.addEventListener('reauth-success', onReauth);
    window.addEventListener('reauth-expired', onExpired);

    return () => {
      window.removeEventListener('reauth-success', onReauth);
      window.removeEventListener('reauth-expired', onExpired);
    };
  }, []);

  useEffect(() => {
    if (!expiry) return;
    function update() {
      const now = Date.now();
      // If a global flag was set (e.g., logout) clears the expiry immediately
      try {
        if (window && window.__reauthExpired) {
          setExpiry(null);
          setRemaining('');
          // keep the flag available for other listeners
          try { delete window.__reauthExpired; } catch (e) {}
          return;
        }
      } catch (e) {}
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      const mm = Math.floor(diff / 60).toString().padStart(1, '0');
      const ss = (diff % 60).toString().padStart(2, '0');
      setRemaining(`${mm}:${ss}`);
      if (diff <= 0) {
        // Dispatch an event so other UI pieces can update their state
        try {
          window.dispatchEvent(new CustomEvent('reauth-expired'));
        } catch (e) {
            // ignore
        }
        setExpiry(null);
        setRemaining('');
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiry]);

  if (!expiry) return null;

  return (
    <div className="mb-2">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        Re-authenticated — valid for {remaining || '—'}
      </span>
    </div>
  );
}
