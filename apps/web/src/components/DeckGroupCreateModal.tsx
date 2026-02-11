import { useEffect, useState, type FormEvent } from 'react';
import type { Deck } from '../types';

interface DeckGroupCreateModalProps {
  isOpen: boolean;
  initialDeck: Deck | null;
  decks: Deck[];
  onSubmit: (name: string, deckIds: [string, string]) => Promise<void>;
  onClose: () => void;
}

export const DeckGroupCreateModal = ({
  isOpen,
  initialDeck,
  decks,
  onSubmit,
  onClose
}: DeckGroupCreateModalProps) => {
  const [secondDeckId, setSecondDeckId] = useState('');
  const [nameDraft, setNameDraft] = useState('');

  const otherDecks = decks.filter((d) => d.id !== initialDeck?.id);

  useEffect(() => {
    if (isOpen) {
      setSecondDeckId(otherDecks[0]?.id || '');
      setNameDraft('');
    }
  }, [isOpen, initialDeck?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!initialDeck || !secondDeckId) return;
    await onSubmit(nameDraft.trim(), [initialDeck.id, secondDeckId]);
  };

  if (!isOpen || !initialDeck) return null;

  // Auto-generate default name preview
  const secondDeck = decks.find((d) => d.id === secondDeckId);
  const defaultName = secondDeck
    ? `${initialDeck.name} | ${secondDeck.name}`
    : '';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">グループ作成</div>
        <label className="field">
          <span>デッキ1</span>
          <input type="text" value={initialDeck.name} disabled />
        </label>
        <label className="field">
          <span>デッキ2</span>
          <select
            value={secondDeckId}
            onChange={(e) => setSecondDeckId(e.target.value)}
          >
            {otherDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>グループ名 (任意)</span>
          <input
            type="text"
            value={nameDraft}
            placeholder={defaultName}
            onChange={(e) => setNameDraft(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            キャンセル
          </button>
          <button
            type="submit"
            className="primary-button"
            disabled={!secondDeckId || otherDecks.length === 0}
          >
            作成
          </button>
        </div>
      </form>
    </div>
  );
};
