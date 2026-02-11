import { useEffect, useState, type FormEvent } from 'react';
import type { Deck, DeckGroup } from '../types';

interface DeckGroupEditModalProps {
  isOpen: boolean;
  group: DeckGroup | null;
  decks: Deck[];
  onSubmit: (id: string, updates: { name?: string; deckIds?: [string, string] }) => Promise<void>;
  onClose: () => void;
}

export const DeckGroupEditModal = ({
  isOpen,
  group,
  decks,
  onSubmit,
  onClose
}: DeckGroupEditModalProps) => {
  const [nameDraft, setNameDraft] = useState('');
  const [deck1Id, setDeck1Id] = useState('');
  const [deck2Id, setDeck2Id] = useState('');

  useEffect(() => {
    if (isOpen && group) {
      setNameDraft(group.name);
      setDeck1Id(group.deckIds[0]);
      setDeck2Id(group.deckIds[1]);
    }
  }, [isOpen, group]);

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
    if (!group) return;

    const nameChanged = nameDraft.trim() !== group.name;
    const decksChanged = deck1Id !== group.deckIds[0] || deck2Id !== group.deckIds[1];

    if (!nameChanged && !decksChanged) {
      onClose();
      return;
    }

    const updates: { name?: string; deckIds?: [string, string] } = {};
    if (nameChanged) updates.name = nameDraft.trim();
    if (decksChanged) updates.deckIds = [deck1Id, deck2Id];

    await onSubmit(group.id, updates);
  };

  if (!isOpen || !group) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">グループ編集</div>
        <label className="field">
          <span>グループ名</span>
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
        </label>
        <label className="field">
          <span>デッキ1 (左)</span>
          <select value={deck1Id} onChange={(e) => setDeck1Id(e.target.value)}>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>デッキ2 (右)</span>
          <select value={deck2Id} onChange={(e) => setDeck2Id(e.target.value)}>
            {decks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary-button">
            保存
          </button>
        </div>
      </form>
    </div>
  );
};
