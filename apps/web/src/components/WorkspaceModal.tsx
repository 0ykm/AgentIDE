import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FileTree } from './FileTree';
import type { FileTreeNode } from '../types';
import type { RemoteNodeWithStatus } from '@deck-ide/shared/types';
import type { NodeApiClient } from '../remote-nodes/NodeApiClient';
import { previewFiles } from '../api';
import { getErrorMessage, getParentPath, joinPath, toTreeNodes } from '../utils';

interface WorkspaceModalProps {
  isOpen: boolean;
  defaultRoot: string;
  nodes?: RemoteNodeWithStatus[];
  getNodeClient?: (nodeId: string) => NodeApiClient | null;
  onSubmit: (path: string, nodeId?: string) => Promise<void>;
  onClose: () => void;
}

export const WorkspaceModal = ({
  isOpen,
  defaultRoot,
  nodes,
  getNodeClient,
  onSubmit,
  onClose
}: WorkspaceModalProps) => {
  const [workspacePathDraft, setWorkspacePathDraft] = useState('');
  const [previewTree, setPreviewTree] = useState<FileTreeNode[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');

  const previewRoot = workspacePathDraft.trim() || defaultRoot;
  const canPreviewBack = useMemo(() => {
    if (!previewRoot) return false;
    return getParentPath(previewRoot) !== previewRoot;
  }, [previewRoot]);

  const isRemoteNode = selectedNodeId !== '';

  const loadPreview = (root: string) => {
    setPreviewLoading(true);
    setPreviewError(null);

    const fetchPromise = isRemoteNode && getNodeClient
      ? (() => {
          const client = getNodeClient(selectedNodeId);
          return client ? client.previewFiles(root) : Promise.reject(new Error('Node client not available'));
        })()
      : previewFiles(root, '');

    return fetchPromise;
  };

  useEffect(() => {
    if (!isOpen) {
      setPreviewTree([]);
      setPreviewLoading(false);
      setPreviewError(null);
      setSelectedNodeId('');
      return;
    }
    let alive = true;
    loadPreview(previewRoot)
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
  }, [isOpen, previewRoot, selectedNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return;
    if (workspacePathDraft.trim()) return;
    if (defaultRoot) {
      setWorkspacePathDraft(defaultRoot);
    }
  }, [defaultRoot, isOpen, workspacePathDraft]);

  // Reset path when switching nodes
  useEffect(() => {
    if (!isOpen) return;
    setWorkspacePathDraft('');
    setPreviewTree([]);
  }, [selectedNodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreviewRefresh = () => {
    if (!isOpen) return;
    loadPreview(previewRoot)
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
    setWorkspacePathDraft(nextPath);
  };

  const handlePreviewBack = () => {
    if (!previewRoot) return;
    const parent = getParentPath(previewRoot);
    if (parent && parent !== previewRoot) {
      setWorkspacePathDraft(parent);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(workspacePathDraft, selectedNodeId || undefined);
    setWorkspacePathDraft('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="modal-title">
          {'\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u8ffd\u52a0'}
        </div>
        {nodes && nodes.length > 0 && (
          <label className="field">
            <span>{'\u30ce\u30fc\u30c9'}</span>
            <select
              value={selectedNodeId}
              onChange={(event) => setSelectedNodeId(event.target.value)}
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
          <span>{'\u30d1\u30b9'}</span>
          <input
            type="text"
            value={workspacePathDraft}
            placeholder={isRemoteNode ? '/path/to/workspace' : (defaultRoot || '')}
            onChange={(event) => setWorkspacePathDraft(event.target.value)}
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
            {'\u30ad\u30e3\u30f3\u30bb\u30eb'}
          </button>
          <button type="submit" className="primary-button">
            {'\u8ffd\u52a0'}
          </button>
        </div>
      </form>
    </div>
  );
};
