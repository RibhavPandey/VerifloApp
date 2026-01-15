import type { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
};

type Counter = { count: number; resetAt: number };

const counters = new Map<string, Counter>();

function now() {
  return Date.now();
}

function getKey(req: any, prefix: string) {
  const userId = req.user?.id;
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  return `${prefix}:${userId || ip}`;
}

export function rateLimit(opts: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = getKey(req, opts.keyPrefix);
    const t = now();
    const existing = counters.get(key);

    if (!existing || existing.resetAt <= t) {
      counters.set(key, { count: 1, resetAt: t + opts.windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > opts.max) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - t) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'Rate limit exceeded. Please slow down.' });
    }

    return next();
  };
}

