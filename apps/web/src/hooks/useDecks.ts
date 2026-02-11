import { useCallback, useEffect, useRef, useState } from 'react';
import type { Deck, TerminalLayout } from '../types';
import {
  listDecks,
  createDeck as apiCreateDeck,
  updateDeck as apiUpdateDeck,
  deleteDeck as apiDeleteDeck,
  createTerminal as apiCreateTerminal,
  deleteTerminal as apiDeleteTerminal,
  listTerminals
} from '../api';
import { getErrorMessage, createEmptyDeckState } from '../utils';

export interface TerminalApi {
  createTerminal: (deckId: string, title?: string, command?: string) => Promise<{ id: string; title: string }>;
  deleteTerminal: (terminalId: string) => Promise<void>;
  listTerminals: (deckId: string) => Promise<{ id: string; title: string }[]>;
}

interface UseDecksProps {
  setStatusMessage: (message: string) => void;
  initializeDeckStates: (deckIds: string[]) => void;
  updateDeckState: (deckId: string, updater: (state: import('../types').DeckState) => import('../types').DeckState) => void;
  deckStates: Record<string, import('../types').DeckState>;
  setDeckStates: React.Dispatch<React.SetStateAction<Record<string, import('../types').DeckState>>>;
  initialDeckIds?: string[];
  /** Remote deck IDs that should be considered valid (not filtered out by validation) */
  remoteDeckIds?: string[];
  /** Returns the terminal API for a given deck ID. Return undefined to use default (local) API. */
  getTerminalApi?: (deckId: string) => TerminalApi | undefined;
}

const defaultTerminalApi: TerminalApi = { createTerminal: apiCreateTerminal, deleteTerminal: apiDeleteTerminal, listTerminals };

