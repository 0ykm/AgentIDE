import fs from 'node:fs/promises';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import rateLimit from 'express-rate-limit';
import type { Workspace } from '../types.js';
import { MAX_FILE_SIZE, NODE_ENV, DEFAULT_ROOT } from '../config.js';
import { createHttpError, handleError, readJson } from '../utils/error.js';
import { resolveSafePath, normalizeWorkspacePath } from '../utils/path.js';
import { requireWorkspace } from './workspaces.js';
import { sortFileEntries } from '@deck-ide/shared/utils-node';

const fileUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many file upload requests, please try again later.',
  skip: () => NODE_ENV === 'development' && !process.env.ENABLE_RATE_LIMIT
});

export function createFileRouter(workspaces: Map<string, Workspace>) {
  const router = new Hono();

  router.get('/', async (c) => {
    try {
      const workspaceId = c.req.query('workspaceId');
      if (!workspaceId) {
        throw createHttpError('workspaceId is required', 400);
      }
      const workspace = requireWorkspace(workspaces, workspaceId);
      const requestedPath = c.req.query('path') || '';
      const target = await resolveSafePath(workspace.path, requestedPath);
      const stats = await fs.stat(target);
      if (!stats.isDirectory()) {
        throw createHttpError('Path is not a directory', 400);
      }
      const entries = await fs.readdir(target, { withFileTypes: true });
      const normalizedBase = requestedPath.replace(/\\/g, '/');
      const mapped = entries.map((entry) => {
        const entryPath = normalizedBase
          ? `${normalizedBase}/${entry.name}`
          : entry.name;
        return {
          name: entry.name,
          path: entryPath,
          type: (entry.isDirectory() ? 'dir' : 'file') as 'dir' | 'file'
        };
      });
      const sorted = sortFileEntries(mapped);
      return c.json(sorted);
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.get('/preview', async (c) => {
    try {
      const rootInput = c.req.query('path') || DEFAULT_ROOT;
      const requestedPath = c.req.query('subpath') || '';
      const rootPath = normalizeWorkspacePath(rootInput);
      const target = await resolveSafePath(rootPath, requestedPath);
      const stats = await fs.stat(target);
      if (!stats.isDirectory()) {
        throw createHttpError('Path is not a directory', 400);
      }
      const entries = await fs.readdir(target, { withFileTypes: true });
      const normalizedBase = String(requestedPath || '').replace(/\\/g, '/');
      const mapped = entries.map((entry) => {
        const entryPath = normalizedBase
          ? `${normalizedBase}/${entry.name}`
          : entry.name;
        return {
          name: entry.name,
          path: entryPath,
          type: (entry.isDirectory() ? 'dir' : 'file') as 'dir' | 'file'
        };
      });
      const sorted = sortFileEntries(mapped);
      return c.json(sorted);
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.get('/file', async (c) => {
    try {
      const workspaceId = c.req.query('workspaceId');
      if (!workspaceId) {
        throw createHttpError('workspaceId is required', 400);
      }
      const workspace = requireWorkspace(workspaces, workspaceId);
      const target = await resolveSafePath(workspace.path, c.req.query('path') || '');
      const stats = await fs.stat(target);
      if (stats.size > MAX_FILE_SIZE) {
        throw createHttpError(`File too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum size is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`, 413);
      }
      const contents = await fs.readFile(target, 'utf8');
      return c.json({ path: c.req.query('path'), contents });
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.put('/file', async (c) => {
    return new Promise<Response>((resolve, reject) => {
      const req = c.req.raw as any;
      const res = {
        setHeader: (name: string, value: string) => c.header(name, value),
        status: (code: number) => ({ json: (data: any) => { const resp = c.json(data, code as ContentfulStatusCode); resolve(resp); return resp; } })
      } as any;
      fileUploadLimiter(req, res, async (err?: any) => {
        if (err) {
          reject(err);
          return;
        }
        try {
          const body = await readJson<{
            workspaceId?: string;
            path?: string;
            contents?: string;
          }>(c);
          const workspaceId = body?.workspaceId;
          if (!workspaceId) {
            throw createHttpError('workspaceId is required', 400);
          }
          const workspace = requireWorkspace(workspaces, workspaceId);
          const target = await resolveSafePath(workspace.path, body?.path || '');
          const contents = body?.contents ?? '';
          const contentSize = Buffer.byteLength(contents, 'utf8');
          if (contentSize > MAX_FILE_SIZE) {
            throw createHttpError(`Content size exceeds maximum allowed size of ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB`, 413);
          }
          await fs.mkdir(path.dirname(target), { recursive: true });
          await fs.writeFile(target, contents, 'utf8');
          resolve(c.json({ path: body?.path, saved: true }));
        } catch (error) {
          resolve(handleError(c, error));
        }
      });
    });
  });

  return router;
}
