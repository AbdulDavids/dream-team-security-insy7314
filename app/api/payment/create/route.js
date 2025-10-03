import { NextResponse } from "next/server";
import dbConnect from '../../../../lib/db/connection.js';
import Payment from '../../../../lib/db/models/payment.js';
import { sanitizeAndValidate, validateAmount } from '../../../../lib/security/validation.js';
import { getSession, validateCsrfToken, updateSessionActivity } from "../../../../lib/auth/session";


export async function POST(request) {
    try{
        const session = getSession(request)

        // Verify valid session
        if(!session || !session.isValid){
            return NextResponse.json(
                {error: 'Authentication required. Please log in'},
                {status: 401}
            );
        }

        // Verify valid role
        if (session.user.role !== 'user') {
            return NextResponse.json(
                { error: 'Only users can create payments.' },
                { status: 403 }
            );
        }

        // Validate CSRF token
        if (!validateCsrfToken(request)) {
            return NextResponse.json(
                { error: 'Invalid CSRF token. Please refresh the page and try again.' },
                { status: 403 }
            );
        }

        const body = await request.json()
        const{
            amount,
            currency,
            paymentProvider,
            recipientName,
            recipientBankName,
            recipientAccountNumber,
            swiftCode,
            reference = ''
        } = body;

        if (!amount || !currency || !paymentProvider || !recipientName || 
            !recipientBankName || !recipientAccountNumber || !swiftCode) {
            return NextResponse.json(
                { error: 'All required fields must be provided.' },
                { status: 400 }
            );
        }

        await dbConnect();

        // Validate and sanitize inputs
        const validationResults = {
            amount: validateAmount(amount),
            currency: sanitizeAndValidate(currency.toString(), 'currency'),
            paymentProvider: sanitizeAndValidate(paymentProvider, 'paymentProvider'),
            recipientName: sanitizeAndValidate(recipientName, 'recipientName'),
            recipientBankName: sanitizeAndValidate(recipientBankName, 'recipientBankName'),
            accountNumber: sanitizeAndValidate(recipientAccountNumber.toString().toUpperCase(), 'accountNumberOrIban'), //CHECKK
            swiftCode: sanitizeAndValidate(swiftCode.toString().toUpperCase(), 'swiftCode')
        };

        // Collect validation errors
        const validationErrors = {}

        if (!validationResults.amount.isValid) {
            validationErrors.amount = 'Amount must be between 0.01 and 999,999.99';
        }
        if (!validationResults.currency.isValid) {
            validationErrors.currency = 'Invalid currency. Supported: USD, EUR, GBP, ZAR, JPY, CAD, AUD, CHF';
        }
        if (!validationResults.paymentProvider.isValid || validationResults.paymentProvider.sanitized !== 'SWIFT') {
            validationErrors.paymentProvider = 'Only SWIFT payments are supported.';
        }
        if (!validationResults.recipientName.isValid) {
            validationErrors.recipientName = 'Recipient name must be 2-100 characters.';
        }
        if (!validationResults.recipientBankName.isValid) {
            validationErrors.recipientBankName = 'Bank name must be 2-100 characters.';
        }
        if (!validationResults.accountNumber.isValid) {
            validationErrors.recipientAccountNumber = 'Account number must be valid (7-20 digits or IBAN 15-34 characters).';
        }
        if (!validationResults.swiftCode.isValid) {
            validationErrors.swiftCode = 'SWIFT code must be 8 or 11 characters (letters and numbers only).';
        }

        // Return validation errors
        if(Object.keys(validationErrors).length > 0){
            return NextResponse.json({ errors: validationErrors }, {status: 400});
        }

        // Create payment
        const payment = new Payment({
            userId: session.user.userId,
            amount: validationResults.amount.sanitized,
            currency: validationResults.currency.sanitized,
            paymentProvider: 'SWIFT',
            recipientName: validationResults.recipientName.sanitized,
            recipientBankName: validationResults.recipientBankName.sanitized,
            recipientAccountNumber: validationResults.accountNumber.sanitized,
            swiftCode: validationResults.swiftCode.sanitized,
            reference: reference || '',
            status: 'pending',
            // Genreate ID's
            paymentId: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            referenceNumber: `REF-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`
        });

        await payment.save();

        const response = NextResponse.json({
            message: 'Payment created successfully',
            payment: {
                paymentId: payment.paymentId,
                referenceNumber: payment.referenceNumber,
                amount: payment.amount,
                currency: payment.currency,
                recipientName: payment.recipentName,
                status: payment.status,
                createdAt: payment.createdAt
            }
        }, { status: 201 });

        // Update session activity
        if (session.needsRenewal) {
            updateSessionActivity(response, session);
        }

        return response;
    }
    catch(error){
        console.error('Payment creation error:', error);

        // DEBUG ERRORS REMOVE LATER

        // Handle duplicate payment IDs (rare but possible)
        if (error.code === 11000) {
            return NextResponse.json(
                { error: 'Payment reference conflict. Please try again.' },
                { status: 409 }
            );
        }

        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = {};
            Object.values(error.errors).forEach((err) => {
                errors[err.path] = err.message;
            });
            return NextResponse.json({ errors }, { status: 400 });
        }

        return NextResponse.json(
            { error: 'Internal server error. Please try again.' },
            { status: 500 }
        );
    }
}

// Only allow POST method 
export async function GET() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function PUT() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function DELETE() {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}