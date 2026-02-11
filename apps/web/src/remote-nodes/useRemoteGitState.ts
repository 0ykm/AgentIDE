import { useCallback, useState, useRef } from 'react';
import type { GitStatus, GitFileStatus, GitDiff, GitRepoInfo } from '../types';
import { NodeApiClient } from './NodeApiClient';

export interface BranchStatus {
  ahead: number;
  behind: number;
  hasUpstream: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
}

export interface GitLogEntry {
  hash: string;
  hashShort: string;
  message: string;
  author: string;
  date: string;
}

export interface GitState {
  status: GitStatus | null;
  loading: boolean;
  error: string | null;
  diffPath: string | null;
  diff: GitDiff | null;
  diffLoading: boolean;
  branchStatus: BranchStatus | null;
  hasRemote: boolean;
  pushing: boolean;
  pulling: boolean;
  branches: GitBranch[];
  branchesLoading: boolean;
  logs: GitLogEntry[];
  logsLoading: boolean;
  repos: GitRepoInfo[];
  reposLoading: boolean;
  selectedRepoPath: string | null;
}

const createEmptyGitState = (): GitState => ({
  status: null,
  loading: false,
  error: null,
  diffPath: null,
  diff: null,
  diffLoading: false,
  branchStatus: null,
  hasRemote: false,
  pushing: false,
  pulling: false,
  branches: [],
  branchesLoading: false,
  logs: [],
  logsLoading: false,
  repos: [],
  reposLoading: false,
  selectedRepoPath: null
});

// API timeout wrapper
const withTimeout = <T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

/**
 * Remote-node version of useGitState.
 * Maintains separate git states for each workspace on a remote node.
 */
