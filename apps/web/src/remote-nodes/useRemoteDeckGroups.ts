import { useCallback, useMemo } from 'react';
import type { Deck, DeckGroup } from '../types';
import type { NodeDeck } from './useRemoteDecks';

export interface UseRemoteDeckGroupsReturn {
  allDeckGroups: DeckGroup[];
  createDeckGroup: (
    name: string,
    deck1: { nodeId: string; deckId: string },
    deck2: { nodeId: string; deckId: string }
  ) => Promise<DeckGroup | null>;
  updateDeckGroup: (
    id: string,
    updates: { name?: string; deckIds?: [string, string] }
  ) => Promise<DeckGroup | null>;
  deleteDeckGroup: (id: string) => Promise<void>;
  resolveDeckGroupDecks: (group: DeckGroup) => {
    deck1: NodeDeck | null;
    deck2: NodeDeck | null;
  };
}

/**
 * Encode a deck reference as composite id.
 * Local decks use plain deckId, remote decks use "nodeId:deckId".
 */
function encodeCompositeId(nodeId: string, deckId: string, localNodeId: string): string {
  if (nodeId === localNodeId || nodeId === 'local') {
    return deckId;
  }
  return `${nodeId}:${deckId}`;
}

/**
 * Decode a composite deck id.
 * Returns { nodeId, deckId }.
 */
function decodeCompositeId(compositeId: string, localNodeId: string): { nodeId: string; deckId: string } {
  const colonIndex = compositeId.indexOf(':');
  if (colonIndex === -1) {
    return { nodeId: localNodeId, deckId: compositeId };
  }
  return {
    nodeId: compositeId.substring(0, colonIndex),
    deckId: compositeId.substring(colonIndex + 1)
  };
}

export function useRemoteDeckGroups(params: {
  localDeckGroups: DeckGroup[];
  localDecks: Deck[];
  remoteDecks: NodeDeck[];
  localNodeId: string;
  handleCreateLocalDeckGroup: (name: string, deckIds: [string, string]) => Promise<DeckGroup | null>;
  handleUpdateLocalDeckGroup: (id: string, updates: { name?: string; deckIds?: [string, string] }) => Promise<DeckGroup | null>;
  handleDeleteLocalDeckGroup: (id: string) => Promise<boolean>;
}): UseRemoteDeckGroupsReturn {
  const {
    localDeckGroups,
    localDecks,
    remoteDecks,
    localNodeId,
    handleCreateLocalDeckGroup,
    handleUpdateLocalDeckGroup,
    handleDeleteLocalDeckGroup
  } = params;

  // All deck groups come from local server storage
  const allDeckGroups = localDeckGroups;

  // Build a lookup of all known decks (local + remote) as NodeDeck
  const allDecksMap = useMemo(() => {
    const map = new Map<string, NodeDeck>();

    // Local decks
    for (const deck of localDecks) {
      const nodeDeck: NodeDeck = {
        ...deck,
        nodeId: localNodeId,
        nodeName: 'Local'
      };
      map.set(deck.id, nodeDeck);
      map.set(`${localNodeId}:${deck.id}`, nodeDeck);
    }

    // Remote decks
    for (const deck of remoteDecks) {
      const compositeId = `${deck.nodeId}:${deck.id}`;
      map.set(compositeId, deck);
    }

    return map;
  }, [localDecks, remoteDecks, localNodeId]);

  const createDeckGroup = useCallback(
    async (
      name: string,
      deck1: { nodeId: string; deckId: string },
      deck2: { nodeId: string; deckId: string }
    ): Promise<DeckGroup | null> => {
      const id1 = encodeCompositeId(deck1.nodeId, deck1.deckId, localNodeId);
      const id2 = encodeCompositeId(deck2.nodeId, deck2.deckId, localNodeId);
      return handleCreateLocalDeckGroup(name, [id1, id2]);
    },
    [localNodeId, handleCreateLocalDeckGroup]
  );

  const updateDeckGroup = useCallback(
    async (
      id: string,
      updates: { name?: string; deckIds?: [string, string] }
    ): Promise<DeckGroup | null> => {
      return handleUpdateLocalDeckGroup(id, updates);
    },
    [handleUpdateLocalDeckGroup]
  );

  const deleteDeckGroup = useCallback(
    async (id: string) => {
      await handleDeleteLocalDeckGroup(id);
    },
    [handleDeleteLocalDeckGroup]
  );

  const resolveDeckGroupDecks = useCallback(
    (group: DeckGroup): { deck1: NodeDeck | null; deck2: NodeDeck | null } => {
      const resolve = (compositeId: string): NodeDeck | null => {
        // Try direct lookup first (works for local plain ids)
        const direct = allDecksMap.get(compositeId);
        if (direct) return direct;

        // Decode and try with composite format
        const { nodeId, deckId } = decodeCompositeId(compositeId, localNodeId);
        const compositeKey = `${nodeId}:${deckId}`;
        return allDecksMap.get(compositeKey) || allDecksMap.get(deckId) || null;
      };

      return {
        deck1: resolve(group.deckIds[0]),
        deck2: resolve(group.deckIds[1])
      };
    },
    [allDecksMap, localNodeId]
  );

  return {
    allDeckGroups,
    createDeckGroup,
    updateDeckGroup,
    deleteDeckGroup,
    resolveDeckGroupDecks
  };
}
