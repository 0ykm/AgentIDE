import crypto from 'node:crypto';
import { Hono } from 'hono';
import { spawn } from 'node-pty';
import type { Deck, TerminalSession } from '../types.js';
import { TERMINAL_BUFFER_LIMIT } from '../config.js';
import { createHttpError, handleError, readJson } from '../utils/error.js';
import { getDefaultShell } from '../utils/shell.js';

export function createTerminalRouter(
  decks: Map<string, Deck>,
  terminals: Map<string, TerminalSession>
) {
  const router = new Hono();

  function appendToTerminalBuffer(session: TerminalSession, data: string): void {
    session.buffer += data;
    if (session.buffer.length > TERMINAL_BUFFER_LIMIT) {
      session.buffer = session.buffer.slice(
        session.buffer.length - TERMINAL_BUFFER_LIMIT
      );
    }
  }

  function getNextTerminalIndex(deckId: string): number {
    let count = 0;
    terminals.forEach((session) => {
      if (session.deckId === deckId) {
        count += 1;
      }
    });
    return count + 1;
  }

  function createTerminalSession(deck: Deck, title?: string): TerminalSession {
    const id = crypto.randomUUID();
    const shell = getDefaultShell();
    const env = {
      ...process.env,
      TERM: process.env.TERM || 'xterm-256color'
    };
    const term = spawn(shell, [], {
      cwd: deck.root,
      cols: 120,
      rows: 32,
      env
    });
    const resolvedTitle = title || `Terminal ${getNextTerminalIndex(deck.id)}`;
    const session: TerminalSession = {
      id,
      deckId: deck.id,
      title: resolvedTitle,
      createdAt: new Date().toISOString(),
      term,
      sockets: new Set(),
      buffer: '',
      lastActive: Date.now(),
      dispose: null
    };
    session.dispose = term.onData((data) => {
      appendToTerminalBuffer(session, data);
      session.lastActive = Date.now();
      session.sockets.forEach((socket) => {
        if (socket.readyState === 1) {
          socket.send(data);
        }
      });
    });
    term.onExit(() => {
      session.sockets.forEach((socket) => {
        try {
          socket.close();
        } catch {
          // ignore
        }
      });
      terminals.delete(id);
    });
    terminals.set(id, session);
    return session;
  }

  router.get('/', (c) => {
    const deckId = c.req.query('deckId');
    if (!deckId) {
      return c.json({ error: 'deckId is required' }, 400);
    }
    const sessions: Array<{ id: string; title: string; createdAt: string }> = [];
    terminals.forEach((session) => {
      if (session.deckId === deckId) {
        sessions.push({
          id: session.id,
          title: session.title,
          createdAt: session.createdAt
        });
      }
    });
    sessions.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return c.json(sessions);
  });

  router.post('/', async (c) => {
    try {
      const body = await readJson<{ deckId?: string; title?: string }>(c);
      const deckId = body?.deckId;
      if (!deckId || !decks.has(deckId)) {
        throw createHttpError('deckId is required', 400);
      }
      const deck = decks.get(deckId);
      if (!deck) {
        throw createHttpError('deck not found', 404);
      }
      const session = createTerminalSession(deck, body?.title);
      return c.json({ id: session.id, title: session.title }, 201);
    } catch (error) {
      return handleError(c, error);
    }
  });

  return router;
}
