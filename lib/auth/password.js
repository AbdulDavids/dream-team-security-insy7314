import bcrypt from 'bcrypt';

const saltRounds = 12;

// Hash a plaintext password
export async function hashPassword(password) {
    try{
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    }
    catch(error){
        throw new Error("Authentication error");
    }
}

// Verify a plaintext password against a hash
export async function verifyPassword(password, hash) {
    try{
        return await bcrypt.compare(password, hash);
    }
    catch(error){
        throw new Error("Authentication error");
    }
}