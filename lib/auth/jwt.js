import jwt from 'jsonwebtoken';

const SESSION_SECRET = process.env.SESSION_SECRET
const SESSION_DURATION = 30*60 // 30 mins
 
// Sign a jwt token with user payload and security claims
export function signToken(payload) {
    // Check if SESSION_SECRET is defined to ensure token security
    if (!SESSION_SECRET) throw new Error("SESSION_SECRET is not defined");

    // Create a secure payload
    const securePayload = {
        ...payload,
        iss: 'DreamTeamSecurity',
        aud: 'PaymentPortal',
        jti: payload.sessionId 
    };

    // Sign the token with the secure payload and secret, setting expiration
    return jwt.sign(securePayload, SESSION_SECRET, { algorithm: 'HS256', expiresIn: SESSION_DURATION, notBefore: 0 });
}

// Verify the validity of a token
export function verifyToken(token) {
    try {
        if (!token || !SESSION_DURATION){
            return {isValid: false, error: 'Invalid token' };
        } 

        // Check token expiration to prevent replay attacks
        const decoded = jwt.verify(token, SESSION_SECRET, { algorithms: ['HS256'], iss: 'DreamTeamSecurity', aud: 'PaymentPortal' });
        
        return {
            isValid : true,
            user: {
                userId: decoded.userId,
                userName: decoded.userName,
                fullName: decoded.fullName,
                role: decoded.role,
                sessionId: decoded.sessionId,
                issuedAt: decoded.iat
            },
            exp: decoded.exp
        };
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return { isValid: false, error: 'Token expired' };
        } else if (err.name === 'JsonWebTokenError') {
            return { isValid: false, error: 'Invalid token' };
        } else {
            return { isValid: false, error: 'Token verification failed' };
        }
    }
}