export const useDecks = ({
  setStatusMessage,
  initializeDeckStates,
  updateDeckState,
  deckStates,
  setDeckStates,
  initialDeckIds,
  remoteDeckIds,
  getTerminalApi
}: UseDecksProps) => {
  const getTerminalApiRef = useRef(getTerminalApi);
  getTerminalApiRef.current = getTerminalApi;
  const resolveTerminalApi = useCallback(
    (deckId: string) => getTerminalApiRef.current?.(deckId) ?? defaultTerminalApi,
    []
  );
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckIds, setActiveDeckIds] = useState<string[]>(initialDeckIds ?? []);

  useEffect(() => {
    let alive = true;
    listDecks()
      .then((data) => {
        if (!alive) return;
        setDecks(data);
        initializeDeckStates(data.map((deck) => deck.id));
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setStatusMessage(
          `デッキを取得できませんでした: ${getErrorMessage(error)}`
        );
      });

    return () => {
      alive = false;
    };
  }, [setStatusMessage, initializeDeckStates]);

  useEffect(() => {
    // Don't do anything until decks are loaded
    if (decks.length === 0) {
      return;
    }
    const remoteSet = new Set(remoteDeckIds);
    // Filter out invalid deck IDs (local decks must exist, remote deck IDs are always valid)
    const validIds = activeDeckIds.filter(
      (id) => remoteSet.has(id) || decks.some((deck) => deck.id === id)
    );
    // If all IDs are valid, keep them
    if (validIds.length === activeDeckIds.length && validIds.length > 0) {
      return;
    }
    // If we have some valid IDs, use them; otherwise fall back to first deck
    if (validIds.length > 0) {
      setActiveDeckIds(validIds);
    } else if (decks[0]) {
      setActiveDeckIds([decks[0].id]);
    }
  }, [decks, activeDeckIds, remoteDeckIds]);

  // Load terminals for all active decks
  useEffect(() => {
    activeDeckIds.forEach((deckId) => {
      const current = deckStates[deckId];
      if (current?.terminalsLoaded) return;
      const api = resolveTerminalApi(deckId);
      api.listTerminals(deckId)
        .then((sessions) => {
          updateDeckState(deckId, (state) => ({
            ...state,
            terminals: sessions,
            terminalsLoaded: true
          }));
        })
        .catch((error: unknown) => {
          updateDeckState(deckId, (state) => ({
            ...state,
            terminalsLoaded: true
          }));
          setStatusMessage(
            `ターミナルを取得できませんでした: ${getErrorMessage(error)}`
          );
        });
    });
  }, [activeDeckIds, deckStates, updateDeckState, setStatusMessage]);

  const handleCreateDeck = useCallback(
    async (name: string, workspaceId: string) => {
      try {
        const deck = await apiCreateDeck(name, workspaceId);
        setDecks((prev) => [...prev, deck]);
        setActiveDeckIds((prev) => [...prev.filter((id) => id !== deck.id), deck.id]);
        setDeckStates((prev) => ({
          ...prev,
          [deck.id]: createEmptyDeckState()
        }));
        return deck;
      } catch (error: unknown) {
        setStatusMessage(
          `デッキの作成に失敗しました: ${getErrorMessage(error)}`
        );
        return null;
      }
    },
    [setStatusMessage, setDeckStates]
  );

  const handleCreateTerminal = useCallback(
    async (deckId: string, terminalsCount: number, command?: string, customTitle?: string) => {
      try {
        const index = terminalsCount + 1;
        const title = customTitle || `ターミナル ${index}`;
        const api = resolveTerminalApi(deckId);
        const session = await api.createTerminal(deckId, title, command);
        updateDeckState(deckId, (state) => {
          const terminal = {
            id: session.id,
            title: session.title || title
          };
          return {
            ...state,
            terminals: [...state.terminals, terminal],
            terminalsLoaded: true
          };
        });
      } catch (error: unknown) {
        setStatusMessage(
          `ターミナルを起動できませんでした: ${getErrorMessage(error)}`
        );
      }
    },
    [updateDeckState, setStatusMessage]
  );

  const handleDeleteTerminal = useCallback(
    async (deckId: string, terminalId: string) => {
      try {
        const api = resolveTerminalApi(deckId);
        await api.deleteTerminal(terminalId);
        updateDeckState(deckId, (state) => ({
          ...state,
          terminals: state.terminals.filter((t) => t.id !== terminalId)
        }));
      } catch (error: unknown) {
        setStatusMessage(
          `ターミナルを削除できませんでした: ${getErrorMessage(error)}`
        );
      }
    },
    [updateDeckState, setStatusMessage]
  );

  const handleUpdateDeck = useCallback(
    async (id: string, updates: { name?: string; workspaceId?: string; terminalLayout?: TerminalLayout }) => {
      try {
        const updated = await apiUpdateDeck(id, updates);
        setDecks((prev) => prev.map((d) => (d.id === id ? updated : d)));
        return updated;
      } catch (error: unknown) {
        setStatusMessage(
          `デッキを更新できませんでした: ${getErrorMessage(error)}`
        );
        return null;
      }
    },
    [setStatusMessage]
  );

  const handleDeleteDeck = useCallback(
    async (id: string) => {
      try {
        await apiDeleteDeck(id);
        setDecks((prev) => prev.filter((d) => d.id !== id));
        setActiveDeckIds((prev) => prev.filter((deckId) => deckId !== id));
        setDeckStates((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return true;
      } catch (error: unknown) {
        setStatusMessage(
          `デッキを削除できませんでした: ${getErrorMessage(error)}`
        );
        return false;
      }
    },
    [setStatusMessage, setDeckStates]
  );

  const removeDecksForWorkspace = useCallback(
    (workspaceId: string) => {
      const deckIdsToRemove = new Set(
        decks.filter((d) => d.workspaceId === workspaceId).map((d) => d.id)
      );
      if (deckIdsToRemove.size === 0) return;
      setDecks((prev) => prev.filter((d) => !deckIdsToRemove.has(d.id)));
      setActiveDeckIds((prev) => prev.filter((id) => !deckIdsToRemove.has(id)));
      setDeckStates((prev) => {
        const next = { ...prev };
        for (const id of deckIdsToRemove) {
          delete next[id];
        }
        return next;
      });
    },
    [decks, setDeckStates]
  );

  return {
    decks,
    activeDeckIds,
    setActiveDeckIds,
    handleCreateDeck,
    handleUpdateDeck,
    handleDeleteDeck,
    handleCreateTerminal,
    handleDeleteTerminal,
    removeDecksForWorkspace
  };
};
