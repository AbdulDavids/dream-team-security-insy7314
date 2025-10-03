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
    paymentId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    referenceNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
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
paymentSchema.index({ paymentId: 1 }, { unique: true });
paymentSchema.index({ referenceNumber: 1 }, { unique: true });

export default mongoose.models.Payment || mongoose.model('Payment', paymentSchema);