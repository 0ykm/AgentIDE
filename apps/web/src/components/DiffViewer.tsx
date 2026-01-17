import { DiffEditor } from '@monaco-editor/react';
import type { GitDiff } from '../types';
import { EDITOR_FONT_FAMILY, EDITOR_FONT_SIZE } from '../constants';

const LABEL_DIFF_VIEWER = '差分ビューア';
const LABEL_LOADING = '読み込み中...';
const LABEL_CLOSE = '閉じる';
const MONACO_THEME_DARK = 'vs-dark';
const MONACO_THEME_LIGHT = 'vs';

interface DiffViewerProps {
  diff: GitDiff | null;
  loading: boolean;
  theme: 'light' | 'dark';
  onClose: () => void;
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    graphql: 'graphql',
    dockerfile: 'dockerfile'
  };
  return languageMap[ext] || 'plaintext';
}

export function DiffViewer({ diff, loading, theme, onClose }: DiffViewerProps) {
  const language = diff ? getLanguageFromPath(diff.path) : 'plaintext';

  return (
    <div className="diff-viewer-overlay">
      <div className="diff-viewer-header">
        <div>
          <div className="diff-viewer-title">{LABEL_DIFF_VIEWER}</div>
          {diff && <div className="diff-viewer-path">{diff.path}</div>}
        </div>
        <button type="button" className="ghost-button" onClick={onClose}>
          {LABEL_CLOSE}
        </button>
      </div>
      <div className="diff-viewer-body">
        {loading ? (
          <div className="empty-state">{LABEL_LOADING}</div>
        ) : diff ? (
          <DiffEditor
            height="100%"
            theme={theme === 'dark' ? MONACO_THEME_DARK : MONACO_THEME_LIGHT}
            language={language}
            original={diff.original}
            modified={diff.modified}
            options={{
              fontFamily: EDITOR_FONT_FAMILY,
              fontSize: EDITOR_FONT_SIZE,
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              smoothScrolling: true
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
