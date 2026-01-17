// Re-export shared types from @deck-ide/shared
export type {
  FileEntryType,
  Workspace,
  Deck,
  FileSystemEntry,
  FileTreeNode,
  EditorFile,
  TerminalSession,
  WorkspaceState,
  DeckState,
  ApiError,
  ApiConfig,
  ApiFileResponse,
  ApiFileSaveResponse,
  ApiTerminalCreateResponse,
  CreateWorkspaceRequest,
  CreateDeckRequest,
  CreateTerminalRequest,
  SaveFileRequest,
  GetFileRequest,
  GetFilesRequest,
  GetPreviewRequest
} from '@deck-ide/shared/types';

export type AppView = 'workspace' | 'terminal';
export type WorkspaceMode = 'list' | 'editor';
export type ThemeMode = 'light' | 'dark';

export interface UrlState {
  view: AppView;
  workspaceId: string | null;
  deckId: string | null;
  workspaceMode: WorkspaceMode;
}

export interface DeckListItem {
  id: string;
  name: string;
  path: string;
}
