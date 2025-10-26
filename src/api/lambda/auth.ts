import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_EXPIRY = '24h';

export interface JWTPayload {
  contactId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token with contact identity
 */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable not configured');
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
    issuer: 'hedgehog-learn',
    audience: 'hedgehog-learn-frontend'
  });
}

/**
 * Verify and decode a JWT token
 * @throws Error if token is invalid, expired, or signature doesn't match
 */
export function verifyToken(token: string): JWTPayload {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable not configured');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'hedgehog-learn',
      audience: 'hedgehog-learn-frontend'
    }) as JWTPayload;

    return decoded;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (err.name === 'JsonWebTokenError') {
      throw new Error('Invalid token signature');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Extract contact identifier from JWT token string
 */
export function extractContactFromToken(authHeader: string | undefined): { email: string; contactId: string } | null {
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
  } catch (err) {
    console.warn('[JWT] Token verification failed:', err);
    return null;
  }
}
