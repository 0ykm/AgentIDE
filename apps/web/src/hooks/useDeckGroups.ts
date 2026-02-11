import { useCallback, useEffect, useState } from 'react';
import type { Deck, DeckGroup } from '../types';
import {
  listDeckGroups,
  createDeckGroup as apiCreateDeckGroup,
  updateDeckGroup as apiUpdateDeckGroup,
  deleteDeckGroup as apiDeleteDeckGroup
} from '../api';
import { getErrorMessage } from '../utils';

interface UseDeckGroupsProps {
  setStatusMessage: (message: string) => void;
  decks: Deck[];
}

export const useDeckGroups = ({ setStatusMessage, decks }: UseDeckGroupsProps) => {
  const [deckGroups, setDeckGroups] = useState<DeckGroup[]>([]);

  useEffect(() => {
    let alive = true;
    listDeckGroups()
      .then((data) => {
        if (!alive) return;
        setDeckGroups(data);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setStatusMessage(
          `デッキグループを取得できませんでした: ${getErrorMessage(error)}`
        );
      });

    return () => {
      alive = false;
    };
  }, [setStatusMessage]);

  // Filter out groups with missing decks (local cleanup)
  useEffect(() => {
    if (decks.length === 0) return;
    const deckIdSet = new Set(decks.map((d) => d.id));
    setDeckGroups((prev) => {
      const filtered = prev.filter(
        (g) => deckIdSet.has(g.deckIds[0]) && deckIdSet.has(g.deckIds[1])
      );
      return filtered.length !== prev.length ? filtered : prev;
    });
  }, [decks]);

  const handleCreateDeckGroup = useCallback(
    async (name: string, deckIds: [string, string]) => {
      try {
        const group = await apiCreateDeckGroup(name, deckIds);
        setDeckGroups((prev) => [...prev, group]);
        return group;
      } catch (error: unknown) {
        setStatusMessage(
          `デッキグループの作成に失敗しました: ${getErrorMessage(error)}`
        );
        return null;
      }
    },
    [setStatusMessage]
  );

  const handleUpdateDeckGroup = useCallback(
    async (id: string, updates: { name?: string; deckIds?: [string, string] }) => {
      try {
        const updated = await apiUpdateDeckGroup(id, updates);
        setDeckGroups((prev) => prev.map((g) => (g.id === id ? updated : g)));
        return updated;
      } catch (error: unknown) {
        setStatusMessage(
          `デッキグループを更新できませんでした: ${getErrorMessage(error)}`
        );
        return null;
      }
    },
    [setStatusMessage]
  );

  const handleDeleteDeckGroup = useCallback(
    async (id: string) => {
      try {
        await apiDeleteDeckGroup(id);
        setDeckGroups((prev) => prev.filter((g) => g.id !== id));
        return true;
      } catch (error: unknown) {
        setStatusMessage(
          `デッキグループを削除できませんでした: ${getErrorMessage(error)}`
        );
        return false;
      }
    },
    [setStatusMessage]
  );

  return {
    deckGroups,
    handleCreateDeckGroup,
    handleUpdateDeckGroup,
    handleDeleteDeckGroup
  };
};
