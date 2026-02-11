# リモートワークスペース機能 フルスペック実装プラン

## Context

ノードを追加してもワークスペース一覧にリモートWSが表示されない問題への対応。
バックエンド基盤（`NodeApiClient`、`useRemoteWorkspaces`、`useRemoteFileOperations`、`useRemoteGitState`）は実装済みだが、UIへの統合が未実施。
`useRemoteDecks`の成功パターンを踏襲し、リモートWSをフロントエンドに完全統合する。

### 確定要件
- **一覧表示**: ノード別セクション分離（Local / Node-A / Node-B ...）
- **操作体験**: 完全統一（ファイルツリー・エディタ・Gitはローカルと同じUI）
- **WS取得**: ノード接続時に自動取得＋手動追加作成も可能
- **Deck連携**: DeckModalでノード選択→そのノードのWSがドロップダウンに表示
- **オフライン時**: グレーアウト＋ステータス表示（選択不可）

---

## タスク一覧

- [x] Task 1: NodeWorkspace型にnodeName追加 + NodeApiClient.updateWorkspace追加
- [x] Task 2: useRemoteWorkspacesをuseRemoteDecksパターンに書き換え
- [x] Task 3: WorkspaceListにノード別セクション分離表示＋オフライン対応
- [x] Task 4: App.tsxにuseRemoteWorkspaces統合
- [x] Task 5: ファイル操作・Git操作のローカル/リモート条件切替
- [x] Task 6: DeckModalにremoteWorkspaces連携
- [x] Task 7: WorkspaceModalにノード選択追加（リモートWS作成）
- [x] Task 8: WS編集・削除のリモート対応
- [x] Task 9: デバッグ・動作確認

---

## Task 1: 型拡張 + NodeApiClient修正

### 達成要件
- NodeWorkspaceにnodeNameフィールドが追加されている
- NodeApiClient.updateWorkspace()が追加されている

### 変更ファイル

**`apps/web/src/remote-nodes/useRemoteWorkspaces.ts` (行5-7)**
```typescript
export interface NodeWorkspace extends Workspace {
  nodeId: string;
  nodeName: string;  // 追加
}
```

**`apps/web/src/remote-nodes/NodeApiClient.ts` (行119の後に追加)**
```typescript
updateWorkspace(id: string, updates: { name?: string; path?: string }): Promise<Workspace> {
  return this.request<Workspace>(`/api/workspaces/${id}`, {
    method: HTTP_METHOD_PATCH,
    headers: { 'Content-Type': CONTENT_TYPE_JSON },
    body: JSON.stringify(updates)
  });
}
```
- `updateDeck`(行141-150)と同じパターン。サーバー側APIは既存のPATCH `/api/workspaces/:id`をそのまま利用。

**NodeApiClient.previewFilesも追加** (WorkspaceModal用):
```typescript
previewFiles(rootPath: string, subpath = ''): Promise<FileSystemEntry[]> {
  const query = new URLSearchParams({ path: rootPath, subpath });
  return this.request<FileSystemEntry[]>(`/api/preview?${query.toString()}`);
}
```
- サーバーの既存`GET /api/preview`エンドポイント(`apps/server/src/routes/files.ts` 行46)を利用

---

## Task 2: useRemoteWorkspaces書き換え

### 達成要件
- useRemoteDecks(行21-60)と同じパターンでフラットなremoteWorkspaces配列を返す
- refreshRemoteWorkspaces()で全オンラインノードから一括取得する
- create/deleteでローカルステート即時反映する

### 変更ファイル

**`apps/web/src/remote-nodes/useRemoteWorkspaces.ts` (全体書き換え)**

引数を`useRemoteDecks`に合わせて変更:
```typescript
export function useRemoteWorkspaces(
  onlineRemoteNodes: RemoteNodeWithStatus[],  // 変更: getNodeClient→onlineRemoteNodes追加
  getNodeClient: (nodeId: string) => NodeApiClient | null
): UseRemoteWorkspacesReturn
```

