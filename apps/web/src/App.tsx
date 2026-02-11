import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeckModal } from './components/DeckModal';
import { DeckEditModal } from './components/DeckEditModal';
import { DiffViewer } from './components/DiffViewer';
import { EditorPane } from './components/EditorPane';
import { FileTree } from './components/FileTree';
import { SettingsModal } from './components/SettingsModal';
import { SideNav } from './components/SideNav';
import { SourceControl } from './components/SourceControl';
import { StatusMessage } from './components/StatusMessage';
import { TerminalPane } from './components/TerminalPane';
import { AgentPane } from './components/AgentPane';
import { AgentModal } from './components/AgentModal';
import { WorkspaceList } from './components/WorkspaceList';
import { WorkspaceModal } from './components/WorkspaceModal';
import { WorkspaceEditModal } from './components/WorkspaceEditModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { getConfig, getWsBase } from './api';
import { useWorkspaceState } from './hooks/useWorkspaceState';
import { useDeckState } from './hooks/useDeckState';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useDecks } from './hooks/useDecks';
import { useFileOperations } from './hooks/useFileOperations';
import { useGitState } from './hooks/useGitState';
import { useAgents } from './hooks/useAgents';
import type { AppView, WorkspaceMode, SidebarPanel, AgentProvider, Workspace, Deck } from './types';
import {
  DEFAULT_ROOT_FALLBACK,
  MESSAGE_WORKSPACE_REQUIRED,
  MESSAGE_SELECT_WORKSPACE,
  MESSAGE_SELECT_DECK,
  STORAGE_KEY_THEME
} from './constants';
import { parseUrlState } from './utils/urlUtils';
import { getInitialTheme, type ThemeMode } from './utils/themeUtils';
import { createEmptyWorkspaceState, createEmptyDeckState } from './utils/stateUtils';

