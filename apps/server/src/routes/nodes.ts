import crypto from 'node:crypto';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import { APP_VERSION } from '../config.js';
import type { PersistedNode } from '../utils/database.js';
import { saveNode, updateNode, deleteNode } from '../utils/database.js';
import { createHttpError, handleError, readJson } from '../utils/error.js';

// Handler for GET /api/node/info (no auth required)
export function createNodeInfoHandler(nodeId: string, nodeName: string) {
  return (c: Context) => {
    return c.json({
      id: nodeId,
      name: nodeName,
      version: APP_VERSION,
      capabilities: ['terminal', 'files', 'git', 'agent']
    });
  };
}

// Router for /api/nodes CRUD (auth required)
export function createNodeRouter(db: DatabaseSync, nodes: Map<string, PersistedNode>) {
  const router = new Hono();

  // List all registered remote nodes
  router.get('/', (c) => {
    return c.json(Array.from(nodes.values()));
  });

  // Register a new remote node
  router.post('/', async (c) => {
    try {
      const body = await readJson<{ name?: string; host?: string; port?: number; authUser?: string; authPasswordEnc?: string }>(c);
      if (!body?.host) {
        throw createHttpError('host is required', 400);
      }
      if (!body.port || typeof body.port !== 'number') {
        throw createHttpError('port is required and must be a number', 400);
      }

      const node: PersistedNode = {
        id: crypto.randomUUID(),
        name: body.name || body.host,
        host: body.host,
        port: body.port,
        authUser: body.authUser ?? null,
        authPasswordEnc: body.authPasswordEnc ?? null,
        createdAt: new Date().toISOString()
      };

      saveNode(db, node);
      nodes.set(node.id, node);
      return c.json(node, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  // Update a remote node
  router.patch('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const existing = nodes.get(id);
      if (!existing) {
        throw createHttpError('Node not found', 404);
      }

      const body = await readJson<{ name?: string; host?: string; port?: number; authUser?: string; authPasswordEnc?: string }>(c);
      const updates: Partial<Pick<PersistedNode, 'name' | 'host' | 'port' | 'authUser' | 'authPasswordEnc'>> = {};

      if (body?.name !== undefined) updates.name = body.name;
      if (body?.host !== undefined) updates.host = body.host;
      if (body?.port !== undefined) updates.port = body.port;
      if (body?.authUser !== undefined) updates.authUser = body.authUser;
      if (body?.authPasswordEnc !== undefined) updates.authPasswordEnc = body.authPasswordEnc;

      updateNode(db, id, updates);
      const updated: PersistedNode = { ...existing, ...updates };
      nodes.set(id, updated);
      return c.json(updated);
    } catch (error) {
      return handleError(c, error);
    }
  });

  // Delete a remote node
  router.delete('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      if (!nodes.has(id)) {
        throw createHttpError('Node not found', 404);
      }

      deleteNode(db, id);
      nodes.delete(id);
      return c.body(null, 204);
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
