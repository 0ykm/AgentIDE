import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FileTree } from './FileTree';
import type { FileTreeNode, Workspace } from '../types';
import { previewFiles } from '../api';
import { getErrorMessage, getParentPath, joinPath, toTreeNodes } from '../utils';

interface WorkspaceEditModalProps {
  isOpen: boolean;
  workspace: Workspace | null;
  onSubmit: (id: string, updates: { name?: string; path?: string }) => Promise<void>;
  onClose: () => void;
}

export const WorkspaceEditModal = ({
  isOpen,
  workspace,
  onSubmit,
  onClose
}: WorkspaceEditModalProps) => {
  const [nameDraft, setNameDraft] = useState('');
  const [pathDraft, setPathDraft] = useState('');
  const [previewTree, setPreviewTree] = useState<FileTreeNode[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewRoot = pathDraft.trim() || '';
  const canPreviewBack = useMemo(() => {
    if (!previewRoot) return false;
    return getParentPath(previewRoot) !== previewRoot;
  }, [previewRoot]);

  // Reset form when workspace changes or modal opens
  useEffect(() => {
    if (isOpen && workspace) {
      setNameDraft(workspace.name);
      setPathDraft(workspace.path);
    }
    if (!isOpen) {
      setPreviewTree([]);
      setPreviewLoading(false);
      setPreviewError(null);
    }
  }, [isOpen, workspace]);

  // Load preview tree
  useEffect(() => {
    if (!isOpen || !previewRoot) return;
    let alive = true;
    setPreviewLoading(true);
    setPreviewError(null);
    previewFiles(previewRoot, '')
      .then((entries) => {
        if (!alive) return;
        setPreviewTree(toTreeNodes(entries));
        setPreviewLoading(false);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setPreviewError(getErrorMessage(error));
        setPreviewLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [isOpen, previewRoot]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handlePreviewRefresh = () => {
    if (!isOpen || !previewRoot) return;
    setPreviewLoading(true);
    setPreviewError(null);
    previewFiles(previewRoot, '')
      .then((entries) => {
        setPreviewTree(toTreeNodes(entries));
        setPreviewLoading(false);
      })
      .catch((error: unknown) => {
        setPreviewError(getErrorMessage(error));
        setPreviewLoading(false);
      });
  };

  const handlePreviewToggleDir = (node: FileTreeNode) => {
    if (node.type !== 'dir') return;
    const nextPath = joinPath(previewRoot, node.name);
    setPathDraft(nextPath);
  };

  const handlePreviewBack = () => {
    if (!previewRoot) return;
    const parent = getParentPath(previewRoot);
    if (parent && parent !== previewRoot) {
      setPathDraft(parent);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspace) return;

    const nameChanged = nameDraft.trim() !== workspace.name;
    const pathChanged = pathDraft.trim() !== workspace.path;

    if (!nameChanged && !pathChanged) {
      onClose();
      return;
    }

    const updates: { name?: string; path?: string } = {};
    if (nameChanged) updates.name = nameDraft.trim();
    if (pathChanged) updates.path = pathDraft.trim();

    await onSubmit(workspace.id, updates);
  };

  if (!isOpen || !workspace) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">ワークスペース編集</div>
        <label className="field">
          <span>名前</span>
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
          />
        </label>
        <label className="field">
          <span>パス</span>
          <input
            type="text"
            value={pathDraft}
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
            onChange={(e) => setPathDraft(e.target.value)}
          />
        </label>
        <div className="modal-explorer">
          <FileTree
            root={previewRoot}
            entries={previewTree}
            loading={previewLoading}
            error={previewError}
            mode="navigator"
            canBack={canPreviewBack}
            onBack={handlePreviewBack}
            onToggleDir={handlePreviewToggleDir}
            onOpenFile={() => undefined}
            onRefresh={handlePreviewRefresh}
          />
        </div>
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
