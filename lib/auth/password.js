import bcrypt from 'bcrypt';

const saltRounds = 12;

export async function hashPassword(password) {
    try{
        const salt = await bcrypt.genSalt(saltRounds);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    }
    catch(error){
        throw new Error("Password hashing failed");
    }
}

export async function verifyPassword(password, hash) {
    try{
        return await bcrypt.compare(password, hash);
    }
    catch(error){
        throw new Error("Password verification failed");
    }
}