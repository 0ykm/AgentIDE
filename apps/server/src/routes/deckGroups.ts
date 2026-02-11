import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { Deck, DeckGroup } from '../types.js';
import { createHttpError, handleError, readJson } from '../utils/error.js';

export function createDeckGroupRouter(
  db: DatabaseSync,
  decks: Map<string, Deck>,
  deckGroups: Map<string, DeckGroup>
) {
  const router = new Hono();

  const insertGroup = db.prepare(
    'INSERT INTO deck_groups (id, name, deck_ids, created_at) VALUES (?, ?, ?, ?)'
  );
  const updateGroupStmt = db.prepare(
    'UPDATE deck_groups SET name = ?, deck_ids = ? WHERE id = ?'
  );
  const deleteGroupStmt = db.prepare('DELETE FROM deck_groups WHERE id = ?');

  router.get('/', (c) => {
    return c.json(Array.from(deckGroups.values()));
  });

  router.post('/', async (c) => {
    try {
      const body = await readJson<{ name?: string; deckIds?: string[] }>(c);
      const deckIds = body?.deckIds;
      if (!deckIds || deckIds.length !== 2) {
        throw createHttpError('deckIds must be an array of exactly 2 deck IDs', 400);
      }
      if (!decks.has(deckIds[0]) || !decks.has(deckIds[1])) {
        throw createHttpError('One or both deck IDs not found', 404);
      }

      const name = body?.name?.trim() ||
        `${decks.get(deckIds[0])!.name} | ${decks.get(deckIds[1])!.name}`;

      const group: DeckGroup = {
        id: crypto.randomUUID(),
        name,
        deckIds: deckIds as [string, string],
        createdAt: new Date().toISOString()
      };

      insertGroup.run(group.id, group.name, JSON.stringify(group.deckIds), group.createdAt);
      deckGroups.set(group.id, group);

      return c.json(group, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.patch('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      const existing = deckGroups.get(id);
      if (!existing) {
        throw createHttpError('Deck group not found', 404);
      }

      const body = await readJson<{ name?: string; deckIds?: string[] }>(c);
      const name = body?.name?.trim() || existing.name;
      let deckIds = existing.deckIds;

      if (body?.deckIds) {
        if (body.deckIds.length !== 2) {
          throw createHttpError('deckIds must be an array of exactly 2 deck IDs', 400);
        }
        if (!decks.has(body.deckIds[0]) || !decks.has(body.deckIds[1])) {
          throw createHttpError('One or both deck IDs not found', 404);
        }
        deckIds = body.deckIds as [string, string];
      }

      const updated: DeckGroup = { ...existing, name, deckIds };
      updateGroupStmt.run(name, JSON.stringify(deckIds), id);
      deckGroups.set(id, updated);

      return c.json(updated);
    } catch (error) {
      return handleError(c, error);
    }
  });

  router.delete('/:id', async (c) => {
    try {
      const id = c.req.param('id');
      if (!deckGroups.has(id)) {
        throw createHttpError('Deck group not found', 404);
      }

      deleteGroupStmt.run(id);
      deckGroups.delete(id);

      return c.body(null, 204);
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
