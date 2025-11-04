import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        match: [/^[A-Za-zÀ-ž'\.\-\s]{2,100}$/, 'Full name must be 2-100 characters and can only contain letters, spaces, and common punctuation']
    },
    employeeId: {
        type: String,
        required: true,
        unique: true,
        match: [/^EMP\d{3}$/, 'Employee ID must be in the format EMP followed by 3 digits']
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
    },
    // User role; currently this repo only supports the 'employee' role.
    role: {
        type: String,
        enum: ['employee'],
        default: 'employee',
    },
    // Encrypted TOTP secret (base32) for authenticator apps. Stored
    // encrypted with the app's field-encryption helper. Set
    // `totpEnrolled: true` when the employee completes enrollment.
    totpSecretEncrypted: {
        type: String,
        default: null
    },
    // Set to true when the employee has enrolled an authenticator app.
    totpEnrolled: {
        type: Boolean,
        default: false
    },
    // Timestamp of last successful re-authentication (password/TOTP).
    // Used to allow a short window where repeated sensitive ops don't
    // require the operator to re-enter credentials for UX.
    lastReauthAt: {
        type: Date,
        default: null
    },
    // (No per-payment binding stored for reauth in this model.)
    // Counter of recent re-authentication failures. This is used to
    // temporarily throttle/lock the account for repeated wrong attempts.
    reauthFailures: {
        type: Number,
        default: 0
    },
    // Optional: encrypted TOTP secret (base32) for authenticator apps
    totpSecretEncrypted: {
        type: String,
        default: null
    },
    totpEnrolled: {
        type: Boolean,
        default: false
    },
    // Last successful re-auth timestamp (server-set when employee reauths)
    lastReauthAt: {
        type: Date,
        default: null
    },
    // Counter of recent re-auth failures; used to temporarily throttle/lock
    reauthFailures: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

export default mongoose.models.Employee || mongoose.model('Employee', employeeSchema);