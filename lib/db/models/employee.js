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
        match: [/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Password must be at least 8 characters, include uppercase, lowercase, number, and special character']
    },
    role: {
        type: String,
        enum: ['employee'],
        default: 'employee',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});