export const validationRegex = {
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
  employeeId: /^EMP\d{3}$/
};

export function sanitizeInput(input) {

    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
    .trim()
    .replace(/\0/g, '') // Remove null bytes
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .trim();
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
