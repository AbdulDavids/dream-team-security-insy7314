import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, requireRole } from '../../../lib/auth/session.js';
import AllPayments from './AllPayments';
import Link from 'next/link';

export default async function AllPaymentsPage() {
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
    const roleCheck = requireRole(session, 'user');
    if (!roleCheck.hasAccess) {
        redirect('/login');
    }

    const { user, csrfToken } = session;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                All Payments
                            </h1>
                            <p className="text-sm text-gray-600 mt-1">
                                View your complete payment history
                            </p>
                        </div>
                        <Link
                            href="/dashboard/user"
                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <AllPayments csrfToken={csrfToken} userName={user.userName} />
            </main>
        </div>
    );
}