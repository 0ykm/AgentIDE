import { useState } from 'react';
import type { RemoteNodeWithStatus, RegisterNodeRequest } from '@deck-ide/shared/types';
import { NodeAddModal } from './NodeAddModal';
import type { NodeInfo } from '@deck-ide/shared/types';

interface NodeManagementProps {
  nodes: RemoteNodeWithStatus[];
  onAddNode: (req: RegisterNodeRequest) => Promise<void>;
  onRemoveNode: (nodeId: string) => Promise<void>;
  onUpdateNode: (nodeId: string, updates: Partial<RegisterNodeRequest>) => Promise<void>;
  onTestConnection: (host: string, port: number) => Promise<NodeInfo | null>;
  onRefreshStatuses: () => Promise<void>;
}

const STATUS_LABELS: Record<string, string> = {
  online: 'オンライン',
  offline: 'オフライン',
  connecting: '接続中',
  error: 'エラー'
};

export function NodeManagement({
  nodes,
  onAddNode,
  onRemoveNode,
  onUpdateNode,
  onTestConnection,
  onRefreshStatuses
}: NodeManagementProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<RemoteNodeWithStatus | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const localNode = nodes.find(n => n.isLocal);
  const remoteNodes = nodes.filter(n => !n.isLocal);

  const handleRemove = async (nodeId: string) => {
    setRemovingId(nodeId);
    try {
      await onRemoveNode(nodeId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="node-management">
      <div className="node-management-header">
        <h2>ノード管理</h2>
        <div className="node-management-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={onRefreshStatuses}
          >
            更新
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsAddModalOpen(true)}
          >
            ノード追加
          </button>
        </div>
      </div>

      <div className="node-list">
        {localNode && (
          <div className="node-card node-card-local">
            <div className="node-card-header">
              <span className="node-name">{localNode.name}</span>
              <span className="node-status node-status-online">
                {STATUS_LABELS.online}
              </span>
            </div>
            <div className="node-card-body">
              <span className="node-detail">ローカルノード</span>
              {localNode.version && (
                <span className="node-detail">v{localNode.version}</span>
              )}
            </div>
          </div>
        )}

        {remoteNodes.length === 0 ? (
          <div className="node-empty">
            <p>リモートノードが登録されていません。</p>
            <p>「ノード追加」からIPアドレスとポートを指定して接続できます。</p>
          </div>
        ) : (
          remoteNodes.map((node) => (
            <div key={node.id} className={`node-card node-card-${node.status}`}>
              <div className="node-card-header">
                <span className="node-name">{node.name}</span>
                <span className={`node-status node-status-${node.status}`}>
                  {STATUS_LABELS[node.status] || node.status}
                </span>
              </div>
              <div className="node-card-body">
                <span className="node-detail">{node.host}:{node.port}</span>
                {node.version && (
                  <span className="node-detail">v{node.version}</span>
                )}
                {node.lastSeen && (
                  <span className="node-detail">
                    最終確認: {new Date(node.lastSeen).toLocaleTimeString()}
                  </span>
                )}
                {node.error && (
                  <span className="node-detail node-error">{node.error}</span>
                )}
              </div>
              <div className="node-card-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setEditingNode(node)}
                >
                  設定
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button-danger"
                  onClick={() => handleRemove(node.id)}
                  disabled={removingId === node.id}
                >
                  {removingId === node.id ? '削除中...' : '削除'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add mode */}
      <NodeAddModal
        isOpen={isAddModalOpen}
        onSubmit={async (req) => {
          await onAddNode(req);
          setIsAddModalOpen(false);
        }}
        onTestConnection={onTestConnection}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Edit mode */}
      <NodeAddModal
        isOpen={editingNode !== null}
        editNode={editingNode}
        onSubmit={async (req) => {
          if (!editingNode) return;
          await onUpdateNode(editingNode.id, req);
          setEditingNode(null);
        }}
        onTestConnection={onTestConnection}
        onClose={() => setEditingNode(null)}
      />
    </div>
  );
}
