"use client";

import { useState, useRef, useEffect } from 'react';

// Client-side component for verifying a single payment.
// Responsibilities and security notes:
// - Expects `paymentId` and the server-issued `csrfToken` (from the server
//   component). The CSRF token is sent in the `x-csrf-token` header using the
//   double-submit cookie pattern implemented in this app.
// - As an additional human-validation step, the component prompts the
//   employee to re-enter/confirm the recipient SWIFT code. The entered value
//   is sent to the server as `confirmSwift`; the server performs the
//   authoritative comparison against the stored `payment.swiftCode`.
// - On successful verification the component will reload the dashboard so
//   that the server-rendered pending payments list is refreshed. Reloading
//   keeps the server component simple; for a richer UX we could convert the
//   pending table to a client component and update it without a full reload.
export default function VerifyPaymentButton({ paymentId, csrfToken, swiftCode, amount, needsReauth = false }) {
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
  // Ref for the re-authentication modal (separate from the SWIFT confirm modal)
  // This modal is shown first in the two-step flow so the operator can
  // re-enter credentials without mixing them into the confirmation form.
  const reauthModalRef = useRef(null);
  const [totpCode, setTotpCode] = useState('');
  const [reauthDone, setReauthDone] = useState(false);
  const [reauthLoading, setReauthLoading] = useState(false);
  const [reauthError, setReauthError] = useState(null);
  const [reauthExpiry, setReauthExpiry] = useState(null); // timestamp ms when reauth expires
  const [reauthRemaining, setReauthRemaining] = useState(''); // human-friendly remaining time

  // Hook to install modal accessibility behaviors when each modal is shown.
  // We attach the same small focus-trap / Escape handler to both the
  // SWIFT confirmation modal (`modalRef`) and the re-auth modal
  // (`reauthModalRef`) so keyboard users can interact predictably.
  useModalA11y(modalRef, showForm, handleCancel);
  useModalA11y(reauthModalRef, showReauth, handleReauthCancel);

  // Countdown effect: when `reauthExpiry` is set we update the
  // `reauthRemaining` display every second. When the expiry passes we
  // clear the `reauthDone` flag so the UI returns to the pre-auth state.
  useEffect(() => {
    if (!reauthExpiry) return;
    function update() {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((reauthExpiry - now) / 1000));
      const mm = Math.floor(diff / 60).toString().padStart(1, '0');
      const ss = (diff % 60).toString().padStart(2, '0');
      setReauthRemaining(`${mm}:${ss}`);
      if (diff <= 0) {
        setReauthDone(false);
        setReauthExpiry(null);
        setReauthRemaining('');
      }
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [reauthExpiry]);

// Developer note:
// The reauth window is server-driven. When a successful re-auth occurs the
// server returns `lastReauthAt` and a `reauthWindowSeconds` value. We compute
// an expiry locally (last + window) and show a countdown so the operator
// understands how long the step-up authentication remains valid. The server
// remains authoritative: even if the client thinks reauth is valid, the
// server may require credentials again if its window state changed or if
// an operation's risk threshold increased.

// Note: The modal accessibility helper above is intentionally small and
// dependency-free. It covers the common cases (focus trap and Escape to
// close). For production-grade accessibility and edge-case handling you
// may prefer a well-tested library such as `focus-trap-react`.

// Note: The modal accessibility helper above is intentionally small and
// dependency-free. It covers the common cases (focus trap and Escape to
// close). For production-grade accessibility and edge-case handling you
// may prefer a well-tested library such as `focus-trap-react`.
 

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

  // Client-side SWIFT format validation to catch obvious mistakes before
  // making a network request. Server-side validation remains authoritative.
  const SWIFT_REGEX = /^[A-Za-z]{6}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/;

  // Submit the SWIFT confirmation to the server
  async function handleSubmit(e) {
    e?.preventDefault();
    if (!formSwift) {
      setError('Please enter the SWIFT code to confirm');
      return;
    }

    // Basic client-side format check to ensure the operator didn't paste a
    // very long/unexpected value that would break UI or always fail server
    // validation. This improves UX by surfacing the problem immediately.
    if (!SWIFT_REGEX.test(formSwift.trim())) {
      setError('SWIFT code must be 8 or 11 characters (letters then digits).');
      return;
    }

    // At this stage the client should have already performed re-auth when
    // required (two-step flow). The SWIFT confirmation itself does not
    // re-check the password here — the server will still enforce re-auth
    // if the reauth window expired between steps.

    // Mark loading and clear prior errors. The verify endpoint performs the
    // authoritative check (including a server-side reauth requirement when
    // appropriate), then transitions the payment to `verified` on success.
    // Behavior notes:
    // - The client only sends `confirmSwift`; any prior re-auth step is
    //   performed separately via `/api/auth/reauth` and updates the
    //   employee's `lastReauthAt` on the server.
    // - If the server returns 401 with a reauth-related message we open the
    //   reauth modal so the operator can complete credentials without losing context.
    // - On successful verification we reload the page to refresh the server
    //   rendered pending/verified list (the server decides which payments to
    //   surface). This keeps the server-side rendering simple and authoritative.
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
        // Server may require explicit re-auth even if the client believed the
        // session to be valid. Detect reauth prompts and show the reauth modal
        // so the operator can provide credentials without losing context.
        if (res.status === 401 && data?.error && /reauth/i.test(data.error)) {
          setShowForm(false);
          setShowReauth(true);
          setReauthError(null);
          return;
        }
        setError(data?.error || 'Failed to verify payment');
      } else {
        // Successful verify: update local state and refresh the server-rendered
        // UI. We intentionally keep the UI simple by reloading so list queries
        // executed server-side remain authoritative about what to display.
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


  // Perform a POST to the explicit reauth endpoint. Implementation notes:
  // - The `/api/auth/reauth` route validates credentials and, on success,
  //   updates the employee's `lastReauthAt` on the server. The server returns
  //   that timestamp and the configured `reauthWindowSeconds` so the client
  //   can show a helpful countdown.
  // - We never store or log raw credentials in the audit; only a minimal
  //   `reauth_success` or `reauth_failure` audit entry is written server-side.
  // - The helper here only requests reauth; it does NOT perform the verify
  //   operation itself. After a successful reauth we open the SWIFT confirm
  //   modal and the operator submits the `confirmSwift` value separately.
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
        // Successful reauth: server returns lastReauthAt and window seconds
        // so we can compute an expiry and show a countdown to the operator.
        try {
          const last = data?.lastReauthAt ? new Date(data.lastReauthAt).getTime() : Date.now();
          const windowSec = Number(data?.reauthWindowSeconds || process.env.REAUTH_WINDOW_SECONDS || 300);
          const expiry = last + windowSec * 1000;
          setReauthExpiry(expiry);
          setReauthDone(true);
        } catch (err) {
          // Fallback: mark as done without expiry info
          setReauthDone(true);
          setReauthExpiry(null);
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
    // Reset local re-auth state when the operator cancels so the UI is
    // returned to a clean state. We intentionally do not alter any server
    // side state here; canceling simply abandons the attempt.
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
      {/* After a successful re-auth show a small validity indicator with
          a countdown so the operator knows how long the reauth window
          remains valid. */}
      {reauthDone && reauthExpiry && (
        <div className="mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
            Re-authenticated — valid for {reauthRemaining || '—'}
          </span>
        </div>
      )}
      {/* Visible cue for operators when step-up re-auth is required. This
          shows a small badge and an explicit "Re-authenticate" button so
          the operator can proactively perform the credential step before
          opening the SWIFT confirmation. This improves discoverability
          compared with relying solely on the SWIFT modal's warning. */}
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

            {/* Payment ID confirmation removed — paymentId is optional for reauth */}

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

            {/* In the two-step flow, we perform re-authentication first. If
                `reauthDone` is false and `needsReauth` is true, the
                re-auth modal will have been shown already; the SWIFT
                confirmation here is purely the human check and does not
                collect the password. */}
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
                // The submit button is enabled only when not loading and when
                // either step-up auth is not required or the operator has
                // completed the separate re-auth step (`reauthDone`). This
                // prevents credentials from being mixed into the SWIFT form
                // and enforces the two-step UX.
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

// Accessibility: trap focus inside the modal and allow Escape to close.
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
// Note: The modal accessibility helper above is intentionally small and
// dependency-free. It covers the common cases (focus trap and Escape to
// close). For production-grade accessibility and edge-case handling you
// may prefer a well-tested library such as `focus-trap-react`.
