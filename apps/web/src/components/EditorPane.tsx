import { useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { EditorFile } from '../types';
import { EDITOR_FONT_FAMILY, EDITOR_FONT_SIZE } from '../constants';

interface EditorPaneProps {
  files: EditorFile[];
  activeFileId: string | null;
  onSelectFile: (fileId: string) => void;
  onChangeFile: (fileId: string, contents: string) => void;
  onSaveFile?: (fileId: string) => void;
  savingFileId: string | null;
  theme: 'light' | 'dark';
}

const LABEL_EDITOR = 'エディタ';
const LABEL_SAVING = '保存中...';
const LABEL_SAVE = '保存';
const LABEL_EMPTY = 'ファイルを選択してください。';
const MONACO_THEME_DARK = 'vs-dark';
const MONACO_THEME_LIGHT = 'vs';

export function EditorPane({
  files,
  activeFileId,
  onSelectFile,
  onChangeFile,
  onSaveFile,
  savingFileId,
  theme
}: EditorPaneProps) {
  const activeFile = files.find((file) => file.id === activeFileId);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!activeFile) return;
      const isSave =
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's';
      if (!isSave) return;
      event.preventDefault();
      onSaveFile?.(activeFile.id);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, onSaveFile]);

  return (
    <section className="panel editor-pane">
      <div className="panel-header">
        <div>
          <div className="panel-title">{LABEL_EDITOR}</div>
          <div className="panel-subtitle">Monaco Editor</div>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="chip"
            onClick={() => activeFile && onSaveFile?.(activeFile.id)}
            disabled={!activeFile || savingFileId === activeFile.id}
          >
            {savingFileId === activeFile?.id ? LABEL_SAVING : LABEL_SAVE}
          </button>
          <div className="tab-strip">
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                className={`tab ${file.id === activeFileId ? 'is-active' : ''}`}
                onClick={() => onSelectFile(file.id)}
              >
                {file.name}
                {file.dirty ? ' *' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="panel-body editor-body">
        {activeFile ? (
          <Editor
            height="100%"
            theme={theme === 'dark' ? MONACO_THEME_DARK : MONACO_THEME_LIGHT}
            language={activeFile.language}
            value={activeFile.contents}
            onChange={(value) => onChangeFile(activeFile.id, value ?? '')}
            options={{
              fontFamily: EDITOR_FONT_FAMILY,
              fontSize: EDITOR_FONT_SIZE,
              minimap: { enabled: false },
              smoothScrolling: true
            }}
          />
        ) : (
          <div className="empty-state">{LABEL_EMPTY}</div>
        )}
      </div>
    </section>
  );
}
