import DOMPurify from 'isomorphic-dompurify';

export const validationRegex = {

    // Auth regex patterns

    // username: letters, numbers, underscore; 3-30 chars
    username: /^[A-Za-z0-9_]{3,30}$/,
    // full name: letters, spaces, common name punctuation; 2-100 chars
    fullName: /^[A-Za-zÀ-ž'\.\-\s]{2,100}$/,
    // account number: digits only, 7-11 digits (adjust to bank spec)
    accountNumber: /^\d{7,11}$/,
    // South African ID: exactly 13 digits 
    idNumber: /^\d{13}$/,
    // password: at least 8 chars, at least one lower, one upper, one digit, one symbol (no spaces)
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    // employee ID: EMP followed by 3 digits
    employeeId: /^EMP\d{3}$/,

    // Payment regex patterns

    // amount: up to 999,999.99
    amount: /^\d{1,6}(\.\d{1,2})?$/,
    // currency: USD, EUR, GBP, ZAR, JPY, CAD, AUD, CHF
    currency: /^(USD|EUR|GBP|ZAR|JPY|CAD|AUD|CHF)$/,
    // paymentProvider: SWIFT
    paymentProvider: /^SWIFT$/,
    // recipient name: letters, spaces, common punctuation; 2-100 chars
    recipientName: /^[A-Za-zÀ-ž'\.\-\s]{2,100}$/,
    // bank name: letters, spaces, common punctuation; 2-100 chars 
    recipientBankName: /^[A-Za-zÀ-ž'\.\-\s&]{2,100}$/,
    // account number: IBAN (15-34 chars) or regular (7-20 digits)
    accountNumberOrIban: /^(\d{7,20}|[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30})$/,
    // SWIFT code: 8 or 11 chars
    swiftCode: /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/
};

export function sanitizeInput(input) {

    if (!input || typeof input !== 'string') {
        return '';
    }

    let sanitized = DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: []  // No attributes allowed
    });

    sanitized = sanitized
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\s+/g, ' '); // Normalize whitespace

  return sanitized;
}

export function validateInput(input, type) {

    if (!input || typeof input !== 'string') {
    return false;
    }

    // Sanitize before validation
    const sanitized = sanitizeInput(input);
    const pattern = validationRegex[type];

    if (!pattern) {
        throw new Error(`No validation pattern for type: ${type}`);
    }
    return pattern.test(sanitized);
}   

export function sanitizeAndValidate(input, type) {

    // Sanitize before validation
    const sanitized = sanitizeInput(input);
    const pattern = validationRegex[type];

    if (!pattern) {
        throw new Error(`No validation pattern for type: ${type}`);
    }

    const isValid = pattern.test(sanitized);
    return { sanitized, isValid };
}

// Auth validation funcs

export function validatePassword(password) {
    return validateInput(password, 'password');
}

export function validateUsername(username) {
    return validateInput(username, 'username');
}

export function validateFullName(fullName) {
    return validateInput(fullName, 'fullName');
}

export function validateIdNumber(idNumber) {
    return validateInput(idNumber, 'idNumber');
}

export function validateAccountNumber(accountNumber) {
    return validateInput(accountNumber, 'accountNumber');
}

export function validateEmployeeId(employeeId) {
    return validateInput(employeeId, 'employeeId');
}

// Payment validation funcs

export function validateAmount(amount) {
    // Normalize input to a float 
    const sanitized = typeof amount === 'number' ? amount : parseFloat(String(amount).trim());
    const isValid = !isNaN(sanitized) && sanitized > 0 && sanitized <= 999999.99;
    return { sanitized, isValid };
}