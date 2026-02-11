import { useEffect, useRef, useState } from 'react';
import type { Workspace } from '../types';

interface WorkspaceListProps {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
  onEdit: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
}

const LABEL_WORKSPACE = 'ワークスペース';
const LABEL_EMPTY = 'ワークスペースがありません。';

function WorkspaceItemMenu({
  workspace,
  onEdit,
  onDelete
}: {
  workspace: Workspace;
  onEdit: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 2, left: rect.right });
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="workspace-menu-container" ref={containerRef}>
      <button
        ref={btnRef}
        type="button"
        className="workspace-menu-btn"
        style={isOpen ? { opacity: 1 } : undefined}
        onClick={handleToggle}
        title="メニュー"
      >
        ⋮
      </button>
      {isOpen && (
        <div
          className="workspace-context-menu"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button
            type="button"
            className="context-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onEdit(workspace);
            }}
          >
            編集
          </button>
          <button
            type="button"
            className="context-menu-item delete"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onDelete(workspace);
            }}
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}

export function WorkspaceList({
  workspaces,
  selectedWorkspaceId,
  onSelect,
  onEdit,
  onDelete
}: WorkspaceListProps) {
  return (
    <section className="panel workspace-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">{LABEL_WORKSPACE}</div>
        </div>
      </div>
      <div className="panel-body">
        {workspaces.length === 0 ? (
          <div className="empty-state">{LABEL_EMPTY}</div>
        ) : (
          workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className={`workspace-item ${
                workspace.id === selectedWorkspaceId ? 'is-active' : ''
              }`}
            >
              <button
                type="button"
                className="workspace-main"
                onClick={() => onSelect(workspace.id)}
              >
                <div className="workspace-name">{workspace.name}</div>
                <div className="workspace-path">{workspace.path}</div>
              </button>
              <WorkspaceItemMenu
                workspace={workspace}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))
        )}
      </div>
    </section>
  );
}
