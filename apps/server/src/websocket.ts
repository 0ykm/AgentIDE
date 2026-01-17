import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import type { TerminalSession } from './types.js';
import {
  PORT,
  TERMINAL_IDLE_TIMEOUT_MS,
  WS_RATE_LIMIT_WINDOW_MS,
  WS_RATE_LIMIT_MAX_MESSAGES
} from './config.js';
import { checkWebSocketRateLimit, wsMessageRateLimits } from './middleware/security.js';
import { verifyWebSocketAuth } from './middleware/auth.js';

export function setupWebSocketServer(
  server: any,
  terminals: Map<string, TerminalSession>
): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket, req) => {
    if (!verifyWebSocketAuth(req)) {
      socket.close(1008, 'Unauthorized');
      return;
    }
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const match = url.pathname.match(/\/api\/terminals\/(.+)/);
    if (!match) {
      socket.close();
      return;
    }
    const id = match[1];
    const session = terminals.get(id);
    if (!session) {
      socket.close();
      return;
    }

    const socketId = crypto.randomUUID();
    session.sockets.add(socket);
    session.lastActive = Date.now();
    if (session.buffer) {
      socket.send(session.buffer);
    }

    socket.on('message', (data) => {
      if (!checkWebSocketRateLimit(socketId, WS_RATE_LIMIT_WINDOW_MS, WS_RATE_LIMIT_MAX_MESSAGES)) {
        console.warn(`WebSocket rate limit exceeded for socket ${socketId}`);
        socket.send('\r\n\x1b[31mRate limit exceeded. Please slow down.\x1b[0m\r\n');
        return;
      }
      session.lastActive = Date.now();
      const message = data.toString();
      if (message.startsWith('\u0000resize:')) {
        const payload = message.slice('\u0000resize:'.length);
        const [colsRaw, rowsRaw] = payload.split(',');
        const cols = Number(colsRaw);
        const rows = Number(rowsRaw);
        if (Number.isFinite(cols) && Number.isFinite(rows)) {
          session.term.resize(cols, rows);
        }
        return;
      }
      session.term.write(message);
    });

    socket.on('close', () => {
      session.sockets.delete(socket);
      session.lastActive = Date.now();
      wsMessageRateLimits.delete(socketId);
    });
  });

  return wss;
}

export function setupTerminalCleanup(terminals: Map<string, TerminalSession>): void {
  setInterval(() => {
    const now = Date.now();
    terminals.forEach((session, id) => {
      if (
        session.sockets.size === 0 &&
        now - session.lastActive > TERMINAL_IDLE_TIMEOUT_MS
      ) {
        session.dispose?.dispose();
        session.term.kill();
        terminals.delete(id);
      }
    });
  }, 60_000).unref();
}
