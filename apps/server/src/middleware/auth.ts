import { basicAuth } from 'hono/basic-auth';
import { BASIC_AUTH_USER, BASIC_AUTH_PASSWORD } from '../config.js';

export const basicAuthMiddleware = BASIC_AUTH_USER && BASIC_AUTH_PASSWORD
  ? basicAuth({ username: BASIC_AUTH_USER, password: BASIC_AUTH_PASSWORD })
  : undefined;

export function verifyWebSocketAuth(req: import('http').IncomingMessage): boolean {
  if (!BASIC_AUTH_USER || !BASIC_AUTH_PASSWORD) {
    return true;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }
  const base64Credentials = authHeader.slice('Basic '.length);
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
  const colonIndex = credentials.indexOf(':');
  if (colonIndex === -1) {
    return false;
  }
  const username = credentials.substring(0, colonIndex);
  const password = credentials.substring(colonIndex + 1);
  return username === BASIC_AUTH_USER && password === BASIC_AUTH_PASSWORD;
}
