"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.extractContactFromToken = extractContactFromToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRY = '24h';
/**
 * Sign a JWT token with contact identity
 */
function signToken(payload) {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable not configured');
    }
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRY,
        issuer: 'hedgehog-learn',
        audience: 'hedgehog-learn-frontend'
    });
}
/**
 * Verify and decode a JWT token
 * @throws Error if token is invalid, expired, or signature doesn't match
 */
function verifyToken(token) {
    if (!JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable not configured');
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, {
            issuer: 'hedgehog-learn',
            audience: 'hedgehog-learn-frontend'
        });
        return decoded;
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        }
        else if (err.name === 'JsonWebTokenError') {
            throw new Error('Invalid token signature');
        }
        else {
            throw new Error('Token verification failed');
        }
    }
}
/**
 * Extract contact identifier from JWT token string
 */
function extractContactFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.slice(7); // Remove "Bearer " prefix
    try {
        const payload = verifyToken(token);
        return {
            email: payload.email,
            contactId: payload.contactId
        };
    }
    catch (err) {
        console.warn('[JWT] Token verification failed:', err);
        return null;
    }
}
