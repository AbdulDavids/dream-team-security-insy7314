import { match } from 'assert';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
    },
    userName: {
        type: String,
        required: true,
        unique: true,
        match: [/^[A-Za-z0-9_]{3,30}$/, 'Username must be 3-30 characters and can only contain letters, numbers, and underscores']
    },
    idNumber: {
        type: String,
        required: true,
        unique: true,
        match: [/^\d{13}$/, 'ID number must be exactly 13 digits']
    },
    accountNumber: {
        type: String,
        required: true,
        unique: true,
        match: [/^\d{7,11}$/, 'Account number must be between 7-11 digits']
    },
    role: {
        type: String,
        enum: ['user'],
        default: 'user',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        match: [/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, 'Password must be at least 8 characters, include uppercase, lowercase, number, and special character']
    }
});

export default mongoose.models.User || mongoose.model('User', userSchema);