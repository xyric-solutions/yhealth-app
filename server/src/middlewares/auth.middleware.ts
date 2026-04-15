import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.config.js';
import type { AuthenticatedRequest, IJwtPayload, UserRole } from '../types/index.js';
import { query } from '../database/pg.js';

/**
 * Extract token from request
 */
function extractToken(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check cookies
  const cookieToken = req.cookies?.['access_token'];
  if (cookieToken) {
    return cookieToken;
  }

  // Query parameter token removed for security — tokens in URLs are logged and
  // leaked via Referer headers. WebSocket auth uses socket.io handshake instead.

  return null;
}

/**
 * Verify and decode JWT token
 */
function verifyToken(token: string): IJwtPayload {
  try {
    const decoded = jwt.verify(token, env.jwt.secret, {
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    }) as IJwtPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw ApiError.unauthorized('Invalid token');
    }
    throw ApiError.unauthorized('Token verification failed');
  }
}

/**
 * Authentication middleware - requires valid JWT
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (!token) {
      throw ApiError.unauthorized('No authentication token provided');
    }

    const decoded = verifyToken(token);
    (req as AuthenticatedRequest).user = decoded;

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - attaches user if token present, but doesn't require it
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = verifyToken(token);
      (req as AuthenticatedRequest).user = decoded;
    }

    next();
  } catch {
    // Ignore token errors for optional auth
    next();
  }
}

/**
 * Role-based authorization middleware
 * Checks JWT role first, then falls back to database if role doesn't match
 * This handles cases where the JWT has a stale role after role changes
 */
export function authorize(...allowedRoles: UserRole[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        next(ApiError.unauthorized('Authentication required'));
        return;
      }

      // Fast path: Check JWT role first (most common case)
      if (allowedRoles.includes(user.role)) {
        next();
        return;
      }

      // Slow path: JWT role doesn't match - check database for current role
      // This handles stale tokens after role changes
      const roleResult = await query<{ role: string }>(
        `SELECT r.slug as role FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [user.userId]
      );

      if (roleResult.rows.length === 0) {
        next(ApiError.notFound('User not found'));
        return;
      }

      const dbRole = roleResult.rows[0].role as UserRole;

      // Update the user object with the database role for this request
      // (Note: This doesn't update the JWT, but allows the request to proceed)
      if (allowedRoles.includes(dbRole)) {
        // Update the request user object with the correct role
        (req as AuthenticatedRequest).user = {
          ...user,
          role: dbRole,
        };
        next();
        return;
      }

      // User doesn't have the required role in database either
      next(ApiError.forbidden(
        `Access denied. Required roles: ${allowedRoles.join(', ')}. ` +
        `Your current role is "${dbRole}". Please refresh your token or log out and log back in.`
      ));
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user owns the resource or is admin
 */
export function authorizeOwnerOrAdmin(
  getResourceOwnerId: (req: Request) => string | Promise<string>
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        throw ApiError.unauthorized('Authentication required');
      }

      // Admins have full access
      if (user.role === 'admin') {
        next();
        return;
      }

      const ownerId = await getResourceOwnerId(req);

      if (user.userId !== ownerId) {
        throw ApiError.forbidden('You do not have permission to access this resource');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Refresh token middleware
 */
export function verifyRefreshToken(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const refreshToken = req.body.refreshToken || req.cookies?.['refresh_token'];

    if (!refreshToken) {
      throw ApiError.unauthorized('No refresh token provided');
    }

    const decoded = jwt.verify(refreshToken, env.jwt.refreshSecret, {
      issuer: env.jwt.issuer,
      audience: env.jwt.audience,
    }) as IJwtPayload;

    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Refresh token has expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Invalid refresh token'));
    } else {
      next(error);
    }
  }
}

/**
 * Generate JWT tokens
 */
export function generateTokens(payload: Omit<IJwtPayload, 'iat' | 'exp'>): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  const accessToken = jwt.sign(payload, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn as string,
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as string,
    issuer: env.jwt.issuer,
    audience: env.jwt.audience,
  } as jwt.SignOptions);

  // Calculate expiry in seconds
  const decoded = jwt.decode(accessToken) as IJwtPayload;
  const expiresIn = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;

  return { accessToken, refreshToken, expiresIn };
}

export default authenticate;
