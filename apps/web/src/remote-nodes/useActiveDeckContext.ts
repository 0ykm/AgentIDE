import { useMemo } from 'react';
import type { Deck, Workspace } from '../types';
import type { NodeDeck } from './useRemoteDecks';
import { NodeApiClient } from './NodeApiClient';

export interface ActiveDeckContext {
  isRemoteDeck: boolean;
  activeNodeId: string | null;
  activeNodeClient: NodeApiClient | null;
  workspaceId: string | null;
  workspace: Workspace | null;
  wsBase: string;
  wsTokenFetcher: (() => Promise<{ token: string; authEnabled: boolean }>) | undefined;
}

interface UseActiveDeckContextParams {
  activeDeckIds: string[];
  localDecks: Deck[];
  remoteDecks: NodeDeck[];
  localNodeId: string;
  getNodeClient: (nodeId: string) => NodeApiClient | null;
  localWsBase: string;
}

export function useActiveDeckContext({
  activeDeckIds,
  localDecks,
  remoteDecks,
  localNodeId,
  getNodeClient,
  localWsBase
}: UseActiveDeckContextParams): ActiveDeckContext {
  return useMemo(() => {
    const activeDeckId = activeDeckIds[0] || null;
    if (!activeDeckId) {
      return {
        isRemoteDeck: false,
        activeNodeId: localNodeId,
        activeNodeClient: null,
        workspaceId: null,
        workspace: null,
        wsBase: localWsBase,
        wsTokenFetcher: undefined
      };
    }

    // Check if the active deck is a local deck
    const localDeck = localDecks.find((d) => d.id === activeDeckId);
    if (localDeck) {
      return {
        isRemoteDeck: false,
        activeNodeId: localNodeId,
        activeNodeClient: getNodeClient(localNodeId),
        workspaceId: localDeck.workspaceId,
        workspace: null, // Workspace resolution is done by the consumer
        wsBase: localWsBase,
        wsTokenFetcher: undefined
      };
    }

    // Check if the active deck is a remote deck
    const remoteDeck = remoteDecks.find((d) => d.id === activeDeckId);
    if (remoteDeck) {
      const nodeClient = getNodeClient(remoteDeck.nodeId);
      return {
        isRemoteDeck: true,
        activeNodeId: remoteDeck.nodeId,
        activeNodeClient: nodeClient,
        workspaceId: remoteDeck.workspaceId,
        workspace: null,
        wsBase: nodeClient ? nodeClient.getWsBase() : localWsBase,
        wsTokenFetcher: nodeClient
          ? () => nodeClient.getWsToken()
          : undefined
      };
    }

    // Deck not found in either list
    return {
      isRemoteDeck: false,
      activeNodeId: null,
      activeNodeClient: null,
      workspaceId: null,
      workspace: null,
      wsBase: localWsBase,
      wsTokenFetcher: undefined
    };
  }, [activeDeckIds, localDecks, remoteDecks, localNodeId, getNodeClient, localWsBase]);
}
