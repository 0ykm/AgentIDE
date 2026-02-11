import type {
  Deck,
  DeckGroup,
  FileSystemEntry,
  Workspace,
  GitStatus,
  GitDiff,
  GitRepoInfo,
  MultiRepoGitStatus,
  TerminalLayout
} from '../types';
import type {
  AgentSession,
  CreateAgentRequest,
  AgentMessage,
  AgentStatus
} from '../types';
import type { NodeInfo, RemoteNode, RegisterNodeRequest } from '@deck-ide/shared/types';

const HTTP_STATUS_NO_CONTENT = 204;
const CONTENT_TYPE_JSON = 'application/json';
const HTTP_METHOD_POST = 'POST';
const HTTP_METHOD_PUT = 'PUT';
const HTTP_METHOD_PATCH = 'PATCH';
const HTTP_METHOD_DELETE = 'DELETE';
const MAX_RECONNECT = 3;

/**
 * API client that targets a specific remote node.
 * Mirrors all functions from api.ts as instance methods.
 */
export class NodeApiClient {
  constructor(
    private baseUrl: string,
    private credentials?: { user: string; password: string }
  ) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {})
    };

    if (this.credentials) {
      const encoded = btoa(`${this.credentials.user}:${this.credentials.password}`);
      headers['Authorization'] = `Basic ${encoded}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include'
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed (${response.status})`);
    }

    if (response.status === HTTP_STATUS_NO_CONTENT) {
      return null as T;
    }

    return response.json() as Promise<T>;
  }

  /** Convert baseUrl http -> ws */
  getWsBase(): string {
    return this.baseUrl.replace(/^http/, 'ws');
  }

  /** Fetch a one-time WebSocket authentication token */
  async getWsToken(): Promise<{ token: string; authEnabled: boolean }> {
    return this.request<{ token: string; authEnabled: boolean }>('/api/ws-token');
  }

  // ===== Workspace API =====

  listWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>('/api/workspaces');
  }

  createWorkspace(path: string): Promise<Workspace> {
    return this.request<Workspace>('/api/workspaces', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ path })
    });
  }

  deleteWorkspace(id: string): Promise<void> {
    return this.request<void>(`/api/workspaces/${id}`, {
      method: HTTP_METHOD_DELETE
    });
  }

  // ===== Deck API =====

  listDecks(): Promise<Deck[]> {
    return this.request<Deck[]>('/api/decks');
  }

  createDeck(name: string, workspaceId: string): Promise<Deck> {
    return this.request<Deck>('/api/decks', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ name, workspaceId })
    });
  }

  deleteDeck(id: string): Promise<void> {
    return this.request<void>(`/api/decks/${id}`, {
      method: HTTP_METHOD_DELETE
    });
  }

  updateDeck(
    id: string,
    updates: { name?: string; workspaceId?: string; terminalLayout?: TerminalLayout }
  ): Promise<Deck> {
    return this.request<Deck>(`/api/decks/${id}`, {
      method: HTTP_METHOD_PATCH,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify(updates)
    });
  }

  // ===== Terminal API =====

  createTerminal(
    deckId: string,
    title?: string,
    command?: string
  ): Promise<{ id: string; title: string }> {
    return this.request<{ id: string; title: string }>('/api/terminals', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ deckId, title, command })
    });
  }

  deleteTerminal(terminalId: string): Promise<void> {
    return this.request<void>(`/api/terminals/${terminalId}`, {
      method: HTTP_METHOD_DELETE
    });
  }

  listTerminals(deckId: string): Promise<{ id: string; title: string }[]> {
    const query = new URLSearchParams({ deckId });
    return this.request<{ id: string; title: string }[]>(
      `/api/terminals?${query.toString()}`
    );
  }

  // ===== File API =====

  listFiles(workspaceId: string, path = ''): Promise<FileSystemEntry[]> {
    const query = new URLSearchParams({ workspaceId, path });
    return this.request<FileSystemEntry[]>(`/api/files?${query.toString()}`);
  }

  readFile(
    workspaceId: string,
    path: string
  ): Promise<{ path: string; contents: string }> {
    const query = new URLSearchParams({ workspaceId, path });
    return this.request<{ path: string; contents: string }>(
      `/api/file?${query.toString()}`
    );
  }

  writeFile(
    workspaceId: string,
    path: string,
    contents: string
  ): Promise<{ path: string; saved: boolean }> {
    return this.request<{ path: string; saved: boolean }>('/api/file', {
      method: HTTP_METHOD_PUT,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, path, contents })
    });
  }

  createFile(
    workspaceId: string,
    path: string,
    contents = ''
  ): Promise<{ path: string; created: boolean }> {
    return this.request<{ path: string; created: boolean }>('/api/file', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, path, contents })
    });
  }

  deleteFile(
    workspaceId: string,
    path: string
  ): Promise<{ path: string; deleted: boolean }> {
    const query = new URLSearchParams({ workspaceId, path });
    return this.request<{ path: string; deleted: boolean }>(
      `/api/file?${query.toString()}`,
      { method: HTTP_METHOD_DELETE }
    );
  }

  createDirectory(
    workspaceId: string,
    path: string
  ): Promise<{ path: string; created: boolean }> {
    return this.request<{ path: string; created: boolean }>('/api/dir', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, path })
    });
  }

  deleteDirectory(
    workspaceId: string,
    path: string
  ): Promise<{ path: string; deleted: boolean }> {
    const query = new URLSearchParams({ workspaceId, path });
    return this.request<{ path: string; deleted: boolean }>(
      `/api/dir?${query.toString()}`,
      { method: HTTP_METHOD_DELETE }
    );
  }

  // ===== Git API =====

  getGitStatus(workspaceId: string, repoPath?: string): Promise<GitStatus> {
    const params: Record<string, string> = { workspaceId };
    if (repoPath !== undefined) params.repoPath = repoPath;
    const query = new URLSearchParams(params);
    return this.request<GitStatus>(`/api/git/status?${query.toString()}`);
  }

  getGitRepos(workspaceId: string): Promise<{ repos: GitRepoInfo[] }> {
    const query = new URLSearchParams({ workspaceId });
    return this.request<{ repos: GitRepoInfo[] }>(`/api/git/repos?${query.toString()}`);
  }

  getMultiRepoStatus(workspaceId: string): Promise<MultiRepoGitStatus> {
    const query = new URLSearchParams({ workspaceId });
    return this.request<MultiRepoGitStatus>(`/api/git/multi-status?${query.toString()}`);
  }

  stageFiles(
    workspaceId: string,
    paths: string[],
    repoPath?: string
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/git/stage', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, paths, repoPath })
    });
  }

  unstageFiles(
    workspaceId: string,
    paths: string[],
    repoPath?: string
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/git/unstage', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, paths, repoPath })
    });
  }

  commitChanges(
    workspaceId: string,
    message: string,
    repoPath?: string
  ): Promise<{
    success: boolean;
    commit: string;
    summary: { changes: number; insertions: number; deletions: number };
  }> {
    return this.request('/api/git/commit', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, message, repoPath })
    });
  }

  discardChanges(
    workspaceId: string,
    paths: string[],
    repoPath?: string
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/git/discard', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, paths, repoPath })
    });
  }

  getGitDiff(
    workspaceId: string,
    path: string,
    staged: boolean,
    repoPath?: string
  ): Promise<GitDiff> {
    const params: Record<string, string> = {
      workspaceId,
      path,
      staged: staged.toString()
    };
    if (repoPath !== undefined) params.repoPath = repoPath;
    const query = new URLSearchParams(params);
    return this.request<GitDiff>(`/api/git/diff?${query.toString()}`);
  }

  pushChanges(
    workspaceId: string,
    repoPath?: string
  ): Promise<{ success: boolean; branch: string }> {
    return this.request('/api/git/push', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, repoPath })
    });
  }

  pullChanges(
    workspaceId: string,
    repoPath?: string
  ): Promise<{
    success: boolean;
    summary: { changes: number; insertions: number; deletions: number };
  }> {
    return this.request('/api/git/pull', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, repoPath })
    });
  }

  fetchChanges(
    workspaceId: string,
    repoPath?: string
  ): Promise<{ success: boolean }> {
    return this.request('/api/git/fetch', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, repoPath })
    });
  }

  getBranchStatus(
    workspaceId: string,
    repoPath?: string
  ): Promise<{ ahead: number; behind: number; hasUpstream: boolean }> {
    const params: Record<string, string> = { workspaceId };
    if (repoPath !== undefined) params.repoPath = repoPath;
    const query = new URLSearchParams(params);
    return this.request(`/api/git/branch-status?${query.toString()}`);
  }

  getGitRemotes(
    workspaceId: string,
    repoPath?: string
  ): Promise<{
    remotes: { name: string; fetchUrl: string; pushUrl: string }[];
    hasRemote: boolean;
  }> {
    const params: Record<string, string> = { workspaceId };
    if (repoPath !== undefined) params.repoPath = repoPath;
    const query = new URLSearchParams(params);
    return this.request(`/api/git/remotes?${query.toString()}`);
  }

  listBranches(
    workspaceId: string,
    repoPath?: string
  ): Promise<{
    branches: { name: string; current: boolean }[];
    currentBranch: string;
  }> {
    const params: Record<string, string> = { workspaceId };
    if (repoPath !== undefined) params.repoPath = repoPath;
    const query = new URLSearchParams(params);
    return this.request(`/api/git/branches?${query.toString()}`);
  }

  checkoutBranch(
    workspaceId: string,
    branchName: string,
    repoPath?: string
  ): Promise<{ success: boolean }> {
    return this.request('/api/git/checkout', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, branchName, repoPath })
    });
  }

  createBranch(
    workspaceId: string,
    branchName: string,
    checkout = true,
    repoPath?: string
  ): Promise<{ success: boolean }> {
    return this.request('/api/git/create-branch', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ workspaceId, branchName, checkout, repoPath })
    });
  }

  getGitLog(
    workspaceId: string,
    limit = 50,
    repoPath?: string
  ): Promise<{
    logs: {
      hash: string;
      hashShort: string;
      message: string;
      author: string;
      date: string;
    }[];
  }> {
    const params: Record<string, string> = { workspaceId, limit: String(limit) };
    if (repoPath !== undefined) params.repoPath = repoPath;
    const query = new URLSearchParams(params);
    return this.request(`/api/git/log?${query.toString()}`);
  }

  // ===== Deck Group API =====

  listDeckGroups(): Promise<DeckGroup[]> {
    return this.request<DeckGroup[]>('/api/deck-groups');
  }

  createDeckGroup(name: string, deckIds: [string, string]): Promise<DeckGroup> {
    return this.request<DeckGroup>('/api/deck-groups', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify({ name, deckIds })
    });
  }

  updateDeckGroup(
    id: string,
    updates: { name?: string; deckIds?: [string, string] }
  ): Promise<DeckGroup> {
    return this.request<DeckGroup>(`/api/deck-groups/${id}`, {
      method: HTTP_METHOD_PATCH,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify(updates)
    });
  }

  deleteDeckGroup(id: string): Promise<void> {
    return this.request<void>(`/api/deck-groups/${id}`, {
      method: HTTP_METHOD_DELETE
    });
  }

  // ===== Agent API =====

  listAgentSessions(): Promise<AgentSession[]> {
    return this.request<AgentSession[]>('/api/agents');
  }

  createAgentSession(req: CreateAgentRequest): Promise<AgentSession> {
    return this.request<AgentSession>('/api/agents', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify(req)
    });
  }

  deleteAgentSession(id: string): Promise<void> {
    return this.request<void>(`/api/agents/${id}`, {
      method: HTTP_METHOD_DELETE
    });
  }

  /**
   * Connects to agent SSE stream using fetch with remote node auth.
   * Returns cleanup function to close the connection.
   */
  streamAgentSession(
    id: string,
    onMessage: (msg: AgentMessage) => void,
    onStatus: (status: AgentStatus, extra?: { error?: string; durationMs?: number; totalCostUsd?: number }) => void,
    onError: (err: Error) => void
  ): () => void {
    const url = `${this.baseUrl}/api/agents/${id}/stream`;
    let aborted = false;
    const controller = new AbortController();

    let reconnectAttempt = 0;

    const authHeaders: Record<string, string> = {};
    if (this.credentials) {
      const encoded = btoa(`${this.credentials.user}:${this.credentials.password}`);
      authHeaders['Authorization'] = `Basic ${encoded}`;
    }

    const connect = () => {
      fetch(url, {
        credentials: 'include',
        headers: { 'Accept': 'text/event-stream', ...authHeaders },
        signal: controller.signal
      })
        .then(async (response) => {
          if (!response.ok || !response.body) {
            throw new Error(`SSE connection failed (${response.status})`);
          }
          reconnectAttempt = 0;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEvent = '';
          let currentData = '';

          while (!aborted) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('event:')) {
                currentEvent = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                currentData += line.slice(5).trim();
              } else if (line === '') {
                if (currentEvent && currentData) {
                  try {
                    const parsed = JSON.parse(currentData);
                    if (currentEvent === 'message') {
                      onMessage(parsed);
                    } else if (currentEvent === 'status') {
                      onStatus(parsed.status, {
                        error: parsed.error,
                        durationMs: parsed.durationMs,
                        totalCostUsd: parsed.totalCostUsd
                      });
                    }
                  } catch {
                    // ignore parse errors
                  }
                }
                currentEvent = '';
                currentData = '';
              }
            }
          }

          // Stream ended normally - if agent was still running, try reconnect
          if (!aborted && reconnectAttempt < MAX_RECONNECT) {
            reconnectAttempt++;
            setTimeout(connect, 1000 * reconnectAttempt);
          }
        })
        .catch((err: unknown) => {
          if (aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
          if (reconnectAttempt < MAX_RECONNECT) {
            reconnectAttempt++;
            setTimeout(connect, 1000 * reconnectAttempt);
          } else {
            onError(err instanceof Error ? err : new Error(String(err)));
          }
        });
    };

    connect();

    return () => {
      aborted = true;
      controller.abort();
    };
  }

  // ===== Node API =====

  getNodeInfo(): Promise<NodeInfo> {
    return this.request<NodeInfo>('/api/node/info');
  }

  listNodes(): Promise<RemoteNode[]> {
    return this.request<RemoteNode[]>('/api/nodes');
  }

  registerNode(req: RegisterNodeRequest): Promise<RemoteNode> {
    return this.request<RemoteNode>('/api/nodes', {
      method: HTTP_METHOD_POST,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify(req)
    });
  }

  updateNode(id: string, updates: Partial<RegisterNodeRequest>): Promise<RemoteNode> {
    return this.request<RemoteNode>(`/api/nodes/${id}`, {
      method: HTTP_METHOD_PATCH,
      headers: { 'Content-Type': CONTENT_TYPE_JSON },
      body: JSON.stringify(updates)
    });
  }

  deleteNode(id: string): Promise<void> {
    return this.request<void>(`/api/nodes/${id}`, {
      method: HTTP_METHOD_DELETE
    });
  }
}
