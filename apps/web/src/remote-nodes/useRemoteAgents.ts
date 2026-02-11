import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentSession, CreateAgentRequest, AgentStatus } from '../types';
import { NodeApiClient } from './NodeApiClient';
import {
  MESSAGE_AGENT_FETCH_ERROR,
  MESSAGE_AGENT_START_ERROR,
  MESSAGE_AGENT_DELETE_ERROR
} from '../constants';

interface UseRemoteAgentsProps {
  nodeClient: NodeApiClient | null;
  setStatusMessage: (message: string) => void;
}

export function useRemoteAgents({ nodeClient, setStatusMessage }: UseRemoteAgentsProps) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const streamCleanups = useRef<Map<string, () => void>>(new Map());
  // Track the client that was used for loading to avoid stale closures
  const activeClientRef = useRef<NodeApiClient | null>(null);

  const connectStream = useCallback((client: NodeApiClient, sessionId: string) => {
    if (streamCleanups.current.has(sessionId)) return;

    const cleanup = client.streamAgentSession(
      sessionId,
      (msg) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, msg] }
              : s
          )
        );
      },
      (status: AgentStatus, extra) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  status,
                  error: extra?.error || s.error,
                  durationMs: extra?.durationMs || s.durationMs,
                  totalCostUsd: extra?.totalCostUsd ?? s.totalCostUsd
                }
              : s
          )
        );
        if (status === 'completed' || status === 'error' || status === 'aborted') {
          const c = streamCleanups.current.get(sessionId);
          if (c) {
            c();
            streamCleanups.current.delete(sessionId);
          }
        }
      },
      () => {
        streamCleanups.current.delete(sessionId);
      }
    );

    streamCleanups.current.set(sessionId, cleanup);
  }, []);

  // Load sessions when nodeClient changes
  useEffect(() => {
    if (!nodeClient) {
      setSessions([]);
      setSessionsLoaded(false);
      return;
    }

    let alive = true;
    activeClientRef.current = nodeClient;

    nodeClient.listAgentSessions()
      .then((data) => {
        if (!alive) return;
        setSessions(data);
        setSessionsLoaded(true);
        for (const session of data) {
          if (session.status === 'running' || session.status === 'idle') {
            connectStream(nodeClient, session.id);
          }
        }
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setStatusMessage(
          `${MESSAGE_AGENT_FETCH_ERROR}: ${err instanceof Error ? err.message : String(err)}`
        );
      });

    return () => {
      alive = false;
      // Clean up streams when client changes
      for (const cleanup of streamCleanups.current.values()) {
        cleanup();
      }
      streamCleanups.current.clear();
    };
  }, [nodeClient, setStatusMessage, connectStream]);

  const handleCreateAgent = useCallback(
    async (req: CreateAgentRequest) => {
      const client = activeClientRef.current;
      if (!client) return null;
      try {
        const session = await client.createAgentSession(req);
        setSessions((prev) => [...prev, session]);
        connectStream(client, session.id);
        return session;
      } catch (err: unknown) {
        setStatusMessage(
          `${MESSAGE_AGENT_START_ERROR}: ${err instanceof Error ? err.message : String(err)}`
        );
        return null;
      }
    },
    [setStatusMessage, connectStream]
  );

  const handleDeleteAgent = useCallback(
    async (id: string) => {
      const client = activeClientRef.current;
      if (!client) return;
      try {
        const cleanup = streamCleanups.current.get(id);
        if (cleanup) {
          cleanup();
          streamCleanups.current.delete(id);
        }
        await client.deleteAgentSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
      } catch (err: unknown) {
        setStatusMessage(
          `${MESSAGE_AGENT_DELETE_ERROR}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    },
    [setStatusMessage]
  );

  return {
    sessions,
    sessionsLoaded,
    handleCreateAgent,
    handleDeleteAgent
  };
}