export const useRemoteGitState = (
  nodeClient: NodeApiClient | null,
  activeWorkspaceId: string | null,
  setStatusMessage: (message: string) => void
) => {
  const [gitStates, setGitStates] = useState<Record<string, GitState>>({});
  const loadingRefs = useRef<Record<string, boolean>>({});

  const gitState = activeWorkspaceId
    ? gitStates[activeWorkspaceId] || createEmptyGitState()
    : createEmptyGitState();

  const updateGitState = useCallback(
    (workspaceId: string, updater: (prev: GitState) => GitState) => {
      setGitStates((prev) => ({
        ...prev,
        [workspaceId]: updater(prev[workspaceId] || createEmptyGitState())
      }));
    },
    []
  );

  const refreshGitStatus = useCallback(
    async (targetWorkspaceId?: string) => {
      const wsId = targetWorkspaceId || activeWorkspaceId;
      if (!wsId || !nodeClient) return;

      if (loadingRefs.current[wsId]) return;
      loadingRefs.current[wsId] = true;

      updateGitState(wsId, (prev) => ({ ...prev, loading: true, reposLoading: true, error: null }));

      try {
        const reposResult = await withTimeout(nodeClient.getGitRepos(wsId)).catch(() => ({ repos: [] }));
        const repos = reposResult.repos;

        updateGitState(wsId, (prev) => ({
          ...prev,
          repos,
          reposLoading: false,
          selectedRepoPath: prev.selectedRepoPath ?? (repos.length > 0 ? repos[0].path : null)
        }));

        const currentState = gitStates[wsId] || createEmptyGitState();
        const repoPath = currentState.selectedRepoPath ?? (repos.length > 0 ? repos[0].path : undefined);

        const [status, branchStatus, remotes] = await Promise.all([
          withTimeout(nodeClient.getGitStatus(wsId, repoPath || undefined)),
          withTimeout(nodeClient.getBranchStatus(wsId, repoPath || undefined)).catch(() => ({ ahead: 0, behind: 0, hasUpstream: false })),
          withTimeout(nodeClient.getGitRemotes(wsId, repoPath || undefined)).catch(() => ({ hasRemote: false, remotes: [] }))
        ]);

        updateGitState(wsId, (prev) => ({
          ...prev,
          status,
          branchStatus,
          hasRemote: remotes.hasRemote,
          loading: false,
          error: null
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get git status';
        updateGitState(wsId, (prev) => ({
          ...prev,
          status: null,
          loading: false,
          reposLoading: false,
          error: message
        }));
      } finally {
        loadingRefs.current[wsId] = false;
      }
    },
    [activeWorkspaceId, nodeClient, updateGitState, gitStates]
  );

  const handleSelectRepo = useCallback(
    async (repoPath: string) => {
      if (!activeWorkspaceId || !nodeClient) return;

      updateGitState(activeWorkspaceId, (prev) => ({
        ...prev,
        selectedRepoPath: repoPath,
        loading: true
      }));

      try {
        const [status, branchStatus, remotes] = await Promise.all([
          withTimeout(nodeClient.getGitStatus(activeWorkspaceId, repoPath || undefined)),
          withTimeout(nodeClient.getBranchStatus(activeWorkspaceId, repoPath || undefined)).catch(() => ({ ahead: 0, behind: 0, hasUpstream: false })),
          withTimeout(nodeClient.getGitRemotes(activeWorkspaceId, repoPath || undefined)).catch(() => ({ hasRemote: false, remotes: [] }))
        ]);

        updateGitState(activeWorkspaceId, (prev) => ({
          ...prev,
          status,
          branchStatus,
          hasRemote: remotes.hasRemote,
          loading: false,
          branches: [],
          logs: []
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get git status';
        setStatusMessage(message);
        updateGitState(activeWorkspaceId, (prev) => ({
          ...prev,
          loading: false
        }));
      }
    },
    [activeWorkspaceId, nodeClient, updateGitState, setStatusMessage]
  );

  const refreshAllGitStatuses = useCallback(async () => {
    const workspaceIds = Object.keys(gitStates);
    await Promise.all(workspaceIds.map((id) => refreshGitStatus(id)));
  }, [gitStates, refreshGitStatus]);

  const getCurrentRepoPath = useCallback(() => {
    if (!activeWorkspaceId) return undefined;
    const state = gitStates[activeWorkspaceId];
    return state?.selectedRepoPath || undefined;
  }, [activeWorkspaceId, gitStates]);

  const handleStageFile = useCallback(
    async (path: string) => {
      if (!activeWorkspaceId || !nodeClient) return;
      const repoPath = getCurrentRepoPath();
      try {
        await nodeClient.stageFiles(activeWorkspaceId, [path], repoPath);
        await refreshGitStatus();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Failed to stage file');
      }
    },
    [activeWorkspaceId, nodeClient, getCurrentRepoPath, refreshGitStatus, setStatusMessage]
  );

  const handleUnstageFile = useCallback(
    async (path: string) => {
      if (!activeWorkspaceId || !nodeClient) return;
      const repoPath = getCurrentRepoPath();
      try {
        await nodeClient.unstageFiles(activeWorkspaceId, [path], repoPath);
        await refreshGitStatus();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Failed to unstage file');
      }
    },
    [activeWorkspaceId, nodeClient, getCurrentRepoPath, refreshGitStatus, setStatusMessage]
  );

  const handleStageAll = useCallback(async () => {
    if (!activeWorkspaceId || !nodeClient || !gitState.status) return;
    const repoPath = getCurrentRepoPath();
    const unstagedFiles = gitState.status.files
      .filter((f) => !f.staged)
      .map((f) => f.path);
    if (unstagedFiles.length === 0) return;
    try {
      await nodeClient.stageFiles(activeWorkspaceId, unstagedFiles, repoPath);
      await refreshGitStatus();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to stage files');
    }
  }, [activeWorkspaceId, nodeClient, gitState.status, getCurrentRepoPath, refreshGitStatus, setStatusMessage]);

  const handleUnstageAll = useCallback(async () => {
    if (!activeWorkspaceId || !nodeClient || !gitState.status) return;
    const repoPath = getCurrentRepoPath();
    const stagedFiles = gitState.status.files
      .filter((f) => f.staged)
      .map((f) => f.path);
    if (stagedFiles.length === 0) return;
    try {
      await nodeClient.unstageFiles(activeWorkspaceId, stagedFiles, repoPath);
      await refreshGitStatus();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to unstage files');
    }
  }, [activeWorkspaceId, nodeClient, gitState.status, getCurrentRepoPath, refreshGitStatus, setStatusMessage]);

  const handleCommit = useCallback(
    async (message: string) => {
      if (!activeWorkspaceId || !nodeClient || !message.trim()) return;
      const repoPath = getCurrentRepoPath();
      try {
        const result = await nodeClient.commitChanges(activeWorkspaceId, message.trim(), repoPath);
        setStatusMessage(
          `Committed: ${result.summary.changes} changes, +${result.summary.insertions} -${result.summary.deletions}`
        );
        await refreshGitStatus();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Failed to commit');
      }
    },
    [activeWorkspaceId, nodeClient, getCurrentRepoPath, refreshGitStatus, setStatusMessage]
  );

  const handleDiscardFile = useCallback(
    async (path: string) => {
      if (!activeWorkspaceId || !nodeClient) return;
      const repoPath = getCurrentRepoPath();
      try {
        await nodeClient.discardChanges(activeWorkspaceId, [path], repoPath);
        await refreshGitStatus();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Failed to discard changes');
      }
    },
    [activeWorkspaceId, nodeClient, getCurrentRepoPath, refreshGitStatus, setStatusMessage]
  );

  const handleShowDiff = useCallback(
    async (file: GitFileStatus) => {
      if (!activeWorkspaceId || !nodeClient) return;
      const repoPath = getCurrentRepoPath();

      updateGitState(activeWorkspaceId, (prev) => ({
        ...prev,
        diffPath: file.path,
        diffLoading: true,
        diff: null
      }));

      try {
        const diff = await nodeClient.getGitDiff(activeWorkspaceId, file.path, file.staged, repoPath);
        updateGitState(activeWorkspaceId, (prev) => ({
          ...prev,
          diff,
          diffLoading: false
        }));
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Failed to get diff');
        updateGitState(activeWorkspaceId, (prev) => ({
          ...prev,
          diffPath: null,
          diff: null,
          diffLoading: false
        }));
      }
    },
    [activeWorkspaceId, nodeClient, getCurrentRepoPath, updateGitState, setStatusMessage]
  );

  const handleCloseDiff = useCallback(() => {
    if (!activeWorkspaceId) return;
    updateGitState(activeWorkspaceId, (prev) => ({
      ...prev,
      diffPath: null,
      diff: null,
      diffLoading: false
    }));
  }, [activeWorkspaceId, updateGitState]);

  const handlePush = useCallback(async () => {
    if (!activeWorkspaceId || !nodeClient) return;
    const repoPath = getCurrentRepoPath();
    updateGitState(activeWorkspaceId, (prev) => ({ ...prev, pushing: true }));
    try {
      const result = await nodeClient.pushChanges(activeWorkspaceId, repoPath);
      setStatusMessage(`Pushed to ${result.branch}`);
      await refreshGitStatus();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to push');
    } finally {
      updateGitState(activeWorkspaceId, (prev) => ({ ...prev, pushing: false }));
    }
  }, [activeWorkspaceId, nodeClient, getCurrentRepoPath, updateGitState, refreshGitStatus, setStatusMessage]);

  const handlePull = useCallback(async () => {
    if (!activeWorkspaceId || !nodeClient) return;
    const repoPath = getCurrentRepoPath();
    updateGitState(activeWorkspaceId, (prev) => ({ ...prev, pulling: true }));
    try {
      const result = await nodeClient.pullChanges(activeWorkspaceId, repoPath);
      if (result.summary.changes > 0) {
        setStatusMessage(
          `Pulled: ${result.summary.changes} changes, +${result.summary.insertions} -${result.summary.deletions}`
        );
      } else {
        setStatusMessage('Already up to date');
      }
      await refreshGitStatus();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to pull');
    } finally {
      updateGitState(activeWorkspaceId, (prev) => ({ ...prev, pulling: false }));
    }
  }, [activeWorkspaceId, nodeClient, getCurrentRepoPath, updateGitState, refreshGitStatus, setStatusMessage]);

  const handleFetch = useCallback(async () => {
    if (!activeWorkspaceId || !nodeClient) return;
    const repoPath = getCurrentRepoPath();
    try {
      await nodeClient.fetchChanges(activeWorkspaceId, repoPath);
      setStatusMessage('Fetched from remote');
      await refreshGitStatus();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to fetch');
    }
  }, [activeWorkspaceId, nodeClient, getCurrentRepoPath, refreshGitStatus, setStatusMessage]);

  const handleLoadBranches = useCallback(async () => {
    if (!activeWorkspaceId || !nodeClient) return;
    const repoPath = getCurrentRepoPath();
    updateGitState(activeWorkspaceId, (prev) => ({ ...prev, branchesLoading: true }));
    try {
      const result = await withTimeout(nodeClient.listBranches(activeWorkspaceId, repoPath));
      updateGitState(activeWorkspaceId, (prev) => ({
        ...prev,
        branches: result.branches,
        branchesLoading: false
      }));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to load branches');
      updateGitState(activeWorkspaceId, (prev) => ({ ...prev, branchesLoading: false }));
    }
  }, [activeWorkspaceId, nodeClient, getCurrentRepoPath, updateGitState, setStatusMessage]);

  const handleCheckoutBranch = useCallback(
    async (branchName: string) => {
      if (!activeWorkspaceId || !nodeClient) return;
      const repoPath = getCurrentRepoPath();
      try {
        await nodeClient.checkoutBranch(activeWorkspaceId, branchName, repoPath);
        setStatusMessage(`Switched to branch '${branchName}'`);
        await refreshGitStatus();
        await handleLoadBranches();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Failed to checkout branch');
      }
    },
    [activeWorkspaceId, nodeClient, getCurrentRepoPath, refreshGitStatus, handleLoadBranches, setStatusMessage]
  );

  const handleCreateBranch = useCallback(
    async (branchName: string, checkout = true) => {
      if (!activeWorkspaceId || !nodeClient) return;
      const repoPath = getCurrentRepoPath();
      try {
        await nodeClient.createBranch(activeWorkspaceId, branchName, checkout, repoPath);
        setStatusMessage(`Created branch '${branchName}'${checkout ? ' and switched to it' : ''}`);
        await refreshGitStatus();
        await handleLoadBranches();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : 'Failed to create branch');
      }
    },
    [activeWorkspaceId, nodeClient, getCurrentRepoPath, refreshGitStatus, handleLoadBranches, setStatusMessage]
  );

  const handleLoadLogs = useCallback(async (limit = 50) => {
    if (!activeWorkspaceId || !nodeClient) return;
    const repoPath = getCurrentRepoPath();
    updateGitState(activeWorkspaceId, (prev) => ({ ...prev, logsLoading: true }));
    try {
      const result = await withTimeout(nodeClient.getGitLog(activeWorkspaceId, limit, repoPath));
      updateGitState(activeWorkspaceId, (prev) => ({
        ...prev,
        logs: result.logs,
        logsLoading: false
      }));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to load git log');
      updateGitState(activeWorkspaceId, (prev) => ({ ...prev, logsLoading: false }));
    }
  }, [activeWorkspaceId, nodeClient, getCurrentRepoPath, updateGitState, setStatusMessage]);

  const getGitStateForWorkspace = useCallback(
    (workspaceId: string): GitState => {
      return gitStates[workspaceId] || createEmptyGitState();
    },
    [gitStates]
  );

  return {
    gitState,
    gitStates,
    refreshGitStatus,
    refreshAllGitStatuses,
    getGitStateForWorkspace,
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
    handleFetch,
    handleLoadBranches,
    handleCheckoutBranch,
    handleCreateBranch,
    handleLoadLogs
  };
};
