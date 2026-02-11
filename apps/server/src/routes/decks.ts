import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { Workspace, Deck, DeckGroup } from '../types.js';
import { createHttpError, handleError, readJson } from '../utils/error.js';
import { requireWorkspace } from './workspaces.js';

export function createDeckRouter(
  db: DatabaseSync,
  workspaces: Map<string, Workspace>,
  decks: Map<string, Deck>,
  deckGroups: Map<string, DeckGroup>
) {
  const router = new Hono();

  const insertDeck = db.prepare(
    'INSERT INTO decks (id, name, root, workspace_id, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const updateDeckStmt = db.prepare(
    'UPDATE decks SET name = ?, root = ?, workspace_id = ? WHERE id = ?'
  );
  const deleteDeckStmt = db.prepare('DELETE FROM decks WHERE id = ?');
  const deleteTerminalsForDeck = db.prepare('DELETE FROM terminals WHERE deck_id = ?');
  const deleteGroupStmt = db.prepare('DELETE FROM deck_groups WHERE id = ?');

  function createDeck(name: string | undefined, workspaceId: string): Deck {
    const workspace = requireWorkspace(workspaces, workspaceId);
    const deck: Deck = {
      id: crypto.randomUUID(),
      name: name || `Deck ${decks.size + 1}`,
      root: workspace.path,
      workspaceId,
      createdAt: new Date().toISOString()
    };
    decks.set(deck.id, deck);
    insertDeck.run(
      deck.id,
      deck.name,
      deck.root,
      deck.workspaceId,
      deck.createdAt
    );
    return deck;
  }

  router.get('/', (c) => {
    return c.json(Array.from(decks.values()));
  });

  router.post('/', async (c) => {
    try {
      const body = await readJson<{ name?: string; workspaceId?: string }>(c);
      const workspaceId = body?.workspaceId;
      if (!workspaceId) {
        throw createHttpError('workspaceId is required', 400);
      }
      const deck = createDeck(body?.name, workspaceId);
      return c.json(deck, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.patch('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const existing = decks.get(id);
      if (!existing) {
        throw createHttpError('Deck not found', 404);
      }

      const body = await readJson<{ name?: string; workspaceId?: string }>(c);
      const name = body?.name?.trim() || existing.name;
      const workspaceId = body?.workspaceId || existing.workspaceId;
      let root = existing.root;

      if (workspaceId !== existing.workspaceId) {
        const workspace = requireWorkspace(workspaces, workspaceId);
        root = workspace.path;
      }

      const updated: Deck = { ...existing, name, root, workspaceId };
      updateDeckStmt.run(name, root, workspaceId, id);
      decks.set(id, updated);

      return c.json(updated);
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.delete('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      if (!decks.has(id)) {
        throw createHttpError('Deck not found', 404);
      }

      deleteTerminalsForDeck.run(id);
      deleteDeckStmt.run(id);
      decks.delete(id);

      // Clean up deck groups containing this deck
      for (const [groupId, group] of deckGroups) {
        if (group.deckIds.includes(id)) {
          deleteGroupStmt.run(groupId);
          deckGroups.delete(groupId);
        }
      }

      return c.body(null, 204);
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
