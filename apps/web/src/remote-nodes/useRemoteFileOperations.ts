import { useCallback, useState } from 'react';
import type { EditorFile, FileTreeNode, WorkspaceState } from '../types';
import { NodeApiClient } from './NodeApiClient';
import { getErrorMessage, getLanguageFromPath, toTreeNodes } from '../utils';
import { MESSAGE_SAVED } from '../constants';

// API timeout wrapper
const withTimeout = <T>(promise: Promise<T>, timeoutMs = 15000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    )
  ]);
};

interface UseRemoteFileOperationsProps {
  nodeClient: NodeApiClient | null;
  workspaceId: string | null;
  workspaceState: WorkspaceState;
  updateWorkspaceState: (wsId: string, updater: (state: WorkspaceState) => WorkspaceState) => void;
  setStatusMessage: (msg: string) => void;
}

export const useRemoteFileOperations = ({
  nodeClient,
  workspaceId,
  workspaceState,
  updateWorkspaceState,
  setStatusMessage
}: UseRemoteFileOperationsProps) => {
  const [savingFileId, setSavingFileId] = useState<string | null>(null);

  const updateTreeNode = useCallback(
    (
      nodes: FileTreeNode[],
      targetPath: string,
      updater: (node: FileTreeNode) => FileTreeNode
    ): FileTreeNode[] =>
      nodes.map((node) => {
        if (node.path === targetPath) {
          return updater(node);
        }
        if (node.children) {
          return {
            ...node,
            children: updateTreeNode(node.children, targetPath, updater)
          };
        }
        return node;
      }),
    []
  );

  const handleRefreshTree = useCallback(() => {
    if (!workspaceId || !nodeClient) return;
    updateWorkspaceState(workspaceId, (state) => ({
      ...state,
      treeLoading: true,
      treeError: null
    }));
    withTimeout(nodeClient.listFiles(workspaceId, ''))
      .then((entries) => {
        updateWorkspaceState(workspaceId, (state) => ({
          ...state,
          tree: toTreeNodes(entries),
          treeLoading: false
        }));
      })
      .catch((error: unknown) => {
        updateWorkspaceState(workspaceId, (state) => ({
          ...state,
          treeLoading: false,
          treeError: getErrorMessage(error)
        }));
      });
  }, [workspaceId, nodeClient, updateWorkspaceState]);

  const handleToggleDir = useCallback(
    (node: FileTreeNode) => {
      if (!workspaceId || !nodeClient || node.type !== 'dir') return;
      if (node.expanded) {
        updateWorkspaceState(workspaceId, (state) => ({
          ...state,
          tree: updateTreeNode(state.tree, node.path, (item) => ({
            ...item,
            expanded: false
          }))
        }));
        return;
      }
      if (node.children && node.children.length > 0) {
        updateWorkspaceState(workspaceId, (state) => ({
          ...state,
          tree: updateTreeNode(state.tree, node.path, (item) => ({
            ...item,
            expanded: true
          }))
        }));
        return;
      }

      updateWorkspaceState(workspaceId, (state) => ({
        ...state,
        tree: updateTreeNode(state.tree, node.path, (item) => ({
          ...item,
          loading: true
        }))
      }));
      withTimeout(nodeClient.listFiles(workspaceId, node.path))
        .then((entries) => {
          updateWorkspaceState(workspaceId, (state) => ({
            ...state,
            tree: updateTreeNode(state.tree, node.path, (item) => ({
              ...item,
              expanded: true,
              loading: false,
              children: toTreeNodes(entries)
            }))
          }));
        })
        .catch((error: unknown) => {
          updateWorkspaceState(workspaceId, (state) => ({
            ...state,
            treeError: getErrorMessage(error),
            tree: updateTreeNode(state.tree, node.path, (item) => ({
              ...item,
              loading: false
            }))
          }));
        });
    },
    [workspaceId, nodeClient, updateWorkspaceState, updateTreeNode]
  );

  const handleOpenFile = useCallback(
    (entry: FileTreeNode) => {
      if (!workspaceId || !nodeClient || entry.type !== 'file') return;
      const existing = workspaceState.files.find(
        (file) => file.path === entry.path
      );
      if (existing) {
        updateWorkspaceState(workspaceId, (state) => ({
          ...state,
          activeFileId: existing.id
        }));
        return;
      }

      const tempFileId = crypto.randomUUID();
      const tempFile: EditorFile = {
        id: tempFileId,
        name: entry.name,
        path: entry.path,
        language: getLanguageFromPath(entry.path),
        contents: '',
        dirty: false
      };
      updateWorkspaceState(workspaceId, (state) => ({
        ...state,
        files: [...state.files, { ...tempFile, contents: '読み込み中...' }],
        activeFileId: tempFileId
      }));

      withTimeout(nodeClient.readFile(workspaceId, entry.path))
        .then((data) => {
          updateWorkspaceState(workspaceId, (state) => ({
            ...state,
            files: state.files.map((f) =>
              f.id === tempFileId
                ? { ...f, contents: data.contents }
                : f
            )
          }));
        })
        .catch((error: unknown) => {
          updateWorkspaceState(workspaceId, (state) => ({
            ...state,
            files: state.files.filter((f) => f.id !== tempFileId),
            activeFileId: state.files.length > 1 ? state.files[0].id : null
          }));
          setStatusMessage(
            `ファイルを開けませんでした: ${getErrorMessage(error)}`
          );
        });
    },
    [workspaceId, nodeClient, workspaceState.files, updateWorkspaceState, setStatusMessage]
  );

  const handleFileChange = useCallback(
    (fileId: string, contents: string) => {
      if (!workspaceId) return;
      updateWorkspaceState(workspaceId, (state) => ({
        ...state,
        files: state.files.map((file) =>
          file.id === fileId ? { ...file, contents, dirty: true } : file
        )
      }));
    },
    [workspaceId, updateWorkspaceState]
  );

  const handleSaveFile = useCallback(
    async (fileId: string) => {
      if (!workspaceId || !nodeClient) return;
      const file = workspaceState.files.find((item) => item.id === fileId);
      if (!file) return;
      setSavingFileId(fileId);
      try {
        await withTimeout(nodeClient.writeFile(workspaceId, file.path, file.contents));
        updateWorkspaceState(workspaceId, (state) => ({
          ...state,
          files: state.files.map((item) =>
            item.id === fileId ? { ...item, dirty: false } : item
          )
        }));
        setStatusMessage(MESSAGE_SAVED);
      } catch (error: unknown) {
        setStatusMessage(
          `保存に失敗しました: ${getErrorMessage(error)}`
        );
      } finally {
        setSavingFileId(null);
      }
    },
    [workspaceId, nodeClient, workspaceState.files, updateWorkspaceState, setStatusMessage]
  );

  const handleCloseFile = useCallback(
    (fileId: string) => {
      if (!workspaceId) return;
      updateWorkspaceState(workspaceId, (state) => {
        const fileIndex = state.files.findIndex((f) => f.id === fileId);
        const newFiles = state.files.filter((f) => f.id !== fileId);
        let newActiveFileId = state.activeFileId;

        if (state.activeFileId === fileId) {
          if (newFiles.length === 0) {
            newActiveFileId = null;
          } else if (fileIndex >= newFiles.length) {
            newActiveFileId = newFiles[newFiles.length - 1].id;
          } else {
            newActiveFileId = newFiles[fileIndex].id;
          }
        }

        return {
          ...state,
          files: newFiles,
          activeFileId: newActiveFileId
        };
      });
    },
    [workspaceId, updateWorkspaceState]
  );

  // Helper to remove a node from tree
  const removeTreeNode = useCallback(
    (nodes: FileTreeNode[], targetPath: string): FileTreeNode[] =>
      nodes.filter((node) => {
        if (node.path === targetPath) {
          return false;
        }
        if (node.children) {
          node.children = removeTreeNode(node.children, targetPath);
        }
        return true;
      }),
    []
  );

  // Helper to add a node to tree
  const addTreeNode = useCallback(
    (nodes: FileTreeNode[], parentPath: string, newNode: FileTreeNode): FileTreeNode[] => {
      if (!parentPath) {
        const updated = [...nodes, newNode];
        return updated.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      }
      return nodes.map((node) => {
        if (node.path === parentPath && node.type === 'dir') {
          const children = node.children || [];
          const updated = [...children, newNode].sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          return { ...node, children: updated, expanded: true };
        }
        if (node.children) {
          return { ...node, children: addTreeNode(node.children, parentPath, newNode) };
        }
        return node;
      });
    },
    []
  );

  const handleCreateFile = useCallback(
    async (parentPath: string, fileName: string) => {
      if (!workspaceId || !nodeClient) return;
      const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;
      try {
        await withTimeout(nodeClient.createFile(workspaceId, filePath));
        const newNode: FileTreeNode = {
          name: fileName,
          path: filePath,
          type: 'file',
          expanded: false,
          loading: false
        };
        updateWorkspaceState(workspaceId, (state) => ({
          ...state,
          tree: addTreeNode(state.tree, parentPath, newNode)
        }));
        setStatusMessage(`ファイルを作成しました: ${fileName}`);
      } catch (error: unknown) {
        setStatusMessage(`ファイル作成に失敗しました: ${getErrorMessage(error)}`);
      }
    },
    [workspaceId, nodeClient, updateWorkspaceState, setStatusMessage, addTreeNode]
  );

  const handleCreateDirectory = useCallback(
    async (parentPath: string, dirName: string) => {
      if (!workspaceId || !nodeClient) return;
      const dirPath = parentPath ? `${parentPath}/${dirName}` : dirName;
      try {
        await withTimeout(nodeClient.createDirectory(workspaceId, dirPath));
        const newNode: FileTreeNode = {
          name: dirName,
          path: dirPath,
          type: 'dir',
          expanded: false,
          loading: false,
          children: []
        };
        updateWorkspaceState(workspaceId, (state) => ({
          ...state,
          tree: addTreeNode(state.tree, parentPath, newNode)
        }));
        setStatusMessage(`フォルダを作成しました: ${dirName}`);
      } catch (error: unknown) {
        setStatusMessage(`フォルダ作成に失敗しました: ${getErrorMessage(error)}`);
      }
    },
    [workspaceId, nodeClient, updateWorkspaceState, setStatusMessage, addTreeNode]
  );

  const handleDeleteFile = useCallback(
    async (filePath: string) => {
      if (!workspaceId || !nodeClient) return;
      try {
        await withTimeout(nodeClient.deleteFile(workspaceId, filePath));
        updateWorkspaceState(workspaceId, (state) => {
          const newFiles = state.files.filter((f) => f.path !== filePath);
          let newActiveFileId = state.activeFileId;
          const deletedFile = state.files.find((f) => f.path === filePath);
          if (deletedFile && state.activeFileId === deletedFile.id) {
            newActiveFileId = newFiles.length > 0 ? newFiles[0].id : null;
          }
          return {
            ...state,
            files: newFiles,
            activeFileId: newActiveFileId,
            tree: removeTreeNode(state.tree, filePath)
          };
        });
        setStatusMessage(`ファイルを削除しました`);
      } catch (error: unknown) {
        setStatusMessage(`ファイル削除に失敗しました: ${getErrorMessage(error)}`);
      }
    },
    [workspaceId, nodeClient, updateWorkspaceState, setStatusMessage, removeTreeNode]
  );

  const handleDeleteDirectory = useCallback(
    async (dirPath: string) => {
      if (!workspaceId || !nodeClient) return;
      try {
        await withTimeout(nodeClient.deleteDirectory(workspaceId, dirPath));
        updateWorkspaceState(workspaceId, (state) => {
          const newFiles = state.files.filter(
            (f) => !f.path.startsWith(dirPath + '/') && f.path !== dirPath
          );
          let newActiveFileId = state.activeFileId;
          const activeFile = state.files.find((f) => f.id === state.activeFileId);
          if (activeFile && (activeFile.path.startsWith(dirPath + '/') || activeFile.path === dirPath)) {
            newActiveFileId = newFiles.length > 0 ? newFiles[0].id : null;
          }
          return {
            ...state,
            files: newFiles,
            activeFileId: newActiveFileId,
            tree: removeTreeNode(state.tree, dirPath)
          };
        });
        setStatusMessage(`フォルダを削除しました`);
      } catch (error: unknown) {
        setStatusMessage(`フォルダ削除に失敗しました: ${getErrorMessage(error)}`);
      }
    },
    [workspaceId, nodeClient, updateWorkspaceState, setStatusMessage, removeTreeNode]
  );

  return {
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
  };
};
