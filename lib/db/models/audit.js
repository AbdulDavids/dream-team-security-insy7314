// Audit model
// Purpose: Record important security-sensitive events performed by employees
// (and optionally other actors) so that administrators can review who did
// what and when. Events recorded include employee login, payment verification,
// and sending payments to SWIFT (simulated). Keeping a separate audit
// collection makes it easy to query and export audit trails for compliance.

import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
    // Reference to Employee who performed the action (if applicable)
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: false,
        index: true
    },
    // Human-friendly employee identifier (e.g. EMP001). We store this in
    // addition to the ObjectId reference so audit records remain readable
    // even if the employee record is later removed or changed. This also
    // speeds up queries/filters by employee code in some admin UIs.
    employeeIdentifier: {
        type: String,
        required: false,
        trim: true,
        index: true
    },
    // Action type: login, verify, send
    action: {
        type: String,
        enum: ['login', 'verify', 'send'],
        required: true
    },
    // Payment identifier associated with the action (if any)
    paymentId: {
        type: String,
        required: false,
        index: true
    },
    // Free-form details for the audit event
    details: {
        type: Object,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now,
        required: true
    }
});

export default mongoose.models.Audit || mongoose.model('Audit', auditSchema);
