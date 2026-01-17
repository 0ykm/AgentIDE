import type { Deck, FileSystemEntry, Workspace } from './types';
import { API_BASE } from './constants';

const HTTP_STATUS_NO_CONTENT = 204;

/**
 * Makes an HTTP request to the API
 * @param path - API endpoint path
 * @param options - Fetch options
 * @returns Parsed JSON response
 * @throws Error if request fails
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  if (response.status === HTTP_STATUS_NO_CONTENT) {
    return null as T;
  }
  return response.json() as Promise<T>;
}

const CONTENT_TYPE_JSON = 'application/json';
const HTTP_METHOD_POST = 'POST';
const HTTP_METHOD_PUT = 'PUT';

/**
 * Converts HTTP(S) base URL to WebSocket URL
 */
export function getWsBase(): string {
  const base = API_BASE || window.location.origin;
  return base.replace(/^http/, 'ws');
}

/**
 * Fetches all workspaces
 */
export function listWorkspaces(): Promise<Workspace[]> {
  return request<Workspace[]>('/api/workspaces');
}

/**
 * Fetches server configuration
 */
export function getConfig(): Promise<{ defaultRoot?: string }> {
  return request<{ defaultRoot?: string }>('/api/config');
}

/**
 * Creates a new workspace
 */
export function createWorkspace(path: string): Promise<Workspace> {
  return request<Workspace>('/api/workspaces', {
    method: HTTP_METHOD_POST,
    headers: { 'Content-Type': CONTENT_TYPE_JSON },
    body: JSON.stringify({ path })
  });
}

/**
 * Fetches all decks
 */
export function listDecks(): Promise<Deck[]> {
  return request<Deck[]>('/api/decks');
}

/**
 * Creates a new deck
 */
export function createDeck(name: string, workspaceId: string): Promise<Deck> {
  return request<Deck>('/api/decks', {
    method: HTTP_METHOD_POST,
    headers: { 'Content-Type': CONTENT_TYPE_JSON },
    body: JSON.stringify({ name, workspaceId })
  });
}

/**
 * Lists files in a workspace directory
 */
export function listFiles(
  workspaceId: string,
  path = ''
): Promise<FileSystemEntry[]> {
  const query = new URLSearchParams({ workspaceId, path });
  return request<FileSystemEntry[]>(`/api/files?${query.toString()}`);
}

/**
 * Previews files in a directory (without workspace context)
 */
export function previewFiles(
  rootPath: string,
  subpath = ''
): Promise<FileSystemEntry[]> {
  const query = new URLSearchParams({ path: rootPath, subpath });
  return request<FileSystemEntry[]>(`/api/preview?${query.toString()}`);
}

/**
 * Reads the contents of a file
 */
export function readFile(
  workspaceId: string,
  path: string
): Promise<{ path: string; contents: string }> {
  const query = new URLSearchParams({ workspaceId, path });
  return request<{ path: string; contents: string }>(
    `/api/file?${query.toString()}`
  );
}

/**
 * Writes contents to a file
 */
export function writeFile(
  workspaceId: string,
  path: string,
  contents: string
): Promise<{ path: string; saved: boolean }> {
  return request<{ path: string; saved: boolean }>('/api/file', {
    method: HTTP_METHOD_PUT,
    headers: { 'Content-Type': CONTENT_TYPE_JSON },
    body: JSON.stringify({ workspaceId, path, contents })
  });
}

/**
 * Creates a new terminal session
 */
export function createTerminal(
  deckId: string,
  title?: string
): Promise<{ id: string; title: string }> {
  return request<{ id: string; title: string }>('/api/terminals', {
    method: HTTP_METHOD_POST,
    headers: { 'Content-Type': CONTENT_TYPE_JSON },
    body: JSON.stringify({ deckId, title })
  });
}

/**
 * Lists all terminals for a deck
 */
export function listTerminals(
  deckId: string
): Promise<{ id: string; title: string }[]> {
  const query = new URLSearchParams({ deckId });
  return request<{ id: string; title: string }[]>(
    `/api/terminals?${query.toString()}`
  );
}
