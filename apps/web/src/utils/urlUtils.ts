/**
 * URL and routing utilities
 */

type AppView = 'workspace' | 'terminal';
type WorkspaceMode = 'list' | 'editor';

export type UrlState = {
  view: AppView;
  workspaceId: string | null;
  deckId: string | null;
  workspaceMode: WorkspaceMode;
};

/**
 * Parses URL search parameters into application state
 */
export function parseUrlState(): UrlState {
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
}
