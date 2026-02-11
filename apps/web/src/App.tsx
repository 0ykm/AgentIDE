import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeckModal } from './components/DeckModal';
import { DeckEditModal } from './components/DeckEditModal';
import { DeckGroupCreateModal } from './components/DeckGroupCreateModal';
import { DeckGroupEditModal } from './components/DeckGroupEditModal';
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
import { NodeManagement } from './components/NodeManagement';
import { getConfig, getWsBase } from './api';
import { useWorkspaceState } from './hooks/useWorkspaceState';
import { useDeckState } from './hooks/useDeckState';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useDecks } from './hooks/useDecks';
import { useDeckGroups } from './hooks/useDeckGroups';
import { useFileOperations } from './hooks/useFileOperations';
import { useGitState } from './hooks/useGitState';
import { useAgents } from './hooks/useAgents';
import { useNodes, useRemoteDecks, useRemoteWorkspaces, useRemoteFileOperations, useRemoteGitState, useActiveDeckContext } from './remote-nodes';
import type { NodeDeck, NodeWorkspace } from './remote-nodes';
import type { AppView, WorkspaceMode, SidebarPanel, AgentProvider, Workspace, Deck, DeckGroup, TerminalLayout } from './types';
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
  const [remoteDeckContextMenu, setRemoteDeckContextMenu] = useState<{ deck: NodeDeck; x: number; y: number } | null>(null);
  const [editingRemoteDeck, setEditingRemoteDeck] = useState<NodeDeck | null>(null);
  const [deletingRemoteDeck, setDeletingRemoteDeck] = useState<NodeDeck | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(initialUrlState.groupId ?? null);
  const [groupCreateInitialDeck, setGroupCreateInitialDeck] = useState<Deck | null>(null);
  const [editingDeckGroup, setEditingDeckGroup] = useState<DeckGroup | null>(null);
  const [deletingDeckGroup, setDeletingDeckGroup] = useState<DeckGroup | null>(null);
  const [groupContextMenu, setGroupContextMenu] = useState<{ group: DeckGroup; x: number; y: number } | null>(null);
  const [deckModalNodeId, setDeckModalNodeId] = useState<string>('');

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

  // Remote nodes (must be before useDecks so remoteDeckIds are available for validation)
  const { nodes, localNode, onlineRemoteNodes, getNodeClient, addNode, removeNode, updateNode, testConnection, refreshAllStatuses } = useNodes();
  const { remoteDecks, refreshRemoteDecks, createRemoteDeck, updateRemoteDeck, deleteRemoteDeck } = useRemoteDecks(onlineRemoteNodes, getNodeClient);
  const { remoteWorkspaces, refreshRemoteWorkspaces, createRemoteWorkspace, deleteRemoteWorkspace, updateRemoteWorkspace } =
    useRemoteWorkspaces(onlineRemoteNodes, getNodeClient);

  // Refresh remote decks & workspaces when online nodes change
  useEffect(() => {
    if (onlineRemoteNodes.length > 0) {
      refreshRemoteDecks();
      refreshRemoteWorkspaces();
    }
  }, [onlineRemoteNodes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const remoteDeckIds = useMemo(() => remoteDecks.map(d => d.id), [remoteDecks]);

  const { decks, activeDeckIds, setActiveDeckIds, handleCreateDeck, handleUpdateDeck, handleDeleteDeck, handleCreateTerminal, handleDeleteTerminal, removeDecksForWorkspace } =
    useDecks({
      setStatusMessage,
      initializeDeckStates,
      updateDeckState,
      deckStates,
      setDeckStates,
      initialDeckIds: initialUrlState.deckIds,
      remoteDeckIds
    });

  const { deckGroups, handleCreateDeckGroup, handleUpdateDeckGroup, handleDeleteDeckGroup } =
    useDeckGroups({ setStatusMessage, decks });

  const { sessions: agentSessions, handleCreateAgent, handleDeleteAgent } = useAgents({ setStatusMessage });

  const wsBase = getWsBase();

  // Active deck context: determines if active deck is local or remote
  const activeDeckCtx = useActiveDeckContext({
    activeDeckIds,
    localDecks: decks,
    remoteDecks,
    localNodeId: localNode.id,
    getNodeClient,
    localWsBase: wsBase
  });

  // Sync editorWorkspaceId when active deck changes
  useEffect(() => {
    const wsId = activeDeckCtx.workspaceId;
    if (wsId && wsId !== editorWorkspaceId) {
      setEditorWorkspaceId(wsId);
      setWorkspaceMode('editor');
      setWorkspaceStates((prev) => {
        if (prev[wsId]) return prev;
        return { ...prev, [wsId]: createEmptyWorkspaceState() };
      });
    }
  }, [activeDeckCtx.workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const defaultWorkspaceState = useMemo(() => createEmptyWorkspaceState(), []);
  const defaultDeckState = useMemo(() => createEmptyDeckState(), []);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === editorWorkspaceId) ||
    remoteWorkspaces.find((ws) => ws.id === editorWorkspaceId) ||
    null;

  const activeRemoteWorkspace = activeWorkspace && 'nodeId' in activeWorkspace
    ? (activeWorkspace as NodeWorkspace)
    : null;
  const isRemoteWorkspace = activeRemoteWorkspace !== null;
  const activeNodeClient = activeRemoteWorkspace
    ? getNodeClient(activeRemoteWorkspace.nodeId)
    : null;

  const activeWorkspaceState = editorWorkspaceId
    ? workspaceStates[editorWorkspaceId] || defaultWorkspaceState
    : defaultWorkspaceState;

  const offlineNodeIds = useMemo(
    () => new Set(nodes.filter(n => n.status !== 'online' && !n.isLocal).map(n => n.id)),
    [nodes]
  );

  // Local file operations
  const localFileOps = useFileOperations({
    editorWorkspaceId: isRemoteWorkspace ? null : editorWorkspaceId,
    activeWorkspaceState,
    updateWorkspaceState,
    setStatusMessage
  });

  // Remote file operations
  const remoteFileOps = useRemoteFileOperations({
    nodeClient: activeNodeClient,
    workspaceId: isRemoteWorkspace ? editorWorkspaceId : null,
    workspaceState: activeWorkspaceState,
    updateWorkspaceState,
    setStatusMessage
  });

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
  } = isRemoteWorkspace ? remoteFileOps : localFileOps;

  // Local Git
  const localGitOps = useGitState(
    isRemoteWorkspace ? null : editorWorkspaceId, setStatusMessage
  );

  // Remote Git
  const remoteGitOps = useRemoteGitState(
    activeNodeClient,
    isRemoteWorkspace ? editorWorkspaceId : null,
    setStatusMessage
  );

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
  } = isRemoteWorkspace ? remoteGitOps : localGitOps;

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
      setActiveGroupId(next.groupId);
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
    if (activeGroupId) {
      params.set('group', activeGroupId);
    }
    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }, [view, editorWorkspaceId, activeDeckIds, workspaceMode, activeGroupId]);

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
    if (workspaces.length === 0 && remoteWorkspaces.length === 0) {
      setStatusMessage(MESSAGE_WORKSPACE_REQUIRED);
      return;
    }
    setIsDeckModalOpen(true);
  }, [workspaces.length, remoteWorkspaces.length]);

  const deckModalRemoteWorkspaces = useMemo(
    () => deckModalNodeId ? remoteWorkspaces.filter(ws => ws.nodeId === deckModalNodeId) : undefined,
    [deckModalNodeId, remoteWorkspaces]
  );

  const handleSubmitDeck = useCallback(
    async (name: string, workspaceId: string) => {
      if (!workspaceId) {
        setStatusMessage(MESSAGE_SELECT_WORKSPACE);
        return;
      }
      // 名前が空の場合、全デッキを考慮してユニーク名を生成
      let resolvedName = name;
      if (!resolvedName) {
        const allNames = new Set([
          ...decks.map(d => d.name),
          ...remoteDecks.map(d => d.name)
        ]);
        let n = allNames.size + 1;
        while (allNames.has(`Deck ${n}`)) n++;
        resolvedName = `Deck ${n}`;
      }
      if (deckModalNodeId) {
        const deck = await createRemoteDeck(deckModalNodeId, resolvedName, workspaceId);
        if (deck) await refreshRemoteDecks();
      } else {
        await handleCreateDeck(resolvedName, workspaceId);
      }
      setIsDeckModalOpen(false);
      setDeckModalNodeId('');
    },
    [deckModalNodeId, createRemoteDeck, refreshRemoteDecks, handleCreateDeck, decks, remoteDecks]
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
      setWorkspaceStates((prev) => {
        if (prev[workspaceId]) return prev;
        return { ...prev, [workspaceId]: createEmptyWorkspaceState() };
      });
    },
    [setEditorWorkspaceId, setWorkspaceStates]
  );

  const handleCloseWorkspaceEditor = useCallback(() => {
    setWorkspaceMode('list');
  }, []);

  const handleOpenWorkspaceModal = useCallback(() => {
    setIsWorkspaceModalOpen(true);
  }, []);

  const handleSubmitWorkspace = useCallback(
    async (path: string, nodeId?: string) => {
      if (nodeId) {
        const created = await createRemoteWorkspace(nodeId, path);
        if (created) {
          await refreshRemoteWorkspaces();
          setIsWorkspaceModalOpen(false);
        }
      } else {
        const created = await handleCreateWorkspace(path);
        if (created) {
          setIsWorkspaceModalOpen(false);
        }
      }
    },
    [handleCreateWorkspace, createRemoteWorkspace, refreshRemoteWorkspaces]
  );

  const handleOpenEditWorkspace = useCallback((workspace: Workspace) => {
    setEditingWorkspace(workspace);
  }, []);

  const handleSubmitEditWorkspace = useCallback(
    async (id: string, updates: { name?: string; path?: string }) => {
      const remoteWs = remoteWorkspaces.find(ws => ws.id === id);
      if (remoteWs) {
        const result = await updateRemoteWorkspace(remoteWs.nodeId, id, updates);
        if (result) setEditingWorkspace(null);
      } else {
        const updated = await handleUpdateWorkspace(id, updates);
        if (updated) {
          setEditingWorkspace(null);
        }
      }
    },
    [handleUpdateWorkspace, remoteWorkspaces, updateRemoteWorkspace]
  );

  const handleOpenDeleteWorkspace = useCallback((workspace: Workspace) => {
    setDeletingWorkspace(workspace);
  }, []);

  const handleConfirmDeleteWorkspace = useCallback(async () => {
    if (!deletingWorkspace) return;
    const remoteWs = remoteWorkspaces.find(ws => ws.id === deletingWorkspace.id);
    if (remoteWs) {
      await deleteRemoteWorkspace(remoteWs.nodeId, deletingWorkspace.id);
      setDeletingWorkspace(null);
    } else {
      const success = await handleDeleteWorkspace(deletingWorkspace.id);
      if (success) {
        removeDecksForWorkspace(deletingWorkspace.id);
        setDeletingWorkspace(null);
      }
    }
  }, [deletingWorkspace, handleDeleteWorkspace, removeDecksForWorkspace, remoteWorkspaces, deleteRemoteWorkspace]);

  const handleDeckTabContextMenu = useCallback(
    (e: React.MouseEvent, deck: Deck) => {
      e.preventDefault();
      e.stopPropagation();
      setDeckContextMenu({ deck, x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleRemoteDeckTabContextMenu = useCallback(
    (e: React.MouseEvent, deck: NodeDeck) => {
      e.preventDefault();
      e.stopPropagation();
      setRemoteDeckContextMenu({ deck, x: e.clientX, y: e.clientY });
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

  const handleSubmitEditRemoteDeck = useCallback(
    async (id: string, updates: { name?: string; workspaceId?: string }) => {
      if (!editingRemoteDeck) return;
      const updated = await updateRemoteDeck(editingRemoteDeck.nodeId, id, updates);
      if (updated) setEditingRemoteDeck(null);
    },
    [editingRemoteDeck, updateRemoteDeck]
  );

  const handleConfirmDeleteDeck = useCallback(async () => {
    if (!deletingDeck) return;
    const success = await handleDeleteDeck(deletingDeck.id);
    if (success) {
      setDeletingDeck(null);
    }
  }, [deletingDeck, handleDeleteDeck]);

  const handleConfirmDeleteRemoteDeck = useCallback(async () => {
    if (!deletingRemoteDeck) return;
    await deleteRemoteDeck(deletingRemoteDeck.nodeId, deletingRemoteDeck.id);
    setActiveDeckIds((prev) => prev.filter((id) => id !== deletingRemoteDeck.id));
    setDeletingRemoteDeck(null);
  }, [deletingRemoteDeck, deleteRemoteDeck, setActiveDeckIds]);

  const handleSubmitCreateDeckGroup = useCallback(
    async (name: string, deckIds: [string, string]) => {
      const group = await handleCreateDeckGroup(name, deckIds);
      if (group) {
        setGroupCreateInitialDeck(null);
      }
    },
    [handleCreateDeckGroup]
  );

  const handleSubmitEditDeckGroup = useCallback(
    async (id: string, updates: { name?: string; deckIds?: [string, string] }) => {
      const updated = await handleUpdateDeckGroup(id, updates);
      if (updated) {
        setEditingDeckGroup(null);
      }
    },
    [handleUpdateDeckGroup]
  );

  const handleConfirmDeleteDeckGroup = useCallback(async () => {
    if (!deletingDeckGroup) return;
    const success = await handleDeleteDeckGroup(deletingDeckGroup.id);
    if (success) {
      if (activeGroupId === deletingDeckGroup.id) {
        setActiveGroupId(null);
      }
      setDeletingDeckGroup(null);
    }
  }, [deletingDeckGroup, handleDeleteDeckGroup, activeGroupId]);

  const handleGroupTabContextMenu = useCallback(
    (e: React.MouseEvent, group: DeckGroup) => {
      e.preventDefault();
      e.stopPropagation();
      setGroupContextMenu({ group, x: e.clientX, y: e.clientY });
    },
    []
  );

  // Close deck context menu on outside click
  const deckContextMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!deckContextMenu && !groupContextMenu && !remoteDeckContextMenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (deckContextMenuRef.current && !deckContextMenuRef.current.contains(e.target as Node)) {
        setDeckContextMenu(null);
        setGroupContextMenu(null);
        setRemoteDeckContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [deckContextMenu, groupContextMenu, remoteDeckContextMenu]);

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

  const handleToggleTerminalLayout = useCallback(
    (deck: Deck) => {
      const newLayout: TerminalLayout = deck.terminalLayout === 'horizontal' ? 'vertical' : 'horizontal';
      handleUpdateDeck(deck.id, { terminalLayout: newLayout });
    },
    [handleUpdateDeck]
  );

  const handleTerminalDeleteForDeck = useCallback(
    (deckId: string, terminalId: string) => {
      handleDeleteTerminal(deckId, terminalId);
    },
    [handleDeleteTerminal]
  );

  const handleToggleDeck = useCallback((deckId: string, shiftKey = false) => {
    setActiveGroupId(null);
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

  const handleToggleGroup = useCallback((groupId: string) => {
    const group = deckGroups.find((g) => g.id === groupId);
    if (!group) return;
    if (activeGroupId === groupId) {
      // Deselect group, show first deck only
      setActiveGroupId(null);
      setActiveDeckIds([group.deckIds[0]]);
    } else {
      setActiveGroupId(groupId);
      setActiveDeckIds([...group.deckIds]);
    }
  }, [deckGroups, activeGroupId, setActiveDeckIds]);


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
          remoteWorkspaces={remoteWorkspaces}
          offlineNodeIds={offlineNodeIds}
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
            {remoteDecks.map((deck) => {
              const isOffline = offlineNodeIds.has(deck.nodeId);
              return (
                <button
                  key={`${deck.nodeId}:${deck.id}`}
                  type="button"
                  className={`deck-tab ${activeDeckIds.includes(deck.id) ? 'active' : ''} ${isOffline ? 'deck-tab-offline' : ''}`}
                  onClick={(e) => !isOffline && handleToggleDeck(deck.id, e.shiftKey)}
                  onContextMenu={(e) => !isOffline && handleRemoteDeckTabContextMenu(e, deck)}
                  disabled={isOffline}
                  title={isOffline
                    ? `[${deck.nodeName}] オフライン`
                    : `[${deck.nodeName}] ${deck.root}\nShift+クリックで分割表示\n右クリックで編集・削除`}
                >
                  <span className="deck-tab-node-dot" style={{ background: isOffline ? '#888' : '#4ec9b0' }} />
                  <span className="deck-tab-node-label">{deck.nodeName}</span>
                  {deck.name}
                </button>
              );
            })}
            {deckGroups.length > 0 && (
              <span className="deck-tab-separator" />
            )}
            {deckGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={`deck-tab deck-tab-group ${activeGroupId === group.id ? 'active' : ''}`}
                onClick={() => handleToggleGroup(group.id)}
                onContextMenu={(e) => handleGroupTabContextMenu(e, group)}
                title={`グループ: ${group.name}\nクリックで2デッキ横並び表示\n右クリックで編集・削除`}
              >
                {group.name}
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
            const deck = decks.find((d) => d.id === deckId) || remoteDecks.find((d) => d.id === deckId);
            const deckState = deckStates[deckId] || defaultDeckState;
            if (!deck) return null;
            const isRemote = 'nodeId' in deck;
            const deckNodeClient = isRemote ? getNodeClient((deck as NodeDeck).nodeId) : null;
            const deckWsBase = deckNodeClient ? deckNodeClient.getWsBase() : wsBase;
            const deckWsTokenFetcher = deckNodeClient ? () => deckNodeClient.getWsToken() : undefined;
            return (
              <div key={deckId} className="deck-split-pane">
                <div className="deck-split-header">
                  <span className="deck-split-title">
                    {isRemote && (
                      <>
                        <span className="deck-tab-node-dot" style={{ background: '#4ec9b0', display: 'inline-block', marginRight: 4, verticalAlign: 'middle' }} />
                        <span className="deck-tab-node-label" style={{ display: 'inline', verticalAlign: 'middle' }}>{(deck as NodeDeck).nodeName}</span>
                      </>
                    )}
                    {deck.name}
                  </span>
                  <div className="deck-split-actions">
                    {deckState.terminals.length === 2 && (
                      <button
                        type="button"
                        className="topbar-btn-sm layout-toggle-btn"
                        onClick={() => handleToggleTerminalLayout(deck)}
                        title={deck.terminalLayout === 'horizontal' ? '上下並びに切替' : '横並びに切替'}
                      >
                        {deck.terminalLayout === 'horizontal' ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                            <rect x="1" y="1" width="12" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="1" y="8" width="12" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                            <rect x="1" y="1" width="5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            <rect x="8" y="1" width="5" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                        )}
                      </button>
                    )}
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
                  wsBase={deckWsBase}
                  layout={deck.terminalLayout}
                  wsTokenFetcher={deckWsTokenFetcher}
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
        {view === 'nodes' && (
          <NodeManagement
            nodes={[localNode, ...nodes]}
            onAddNode={addNode}
            onRemoveNode={removeNode}
            onUpdateNode={updateNode}
            onTestConnection={testConnection}
            onRefreshStatuses={refreshAllStatuses}
          />
        )}
      </main>
      <StatusMessage message={statusMessage} onDismiss={clearStatusMessage} />
      <WorkspaceModal
        isOpen={isWorkspaceModalOpen}
        defaultRoot={defaultRoot}
        nodes={[localNode, ...nodes]}
        getNodeClient={getNodeClient}
        onSubmit={handleSubmitWorkspace}
        onClose={() => setIsWorkspaceModalOpen(false)}
      />
      <DeckModal
        isOpen={isDeckModalOpen}
        workspaces={workspaces}
        nodes={[localNode, ...nodes]}
        remoteWorkspaces={deckModalRemoteWorkspaces}
        onNodeChange={setDeckModalNodeId}
        onSubmit={handleSubmitDeck}
        onClose={() => { setIsDeckModalOpen(false); setDeckModalNodeId(''); }}
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
      <DeckGroupCreateModal
        isOpen={groupCreateInitialDeck !== null}
        initialDeck={groupCreateInitialDeck}
        decks={decks}
        onSubmit={handleSubmitCreateDeckGroup}
        onClose={() => setGroupCreateInitialDeck(null)}
      />
      <DeckGroupEditModal
        isOpen={editingDeckGroup !== null}
        group={editingDeckGroup}
        decks={decks}
        onSubmit={handleSubmitEditDeckGroup}
        onClose={() => setEditingDeckGroup(null)}
      />
      <ConfirmDialog
        isOpen={deletingDeckGroup !== null}
        title="グループ削除"
        message={`グループ「${deletingDeckGroup?.name ?? ''}」を削除しますか？デッキ自体は削除されません。`}
        confirmLabel="削除"
        onConfirm={handleConfirmDeleteDeckGroup}
        onCancel={() => setDeletingDeckGroup(null)}
      />
      {groupContextMenu && (
        <div
          ref={deckContextMenuRef}
          className="context-menu"
          style={{ top: groupContextMenu.y, left: groupContextMenu.x }}
        >
          <button
            type="button"
            className="context-menu-item"
            onClick={() => {
              setEditingDeckGroup(groupContextMenu.group);
              setGroupContextMenu(null);
            }}
          >
            編集
          </button>
          <button
            type="button"
            className="context-menu-item delete"
            onClick={() => {
              setDeletingDeckGroup(groupContextMenu.group);
              setGroupContextMenu(null);
            }}
          >
            削除
          </button>
        </div>
      )}
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
              setGroupCreateInitialDeck(deckContextMenu.deck);
              setDeckContextMenu(null);
            }}
          >
            グループ作成
          </button>
          <div className="context-menu-separator" />
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
      {remoteDeckContextMenu && (
        <div ref={deckContextMenuRef} className="context-menu"
          style={{ top: remoteDeckContextMenu.y, left: remoteDeckContextMenu.x }}>
          <button type="button" className="context-menu-item"
            onClick={() => { setEditingRemoteDeck(remoteDeckContextMenu.deck); setRemoteDeckContextMenu(null); }}>
            編集
          </button>
          <button type="button" className="context-menu-item delete"
            onClick={() => { setDeletingRemoteDeck(remoteDeckContextMenu.deck); setRemoteDeckContextMenu(null); }}>
            削除
          </button>
        </div>
      )}
      <DeckEditModal
        isOpen={editingRemoteDeck !== null}
        deck={editingRemoteDeck}
        workspaces={editingRemoteDeck
          ? remoteWorkspaces.filter(ws => ws.nodeId === editingRemoteDeck.nodeId)
          : []}
        onSubmit={handleSubmitEditRemoteDeck}
        onClose={() => setEditingRemoteDeck(null)}
      />
      <ConfirmDialog
        isOpen={deletingRemoteDeck !== null}
        title="リモートデッキ削除"
        message={`「${deletingRemoteDeck?.name ?? ''}」(${deletingRemoteDeck?.nodeName ?? ''})を削除しますか？関連するターミナルも削除されます。`}
        confirmLabel="削除"
        onConfirm={handleConfirmDeleteRemoteDeck}
        onCancel={() => setDeletingRemoteDeck(null)}
      />
    </div>
  );
}