export default function App() {
  const initialUrlState = parseUrlState();
  const [view, setView] = useState<AppView>(initialUrlState.view);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    initialUrlState.workspaceMode
  );
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [defaultRoot, setDefaultRoot] = useState(DEFAULT_ROOT_FALLBACK);
  const [statusMessage, setStatusMessage] = useState('');
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [agentModalProvider, setAgentModalProvider] = useState<AgentProvider>('claude');
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('files');
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [deckContextMenu, setDeckContextMenu] = useState<{ deck: Deck; x: number; y: number } | null>(null);
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [deletingDeck, setDeletingDeck] = useState<Deck | null>(null);

  const { workspaceStates, setWorkspaceStates, updateWorkspaceState, initializeWorkspaceStates } =
    useWorkspaceState();
  const { deckStates, setDeckStates, updateDeckState, initializeDeckStates } =
    useDeckState();

  const { workspaces, editorWorkspaceId, setEditorWorkspaceId, handleCreateWorkspace, handleUpdateWorkspace, handleDeleteWorkspace } =
    useWorkspaces({
      setStatusMessage,
      defaultRoot,
      initializeWorkspaceStates,
      setWorkspaceStates
    });

  const { decks, activeDeckIds, setActiveDeckIds, handleCreateDeck, handleUpdateDeck, handleDeleteDeck, handleCreateTerminal, handleDeleteTerminal, removeDecksForWorkspace } =
    useDecks({
      setStatusMessage,
      initializeDeckStates,
      updateDeckState,
      deckStates,
      setDeckStates,
      initialDeckIds: initialUrlState.deckIds
    });

  const { sessions: agentSessions, handleCreateAgent, handleDeleteAgent } = useAgents({ setStatusMessage });

  const defaultWorkspaceState = useMemo(() => createEmptyWorkspaceState(), []);
  const defaultDeckState = useMemo(() => createEmptyDeckState(), []);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === editorWorkspaceId) || null;
  const activeWorkspaceState = editorWorkspaceId
    ? workspaceStates[editorWorkspaceId] || defaultWorkspaceState
    : defaultWorkspaceState;

  const {
    savingFileId,
    handleRefreshTree,
    handleToggleDir,
    handleOpenFile,
    handleFileChange,
    handleSaveFile,
    handleCloseFile,
    handleCreateFile,
    handleCreateDirectory,
    handleDeleteFile,
    handleDeleteDirectory
  } = useFileOperations({
    editorWorkspaceId,
    activeWorkspaceState,
    updateWorkspaceState,
    setStatusMessage
  });

  const {
    gitState,
    refreshGitStatus,
    handleSelectRepo,
    handleStageFile,
    handleUnstageFile,
    handleStageAll,
    handleUnstageAll,
    handleCommit,
    handleDiscardFile,
    handleShowDiff,
    handleCloseDiff,
    handlePush,
    handlePull,
    handleLoadBranches,
    handleCheckoutBranch,
    handleCreateBranch,
    handleLoadLogs
  } = useGitState(editorWorkspaceId, setStatusMessage);

  const wsBase = getWsBase();
  const workspaceById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace])),
    [workspaces]
  );
  useEffect(() => {
    let alive = true;
    getConfig()
      .then((config) => {
        if (!alive) return;
        if (config?.defaultRoot) {
          setDefaultRoot(config.defaultRoot);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY_THEME, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    const handlePopState = () => {
      const next = parseUrlState();
      setView(next.view);
      setEditorWorkspaceId(next.workspaceId ?? null);
      setActiveDeckIds(next.deckIds);
      setWorkspaceMode(next.workspaceMode);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setEditorWorkspaceId, setActiveDeckIds]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('view', view);
    if (view === 'workspace' && editorWorkspaceId) {
      params.set('workspace', editorWorkspaceId);
    }
    if (activeDeckIds.length > 0) {
      params.set('decks', activeDeckIds.join(','));
    }
    if (view === 'workspace' && workspaceMode === 'editor' && editorWorkspaceId) {
      params.set('mode', 'editor');
    }
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [view, editorWorkspaceId, activeDeckIds, workspaceMode]);

  const clearStatusMessage = useCallback(() => setStatusMessage(''), []);

  useEffect(() => {
    if (workspaceMode === 'editor' && !editorWorkspaceId) {
      setWorkspaceMode('list');
    }
  }, [workspaceMode, editorWorkspaceId]);

  // Track if we've loaded tree for current workspace
  const treeLoadedRef = useRef<string | null>(null);

  // Refresh file tree when opening workspace editor
  useEffect(() => {
    if (workspaceMode !== 'editor' || !editorWorkspaceId) {
      treeLoadedRef.current = null;
      return;
    }

    // Only load if we haven't loaded for this workspace yet
    if (treeLoadedRef.current !== editorWorkspaceId) {
      treeLoadedRef.current = editorWorkspaceId;
      handleRefreshTree();
      refreshGitStatus();
    }
  }, [workspaceMode, editorWorkspaceId, handleRefreshTree, refreshGitStatus]);

  const handleOpenDeckModal = useCallback(() => {
    if (workspaces.length === 0) {
      setStatusMessage(MESSAGE_WORKSPACE_REQUIRED);
      return;
    }
    setIsDeckModalOpen(true);
  }, [workspaces.length]);

  const handleSubmitDeck = useCallback(
    async (name: string, workspaceId: string) => {
      if (!workspaceId) {
        setStatusMessage(MESSAGE_SELECT_WORKSPACE);
        return;
      }
      const deck = await handleCreateDeck(name, workspaceId);
      if (deck) {
        setIsDeckModalOpen(false);
      }
    },
    [handleCreateDeck]
  );

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleSaveSettings = useCallback(async (settings: { port: number; basicAuthEnabled: boolean; basicAuthUser: string; basicAuthPassword: string }) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to save settings');
      }

      const result = await response.json();
      setStatusMessage('設定を保存しました。ブラウザをリロードしてください。');

      // Reload after 2 seconds to apply settings
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: unknown) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }, []);

  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      setEditorWorkspaceId(workspaceId);
      setWorkspaceMode('editor');
    },
    [setEditorWorkspaceId]
  );

  const handleCloseWorkspaceEditor = useCallback(() => {
    setWorkspaceMode('list');
  }, []);

  const handleOpenWorkspaceModal = useCallback(() => {
    setIsWorkspaceModalOpen(true);
  }, []);

  const handleSubmitWorkspace = useCallback(
    async (path: string) => {
      const created = await handleCreateWorkspace(path);
      if (created) {
        setIsWorkspaceModalOpen(false);
      }
    },
    [handleCreateWorkspace]
  );

  const handleOpenEditWorkspace = useCallback((workspace: Workspace) => {
    setEditingWorkspace(workspace);
  }, []);

  const handleSubmitEditWorkspace = useCallback(
    async (id: string, updates: { name?: string; path?: string }) => {
      const updated = await handleUpdateWorkspace(id, updates);
      if (updated) {
        setEditingWorkspace(null);
      }
    },
    [handleUpdateWorkspace]
  );

  const handleOpenDeleteWorkspace = useCallback((workspace: Workspace) => {
    setDeletingWorkspace(workspace);
  }, []);

  const handleConfirmDeleteWorkspace = useCallback(async () => {
    if (!deletingWorkspace) return;
    const success = await handleDeleteWorkspace(deletingWorkspace.id);
    if (success) {
      removeDecksForWorkspace(deletingWorkspace.id);
      setDeletingWorkspace(null);
    }
  }, [deletingWorkspace, handleDeleteWorkspace, removeDecksForWorkspace]);

  const handleDeckTabContextMenu = useCallback(
    (e: React.MouseEvent, deck: Deck) => {
      e.preventDefault();
      e.stopPropagation();
      setDeckContextMenu({ deck, x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleSubmitEditDeck = useCallback(
    async (id: string, updates: { name?: string; workspaceId?: string }) => {
      const updated = await handleUpdateDeck(id, updates);
      if (updated) {
        setEditingDeck(null);
      }
    },
    [handleUpdateDeck]
  );

  const handleConfirmDeleteDeck = useCallback(async () => {
    if (!deletingDeck) return;
    const success = await handleDeleteDeck(deletingDeck.id);
    if (success) {
      setDeletingDeck(null);
    }
  }, [deletingDeck, handleDeleteDeck]);

  // Close deck context menu on outside click
  const deckContextMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!deckContextMenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (deckContextMenuRef.current && !deckContextMenuRef.current.contains(e.target as Node)) {
        setDeckContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [deckContextMenu]);

  const handleNewTerminalForDeck = useCallback((deckId: string) => {
    const deckState = deckStates[deckId] || defaultDeckState;
    handleCreateTerminal(deckId, deckState.terminals.length);
  }, [deckStates, defaultDeckState, handleCreateTerminal]);

  const handleNewClaudeTerminalForDeck = useCallback((deckId: string) => {
    const deckState = deckStates[deckId] || defaultDeckState;
    handleCreateTerminal(deckId, deckState.terminals.length, 'claude', 'Claude Code');
  }, [deckStates, defaultDeckState, handleCreateTerminal]);

  const handleNewCodexTerminalForDeck = useCallback((deckId: string) => {
    const deckState = deckStates[deckId] || defaultDeckState;
    handleCreateTerminal(deckId, deckState.terminals.length, 'codex', 'Codex');
  }, [deckStates, defaultDeckState, handleCreateTerminal]);

  const handleTerminalDeleteForDeck = useCallback(
    (deckId: string, terminalId: string) => {
      handleDeleteTerminal(deckId, terminalId);
    },
    [handleDeleteTerminal]
  );

  const handleToggleDeck = useCallback((deckId: string, shiftKey = false) => {
    setActiveDeckIds((prev) => {
      if (prev.includes(deckId)) {
        // Remove deck (but keep at least one)
        if (prev.length > 1) {
          return prev.filter((id) => id !== deckId);
        }
        return prev;
      } else if (shiftKey) {
        // Shift+click: Add deck for split view (max 3)
        if (prev.length < 3) {
          return [...prev, deckId];
        }
        // Replace first one if at max
        return [...prev.slice(1), deckId];
      } else {
        // Normal click: Replace with single deck (no split)
        return [deckId];
      }
    });
  }, [setActiveDeckIds]);


  const isWorkspaceEditorOpen = workspaceMode === 'editor' && Boolean(editorWorkspaceId);

  const gitChangeCount = gitState.status?.files.length ?? 0;

  const workspaceEditor = isWorkspaceEditorOpen ? (
    <div className="workspace-editor-overlay">
      <div className="workspace-editor-header">
        <button
          type="button"
          className="ghost-button"
          onClick={handleCloseWorkspaceEditor}
        >
          {'\u4e00\u89a7\u306b\u623b\u308b'}
        </button>
        <div className="workspace-meta">
          {activeWorkspace ? (
            <span className="workspace-path">{activeWorkspace.path}</span>
          ) : null}
        </div>
      </div>
      <div className="workspace-editor-grid">
        <div className="activity-bar">
          <button
            type="button"
            className={`activity-bar-item ${sidebarPanel === 'files' ? 'active' : ''}`}
            onClick={() => setSidebarPanel('files')}
            title="エクスプローラー"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className={`activity-bar-item ${sidebarPanel === 'git' ? 'active' : ''}`}
            onClick={() => {
              setSidebarPanel('git');
              refreshGitStatus();
            }}
            title="ソースコントロール"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3v12M18 9a3 3 0 110 6 3 3 0 010-6zM6 21a3 3 0 110-6 3 3 0 010 6z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M18 12c0 3-3 4-6 4s-6-1-6-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {gitChangeCount > 0 && (
              <span className="activity-bar-badge">{gitChangeCount}</span>
            )}
          </button>
        </div>
        <div className="sidebar-panel">
          <div className="sidebar-content">
            {sidebarPanel === 'files' ? (
              <FileTree
                root={activeWorkspace?.path || defaultRoot || ''}
                entries={activeWorkspaceState.tree}
                loading={activeWorkspaceState.treeLoading}
                error={activeWorkspaceState.treeError}
                onToggleDir={handleToggleDir}
                onOpenFile={handleOpenFile}
                onRefresh={handleRefreshTree}
                onCreateFile={handleCreateFile}
                onCreateDirectory={handleCreateDirectory}
                onDeleteFile={handleDeleteFile}
                onDeleteDirectory={handleDeleteDirectory}
                gitFiles={gitState.status?.files}
              />
            ) : (
              <SourceControl
                status={gitState.status}
                loading={gitState.loading}
                error={gitState.error}
                workspaceId={editorWorkspaceId}
                branchStatus={gitState.branchStatus}
                hasRemote={gitState.hasRemote}
                pushing={gitState.pushing}
                pulling={gitState.pulling}
                branches={gitState.branches}
                branchesLoading={gitState.branchesLoading}
                logs={gitState.logs}
                logsLoading={gitState.logsLoading}
                repos={gitState.repos}
                selectedRepoPath={gitState.selectedRepoPath}
                onSelectRepo={handleSelectRepo}
                onRefresh={refreshGitStatus}
                onStageFile={handleStageFile}
                onUnstageFile={handleUnstageFile}
                onStageAll={handleStageAll}
                onUnstageAll={handleUnstageAll}
                onCommit={handleCommit}
                onDiscardFile={handleDiscardFile}
                onShowDiff={handleShowDiff}
                onPush={handlePush}
                onPull={handlePull}
                onLoadBranches={handleLoadBranches}
                onCheckoutBranch={handleCheckoutBranch}
                onCreateBranch={handleCreateBranch}
                onLoadLogs={handleLoadLogs}
              />
            )}
          </div>
        </div>
        <EditorPane
          files={activeWorkspaceState.files}
          activeFileId={activeWorkspaceState.activeFileId}
          onSelectFile={(fileId) => {
            if (!editorWorkspaceId) return;
            updateWorkspaceState(editorWorkspaceId, (state) => ({
              ...state,
              activeFileId: fileId
            }));
          }}
          onCloseFile={handleCloseFile}
          onChangeFile={handleFileChange}
          onSaveFile={handleSaveFile}
          savingFileId={savingFileId}
          theme={theme}
        />
      </div>
      {gitState.diffPath && (
        <DiffViewer
          diff={gitState.diff}
          loading={gitState.diffLoading}
          theme={theme}
          onClose={handleCloseDiff}
        />
      )}
    </div>
  ) : null;

  const workspaceView = (
    <div className="workspace-view">
      <div className="workspace-start">
        <button
          type="button"
          className="primary-button"
          onClick={handleOpenWorkspaceModal}
        >
          {'\u30ef\u30fc\u30af\u30b9\u30da\u30fc\u30b9\u8ffd\u52a0'}
        </button>
        <WorkspaceList
          workspaces={workspaces}
          selectedWorkspaceId={editorWorkspaceId}
          onSelect={handleSelectWorkspace}
          onEdit={handleOpenEditWorkspace}
          onDelete={handleOpenDeleteWorkspace}
        />
      </div>
      {workspaceEditor}
    </div>
  );

  const terminalView = (
    <div className="terminal-layout">
      <div className="terminal-topbar">
        <div className="topbar-left">
          <div className="deck-tabs">
            {decks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                className={`deck-tab ${activeDeckIds.includes(deck.id) ? 'active' : ''}`}
                onClick={(e) => handleToggleDeck(deck.id, e.shiftKey)}
                onContextMenu={(e) => handleDeckTabContextMenu(e, deck)}
                title={`${workspaceById.get(deck.workspaceId)?.path || deck.root}\nShift+クリックで分割表示\n右クリックで編集・削除`}
              >
                {deck.name}
              </button>
            ))}
            <button
              type="button"
              className="deck-tab deck-tab-add"
              onClick={handleOpenDeckModal}
              title="デッキ作成"
            >
              +
            </button>
          </div>
        </div>
      </div>
      <div className="terminal-split-container" style={{ gridTemplateColumns: `repeat(${activeDeckIds.length}, 1fr)` }}>
        {activeDeckIds.length === 0 ? (
          <div className="panel empty-panel">
            {'デッキを作成してください。'}
          </div>
        ) : (
          activeDeckIds.map((deckId) => {
            const deck = decks.find((d) => d.id === deckId);
            const deckState = deckStates[deckId] || defaultDeckState;
            if (!deck) return null;
            return (
              <div key={deckId} className="deck-split-pane">
                <div className="deck-split-header">
                  <span className="deck-split-title">{deck.name}</span>
                  <div className="deck-split-actions">
                    <button
                      type="button"
                      className="topbar-btn-sm"
                      onClick={() => handleNewTerminalForDeck(deckId)}
                      title="ターミナル追加"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="topbar-btn-sm topbar-btn-claude"
                      onClick={() => handleNewClaudeTerminalForDeck(deckId)}
                      title="Claude"
                    >
                      C
                    </button>
                    <button
                      type="button"
                      className="topbar-btn-sm topbar-btn-codex"
                      onClick={() => handleNewCodexTerminalForDeck(deckId)}
                      title="Codex"
                    >
                      X
                    </button>
                  </div>
                </div>
                <TerminalPane
                  terminals={deckState.terminals}
                  wsBase={wsBase}
                  onDeleteTerminal={(terminalId) => handleTerminalDeleteForDeck(deckId, terminalId)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const agentView = (
    <div className="terminal-layout">
      <div className="terminal-topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="topbar-btn-sm topbar-btn-claude"
            onClick={() => {
              if (workspaces.length === 0) { setStatusMessage(MESSAGE_WORKSPACE_REQUIRED); return; }
              setAgentModalProvider('claude'); setIsAgentModalOpen(true);
            }}
          >
            + Claude
          </button>
          <button
            type="button"
            className="topbar-btn-sm topbar-btn-codex"
            onClick={() => {
              if (workspaces.length === 0) { setStatusMessage(MESSAGE_WORKSPACE_REQUIRED); return; }
              setAgentModalProvider('codex'); setIsAgentModalOpen(true);
            }}
          >
            + Codex
          </button>
        </div>
      </div>
      <AgentPane sessions={agentSessions} onDeleteAgent={handleDeleteAgent} />
    </div>
  );

  return (
    <div className="app" data-view={view}>
      <SideNav
        activeView={view}
        onSelect={setView}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />
      <main className="main">
        {view === 'workspace' && workspaceView}
        {view === 'terminal' && terminalView}
        {view === 'agent' && agentView}
      </main>
      <StatusMessage message={statusMessage} onDismiss={clearStatusMessage} />
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        defaultRoot={defaultRoot}
        onSubmit={handleSubmitWorkspace}
        onClose={() => setIsWorkspaceModalOpen(false)}
      />
      <DeckModal
        isOpen={isDeckModalOpen}
        workspaces={workspaces}
        onSubmit={handleSubmitDeck}
        onClose={() => setIsDeckModalOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={handleSaveSettings}
      />
      <AgentModal
        isOpen={isAgentModalOpen}
        provider={agentModalProvider}
        workspaces={workspaces}
        onSubmit={(prompt, cwd, maxCostUsd) => {
          handleCreateAgent({ provider: agentModalProvider, prompt, cwd, maxCostUsd });
          setIsAgentModalOpen(false);
        }}
        onClose={() => setIsAgentModalOpen(false)}
      />
      <WorkspaceEditModal
        isOpen={editingWorkspace !== null}
        workspace={editingWorkspace}
        onSubmit={handleSubmitEditWorkspace}
        onClose={() => setEditingWorkspace(null)}
      />
      <ConfirmDialog
        isOpen={deletingWorkspace !== null}
        title="ワークスペース削除"
        message={`「${deletingWorkspace?.name ?? ''}」を削除しますか？関連するデッキとターミナルも削除されます。`}
        confirmLabel="削除"
        onConfirm={handleConfirmDeleteWorkspace}
        onCancel={() => setDeletingWorkspace(null)}
      />
      <DeckEditModal
        isOpen={editingDeck !== null}
        deck={editingDeck}
        workspaces={workspaces}
        onSubmit={handleSubmitEditDeck}
        onClose={() => setEditingDeck(null)}
      />
      <ConfirmDialog
        isOpen={deletingDeck !== null}
        title="デッキ削除"
        message={`「${deletingDeck?.name ?? ''}」を削除しますか？関連するターミナルも削除されます。`}
        confirmLabel="削除"
        onConfirm={handleConfirmDeleteDeck}
        onCancel={() => setDeletingDeck(null)}
      />
      {deckContextMenu && (
        <div
          ref={deckContextMenuRef}
          className="context-menu"
          style={{ top: deckContextMenu.y, left: deckContextMenu.x }}
        >
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              setEditingDeck(deckContextMenu.deck);
              setDeckContextMenu(null);
            }}
          >
            編集
          </button>
          <button
            type="button"
            className="context-menu-item delete"
            onClick={() => {
              setDeletingDeck(deckContextMenu.deck);
              setDeckContextMenu(null);
            }}
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}
