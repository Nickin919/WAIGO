import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          error: 'A record with this value already exists',
          field: err.meta?.target
        });
        return;
      case 'P2025':
        res.status(404).json({ error: 'Record not found' });
        return;
      case 'P2003':
        res.status(400).json({ error: 'Foreign key constraint failed' });
        return;
      default:
        res.status(400).json({ error: 'Database error', code: err.code });
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: 'Invalid data provided' });
    return;
  }

  // Handle custom API errors
  const status = err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
