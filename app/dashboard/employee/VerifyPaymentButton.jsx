"use client";

import { useState, useRef, useEffect } from 'react';

export default function VerifyPaymentButton({ paymentId, csrfToken, swiftCode, amount, needsReauth = false, lastReauthAt = null, reauthWindowSeconds = null }) {
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(null);
  // Local UI state to show an inline modal form instead of a prompt
  const [showForm, setShowForm] = useState(false);
  const [showReauth, setShowReauth] = useState(false);
  const [formSwift, setFormSwift] = useState('');
  // Step-up re-auth password (collected only when needsReauth is true)
  const [reauthPassword, setReauthPassword] = useState('');
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  // This modal is shown first in the two-step flow so the operator can re-enter credentials without mixing them into the confirmation form.
  const reauthModalRef = useRef(null);
  const [totpCode, setTotpCode] = useState('');
  // Track whether a recent reauth has been performed. We keep this boolean
  // so the per-row UI can hide the "Re-auth required" hint when the user
  // has a recent reauth. The global countdown lives in the header.
  const [reauthDone, setReauthDone] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState(null);
  

  // Initialize reauthDone based on server-provided lastReauthAt/window so the per-row state is correct on first render
  useEffect(() => {
    try {
      if (lastReauthAt && reauthWindowSeconds) {
        const last = new Date(lastReauthAt).getTime();
        const expiry = last + Number(reauthWindowSeconds) * 1000;
        if (expiry > Date.now()) {
          setReauthDone(true);
          // Schedule clearing reauthDone when the window expires
          const to = expiry - Date.now();
          const id = setTimeout(() => setReauthDone(false), to);
          return () => clearTimeout(id);
        }
      }
    } catch (e) {
      // ignore
    }
  }, [lastReauthAt, reauthWindowSeconds]);

  // Listen for a global `reauth-success` event so we can update local
  useEffect(() => {
    const timeouts = { ids: [] };
    function onReauth(e) {
      try {
        const { lastReauthAt: lr, reauthWindowSeconds: rws } = e.detail || {};
        if (!lr || !rws) return;
        const last = new Date(lr).getTime();
        const expiry = last + Number(rws) * 1000;
        if (expiry > Date.now()) {
          setReauthDone(true);
          const to = expiry - Date.now();
          const id = setTimeout(() => setReauthDone(false), to);
          // store id so we can clear it if needed
          timeouts.ids.push(id);
        }
      } catch (err) {
        // ignore
      }
    }
    window.addEventListener('reauth-success', onReauth);
    return () => {
      window.removeEventListener('reauth-success', onReauth);
      // clear any pending timeouts created by this listener
      try { timeouts.ids.forEach(i => clearTimeout(i)); } catch (e) {}
    };
  }, []);

  // Ensure we expire the per-row reauthDone immediately when a global reauth-expired event is dispatched
  useEffect(() => {
    function onExpired() {
      setReauthDone(false);
    }
    window.addEventListener('reauth-expired', onExpired);
    return () => window.removeEventListener('reauth-expired', onExpired);
  }, []);

  // Hook to install modal accessibility behaviors when each modal is shown.
  useModalA11y(modalRef, showForm, handleCancel);
  useModalA11y(reauthModalRef, showReauth, handleReauthCancel);
 
  // Trigger verification request to server
  // Open the confirmation form instead of using a browser prompt
  function handleVerify() {
    setError(null);
    setFormSwift('');
    // If server requires step-up auth, prompt for credentials first.
    if (needsReauth) {
      setShowReauth(true);
      setReauthError(null);
      setReauthDone(false);
    } else {
      setShowForm(true);
    }
  }

  // Cancel the inline form
  function handleCancel() {
    setShowForm(false);
    setFormSwift('');
    setError(null);
  }

  // Basic modal accessibility: trap focus and close on Escape
  const SWIFT_REGEX = /^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/;

  // Submit the SWIFT confirmation to the server
  async function handleSubmit(e) {
    e?.preventDefault();
    if (!formSwift) {
      setError('Please enter the SWIFT code to confirm');
      return;
    }

    // Basic client-side SWIFT format validation
    if (!SWIFT_REGEX.test(formSwift.trim())) {
      setError('SWIFT code must be 8 or 11 characters (letters then digits).');
      return;
    }
    // All client-side checks passed; proceed with the verify request
    setLoading(true);
    setError(null);
    try {
      const payload = { paymentId, confirmSwift: formSwift };

      const res = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        // Detect reauth prompts and show the reauth modal
        if (res.status === 401 && data?.error && /reauth/i.test(data.error)) {
          setShowForm(false);
          setShowReauth(true);
          setReauthError(null);
          return;
        }
        setError(data?.error || 'Failed to verify payment');
      } else {
        // Successful verify: update local state and refresh the server-rendered UI
        setVerified(true);
        setShowForm(false);
        window.location.reload();
      }
    } catch (err) {
      setError('Network or server error');
    } finally {
      setLoading(false);
    }
  }

  // Re-authentication step (first modal). Validates password (+TOTP)
  // against the server for this payment's amount without performing the
  // verify operation. On success we proceed to the SWIFT confirmation
  // modal.
  async function handleReauthSubmit(e) {
    e?.preventDefault();
    setReauthError(null);
    if (!reauthPassword || reauthPassword.length < 8) {
      setReauthError('Please enter your password (at least 8 characters)');
      return;
    }


  // Perform a POST to the explicit reauth endpoint.
  // reauth checks credentials and updates lastReauthAt, returning the timestamp and reauthWindowSeconds for a countdown.
  // Only reauth_success or reauth_failure are logged—no raw credentials stored.
  setReauthLoading(true);
    try {
  const payload = { paymentId, reauthPassword };
  if (totpCode) payload.totpCode = totpCode;

      const res = await fetch('/api/auth/reauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        setReauthError(data?.error || 'Re-authentication failed');
        } else {
        // Successful reauth: server returns lastReauthAt and window.
        try {
          const payload = { lastReauthAt: data?.lastReauthAt || new Date().toISOString(), reauthWindowSeconds: Number(data?.reauthWindowSeconds || process.env.REAUTH_WINDOW_SECONDS || 300) };
          window.dispatchEvent(new CustomEvent('reauth-success', { detail: payload }));
        } catch (err) {
          // ignore dispatch errors
        }
        setShowReauth(false);
        // Proceed to SWIFT confirmation
        setShowForm(true);
      }
    } catch (err) {
      setReauthError('Network or server error');
    } finally {
      setReauthLoading(false);
    }
  }

  // Close and reset reauth dialog
  function handleReauthCancel() {
    // Reset local re-auth state when the operator cancels so the UI is returned to a clean state
    setShowReauth(false);
    setReauthError(null);
    setReauthPassword('');
    setTotpCode('');
    setReauthLoading(false);
  }

  // If already verified, show a small label instead of the button
  if (verified) {
    return <span className="text-sm text-emerald-600">Verified</span>;
  }

  return (
    <div>
      {/*The reauth countdown is shown only in the page header to avoid duplicate timers */}
      {/* Visible cue for operators when step-up re-auth is required. This
          shows a small badge and an explicit "Re-authenticate" button*/}
      {needsReauth && !reauthDone && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Re-auth required
          </span>
          <button
            type="button"
            onClick={() => { setShowReauth(true); setReauthError(null); }}
            className="inline-flex items-center px-2.5 py-1 border border-yellow-300 text-sm leading-4 font-medium rounded-md text-yellow-800 bg-white hover:bg-yellow-50"
          >
            Re-authenticate
          </button>
        </div>
      )}
      <button
        onClick={handleVerify}
        disabled={loading}
        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Verifying…' : 'Verify'}
      </button>

      {/* Inline modal-style form for entering SWIFT code */}
      {/* Re-auth modal (first step in two-step flow) */}
      {showReauth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={handleReauthCancel} />
          <form
            ref={reauthModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`reauth-dialog-${paymentId}`}
            onSubmit={handleReauthSubmit}
            className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6 overflow-y-auto max-h-[80vh]"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-2">Re-authenticate to proceed</h3>
            <p className="text-sm text-gray-500 mb-4">For high-value actions you must re-enter your password (and authenticator code if enrolled).</p>

            <label className="block text-sm font-medium text-gray-900">Password</label>
            <input
              name="reauthPassword"
              type="password"
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 px-3 py-2"
              placeholder="Enter your password"
              aria-required={true}
              autoComplete="current-password"
            />
            <label className="block text-sm font-medium text-gray-900 mt-3">Authenticator Code (if enrolled)</label>
            <input
              name="totpCode"
              type="text"
              inputMode="numeric"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 px-3 py-2"
              placeholder="123456"
              maxLength={6}
            />

            {}

            {reauthError && <p className="mt-2 text-sm text-rose-600">{reauthError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleReauthCancel}
                disabled={reauthLoading}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reauthLoading || reauthPassword.length < 8}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {reauthLoading ? 'Checking…' : 'Verify'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={handleCancel} />
          <form
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`verify-dialog-${paymentId}`}
            onSubmit={handleSubmit}
            className="relative bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 p-6 overflow-y-auto max-h-[80vh]"
          >
        <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Recipient SWIFT Code</h3>
        <p className="text-sm text-gray-500 mb-4 break-words whitespace-normal">Enter the recipient's SWIFT code to complete verification. This value will be checked server-side.</p>

            <label className="block text-sm font-medium text-gray-700">SWIFT Code</label>
            <input
              ref={inputRef}
              value={formSwift}
              onChange={(e) => setFormSwift(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2 max-w-full"
              placeholder={swiftCode || 'e.g. ABCDUS33'}
              autoFocus
              maxLength={11}
            />

            {/* Made the SWIFT code visible so the operator can see the target value while typing */}
            {swiftCode && (
              <div className="mt-2 text-sm text-gray-400 break-words">
                Expected SWIFT: <span className="font-mono text-gray-500">{swiftCode}</span>
              </div>
            )}

            {needsReauth && !reauthDone && (
              <p className="mt-4 text-sm text-yellow-700">You must re-authenticate first; please click "Verify" to open the re-auth dialog.</p>
            )}

            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                // The submit button is enabled only when not loading and when either step-up auth is not required or the operator has
                // completed the separate re-auth step. 
                // This prevents credentials from being mixed into the SWIFT form
                disabled={loading || (needsReauth && !reauthDone)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
// We attach listeners only when the modal is shown to avoid global side effects.
function useModalA11y(modalRef, isOpen, onClose) {
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;
    const node = modalRef.current;
    const focusable = node.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first) first.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
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
  }, [modalRef, isOpen, onClose]);
}