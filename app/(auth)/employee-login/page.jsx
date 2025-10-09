'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EmployeeLoginPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        employeeId: '',
        password: ''
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [csrfToken, setCsrfToken] = useState('');

    // Get CSRF token 
    useEffect(() => {
        const initializeCSRF = async () => {
            try {
                const getCsrfFromCookie = () => {
                    const cookies = document.cookie.split(';');
                    const csrfCookie = cookies.find(cookie => cookie.trim().startsWith('csrf-token='));
                    return csrfCookie ? csrfCookie.split('=')[1] : null;
                };
                
                let token = getCsrfFromCookie();
                
                if (!token) {
                    const response = await fetch('/api/auth/csrf-token');
                    if (response.ok) {
                        const data = await response.json();
                        token = data.csrfToken;
                    }
                }
                
                if (token) {
                    setCsrfToken(token);
                }
                
            } catch (error) {
                console.error('Failed to initialize CSRF token:', error);
            }
        };

        // Initialize CSRF token
        initializeCSRF();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.employeeId.trim()) {
            newErrors.employeeId = 'Employee ID is required';
        } else if (!/^EMP\d{3}$/.test(formData.employeeId)) {
            newErrors.employeeId = 'Employee ID must be in format EMP### (e.g., EMP001)';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setIsLoading(true);
        setErrors({});

        try {
            const response = await fetch('/api/auth/employee-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // Update CSRF token
                if (data.csrfToken) {
                    setCsrfToken(data.csrfToken);
                }
                
                // Redirect to employee dashboard
                router.push('/dashboard/employee');
            } else {
                if (response.status === 400 && data.details) {
                    setErrors(data.details);
                } else if (response.status === 401) {
                    setErrors({ general: data.error });
                } else if (response.status === 403) {
                    setErrors({ general: data.error + ' Please refresh the page and try again.' });
                } else if (response.status === 429) {
                    const retryMinutes = data.retryAfterMinutes || Math.ceil(data.retryAfter / 60) || 15;
                    setErrors({ 
                        general: `${data.error} ${data.details || ''} Please try again in ${retryMinutes} minutes.`
                    });
                } else {
                    setErrors({ general: data.error || 'An unexpected error occurred. Please try again.' });
                }
            }
        } catch (error) {
            console.error('Employee login error:', error);
            setErrors({ general: 'Network error. Please check your connection and try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    // Used Claude to help create and style the UI
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                {/* Back Button */}
                <div className="flex justify-start">
                    <Link 
                        href="/"
                        className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </Link>
                </div>
                
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Employee Login
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        For authorized employees only.{' '}
                        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                            Customer login
                        </Link>
                    </p>
                </div>
                
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        {/* Employee ID Field */}
                        <div>
                            <label htmlFor="employeeId" className="sr-only">
                                Employee ID
                            </label>
                            <input
                                id="employeeId"
                                name="employeeId"
                                type="text"
                                autoComplete="off"
                                required
                                className={`appearance-none rounded-t-md relative block w-full px-3 py-2 border ${
                                    errors.employeeId ? 'border-red-300' : 'border-gray-300'
                                } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="Employee ID (e.g., EMP001)"
                                value={formData.employeeId}
                                onChange={handleInputChange}
                            />
                            {errors.employeeId && (
                                <p className="mt-1 text-sm text-red-600">{errors.employeeId}</p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className={`appearance-none rounded-b-md relative block w-full px-3 py-2 border ${
                                    errors.password ? 'border-red-300' : 'border-gray-300'
                                } placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="Password"
                                value={formData.password}
                                onChange={handleInputChange}
                            />
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                            )}
                        </div>
                    </div>

                    {/* Error Message */}
                    {errors.general && (
                        <div className="rounded-md bg-red-50 p-4">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">
                                        {errors.general}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}