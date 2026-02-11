import { useEffect, useState, type FormEvent } from 'react';
import type { Deck, Workspace } from '../types';

interface DeckEditModalProps {
  isOpen: boolean;
  deck: Deck | null;
  workspaces: Workspace[];
  onSubmit: (id: string, updates: { name?: string; workspaceId?: string }) => Promise<void>;
  onClose: () => void;
}

export const DeckEditModal = ({
  isOpen,
  deck,
  workspaces,
  onSubmit,
  onClose
}: DeckEditModalProps) => {
  const [nameDraft, setNameDraft] = useState('');
  const [workspaceIdDraft, setWorkspaceIdDraft] = useState('');

  useEffect(() => {
    if (isOpen && deck) {
      setNameDraft(deck.name);
      setWorkspaceIdDraft(deck.workspaceId);
    }
  }, [isOpen, deck]);

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
    if (!deck) return;

    const nameChanged = nameDraft.trim() !== deck.name;
    const workspaceChanged = workspaceIdDraft !== deck.workspaceId;

    if (!nameChanged && !workspaceChanged) {
      onClose();
      return;
    }

    const updates: { name?: string; workspaceId?: string } = {};
    if (nameChanged) updates.name = nameDraft.trim();
    if (workspaceChanged) updates.workspaceId = workspaceIdDraft;

    await onSubmit(deck.id, updates);
  };

  if (!isOpen || !deck) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">デッキ編集</div>
        <label className="field">
          <span>名前</span>
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
        </label>
        <label className="field">
          <span>ワークスペース</span>
          <select
            value={workspaceIdDraft}
            onChange={(e) => setWorkspaceIdDraft(e.target.value)}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.path}
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
