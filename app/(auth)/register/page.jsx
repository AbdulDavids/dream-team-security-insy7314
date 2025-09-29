'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        fullName: '',
        userName: '',
        idNumber: '',
        accountNumber: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [csrfToken, setCsrfToken] = useState('');

    // Get CSRF token from cookies on component mount
    useEffect(() => {
        const initializeCSRF = async () => {
        try {
            // Try to get existing CSRF token from cookie first
            const getCsrfFromCookie = () => {
                const cookies = document.cookie.split(';');
                const csrfCookie = cookies.find(cookie => cookie.trim().startsWith('csrf-token='));
                return csrfCookie ? csrfCookie.split('=')[1] : null;
            };
            
            let token = getCsrfFromCookie();
            
            // If no token exists, fetch one from the server
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

    initializeCSRF();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        // Full name validation
        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Full name is required';
        } else if (formData.fullName.trim().length < 2 || formData.fullName.trim().length > 100) {
            newErrors.fullName = 'Full name must be 2-100 characters';
        }

        // Username validation
        if (!formData.userName.trim()) {
            newErrors.userName = 'Username is required';
        } else if (!/^[A-Za-z0-9_]{3,30}$/.test(formData.userName)) {
            newErrors.userName = 'Username must be 3-30 characters and can only contain letters, numbers, and underscores';
        }

        // ID number validation
        if (!formData.idNumber.trim()) {
            newErrors.idNumber = 'ID number is required';
        } else if (!/^\d{13}$/.test(formData.idNumber)) {
            newErrors.idNumber = 'ID number must be exactly 13 digits';
        }

        // Account number validation
        if (!formData.accountNumber.trim()) {
            newErrors.accountNumber = 'Account number is required';
        } else if (!/^\d{7,11}$/.test(formData.accountNumber)) {
            newErrors.accountNumber = 'Account number must be 7-11 digits';
        }

        // Password validation
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.password)) {
            newErrors.password = 'Password must be at least 8 characters, include uppercase, lowercase, number, and special character';
        }

        // Confirm password validation
        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
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
            // Remove confirmPassword from the data sent to backend
            const { confirmPassword, ...registrationData } = formData;
            
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                credentials: 'include',
                body: JSON.stringify(registrationData)
            });

            const data = await response.json();

            if (response.ok) {
                // Update CSRF token from response headers if provided
                const newCsrfToken = data.csrfToken;
                if (newCsrfToken) {
                    setCsrfToken(newCsrfToken);
                }
                
                // Redirect to login page on success
                router.push('/login?registered=true');
            } else {
                if (response.status === 400 && data.errors) {
                    // Handle validation errors
                    setErrors(data.errors);
                } else if (response.status === 409) {
                    // Handle conflict errors (duplicate username, ID, or account number)
                    setErrors({ general: data.error });
                } else if (response.status === 429) {
                    // Handle rate limiting for registration
                     const retryMinutes = data.retryAfterMinutes || Math.ceil(data.retryAfter / 60) || 15;
                     setErrors({ 
                        general: `${data.error} ${data.details || ''} Please try again in ${retryMinutes} minutes.`
                    });
                } else {
                    setErrors({ general: 'An unexpected error occurred. Please try again.' });
                }
            }
        } catch (error) {
            console.error('Registration error:', error);
            setErrors({ general: 'Network error. Please check your connection and try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Create your account
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Or{' '}
                        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                            sign in to your existing account
                        </Link>
                    </p>
                </div>
                
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {/* Full Name Field */}
                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                                Full Name
                            </label>
                            <input
                                id="fullName"
                                name="fullName"
                                type="text"
                                autoComplete="name"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                                    errors.fullName ? 'border-red-300' : 'border-gray-300'
                                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="Enter your full name"
                                value={formData.fullName}
                                onChange={handleInputChange}
                            />
                            {errors.fullName && (
                                <p className="mt-1 text-sm text-red-600">{errors.fullName}</p>
                            )}
                        </div>

                        {/* Username Field */}
                        <div>
                            <label htmlFor="userName" className="block text-sm font-medium text-gray-700">
                                Username
                            </label>
                            <input
                                id="userName"
                                name="userName"
                                type="text"
                                autoComplete="username"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                                    errors.userName ? 'border-red-300' : 'border-gray-300'
                                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="Choose a username"
                                value={formData.userName}
                                onChange={handleInputChange}
                            />
                            {errors.userName && (
                                <p className="mt-1 text-sm text-red-600">{errors.userName}</p>
                            )}
                        </div>

                        {/* ID Number Field */}
                        <div>
                            <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700">
                                ID Number
                            </label>
                            <input
                                id="idNumber"
                                name="idNumber"
                                type="text"
                                autoComplete="off"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                                    errors.idNumber ? 'border-red-300' : 'border-gray-300'
                                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="13-digit ID number"
                                value={formData.idNumber}
                                onChange={handleInputChange}
                            />
                            {errors.idNumber && (
                                <p className="mt-1 text-sm text-red-600">{errors.idNumber}</p>
                            )}
                        </div>

                        {/* Account Number Field */}
                        <div>
                            <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">
                                Account Number
                            </label>
                            <input
                                id="accountNumber"
                                name="accountNumber"
                                type="text"
                                autoComplete="off"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                                    errors.accountNumber ? 'border-red-300' : 'border-gray-300'
                                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="7-11 digit account number"
                                value={formData.accountNumber}
                                onChange={handleInputChange}
                            />
                            {errors.accountNumber && (
                                <p className="mt-1 text-sm text-red-600">{errors.accountNumber}</p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                                    errors.password ? 'border-red-300' : 'border-gray-300'
                                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="Create a strong password"
                                value={formData.password}
                                onChange={handleInputChange}
                            />
                            {errors.password && (
                                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                            )}
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                required
                                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                                    errors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                                placeholder="Confirm your password"
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                            />
                            {errors.confirmPassword && (
                                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                            )}
                        </div>
                    </div>

                    {/* General Error Message */}
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
                                    Creating account...
                                </>
                            ) : (
                                'Create account'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