返り値:
```typescript
export interface UseRemoteWorkspacesReturn {
  remoteWorkspaces: NodeWorkspace[];        // フラット配列
  loading: boolean;
  refreshRemoteWorkspaces: () => Promise<void>;
  createRemoteWorkspace: (nodeId: string, path: string) => Promise<Workspace | null>;
  deleteRemoteWorkspace: (nodeId: string, workspaceId: string) => Promise<void>;
  updateRemoteWorkspace: (nodeId: string, wsId: string, updates: { name?: string; path?: string }) => Promise<Workspace | null>;
}
```

- `cachedWorkspaces`(Map)は削除し、`remoteWorkspaces: NodeWorkspace[]`に統一
- `getWorkspacesForNode()`は削除（refreshで全ノード一括取得）
- `refreshRemoteWorkspaces`は`useRemoteDecks.refreshRemoteDecks`(行28-60)を模倣
- `createRemoteWorkspace`/`deleteRemoteWorkspace`は`setRemoteWorkspaces`をフラット配列で更新
- `updateRemoteWorkspace`を新規追加（Task 1のNodeApiClient.updateWorkspaceを使用）

**参照テンプレート**: `apps/web/src/remote-nodes/useRemoteDecks.ts` 行28-60

---

## Task 3: WorkspaceListにセクション分離表示＋オフライン対応

### 達成要件
- ローカルWSとリモートWSがノード別セクションに分かれて表示される
- オフラインノードのWSはグレーアウト＋「オフライン」バッジ表示＋選択不可
- リモートWSにはノードステータスドット(緑/グレー)が付く

### 変更ファイル

**`apps/web/src/components/WorkspaceList.tsx`**

Props拡張:
```typescript
interface WorkspaceListProps {
  workspaces: Workspace[];
  remoteWorkspaces?: NodeWorkspace[];       // 追加
  offlineNodeIds?: Set<string>;             // 追加
  selectedWorkspaceId: string | null;
  onSelect: (workspaceId: string) => void;
  onEdit: (workspace: Workspace) => void;
  onDelete: (workspace: Workspace) => void;
}
```

レンダリング構造:
```
<section className="panel workspace-panel">
  <panel-header>ワークスペース</panel-header>
  <panel-body>
    {/* ローカルセクション */}
    <div className="workspace-section">
      <div className="workspace-section-header">Local</div>
      {workspaces.map(...)}  // 既存WorkspaceItem
    </div>

    {/* リモートセクション（ノード別グループ） */}
    {nodeGroups.map(({ nodeId, nodeName, workspaces, isOffline }) => (
      <div className={`workspace-section ${isOffline ? 'offline' : ''}`}>
        <div className="workspace-section-header">
          <span className="node-dot" style={{ background: isOffline ? '#888' : '#4ec9b0' }} />
          {nodeName}
          {isOffline && <span className="offline-badge">オフライン</span>}
        </div>
        {workspaces.map(ws => (
          <WorkspaceItem disabled={isOffline} ... />
        ))}
        {workspaces.length === 0 && <div className="empty-state">WSなし</div>}
      </div>
    ))}
  </panel-body>
</section>
```

`nodeGroups`はremoteWorkspacesをnodeIdでグルーピングし、offlineNodeIdsで判定:
```typescript
const nodeGroups = useMemo(() => {
  if (!remoteWorkspaces?.length) return [];
  const grouped = new Map<string, { nodeName: string; workspaces: NodeWorkspace[] }>();
  for (const ws of remoteWorkspaces) {
    const group = grouped.get(ws.nodeId) || { nodeName: ws.nodeName, workspaces: [] };
    group.workspaces.push(ws);
    grouped.set(ws.nodeId, group);
  }
  return Array.from(grouped.entries()).map(([nodeId, { nodeName, workspaces }]) => ({
    nodeId, nodeName, workspaces, isOffline: offlineNodeIds?.has(nodeId) ?? false
  }));
}, [remoteWorkspaces, offlineNodeIds]);
```

**CSS追加**（既存のワークスペース関連CSSファイル内）:
- `.workspace-section` `.workspace-section-header` のスタイル
- `.offline` 配下の `.workspace-item` に `opacity: 0.5; pointer-events: none;`
- `.offline-badge` のスタイル
- `.node-dot` (リモートデッキタブの `.deck-tab-node-dot` と同様)

---

## Task 4: App.tsxにuseRemoteWorkspaces統合

