import { type MiddlewareHandler } from 'hono';
import { CORS_ORIGIN } from '../config.js';

export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  if (CORS_ORIGIN) {
    c.header('Access-Control-Allow-Origin', CORS_ORIGIN);
  } else {
    // Dynamically allow the requesting origin for cross-node communication
    const origin = c.req.header('Origin');
    if (origin) {
      c.header('Access-Control-Allow-Origin', origin);
    }
  }
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  c.header('Access-Control-Allow-Credentials', 'true');
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204);
  }
  await next();
};
