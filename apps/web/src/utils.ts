import type { FileSystemEntry, FileTreeNode, WorkspaceState, DeckState, UrlState, WorkspaceMode, ThemeMode } from './types';

export const DEFAULT_ROOT_FALLBACK = import.meta.env.VITE_DEFAULT_ROOT || '';
export const SAVED_MESSAGE = '\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002';

export const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'shell',
  ps1: 'powershell',
  py: 'python',
  go: 'go',
  rs: 'rust'
};

export const createEmptyWorkspaceState = (): WorkspaceState => ({
  files: [],
  activeFileId: null,
  tree: [],
  treeLoading: false,
  treeError: null
});

export const createEmptyDeckState = (): DeckState => ({
  terminals: [],
  activeTerminalId: null,
  terminalsLoaded: false
});

export const toTreeNodes = (entries: FileSystemEntry[]): FileTreeNode[] =>
  entries.map((entry) => ({
    ...entry,
    expanded: false,
    loading: false,
    children: entry.type === 'dir' ? [] : undefined
  }));

export const getLanguageFromPath = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase();
  return LANGUAGE_BY_EXTENSION[extension] || 'plaintext';
};

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const normalizeWorkspacePath = (value: string): string =>
  value
    .trim()
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLowerCase();

export const getPathSeparator = (value: string): string =>
  value.includes('\\') ? '\\' : '/';

export const joinPath = (base: string, next: string): string => {
  const separator = getPathSeparator(base);
  const trimmed = base.replace(/[\\/]+$/, '');
  return trimmed ? `${trimmed}${separator}${next}` : next;
};

export const getParentPath = (value: string): string => {
  const trimmed = value.replace(/[\\/]+$/, '');
  if (!trimmed) return value;
  if (/^[A-Za-z]:$/.test(trimmed)) {
    return `${trimmed}\\`;
  }
  if (trimmed === '/') {
    return '/';
  }
  const lastSlash = Math.max(
    trimmed.lastIndexOf('/'),
    trimmed.lastIndexOf('\\')
  );
  if (trimmed.startsWith('/') && lastSlash === 0) {
    return '/';
  }
  if (lastSlash <= 0) {
    return trimmed;
  }
  const parent = trimmed.slice(0, lastSlash);
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}\\`;
  }
  return parent;
};

export const parseUrlState = (): UrlState => {
  if (typeof window === 'undefined') {
    return {
      view: 'terminal',
      workspaceId: null,
      deckId: null,
      workspaceMode: 'list'
    };
  }
  const params = new URLSearchParams(window.location.search);
  const viewParam = params.get('view');
  const modeParam = params.get('mode');
  return {
    view: viewParam === 'workspace' ? 'workspace' : 'terminal',
    workspaceId: params.get('workspace'),
    deckId: params.get('deck'),
    workspaceMode: modeParam === 'editor' ? 'editor' : 'list'
  };
};

export const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }
  const stored = window.localStorage.getItem('deck-theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};
