import { useEffect, useState, type FormEvent } from 'react';
import type { Workspace } from '../types';
import type { RemoteNodeWithStatus } from '@deck-ide/shared/types';

interface DeckModalProps {
  isOpen: boolean;
  workspaces: Workspace[];
  nodes?: RemoteNodeWithStatus[];
  onNodeChange?: (nodeId: string) => void;
  remoteWorkspaces?: Workspace[];
  onSubmit: (name: string, workspaceId: string) => Promise<void>;
  onClose: () => void;
}

export const DeckModal = ({
  isOpen,
  workspaces,
  nodes,
  onNodeChange,
  remoteWorkspaces,
  onSubmit,
  onClose
}: DeckModalProps) => {
  const [deckWorkspaceId, setDeckWorkspaceId] = useState(workspaces[0]?.id || '');
  const [deckNameDraft, setDeckNameDraft] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  const displayWorkspaces = selectedNodeId && remoteWorkspaces ? remoteWorkspaces : workspaces;

  useEffect(() => {
    if (isOpen) {
      setSelectedNodeId('');
      const ws = workspaces[0]?.id || '';
      setDeckWorkspaceId(ws);
    }
  }, [isOpen, workspaces]);

  useEffect(() => {
    if (isOpen && displayWorkspaces.length > 0) {
      setDeckWorkspaceId(displayWorkspaces[0].id);
    }
  }, [isOpen, displayWorkspaces]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(deckNameDraft.trim(), deckWorkspaceId);
    setDeckNameDraft('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">{'\u30c7\u30c3\u30ad\u4f5c\u6210'}</div>
        <label className="field">
          <span>{'\u30c7\u30c3\u30ad\u540d (\u4efb\u610f)'}</span>
          <input
            type="text"
            value={deckNameDraft}
            placeholder={'\u7a7a\u767d\u306e\u307e\u307e\u3067\u3082OK'}
            onChange={(event) => setDeckNameDraft(event.target.value)}
          />
        </label>
        {nodes && nodes.length > 0 && (
          <label className="field">
            <span>{'\u30ce\u30fc\u30c9'}</span>
            <select
              value={selectedNodeId}
              onChange={(event) => {
                setSelectedNodeId(event.target.value);
                onNodeChange?.(event.target.value);
              }}
            >
              <option value="">ローカル</option>
              {nodes.filter(n => !n.isLocal && n.status === 'online').map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name} ({node.host}:{node.port})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>{'\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9'}</span>
          <select
            value={deckWorkspaceId}
            onChange={(event) => setDeckWorkspaceId(event.target.value)}
          >
            {displayWorkspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.path}
              </option>
            ))}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            {'\u30ad\u30e3\u30f3\u30bb\u30eb'}
          </button>
          <button type="submit" className="primary-button">
            {'\u4f5c\u6210'}
          </button>
        </div>
      </form>
    </div>
  );
};
