import crypto from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { WebSocketServer, WebSocket } from 'ws';
import type { TerminalSession } from './types.js';
import {
  PORT,
  TERMINAL_IDLE_TIMEOUT_MS,
  WS_RATE_LIMIT_WINDOW_MS,
  WS_RATE_LIMIT_MAX_MESSAGES
} from './config.js';
import { checkWebSocketRateLimit, wsMessageRateLimits } from './middleware/security.js';
import { verifyWebSocketAuth } from './middleware/auth.js';

const MIN_TERMINAL_SIZE = 1;
const MAX_TERMINAL_SIZE = 500;

function validateTerminalSize(value: number): number {
  const intValue = Math.floor(value);
  if (!Number.isFinite(intValue) || intValue < MIN_TERMINAL_SIZE) {
    return MIN_TERMINAL_SIZE;
  }
  if (intValue > MAX_TERMINAL_SIZE) {
    return MAX_TERMINAL_SIZE;
  }
  return intValue;
}

export function setupWebSocketServer(
  server: HttpServer | HttpsServer,
  terminals: Map<string, TerminalSession>
): WebSocketServer {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket: WebSocket, req) => {
    const socketId = crypto.randomUUID();

    // Add error handler for socket
    socket.on('error', (error) => {
      console.error(`WebSocket error for socket ${socketId}:`, error.message);
      try {
        socket.close(1011, 'Internal error');
      } catch {
        // Socket might already be closed
      }
    });

    if (!verifyWebSocketAuth(req)) {
      socket.close(1008, 'Unauthorized');
      return;
    }

    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const match = url.pathname.match(/\/api\/terminals\/(.+)/);
    if (!match) {
      socket.close(1002, 'Invalid path');
      return;
    }

    const id = match[1];
    const session = terminals.get(id);
    if (!session) {
      socket.close(1002, 'Terminal not found');
      return;
    }

    session.sockets.add(socket);
    session.lastActive = Date.now();

    // Send buffer content if available
    if (session.buffer) {
      try {
        socket.send(session.buffer);
      } catch (error) {
        console.error(`Failed to send buffer to socket ${socketId}:`, error);
      }
    }

    socket.on('message', (data) => {
      try {
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
          const cols = validateTerminalSize(Number(colsRaw));
          const rows = validateTerminalSize(Number(rowsRaw));

          try {
            session.term.resize(cols, rows);
          } catch (resizeError) {
            console.error(`Failed to resize terminal ${id}:`, resizeError);
          }
          return;
        }

        try {
          session.term.write(message);
        } catch (writeError) {
          console.error(`Failed to write to terminal ${id}:`, writeError);
        }
      } catch (error) {
        console.error(`Error handling WebSocket message for socket ${socketId}:`, error);
      }
    });

    socket.on('close', () => {
      session.sockets.delete(socket);
      session.lastActive = Date.now();
      wsMessageRateLimits.delete(socketId);
    });
  });

  wss.on('error', (error) => {
    console.error('WebSocket server error:', error);
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
        try {
          if (session.dispose) {
            session.dispose.dispose();
          }
        } catch (error) {
          console.error(`Failed to dispose terminal ${id}:`, error);
        }

        try {
          session.term.kill();
        } catch (error) {
          console.error(`Failed to kill terminal ${id}:`, error);
        }

        terminals.delete(id);
      }
    });
  }, 60_000).unref();
}
