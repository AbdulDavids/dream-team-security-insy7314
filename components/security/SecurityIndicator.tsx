'use client';

import { useEffect, useState } from 'react';

type IndicatorState = {
  checked: boolean;
  secure: boolean;
  protocol: string;
  host: string;
};

const initialState: IndicatorState = {
  checked: false,
  secure: false,
  protocol: '',
  host: '',
};

export default function SecurityIndicator() {
  const [state, setState] = useState<IndicatorState>(initialState);

  useEffect(() => {
    try {
      const { protocol, host } = window.location;
      const secure = protocol === 'https:' && window.isSecureContext;
      setState({ checked: true, secure, protocol, host });
    } catch (error) {
      console.error('[SecurityIndicator] Failed to determine protocol', error);
      setState({ ...initialState, checked: true });
    }
  }, []);

  const { checked, secure, protocol, host } = state;

  const label = secure ? 'HTTPS + TLS active' : 'HTTP - no TLS';
  const tooltipDetails = checked
    ? `${label}\n${protocol || 'unknown'}//${host || ''}`
    : 'checking…';

  const iconColor = secure ? 'text-emerald-600' : 'text-rose-600';
  const backgroundColor = secure ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200';

  return (
    <div className="w-full border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex max-w-5xl items-center justify-start px-4 py-2 text-sm text-neutral-700">
        <button
          type="button"
          className={`group relative flex items-center justify-center rounded-full border ${backgroundColor} p-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
          aria-label={label}
        >
          <svg
            aria-hidden="true"
            className={`h-5 w-5 ${iconColor}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 11V7.5a4.5 4.5 0 0 0-9 0V11M7 11h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"
            />
          </svg>
          <span className="pointer-events-none absolute left-0 top-11 z-10 hidden w-56 rounded-md border border-neutral-200 bg-white p-3 text-xs text-neutral-600 shadow-lg group-hover:block group-focus:block whitespace-pre-line">
            {tooltipDetails}
          </span>
        </button>
      </div>
    </div>
  );
}
