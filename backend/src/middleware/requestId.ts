import type { Request, Response, NextFunction } from 'express';
import { generateRequestId } from '../utils/logger.js';

// Add request ID to each request
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = generateRequestId();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};