### 達成要件
- App.tsxでuseRemoteWorkspacesが呼ばれている
- オンラインノード変化時にリモートWSが自動取得される
- activeWorkspaceがリモートWSも含めて解決される

### 変更ファイル

**`apps/web/src/App.tsx`**

#### 4a. import追加 (行30付近)
```typescript
import { useNodes, useRemoteDecks, useRemoteWorkspaces, useActiveDeckContext } from './remote-nodes';
import type { NodeDeck, NodeWorkspace } from './remote-nodes';
```

#### 4b. useRemoteWorkspaces呼び出し (行100の直後)
```typescript
const { remoteWorkspaces, refreshRemoteWorkspaces, createRemoteWorkspace, deleteRemoteWorkspace, updateRemoteWorkspace } =
  useRemoteWorkspaces(onlineRemoteNodes, getNodeClient);

useEffect(() => {
  if (onlineRemoteNodes.length > 0) {
    refreshRemoteWorkspaces();
  }
}, [onlineRemoteNodes.length]); // eslint-disable-line react-hooks/exhaustive-deps
```

#### 4c. activeWorkspace拡張 (行123-127)
```typescript
const activeWorkspace =
  workspaces.find((ws) => ws.id === editorWorkspaceId) ||
  remoteWorkspaces.find((ws) => ws.id === editorWorkspaceId) ||
  null;

const activeRemoteWorkspace = activeWorkspace && 'nodeId' in activeWorkspace
  ? (activeWorkspace as NodeWorkspace)
  : null;
const isRemoteWorkspace = activeRemoteWorkspace !== null;
const activeNodeClient = activeRemoteWorkspace
  ? getNodeClient(activeRemoteWorkspace.nodeId)
  : null;
```

#### 4d. offlineNodeIds memo追加
```typescript
const offlineNodeIds = useMemo(
  () => new Set(nodes.filter(n => n.status !== 'online' && !n.isLocal).map(n => n.id)),
  [nodes]
);
```

#### 4e. WorkspaceList呼び出し変更 (行651-657)
```typescript
<WorkspaceList
  workspaces={workspaces}
  remoteWorkspaces={remoteWorkspaces}
  offlineNodeIds={offlineNodeIds}
  selectedWorkspaceId={editorWorkspaceId}
  onSelect={handleSelectWorkspace}
  onEdit={handleOpenEditWorkspace}
  onDelete={handleOpenDeleteWorkspace}
/>
```

#### 4f. handleSelectWorkspace拡張 (行310-316)
リモートWSの選択時にワークスペースステートを初期化:
```typescript
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
```

---

## Task 5: ファイル操作・Git操作の条件切替

### 達成要件
- isRemoteWorkspaceフラグに基づき、ローカル/リモートのファイル操作・Git操作が自動切替される
- UIコンポーネント（FileTree, EditorPane, SourceControl）は変更不要

### 変更ファイル

**`apps/web/src/App.tsx` (行129-166)**

両方のフックを常に呼び出し（Reactのhooksルール遵守）、返り値を条件選択:

```typescript
// ローカルファイル操作（既存）
const localFileOps = useFileOperations({
  editorWorkspaceId: isRemoteWorkspace ? null : editorWorkspaceId,
  activeWorkspaceState,
  updateWorkspaceState,
  setStatusMessage
});

// リモートファイル操作（新規追加）
const remoteFileOps = useRemoteFileOperations({
  nodeClient: activeNodeClient,
  workspaceId: isRemoteWorkspace ? editorWorkspaceId : null,
  workspaceState: activeWorkspaceState,
  updateWorkspaceState,
  setStatusMessage
});

const { savingFileId, handleRefreshTree, handleToggleDir, handleOpenFile,
  handleFileChange, handleSaveFile, handleCloseFile, handleCreateFile,
  handleCreateDirectory, handleDeleteFile, handleDeleteDirectory
} = isRemoteWorkspace ? remoteFileOps : localFileOps;
```

Git操作も同様:
```typescript
// ローカルGit（既存）
const localGitOps = useGitState(
  isRemoteWorkspace ? null : editorWorkspaceId, setStatusMessage
);

// リモートGit（新規追加）
const remoteGitOps = useRemoteGitState(
  activeNodeClient,
  isRemoteWorkspace ? editorWorkspaceId : null,
  setStatusMessage
);

const { gitState, refreshGitStatus, handleSelectRepo, handleStageFile, ... } =
  isRemoteWorkspace ? remoteGitOps : localGitOps;
```

