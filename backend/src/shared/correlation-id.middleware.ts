import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/** ADR-011 / 03-technical-architecture.md §6.1: un ID de correlación por request. */
export function correlationIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.headers['x-correlation-id']) {
    req.headers['x-correlation-id'] = randomUUID();
  }
  next();
}
