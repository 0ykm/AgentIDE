import { useState, useCallback } from 'react';
import type { Deck } from '../types';
import type { RemoteNodeWithStatus } from '@deck-ide/shared/types';
import { NodeApiClient } from './NodeApiClient';

export interface NodeDeck extends Deck {
  nodeId: string;
  nodeName: string;
}

export interface UseRemoteDecksReturn {
  remoteDecks: NodeDeck[];
  loading: boolean;
  createRemoteDeck: (nodeId: string, name: string, workspaceId: string) => Promise<Deck | null>;
  updateRemoteDeck: (nodeId: string, deckId: string, updates: { name?: string; workspaceId?: string }) => Promise<Deck | null>;
  deleteRemoteDeck: (nodeId: string, deckId: string) => Promise<void>;
  createRemoteTerminal: (nodeId: string, deckId: string, title?: string, command?: string) => Promise<{ id: string; title: string } | null>;
  deleteRemoteTerminal: (nodeId: string, terminalId: string) => Promise<void>;
  refreshRemoteDecks: () => Promise<void>;
}

export function useRemoteDecks(
  onlineRemoteNodes: RemoteNodeWithStatus[],
  getNodeClient: (nodeId: string) => NodeApiClient | null
): UseRemoteDecksReturn {
  const [remoteDecks, setRemoteDecks] = useState<NodeDeck[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshRemoteDecks = useCallback(async () => {
    if (onlineRemoteNodes.length === 0) {
      setRemoteDecks([]);
      return;
    }

    setLoading(true);
    try {
      const results = await Promise.allSettled(
        onlineRemoteNodes.map(async (node) => {
          const client = getNodeClient(node.id);
          if (!client) return [];
          const decks = await client.listDecks();
          return decks.map((deck): NodeDeck => ({
            ...deck,
            nodeId: node.id,
            nodeName: node.name
          }));
        })
      );

      const allDecks: NodeDeck[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled') {
          allDecks.push(...result.value);
        }
      }

      setRemoteDecks(allDecks);
    } finally {
      setLoading(false);
    }
  }, [onlineRemoteNodes, getNodeClient]);

  const createRemoteDeck = useCallback(
    async (nodeId: string, name: string, workspaceId: string): Promise<Deck | null> => {
      const client = getNodeClient(nodeId);
      if (!client) return null;

      try {
        const deck = await client.createDeck(name, workspaceId);
        const node = onlineRemoteNodes.find((n) => n.id === nodeId);
        const nodeDeck: NodeDeck = {
          ...deck,
          nodeId,
          nodeName: node?.name || 'Unknown'
        };
        setRemoteDecks((prev) => [...prev, nodeDeck]);
        return deck;
      } catch {
        return null;
      }
    },
    [getNodeClient, onlineRemoteNodes]
  );

  const updateRemoteDeck = useCallback(
    async (nodeId: string, deckId: string, updates: { name?: string; workspaceId?: string }): Promise<Deck | null> => {
      const client = getNodeClient(nodeId);
      if (!client) return null;
      try {
        const updated = await client.updateDeck(deckId, updates);
        setRemoteDecks((prev) =>
          prev.map((d) => d.id === deckId && d.nodeId === nodeId ? { ...d, ...updated } : d)
        );
        return updated;
      } catch {
        return null;
      }
    },
    [getNodeClient]
  );

  const deleteRemoteDeck = useCallback(
    async (nodeId: string, deckId: string) => {
      const client = getNodeClient(nodeId);
      if (!client) return;

      await client.deleteDeck(deckId);
      setRemoteDecks((prev) => prev.filter((d) => !(d.id === deckId && d.nodeId === nodeId)));
    },
    [getNodeClient]
  );

  const createRemoteTerminal = useCallback(
    async (nodeId: string, deckId: string, title?: string, command?: string): Promise<{ id: string; title: string } | null> => {
      const client = getNodeClient(nodeId);
      if (!client) return null;

      try {
        return await client.createTerminal(deckId, title, command);
      } catch {
        return null;
      }
    },
    [getNodeClient]
  );

  const deleteRemoteTerminal = useCallback(
    async (nodeId: string, terminalId: string) => {
      const client = getNodeClient(nodeId);
      if (!client) return;

      await client.deleteTerminal(terminalId);
    },
    [getNodeClient]
  );

  return {
    remoteDecks,
    loading,
    createRemoteDeck,
    updateRemoteDeck,
    deleteRemoteDeck,
    createRemoteTerminal,
    deleteRemoteTerminal,
    refreshRemoteDecks
  };
}