**import追加**:
```typescript
import { useRemoteFileOperations, useRemoteGitState } from './remote-nodes';
```

### 引き継ぎ事項
- `useRemoteFileOperations`は`useFileOperations`と同じ返り値型を持つ（確認済み）
- `useRemoteGitState`も`useGitState`と同じ返り値構造（確認済み）
- `editorWorkspaceId`にnullを渡すことでフックを「無効化」するパターンが安全

---

## Task 6: DeckModalにremoteWorkspaces連携

### 達成要件
- DeckModalでノードを選択すると、そのノードのWSがドロップダウンに表示される
- リモートノード上のDeck作成が可能

### 変更ファイル

**`apps/web/src/App.tsx`**

ステート追加:
```typescript
const [deckModalNodeId, setDeckModalNodeId] = useState<string>('');
```

リモートWS抽出:
```typescript
const deckModalRemoteWorkspaces = useMemo(
  () => deckModalNodeId ? remoteWorkspaces.filter(ws => ws.nodeId === deckModalNodeId) : undefined,
  [deckModalNodeId, remoteWorkspaces]
);
```

DeckModal呼び出し変更 (行862-868):
```typescript
<DeckModal
  isOpen={isDeckModalOpen}
  workspaces={workspaces}
  nodes={[localNode, ...nodes]}
  remoteWorkspaces={deckModalRemoteWorkspaces}
  onNodeChange={setDeckModalNodeId}
  onSubmit={handleSubmitDeck}
  onClose={() => { setIsDeckModalOpen(false); setDeckModalNodeId(''); }}
/>
```

handleSubmitDeck拡張（既存のhandleSubmitDeckを修正）:
```typescript
const handleSubmitDeck = useCallback(
  async (name: string, workspaceId: string) => {
    if (deckModalNodeId) {
      const deck = await createRemoteDeck(deckModalNodeId, name, workspaceId);
      if (deck) await refreshRemoteDecks();
    } else {
      await handleCreateDeck(name, workspaceId);
    }
    setIsDeckModalOpen(false);
    setDeckModalNodeId('');
  },
  [deckModalNodeId, createRemoteDeck, refreshRemoteDecks, handleCreateDeck]
);
```

**`apps/web/src/components/DeckModal.tsx`** → 既存実装がそのまま動作（行28: `displayWorkspaces`ロジック、行65-82: ノード選択が既にある）。変更不要。

---

## Task 7: WorkspaceModalにノード選択追加＋リモートプレビュー対応

### 達成要件
- ワークスペース追加モーダルでノード選択が可能
- ローカル選択時は既存動作（`previewFiles` API）
- リモート選択時は`NodeApiClient.listFiles`でファイルツリープレビューを表示
- リモートWSの作成が可能

### 変更ファイル

**`apps/web/src/components/WorkspaceModal.tsx`**

Props拡張:
```typescript
interface WorkspaceModalProps {
  isOpen: boolean;
  defaultRoot: string;
  nodes?: RemoteNodeWithStatus[];    // 追加
  getNodeClient?: (nodeId: string) => NodeApiClient | null;  // 追加（プレビュー用）
  onSubmit: (path: string, nodeId?: string) => Promise<void>;  // nodeId追加
  onClose: () => void;
}
```

コンポーネント内:
- `selectedNodeId`ステート追加
- DeckModal(行65-82)と同じノードセレクターUIを追加
- ファイルツリープレビューのデータ取得ロジック分岐:
  - ローカル（selectedNodeId === ''）: 既存の`previewFiles(previewRoot, '')`をそのまま使用
  - リモート（selectedNodeId !== ''）: `getNodeClient(selectedNodeId)?.listFiles('__preview__', previewRoot)`等に切替
    ※注: リモートプレビューはWSが未作成の状態なのでworkspaceId不要のpreview用APIが必要か、
    または一旦WSを作成せずにlistFilesの代替としてNodeApiClientに`previewFiles(path)`を追加する
