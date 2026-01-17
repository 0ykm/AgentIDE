import { useCallback, useEffect, useState } from 'react';
import type { Deck } from '../types';
import {
  listDecks,
  createDeck as apiCreateDeck,
  createTerminal as apiCreateTerminal,
  deleteTerminal as apiDeleteTerminal,
  listTerminals
} from '../api';
import { getErrorMessage, createEmptyDeckState } from '../utils';

interface UseDecksProps {
  setStatusMessage: (message: string) => void;
  initializeDeckStates: (deckIds: string[]) => void;
  updateDeckState: (deckId: string, updater: (state: import('../types').DeckState) => import('../types').DeckState) => void;
  deckStates: Record<string, import('../types').DeckState>;
  setDeckStates: React.Dispatch<React.SetStateAction<Record<string, import('../types').DeckState>>>;
}

export const useDecks = ({
  setStatusMessage,
  initializeDeckStates,
  updateDeckState,
  deckStates,
  setDeckStates
}: UseDecksProps) => {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

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
          `\u30c7\u30c3\u30ad\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });

    return () => {
      alive = false;
    };
  }, [setStatusMessage, initializeDeckStates]);

  useEffect(() => {
    if (activeDeckId && decks.some((deck) => deck.id === activeDeckId)) {
      return;
    }
    setActiveDeckId(decks[0]?.id ?? null);
  }, [decks, activeDeckId]);

  useEffect(() => {
    if (!activeDeckId) return;
    const current = deckStates[activeDeckId];
    if (current?.terminalsLoaded) return;
    listTerminals(activeDeckId)
      .then((sessions) => {
        updateDeckState(activeDeckId, (state) => {
          const nextActive =
            state.activeTerminalId &&
            sessions.some((item) => item.id === state.activeTerminalId)
              ? state.activeTerminalId
              : sessions[0]?.id ?? null;
          return {
            ...state,
            terminals: sessions,
            activeTerminalId: nextActive,
            terminalsLoaded: true
          };
        });
      })
      .catch((error: unknown) => {
        updateDeckState(activeDeckId, (state) => ({
          ...state,
          terminalsLoaded: true
        }));
        setStatusMessage(
          `\u30bf\u30fc\u30df\u30ca\u30eb\u3092\u53d6\u5f97\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      });
  }, [activeDeckId, deckStates, updateDeckState, setStatusMessage]);

  const handleCreateDeck = useCallback(
    async (name: string, workspaceId: string) => {
      try {
        const deck = await apiCreateDeck(name, workspaceId);
        setDecks((prev) => [...prev, deck]);
        setActiveDeckId(deck.id);
        setDeckStates((prev) => ({
          ...prev,
          [deck.id]: createEmptyDeckState()
        }));
        return deck;
      } catch (error: unknown) {
        setStatusMessage(
          `\u30c7\u30c3\u30ad\u306e\u4f5c\u6210\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${getErrorMessage(error)}`
        );
        return null;
      }
    },
    [setStatusMessage, setDeckStates]
  );

  const handleCreateTerminal = useCallback(
    async (deckId: string, terminalsCount: number) => {
      try {
        const index = terminalsCount + 1;
        const title = `\u30bf\u30fc\u30df\u30ca\u30eb ${index}`;
        const session = await apiCreateTerminal(deckId, title);
        updateDeckState(deckId, (state) => {
          const terminal = {
            id: session.id,
            title: session.title || title
          };
          return {
            ...state,
            terminals: [...state.terminals, terminal],
            activeTerminalId: terminal.id,
            terminalsLoaded: true
          };
        });
      } catch (error: unknown) {
        setStatusMessage(
          `\u30bf\u30fc\u30df\u30ca\u30eb\u3092\u8d77\u52d5\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      }
    },
    [updateDeckState, setStatusMessage]
  );

  const handleSelectTerminal = useCallback(
    (deckId: string, terminalId: string) => {
      updateDeckState(deckId, (state) => ({
        ...state,
        activeTerminalId: terminalId
      }));
    },
    [updateDeckState]
  );

  const handleDeleteTerminal = useCallback(
    async (deckId: string, terminalId: string) => {
      try {
        await apiDeleteTerminal(terminalId);
        updateDeckState(deckId, (state) => {
          const newTerminals = state.terminals.filter((t) => t.id !== terminalId);
          const newActiveId =
            state.activeTerminalId === terminalId
              ? newTerminals[0]?.id ?? null
              : state.activeTerminalId;
          return {
            ...state,
            terminals: newTerminals,
            activeTerminalId: newActiveId
          };
        });
      } catch (error: unknown) {
        setStatusMessage(
          `\u30bf\u30fc\u30df\u30ca\u30eb\u3092\u524a\u9664\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f: ${getErrorMessage(error)}`
        );
      }
    },
    [updateDeckState, setStatusMessage]
  );

  return {
    decks,
    activeDeckId,
    setActiveDeckId,
    handleCreateDeck,
    handleCreateTerminal,
    handleSelectTerminal,
    handleDeleteTerminal
  };
};
