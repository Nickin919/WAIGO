import { Request, Response } from 'express';

/**
 * 404 handler for undefined routes
 */
export const notFound = (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
};
