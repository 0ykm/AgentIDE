import crypto from 'node:crypto';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { Workspace } from '../types.js';
import { DEFAULT_ROOT } from '../config.js';
import { createHttpError, handleError, readJson } from '../utils/error.js';
import { normalizeWorkspacePath, getWorkspaceKey, getWorkspaceName } from '../utils/path.js';

const MAX_NAME_LENGTH = 100;
const NAME_PATTERN = /^[\p{L}\p{N}\s\-_.]+$/u; // Unicode letters, numbers, spaces, hyphens, underscores, dots

function validateName(name: string | undefined): string | undefined {
  if (!name) {
    return undefined;
  }
  if (typeof name !== 'string') {
    throw createHttpError('name must be a string', 400);
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw createHttpError(`name is too long (max: ${MAX_NAME_LENGTH} characters)`, 400);
  }
  if (!NAME_PATTERN.test(trimmed)) {
    throw createHttpError('name contains invalid characters', 400);
  }
  return trimmed;
}

export function createWorkspaceRouter(
  db: DatabaseSync,
  workspaces: Map<string, Workspace>,
  workspacePathIndex: Map<string, string>,
  decks: Map<string, import('../types.js').Deck>
) {
  const router = new Hono();

  const insertWorkspace = db.prepare(
    'INSERT INTO workspaces (id, name, path, normalized_path, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const updateWorkspaceStmt = db.prepare(
    'UPDATE workspaces SET name = ?, path = ?, normalized_path = ? WHERE id = ?'
  );
  const deleteWorkspaceStmt = db.prepare('DELETE FROM workspaces WHERE id = ?');
  const deleteDecksForWorkspace = db.prepare('DELETE FROM decks WHERE workspace_id = ?');
  const deleteTerminalsForWorkspace = db.prepare(
    'DELETE FROM terminals WHERE deck_id IN (SELECT id FROM decks WHERE workspace_id = ?)'
  );

  function createWorkspace(inputPath: string, name?: string): Workspace {
    const resolvedPath = normalizeWorkspacePath(inputPath);
    const key = getWorkspaceKey(resolvedPath);
    if (workspacePathIndex.has(key)) {
      throw createHttpError('Workspace path already exists', 409);
    }
    const validatedName = validateName(name);
    const workspace: Workspace = {
      id: crypto.randomUUID(),
      name: validatedName || getWorkspaceName(resolvedPath, workspaces.size + 1),
      path: resolvedPath,
      createdAt: new Date().toISOString()
    };
    workspaces.set(workspace.id, workspace);
    workspacePathIndex.set(key, workspace.id);
    insertWorkspace.run(
      workspace.id,
      workspace.name,
      workspace.path,
      key,
      workspace.createdAt
    );
    return workspace;
  }

  router.get('/', (c) => {
    return c.json(Array.from(workspaces.values()));
  });

  router.post('/', async (c) => {
    try {
      const body = await readJson<{ path?: string; name?: string }>(c);
      if (!body?.path) {
        throw createHttpError('path is required', 400);
      }
      const workspace = createWorkspace(body.path, body.name);
      return c.json(workspace, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.patch('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const workspace = workspaces.get(id);
      if (!workspace) {
        throw createHttpError('Workspace not found', 404);
      }
      const body = await readJson<{ name?: string; path?: string }>(c);
      const validatedName = validateName(body?.name);
      const newName = validatedName || workspace.name;
      let newPath = workspace.path;
      let newKey = getWorkspaceKey(newPath);

      if (body?.path && body.path.trim()) {
        const resolvedPath = normalizeWorkspacePath(body.path.trim());
        const candidateKey = getWorkspaceKey(resolvedPath);
        const existingId = workspacePathIndex.get(candidateKey);
        if (existingId && existingId !== id) {
          throw createHttpError('Workspace path already exists', 409);
        }
        newPath = resolvedPath;
        newKey = candidateKey;
      }

      if (newName === workspace.name && newPath === workspace.path) {
        return c.json(workspace);
      }

      // Update path index if path changed
      if (newPath !== workspace.path) {
        const oldKey = getWorkspaceKey(workspace.path);
        workspacePathIndex.delete(oldKey);
        workspacePathIndex.set(newKey, id);
      }

      const updated: Workspace = { ...workspace, name: newName, path: newPath };
      workspaces.set(id, updated);
      updateWorkspaceStmt.run(newName, newPath, newKey, id);
      return c.json(updated);
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.delete('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const workspace = workspaces.get(id);
      if (!workspace) {
        throw createHttpError('Workspace not found', 404);
      }

      // Cascade delete: terminals → decks → workspace
      deleteTerminalsForWorkspace.run(id);
      deleteDecksForWorkspace.run(id);
      deleteWorkspaceStmt.run(id);

      // Clean up memory maps
      const key = getWorkspaceKey(workspace.path);
      workspacePathIndex.delete(key);
      workspaces.delete(id);

      // Clean up decks in memory
      for (const [deckId, deck] of decks) {
        if (deck.workspaceId === id) {
          decks.delete(deckId);
        }
      }

      return c.body(null, 204);
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}

export function getConfigHandler() {
  return (c: Context) => {
    try {
      return c.json({ defaultRoot: normalizeWorkspacePath(DEFAULT_ROOT) });
    } catch (error) {
      console.error('Failed to get config:', error);
      return c.json({ defaultRoot: '' });
    }
  };
}

export function requireWorkspace(workspaces: Map<string, Workspace>, workspaceId: string): Workspace {
  const workspace = workspaces.get(workspaceId);
  if (!workspace) {
    throw createHttpError('Workspace not found', 404);
  }
  return workspace;
}
