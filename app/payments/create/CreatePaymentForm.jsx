'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatePaymentForm({csrfToken, userName}){
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        // Step 1: Payment Details
        amount: '',
        currency: 'ZAR',
        paymentProvider: 'SWIFT',
        // Step 2: Recipient Details
        recipientName: '',
        recipientBankName: '',
        recipientAccountNumber: '',
        swiftCode: '',
        reference: ''
    });
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

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

    // Client-side validation

    const validateStep1 = () => {
        const newErrors = {};

        // Validate amount
        if(!formData.amount || !formData.amount.toString().trim()){
            newErrors.amount = 'Please enter an amount';
        }
        else{
            const numAmount = parseFloat(formData.amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                newErrors.amount = 'Amount must be greater than 0';
            } else if (numAmount > 999999.99) {
                newErrors.amount = 'Amount cannot exceed 999,999.99';
            } else if (!/^\d+(\.\d{1,2})?$/.test(formData.amount)) {
                newErrors.amount = 'Amount must have at most 2 decimal places';
            }
        }

        // Validate currency
        if(!formData.currency){
            newErrors.currency = 'Please select a currency'
        }

        // Return errors
        if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return false;
        }

        return true;
    };

    const validateStep2 = () => {
        const newErrors = {};

        // Validate recipient name
        if (!formData.recipientName.trim()) {
            newErrors.recipientName = 'Please enter recipient name';
        } else if (formData.recipientName.trim().length < 2 || formData.recipientName.trim().length > 100) {
            newErrors.recipientName = 'Recipient name must be 2-100 characters';
        } else if (!/^[A-Za-zÀ-ž'\.\-\s]{2,100}$/.test(formData.recipientName.trim())) {
            newErrors.recipientName = 'Recipient name can only contain letters, spaces, and punctuation';
        }

        // Validate bank name
        if (!formData.recipientBankName.trim()) {
            newErrors.recipientBankName = 'Please enter bank name';
        } else if (formData.recipientBankName.trim().length < 2 || formData.recipientBankName.trim().length > 100) {
            newErrors.recipientBankName = 'Bank name must be 2-100 characters';
        } else if (!/^[A-Za-zÀ-ž'\.\-\s&]{2,100}$/.test(formData.recipientBankName.trim())) {
            newErrors.recipientBankName = 'Bank name can only contain letters, spaces, and punctuation';
        }

        // Validate account number
        if (!formData.recipientAccountNumber.trim()) {
        newErrors.recipientAccountNumber = 'Please enter account number';
        } 
        else {
        const accountNumber = formData.recipientAccountNumber.trim().toUpperCase();
        if (!/^(\d{7,20}|[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30})$/.test(accountNumber)) {
            newErrors.recipientAccountNumber = 'Account number must be 7-20 digits or valid IBAN (2 letters + 2 digits + 11-30 alphanumeric)';
        }
        }

        // Validate swift code
        if (!formData.swiftCode.trim()) {
            newErrors.swiftCode = 'SWIFT code is required';
        } else {
            const swiftCode = formData.swiftCode.trim().toUpperCase();
            if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(swiftCode)) {
                newErrors.swiftCode = 'SWIFT code must be 8 or 11 characters (6 letters + 2 alphanumeric + optional 3 alphanumeric)';
            }
        }

        // Return errors
        if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return false;
        }

        return true;
    };

    // Handle navigation to correct step
    const handleNext = (e) => {
        e?.preventDefault(); // Prevent form submission
        if (step === 1 && validateStep1()) {
            setStep(2);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep(step - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateStep2()) {
            return;
        }

        setIsLoading(true);
        setErrors({});

        try {
            const response = await fetch('/api/payment/create', {
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
                router.push('/payments/success')
            }
            else {
                if (response.status === 400 && data.errors) {
                // Server validation errors
                setErrors(data.errors);
                // If errors are in step 1, go back
                if (data.errors.amount || data.errors.currency || data.errors.paymentProvider) {
                    setStep(1);
                }
                } else if (response.status === 401) {
                    // Session expired
                    router.push('/login?session=expired');
                } else if (response.status === 403) {
                    // CSRF or authorization error
                    setErrors({ general: data.error || 'Security validation failed. Please refresh and try again.' });
                } else if (response.status === 429) {
                    // Rate limiting
                    setErrors({ general: 'Too many payment requests. Please try again later.' });
                } else {
                    setErrors({ general: data.error || 'An unexpected error occurred. Please try again.' });
                }
            }
        }
        catch (error) {
            console.error('Payment creation error:', error);
            setErrors({ general: 'Network error. Please check your connection and try again.' });
        } 
        finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (amount, currency) => {
        if (!amount) return `${currency} 0.00`;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    };

    return (
         <div className="bg-white shadow rounded-lg">
            {/* Progress Steps */}
            <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-center">
                    <div className={`flex items-center ${step >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                            step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                            {step > 1 ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            ) : '1'}
                        </div>
                        <span className="ml-2 text-sm font-medium hidden sm:inline">Payment Details</span>
                    </div>
                    <div className={`flex-1 h-1 mx-4 ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
                    <div className={`flex items-center ${step >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                            step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                            2
                        </div>
                        <span className="ml-2 text-sm font-medium hidden sm:inline">Recipient Details</span>
                    </div>
                </div>
            </div>

             {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
                <div className="p-6">
                    {/* Step 1: Payment Details */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
                                <p className="text-sm text-gray-600 mb-6">
                                    Enter the amount and currency for your international payment.
                                </p>
                            </div>

                            {/* Amount */}
                            <div>
                                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                                    Amount <span className="text-red-500">*</span>
                                </label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                    <input
                                        type="number"
                                        name="amount"
                                        id="amount"
                                        step="0.01"
                                        min="0.01"
                                        max="999999.99"
                                        className={`appearance-none block w-full px-3 py-2 border ${
                                            errors.amount ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                                        } placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-2 sm:text-sm`}
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                {errors.amount && (
                                    <p className="mt-2 text-sm text-red-600">{errors.amount}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-500">Maximum amount: 999,999.99</p>
                            </div>

                            {/* Currency */}
                            <div>
                                <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                                    Currency <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="currency"
                                    id="currency"
                                    className={`mt-1 block w-full px-3 py-2 border ${
                                        errors.currency ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                                    } bg-white rounded-md shadow-sm focus:outline-none focus:ring-2 sm:text-sm`}
                                    value={formData.currency}
                                    onChange={handleInputChange}
                                >
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="GBP">GBP - British Pound</option>
                                    <option value="ZAR">ZAR - South African Rand</option>
                                    <option value="JPY">JPY - Japanese Yen</option>
                                    <option value="CAD">CAD - Canadian Dollar</option>
                                    <option value="AUD">AUD - Australian Dollar</option>
                                    <option value="CHF">CHF - Swiss Franc</option>
                                </select>
                                {errors.currency && (
                                    <p className="mt-2 text-sm text-red-600">{errors.currency}</p>
                                )}
                            </div>

                            {/* Payment Provider */}
                            <div>
                                <label htmlFor="paymentProvider" className="block text-sm font-medium text-gray-700 mb-1">
                                    Payment Provider
                                </label>
                                <input
                                    type="text"
                                    name="paymentProvider"
                                    id="paymentProvider"
                                    value="SWIFT"
                                    disabled
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-md shadow-sm text-gray-500 cursor-not-allowed sm:text-sm"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Only SWIFT international payments are currently supported
                                </p>
                            </div>
                        </div>
                    )}

                     {/* Step 2: Recipient Details */}
                    {step === 2 && (
                        <div className="space-y-6">
                            {/* Payment Summary */}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                <h3 className="text-sm font-semibold text-indigo-900 mb-3">Payment Summary</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-indigo-700">Amount:</span>
                                        <span className="font-semibold text-indigo-900">{formatCurrency(formData.amount, formData.currency)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-indigo-700">Provider:</span>
                                        <span className="font-semibold text-indigo-900">{formData.paymentProvider}</span>
                                    </div>
                                </div>
                            </div>

                             <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Recipient Information</h2>
                                <p className="text-sm text-gray-600 mb-6">
                                    Enter the recipient's banking details carefully.
                                </p>
                            </div>

                            {/* Recipient Name */}
                            <div>
                                <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-1">
                                    Recipient Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="recipientName"
                                    id="recipientName"
                                    className={`mt-1 appearance-none block w-full px-3 py-2 border ${
                                        errors.recipientName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                                    } placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-2 sm:text-sm`}
                                    placeholder="Enter recipient's full name"
                                    value={formData.recipientName}
                                    onChange={handleInputChange}
                                />
                                {errors.recipientName && (
                                    <p className="mt-2 text-sm text-red-600">{errors.recipientName}</p>
                                )}
                            </div>

                            {/* Bank Name */}
                            <div>
                                <label htmlFor="recipientBankName" className="block text-sm font-medium text-gray-700 mb-1">
                                    Bank Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="recipientBankName"
                                    id="recipientBankName"
                                    className={`mt-1 appearance-none block w-full px-3 py-2 border ${
                                        errors.recipientBankName ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                                    } placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-2 sm:text-sm`}
                                    placeholder="Enter recipient's bank name"
                                    value={formData.recipientBankName}
                                    onChange={handleInputChange}
                                />
                                {errors.recipientBankName && (
                                    <p className="mt-2 text-sm text-red-600">{errors.recipientBankName}</p>
                                )}
                            </div>

                            {/* Account Number */}
                            <div>
                                <label htmlFor="recipientAccountNumber" className="block text-sm font-medium text-gray-700 mb-1">
                                    Account Number / IBAN <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="recipientAccountNumber"
                                    id="recipientAccountNumber"
                                    className={`mt-1 appearance-none block w-full px-3 py-2 border ${
                                        errors.recipientAccountNumber ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                                    } placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-2 sm:text-sm font-mono`}
                                    placeholder="Enter account number or IBAN"
                                    value={formData.recipientAccountNumber}
                                    onChange={handleInputChange}
                                />
                                {errors.recipientAccountNumber && (
                                    <p className="mt-2 text-sm text-red-600">{errors.recipientAccountNumber}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                    Enter either a regular account number (7-20 digits) or IBAN (15-34 characters)
                                </p>
                            </div>

                             {/* SWIFT Code */}
                            <div>
                                <label htmlFor="swiftCode" className="block text-sm font-medium text-gray-700 mb-1">
                                    SWIFT/BIC Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="swiftCode"
                                    id="swiftCode"
                                    maxLength="11"
                                    className={`mt-1 appearance-none block w-full px-3 py-2 border ${
                                        errors.swiftCode ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                                    } placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-2 sm:text-sm font-mono uppercase`}
                                    placeholder="e.g., ABCDEF2A or ABCDEF2AXXX"
                                    value={formData.swiftCode}
                                    onChange={handleInputChange}
                                />
                                {errors.swiftCode && (
                                    <p className="mt-2 text-sm text-red-600">{errors.swiftCode}</p>
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                    SWIFT/BIC code must be 8 or 11 characters
                                </p>
                            </div>

                            {/* Optional Reference */}
                            <div>
                                <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-1">
                                    Payment Reference <span className="text-gray-400">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    name="reference"
                                    id="reference"
                                    maxLength="140"
                                    className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Add a note for this payment (optional)"
                                    value={formData.reference}
                                    onChange={handleInputChange}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Maximum 140 characters
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                 {/* General Error Message */}
                {errors.general && (
                    <div className="px-6 pb-4">
                        <div className="rounded-md bg-red-50 border border-red-200 p-4">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-red-800">
                                        {errors.general}
                                    </h3>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Form Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center rounded-b-lg">
                    <div>
                        {step > 1 && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                                <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Back
                            </button>
                        )}
                    </div>
                     <div>
                        {step === 1 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                                Continue
                                <svg className="ml-2 -mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                            ) : (
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isLoading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Creating Payment...
                                    </>
                                ) : (
                                    <>
                                        <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Create Payment
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}