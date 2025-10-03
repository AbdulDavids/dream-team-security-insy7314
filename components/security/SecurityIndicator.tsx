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

  const badgeStyles = secure
    ? 'bg-green-100 text-green-800 border-green-200'
    : 'bg-red-100 text-red-800 border-red-200';

  const statusText = secure ? 'HTTPS + TLS active' : 'HTTP - no TLS';
  const protocolText = checked ? `${protocol || 'unknown'}//${host || ''}` : 'checking...';

  return (
    <div className="w-full border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2 text-sm text-neutral-700">
        <span className={`rounded-md border px-2 py-1 font-medium ${badgeStyles}`}>
          {statusText}
        </span>
        <span className="font-mono text-xs text-neutral-500">{protocolText}</span>
      </div>
    </div>
  );
}
