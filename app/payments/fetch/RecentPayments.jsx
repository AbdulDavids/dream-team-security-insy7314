// RecentPayments client component
// Purpose: fetch and render the user's recent payment activity in a compact
// list used on the user's dashboard. Responsibilities:
// - fetch payments from the server using the session cookie
// - provide an acknowledge action that marks verified payments as
//   acknowledged (persisted server-side) so they are hidden from the
//   recent view but remain visible in the full history
// - expose simple loading/error states suitable for server-rendered pages
// Note: this component expects a server-issued CSRF token prop to be
// supplied when making mutating requests.
'use client';

import { useState, useEffect } from 'react';

export default function RecentPayments({ csrfToken }) {
    const [payments, setPayments] = useState([]);
    const [ackInProgress, setAckInProgress] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/payment/fetch', {
                method: 'GET',
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                setPayments(data.payments);
            } else {
                setError(data.error || 'Failed to load payments');
            }
        } catch (err) {
            console.error('Error fetching payments:', err);
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // acknowledgePayment - marks a verified payment as acknowledged for the
    // current user. This call is persisted server-side so the payment will be
    // excluded from the dashboard (recent) view on subsequent loads while still
    // remaining visible in the full history (View All Payments).
    //
    // The API requires the session cookie and a valid CSRF token (sent via
    // the 'x-csrf-token' header). On success we optimistically remove the
    // payment from the local state and then re-fetch to ensure consistency.
    const acknowledgePayment = async (paymentId) => {
        setAckInProgress(paymentId);
        try {
            const res = await fetch('/api/payment/acknowledge', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': csrfToken || ''
                },
                body: JSON.stringify({ paymentId })
            });

            const data = await res.json();

            if (res.ok) {
                // Remove locally then re-fetch the recent list to ensure the
                // server-side acknowledged flag is reflected in the UI.
                setPayments(prev => prev.filter(p => p.paymentId !== paymentId));
                await fetchPayments();
            } else {
                console.error('Acknowledge failed:', data.error || data);
                alert(data.error || 'Failed to acknowledge payment');
            }
        } catch (err) {
            console.error('Network error acknowledging payment:', err);
            alert('Network error. Please try again.');
        } finally {
            setAckInProgress(null);
        }
    };

    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'verified':
                return 'bg-green-100 text-green-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (isLoading) {
        return (
            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        Recent Activity
                    </h3>
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-sm text-gray-500">Loading payments...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                        Recent Activity
                    </h3>
                    <div className="text-center py-8">
                        <div className="text-red-500 mb-2">
                            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-sm text-gray-700">{error}</p>
                        <button
                            onClick={fetchPayments}
                            className="mt-4 inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Used Claude to help create and style the UI
    return (
        <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Recent Activity
                    </h3>
                    <button
                        onClick={fetchPayments}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                        Refresh
                    </button>
                </div>

                {payments.length === 0 ? (
                    <div className="text-center py-8">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No recent activity</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Your payment history will appear here once you start making transactions.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-hidden">
                        <ul className="divide-y divide-gray-200">
                            {payments.map((payment) => (
                                <li key={payment._id} className="py-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {payment.recipientName}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(payment.status)}`}>
                                                        {payment.status}
                                                    </span>
                                                    {payment.status === 'verified' && !payment.acknowledged && (
                                                        <button
                                                            onClick={() => acknowledgePayment(payment.paymentId)}
                                                            disabled={ackInProgress === payment.paymentId}
                                                            className={`ml-2 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 ${ackInProgress === payment.paymentId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            {ackInProgress === payment.paymentId ? 'Acknowledging...' : 'Acknowledge'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-500 truncate mt-1">
                                                {payment.recipientBankName}
                                            </p>
                                            {payment.recipientAccountNumberMasked && (
                                                <p className="text-sm text-gray-400 mt-1">Acct: {payment.recipientAccountNumberMasked}</p>
                                            )}
                                            <div className="flex items-center mt-2 text-xs text-gray-400">
                                                <span>{formatDate(payment.createdAt)}</span>
                                                <span className="mx-2">•</span>
                                                <span className="font-mono">{payment.paymentId}</span>
                                            </div>
                                        </div>
                                        <div className="ml-4 flex-shrink-0 text-right">
                                            <p className="text-sm font-semibold text-gray-900">
                                                {formatCurrency(payment.amount, payment.currency)}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {payment.swiftCodeMasked || payment.swiftCode || '-'}
                                            </p>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}