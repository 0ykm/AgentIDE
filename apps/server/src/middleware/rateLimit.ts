import type { MiddlewareHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import rateLimit from 'express-rate-limit';
import { NODE_ENV } from '../config.js';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  skip: () => NODE_ENV === 'development' && !process.env.ENABLE_RATE_LIMIT
});

export const apiRateLimitMiddleware: MiddlewareHandler = async (c, next) => {
  return new Promise<void>((resolve, reject) => {
    const req = c.req.raw as any;
    const res = {
      setHeader: (name: string, value: string) => c.header(name, value),
      status: (code: number) => ({ json: (data: any) => { resolve(); return c.json(data, code as ContentfulStatusCode); } })
    } as any;
    apiLimiter(req, res, async (err?: any) => {
      if (err) reject(err);
      else {
        try {
          await next();
          resolve();
        } catch (error) {
          reject(error);
        }
      }
    });
  });
};
