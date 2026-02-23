import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { effectiveRole } from '../lib/roles';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    firstName?: string | null;
    lastName?: string | null;
    accountId?: string | null;
    catalogId?: string | null;
    assignedToDistributorId?: string | null;
  };
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      role: string;
      catalogId?: string | null;
    };

    // Verify user still exists and is active (full schema)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        accountId: true,
        catalogId: true,
        assignedToDistributorId: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email ?? '',
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      accountId: user.accountId ?? null,
      catalogId: user.catalogId,
      assignedToDistributorId: user.assignedToDistributorId
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    next(error);
  }
};

/**
 * Middleware to check if user has required role.
 * Uses effective role so legacy (TURNKEY, BASIC, DISTRIBUTOR) and new (DIRECT_USER, BASIC_USER, DISTRIBUTOR_REP) both work.
 */
export const authorize = (...allowedRoles: string[]) => {
  const allowedSet = new Set(allowedRoles.map((r) => effectiveRole(r)));
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!allowedSet.has(effectiveRole(req.user.role))) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
};

/**
 * Optional authentication - attaches user if token present, but doesn't fail if absent
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      role: string;
      catalogId?: string | null;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        accountId: true,
        catalogId: true,
        assignedToDistributorId: true,
        isActive: true
      }
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        email: user.email ?? '',
        role: user.role,
        accountId: user.accountId ?? null,
        catalogId: user.catalogId,
        assignedToDistributorId: user.assignedToDistributorId
      };
    }

    next();
  } catch {
    // Silent fail for optional auth
    next();
  }
};
