"use client";

import { useState } from 'react';
import { useRef, useEffect } from 'react';

// Client-side button to trigger sending a verified payment to SWIFT
// (simulated). This component's responsibilities and constraints:
// - UI: confirm the operator's intent (uses a browser confirm by default).
// - Network: POSTs to `/api/payment/send` with { paymentId } and includes
//   the `x-csrf-token` header. The endpoint requires an authenticated
//   employee session; the session cookie must be present in the request.
// - Behavior: on success the component reloads the page so server-rendered
//   lists update. For better UX this could be converted to a client-driven
//   flow to avoid a full reload.
// - Security: this is a simulated flow for the demo. A real SWIFT/gateway
//   integration must address credential management, request signing,
//   idempotency, retries, and robust error handling. Audit records are
//   written server-side to record who sent what and when.
export default function SendToSwiftButton({ paymentId, csrfToken, amount, needsReauth = false }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const modalRef = useRef(null);

  // Open confirmation modal
  function openModal() {
    setError(null);
    setReauthPassword('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setError(null);
  }

  // Basic modal accessibility: trap focus and close on Escape
  useEffect(() => {
    if (!showModal || !modalRef.current) return;
    const node = modalRef.current;
    const focusable = node.querySelectorAll('a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (first) first.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
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
  }, [showModal]);

// Note: the modal focus-trap implemented above is a lightweight helper to
// improve keyboard accessibility. For more complete handling (focus
// restoration, nested modals, screen reader optimizations) consider using
// a maintained library such as `focus-trap-react` or a UI framework's
// dialog component.

  async function handleSend(e) {
    e?.preventDefault();
    // Client-side validation for re-auth password when required. This
    // improves UX by failing fast; server-side check remains authoritative.
    if (needsReauth && (!reauthPassword || reauthPassword.length < 8)) {
      setError('Please enter your password (at least 8 characters) to continue');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = { paymentId };
      if (needsReauth) payload.reauthPassword = reauthPassword;
      if (needsReauth && totpCode) payload.totpCode = totpCode;

      const res = await fetch('/api/payment/send', {
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
        setError(data?.error || 'Failed to send payment to SWIFT');
      } else {
        setSent(true);
        setShowModal(false);
        // Refresh to update server-rendered lists
        window.location.reload();
      }
    } catch (err) {
      setError('Network or server error');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return <span className="text-sm text-indigo-600">Sent to SWIFT</span>;
  }

  return (
    <div>
      <button
        onClick={openModal}
        disabled={loading}
        className="ml-2 inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? 'Sending…' : 'Send to SWIFT'}
      </button>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}

      {/* Modal confirmation for send-to-SWIFT. If needsReauth is true the
          modal will collect a password to perform server-side step-up auth. */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <form ref={modalRef} role="dialog" aria-modal="true" aria-labelledby={`send-dialog-${paymentId}`} onSubmit={handleSend} className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-2">Send Payment to SWIFT</h3>
      {/* Use explicit trimmed sentence and ensure wrapping so the copy fits
        inside the modal container on narrow screens. `break-words` +
        `whitespace-normal` allow the sentence to wrap without overflow. */}
      <p className="text-sm text-gray-500 mb-4 break-words whitespace-normal">This action will transmit the verified payment to SWIFT</p>

            {needsReauth && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Re-auth Password</label>
                <input
                  type="password"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
                  placeholder="Enter your password"
                />
                <p className="mt-1 text-xs text-gray-400">Minimum 8 characters. Required for high-value sends.</p>
                <label className="block text-sm font-medium text-gray-700 mt-3">Authenticator Code (optional)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm px-3 py-2"
                  placeholder="123456"
                  maxLength={6}
                />
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={loading || (needsReauth && reauthPassword.length < 8)} className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700">{loading ? 'Sending…' : 'Send to SWIFT'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
