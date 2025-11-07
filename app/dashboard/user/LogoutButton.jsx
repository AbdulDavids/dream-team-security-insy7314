'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutButton({ csrfToken }) {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogout = async () => {
        setIsLoading(true);
        
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify({ csrfToken })
            });

            if (response.ok) {
                // Mark global flag and notify other components that any reauth
                // window should expire. The global flag helps components that
                // check state in tight intervals or may miss the event during
                // navigation.
                try {
                    window.__reauthExpired = true;
                } catch (e) {}
                try {
                    window.dispatchEvent(new CustomEvent('reauth-expired'));
                } catch (e) {
                    // ignore
                }

                // Clear client-side storage
                sessionStorage.clear();
                localStorage.clear();

                // Redirect to login page on successful logout
                window.location.replace('/login?logout=true');
            } else {
                const data = await response.json();
                console.error('Logout failed:', data.error);
                
                // Ensure reauth countdown is expired for any listening components
                try { window.dispatchEvent(new CustomEvent('reauth-expired')); } catch (e) {}
                // Still redirect on error to be safe
                window.location.replace('/login');
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Ensure other components know the reauth window is over
            try { window.dispatchEvent(new CustomEvent('reauth-expired')); } catch (e) {}
            // Still redirect on error to be safe
            router.push('/login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleLogout}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Logging out...
                </>
            ) : (
                <>
                    <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                </>
            )}
        </button>
    );
}
