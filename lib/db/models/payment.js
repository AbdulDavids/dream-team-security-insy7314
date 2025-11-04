import mongoose, { set } from "mongoose";
import { validate } from "uuid";

const paymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: [0.01, 'Amount must be at least 0.01'],
        max: [999999.99, 'Amount cannot exceed 999,999.99'],
        set: v => Math.round(v * 100) / 100 // two decimal places
    },
    currency: {
        type: String,
        required: true,
        enum: {
            values: ['ZAR', 'EUR', 'GBP', 'USD', 'AUD', 'CAD', 'CHF', 'JPY'],
            message: 'Currency must be one of ZAR, EUR, GBP, USD, AUD, CAD, CHF, JPY',
        },
        default: 'ZAR'
    },
    paymentProvider: {
        type: String,
        required: true,
        enum: {
            values: ['SWIFT'],
            message: 'Payment provider must be SWIFT'
        },
        default: 'SWIFT'
    },
    recipientName: {
        type: String,
        required: true,
        trim: true,
        minlength: [2, 'Recipient name must be at least 2 characters'],
        maxlength: [100, 'Recipient name cannot exceed 100 characters']
    },
    recipientBankName: {
        type: String,
        required: true,
        trim: true,
        minlength: [2, 'Bank name must be at least 2 characters'],
        maxlength: [100, 'Bank name cannot exceed 100 characters']
    },
    recipientAccountNumber: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: function(v) {
                // IBAN validation
                if (v.length >= 15 && v.length <= 34) {
                    return /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(v.toUpperCase());
                }
                // Account number validation (7-20 digits)
                return /^\d{7,20}$/.test(v);
            },
            message: 'Account number must be a valid IBAN (15-34 chars) or regular account number (7-20 digits)'
        }
    },
    swiftCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        validate: {
            validator: function(v) {
                return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v);
            },
            message: 'SWIFT code must be 8 or 11 characters'
        }
    },
    reference: {
        type: String,
        trim: true,
        maxlength: [140, 'Reference cannot exceed 140 characters'],
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'cancelled'],
        default: 'pending',
        required: true
    },
    // Audit fields for employee verification
    verifiedBy: {
        // Reference to the Employee who approved the payment. Stored as ObjectId
        // so we can populate if needed. Null for payments not yet verified.
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
    },
    verifiedAt: {
        // Timestamp when an employee verified the payment
        type: Date,
        default: null,
    },
    /**
     * acknowledged - boolean flag indicating that the end-user has acknowledged
     * a verified payment in their dashboard UI. When true the payment will be
     * excluded from 'recent' dashboard queries but still returned in full/all
     * queries (so it remains visible in the full history view).
     *
     * - default: false (unacknowledged)
     * - indexed to make filtering efficient when querying recent payments
     */
    acknowledged: {
        type: Boolean,
        default: false,
        index: true
    },
    /**
     * sentToSwift / swiftSentAt
     * - sentToSwift: boolean flag indicating that the payment has been sent to
     *   SWIFT (this project uses a simulated send). When true the payment has
     *   transitioned from verified -> sent.
     * - swiftSentAt: timestamp recording when the send-to-SWIFT occurred.
     *
     * These fields are indexed/recorded to make it easy to query which
     * payments have already been transmitted and to support audit/forensics.
     */
    sentToSwift: {
        type: Boolean,
        default: false,
        index: true
    },
    swiftSentAt: {
        type: Date,
        default: null
    },
    paymentId: {
        type: String,
        required: true,
        unique: true,
    },
    referenceNumber: {
        type: String,
        required: true,
        unique: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        required: true
    },
    updatedAt: {
        type: Date,
        default: Date.now,
        required: true
    }
});

// Indexes
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);