- リモートプレビューの実装方針: NodeApiClientに`previewFiles(rootPath, subpath)`メソッドを追加し、
  サーバーの既存`GET /api/preview?path=&subpath=`エンドポイントを利用する
  （`apps/server/src/routes/files.ts` 行46。ワークスペース不要の汎用ファイル一覧API）

**`apps/web/src/App.tsx`**

handleSubmitWorkspace拡張 (行326-334):
```typescript
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
      if (created) setIsWorkspaceModalOpen(false);
    }
  },
  [handleCreateWorkspace, createRemoteWorkspace, refreshRemoteWorkspaces]
);
```

WorkspaceModal呼び出し変更 (行856-861):
```typescript
<WorkspaceModal
  isOpen={isWorkspaceModalOpen}
  defaultRoot={defaultRoot}
  nodes={[localNode, ...nodes]}
  onSubmit={handleSubmitWorkspace}
  onClose={() => setIsWorkspaceModalOpen(false)}
/>
```

---

## Task 8: WS編集・削除のリモート対応

### 達成要件
- リモートWSの編集（名前変更）・削除が可能
- 既存のWorkspaceEditModal、ConfirmDialogをそのまま再利用

### 変更ファイル

**`apps/web/src/App.tsx`**

handleSubmitEditWorkspace拡張 (行340-348):
```typescript
const handleSubmitEditWorkspace = useCallback(
  async (id: string, updates: { name?: string; path?: string }) => {
    const remoteWs = remoteWorkspaces.find(ws => ws.id === id);
    if (remoteWs) {
      const result = await updateRemoteWorkspace(remoteWs.nodeId, id, updates);
      if (result) setEditingWorkspace(null);
    } else {
      const updated = await handleUpdateWorkspace(id, updates);
      if (updated) setEditingWorkspace(null);
    }
  },
  [handleUpdateWorkspace, remoteWorkspaces, updateRemoteWorkspace]
);
```

handleConfirmDeleteWorkspace拡張 (行354-361):
```typescript
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
```

---

## Task 9: デバッグ・動作確認

### 確認項目
- [ ] ノード追加後、WS一覧にリモートWSがノード別セクションで表示される
- [ ] オフラインノードのWSがグレーアウト表示される
- [ ] リモートWSを選択してファイルツリーが表示される
- [ ] リモートWSのファイルをエディタで開き、編集・保存できる
- [ ] リモートWSのGitステータスが表示され、stage/commit/push操作ができる
- [ ] DeckModalでリモートノード選択→そのノードのWSがドロップダウンに出る→Deck作成
- [ ] WorkspaceModalでリモートノード選択→パス入力→WS作成
- [ ] リモートWSの名前編集・削除ができる
- [ ] ノードがオフラインになった時にWSがグレーアウトする

### デバッグ方法
- `skill: playwright-debug` を使用してブラウザ上での動作確認

---

## 引き継ぎ事項

### オフライン時の挙動（確定）
- WS一覧: オフラインノードのWSはグレーアウト＋「オフライン」バッジ（Task 3）
- エディタ操作中の切断: 個別API呼び出し失敗時に`setStatusMessage`でエラー表示。未保存の編集内容はエディタに保持される（既存の`useRemoteFileOperations`/`useRemoteGitState`のエラーハンドリングパターンをそのまま利用）
- オーバーレイやブロックUIは不要

### Reactフックルール
Task 5で`useFileOperations`と`useRemoteFileOperations`の両方を常に呼び出す必要がある。`editorWorkspaceId`にnullを渡して無効化するパターンを使用。

### ワークスペースID一意性
ローカルWSとリモートWSでUUID衝突の可能性は理論上あるが極めて低い。現時点では対応不要。将来的に問題が出た場合は`${nodeId}:${workspaceId}`の複合キー化を検討。

### サーバー側変更
不要。NodeApiClientが既にすべてのAPI呼び出しメソッドを持っており、リモートノードのサーバーは既存のエンドポイントをそのまま公開している。

### 既存パターンの再利用
- `useRemoteDecks`(行21-60) → `useRemoteWorkspaces`書き換えのテンプレート
- `DeckModal`(行65-82) → `WorkspaceModal`のノード選択UIテンプレート
- `deck-tab-node-dot` → ワークスペースセクションのノードドットスタイルのテンプレート
