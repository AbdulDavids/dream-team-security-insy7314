// Employee dashboard (server component)
// Purpose: Show a compact overview for logged-in employees including:
// - basic employee identity cards
// - recent pending payments requiring review/verification
// - recent audit log entries for accountability.
// Notes:
// - This is a Next.js server component and runs on the server during render.
// - Authentication/authorization are validated server-side using session
//   helpers in `lib/auth/session.js` and unauthorized users are redirected.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, requireRole } from '../../../lib/auth/session.js';
// UI and helpers
import LogoutButton from '../user/LogoutButton.jsx';

// Database helpers used server-side in this Next.js server component
import dbConnect from '../../../lib/db/connection.js';
import Payment from '../../../lib/db/models/payment.js';
import Employee from '../../../lib/db/models/employee.js';
import Audit from '../../../lib/db/models/audit.js';

// Client-side component that triggers payment verification
import VerifyPaymentButton from './VerifyPaymentButton.jsx';
import SendToSwiftButton from './SendToSwiftButton.jsx';
import ReauthButton from './ReauthButton.jsx';
import ReauthCountdown from './ReauthCountdown.jsx';

// Add dynamic rendering to prevent caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;


export default async function EmployeeDashboard() {

    // Set cache control headers
    const headersList = await headers();
        
    // Get session from server-side cookies
    const cookieStore = await cookies();

   const cookieHeader = cookieStore.getAll()
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
        
    
    // Create a mock request object for session validation
    const mockRequest = {
        headers: {
            get: (name) => (name === 'cookie' ? cookieHeader : null)
        }
    };

    // Validate session
    const session = getSession(mockRequest);
    
    if (!session || !session.isValid) {
        redirect('/login');
    }

    // Check role-based access
    const roleCheck = requireRole(session, 'employee');
    if (!roleCheck.hasAccess) {
        redirect('/login');
    }

    const { user, csrfToken } = session;

    // Fetch payments for the employee dashboard (server-side)
    //
    // Rationale:
    // - We want the dashboard to show items that still require an employee's
    //   attention. A payment that has been VERIFIED still requires an explicit
    //   operator action to transmit to SWIFT, so it should remain visible.
    // - Historically this UI only returned payments with status:'pending',
    //   which caused verified items to disappear immediately after verification
    //   (on the next render). That made it look like verification implicitly
    //   completed the entire workflow; in reality we require an explicit send
    //   action. Returning both 'pending' and 'verified' (but excluding already
    //   sent items) keeps the UI behavior consistent with the actual state
    //   machine and improves operator clarity.
    //
    // Implementation details:
    // - Query for status in ['pending', 'verified'] so both phases appear.
    // - Exclude `sentToSwift: true` so items already transmitted do not show.
    // - Keep a small limit (10) and sort by createdAt desc to keep the page fast.
    // - This query runs on the server (Next.js server component) and is the
    //   authoritative source for what the employee sees in the table.
    await dbConnect();

    const pendingPayments = await Payment.find({
        status: { $in: ['pending', 'verified'] },
        sentToSwift: { $ne: true }
    })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    // Fetch the employee record to obtain last reauth info so the UI can
    // display a persistent countdown after a successful reauth (even if the
    // page is reloaded). This keeps the operator informed about how long
    // the recent reauth remains valid.
    const employeeRecord = await Employee.findById(user.userId).lean();
    const lastReauthAt = employeeRecord?.lastReauthAt || null;
    const reauthWindowSeconds = Number(process.env.REAUTH_WINDOW_SECONDS || 300);

    // Determine the server-side step-up threshold so the UI can present
    // a password field for high-value payments. The server remains
    // authoritative; this prop simply improves UX by showing the field
    // when appropriate.
    const STEP_UP_THRESHOLD = Number(process.env.PAYMENT_STEP_UP_THRESHOLD || 10000);

    // Fetch recent audit logs for this employee (server-side) - show last 20
    // The audit log is used to display a simple history of actions performed
    // by this employee (login, verify, send). We query by the employee's
    // ObjectId so they only see events pertaining to their account.
    const auditLogs = await Audit.find({ employeeId: user.userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

    // Print audit logs to the server terminal rather than rendering them in
    // the employee dashboard UI. This keeps sensitive operational traces out
    // of the browser view while preserving them for operators who can access
    // server logs. The server component runs during render so console output
    // will appear in the server process' stdout (dev terminal or hosting
    // platform logs).
    try {
        console.info(`Audit log for employee ${user.userName} (${user.userId}):`);
        // Print a concise JSON summary; avoid printing raw secrets.
        console.info(auditLogs.map(a => ({ when: a.createdAt, action: a.action, paymentId: a.paymentId, details: a.details })));
    } catch (logErr) {
        // Do not block rendering if logging fails; just output an error to the
        // server console for diagnostics.
        console.error('Failed to write audit log to server console:', logErr);
    }

    // IMPORTANT: Audit handling notes
    // - In development this console output will appear in the terminal where
    //   Next.js is running (e.g., the `npm run dev` window). In production
    //   you should route audit entries to a secure, append-only log store
    //   (SIEM / log aggregation) rather than printing to stdout.
    // - The audit `details` object may contain sensitive metadata. We log a
    //   concise summary above but avoid rendering raw secret fields in the UI.
    // - If you later reintroduce any audit UI, be careful to redact sensitive
    //   fields and ensure the page is only accessible to authorized operators.

    // Used Claude to help create and style the UI
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">
                                Employee Dashboard
                            </h1>
                        </div>
                            <div className="flex items-center gap-3">
                                <ReauthButton csrfToken={csrfToken} lastReauthAt={lastReauthAt} reauthWindowSeconds={reauthWindowSeconds} />
                                {/* Show a persistent reauth countdown in the header so operators
                                    always see how long their step-up auth remains valid. */}
                                <ReauthCountdown lastReauthAt={lastReauthAt} reauthWindowSeconds={reauthWindowSeconds} />
                                <LogoutButton csrfToken={csrfToken} />
                            </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    {/* Dashboard Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {/* User Info Card */}
                        <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">
                                                Employee ID
                                            </dt>
                                            <dd className="text-lg font-medium text-gray-900">
                                                {user.userName}
                                            </dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Full Name Card */}
                        <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">
                                                Full Name
                                            </dt>
                                            <dd className="text-lg font-medium text-gray-900">
                                                {user.fullName}
                                            </dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Role Card */}
                        <div className="bg-white overflow-hidden shadow rounded-lg">
                            <div className="p-5">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="ml-5 w-0 flex-1">
                                        <dl>
                                            <dt className="text-sm font-medium text-gray-500 truncate">
                                                Role
                                            </dt>
                                            <dd className="text-lg font-medium text-gray-900 capitalize">
                                                {user.role}
                                            </dd>
                                        </dl>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Pending Payments */}
                    <div className="bg-white shadow rounded-lg mt-6">
                        <div className="px-4 py-5 sm:p-6">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                                        Recent Pending / Verified Payments
                                                        {/*
                                                            Small note for future maintainers: this section intentionally
                                                            includes both pending and verified-but-not-sent payments. The
                                                            Send-to-SWIFT action (client -> POST /api/payment/send) is
                                                            what transitions an item to `sentToSwift: true`, which will
                                                            then exclude it from this list on subsequent renders.
                                                        */}
                                                </h3>
                            {/* If there are no pending payments show friendly placeholder */}
                            {pendingPayments.length === 0 ? (
                                <div className="text-center py-8">
                                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                    <h3 className="mt-2 text-sm font-medium text-gray-900">No pending payments</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Pending client payment information will appear here when available.
                                    </p>
                                </div>
                            ) : (
                                /* Render a table of pending payments. Each row includes a Verify button
                                   that calls a client-side API to verify the payment. The Verify button
                                   receives the server-side CSRF token so it can present it in the
                                   `x-csrf-token` header (double-submit cookie pattern used elsewhere
                                   in this app). */
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment ID</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                                                {/* Display the beneficiary's SWIFT/BIC here so the employee can
                                                    visually verify the bank identifier before taking action.
                                                    The authoritative comparison is still performed server-side
                                                    when the employee submits the Verify form. */}
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SWIFT Code</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                                                                        {pendingPayments.map((p) => (
                                                                                                <tr key={p.paymentId}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.paymentId}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.amount} {p.currency}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.recipientName}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.swiftCode || '-'}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(p.createdAt).toLocaleString()}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex items-center gap-2">
                                                                                                                {/* Render Verify only for pending payments. For already-
                                                                                                                        verified items we show a static label so the Verify
                                                                                                                        button does not reappear after the employee verifies. */}
                                                                                                                                                                        {p.status === 'pending' ? (
                                                                                                                    <VerifyPaymentButton
                                                                                                                        paymentId={p.paymentId}
                                                                                                                        csrfToken={csrfToken}
                                                                                                                        swiftCode={p.swiftCode}
                                                                                                                        amount={p.amount}
                                                                                                                        needsReauth={p.amount >= STEP_UP_THRESHOLD}
                                                                                                                        lastReauthAt={lastReauthAt}
                                                                                                                        reauthWindowSeconds={reauthWindowSeconds}
                                                                                                                    />
                                                                                                                ) : (
                                                                                                                    <span className="text-sm text-emerald-600">Verified</span>
                                                                                                                )}

                                                                                                                {/* Only show the Send button when the payment is VERIFIED.
                                                                                                                        This keeps the UI consistent and prevents the operator
                                                                                                                        from attempting a send before verification. The server
                                                                                                                        still enforces this invariant as well. */}
                                                                                                                {p.status === 'verified' ? (
                                                                                                                    <SendToSwiftButton paymentId={p.paymentId} csrfToken={csrfToken} amount={p.amount} needsReauth={p.amount >= STEP_UP_THRESHOLD} />
                                                                                                                ) : (
                                                                                                                    <button disabled className="ml-2 inline-flex items-center px-3 py-1.5 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-gray-300">Awaiting verification</button>
                                                                                                                )}
                                                        
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Audit Log */}
                    <div className="bg-white shadow rounded-lg mt-6">
                        <div className="px-4 py-5 sm:p-6">
                            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Audit Log</h3>
                                    <div className="text-sm text-gray-500">Audit log output is written to the server terminal (stdout). Check your server logs to view recent audit events for this employee.</div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
