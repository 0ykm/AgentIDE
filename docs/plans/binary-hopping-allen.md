# デッキ関連バグ修正プラン

## Context

ローカルとリモートの2つのデッキを作成・切り替えた際に複数の不具合が発生している：
1. リモートで名前指定なしでデッキを作ると名前衝突防止が効かず「Deck 1」になる
2. デッキタブでどのノードのデッキか区別がつかない
3. デッキを切り替えてもファイルツリー・Git状態がデッキのワークスペースに連動しない
4. リモートデッキに右クリックメニュー（編集・削除）がない

---

## タスク一覧

- [x] Task 1: デッキ切り替え時のワークスペースコンテキスト自動同期
- [x] Task 2: デッキ名の衝突回避（クライアントサイド名前生成）
- [x] Task 3: リモートデッキタブにノード名を表示
- [x] Task 4: リモートデッキの右クリックメニュー（編集・削除）追加
- [x] Task 5: デバッグ・動作確認

---

## Task 1: デッキ切り替え時のワークスペースコンテキスト自動同期（CRITICAL）

### 問題
`handleToggleDeck`（App.tsx:551）は`activeDeckIds`のみ更新し、`editorWorkspaceId`を更新しない。
`useActiveDeckContext`（App.tsx:116）が正しいワークスペースIDを計算しているが未使用。
結果：リモートデッキタブをクリックしてもファイルツリー・Gitはローカルのまま。

### 達成要件
- デッキ切替時に`editorWorkspaceId`がアクティブデッキの`workspaceId`に自動同期される
- ワークスペースステートが未初期化の場合は自動作成される

### 変更ファイル

**`apps/web/src/App.tsx`**

`activeDeckCtx`定義（行116-123）の直後に useEffect を追加：
```typescript
// Sync editorWorkspaceId when active deck changes
useEffect(() => {
  const wsId = activeDeckCtx.workspaceId;
  if (wsId && wsId !== editorWorkspaceId) {
    setEditorWorkspaceId(wsId);
    setWorkspaceMode('editor'); // 確定: WS一覧→エディタに自動切替
    // Ensure workspace state exists
    setWorkspaceStates((prev) => {
      if (prev[wsId]) return prev;
      return { ...prev, [wsId]: createEmptyWorkspaceState() };
    });
  }
}, [activeDeckCtx.workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps
```

### 設計判断（確定済み）
- WS一覧表示中にデッキ切替→エディタ表示に自動切替（ユーザー確認済み）
- `activeDeckCtx.workspaceId`のみを依存に指定（オブジェクト参照の安定性のため）
- ワークスペースリストでの手動選択（`handleSelectWorkspace`）はそのまま動作する（editorWorkspaceIdが直接setされるため）

---

## Task 2: デッキ名の衝突回避

### 問題
サーバー側は `name || "Deck ${decks.size + 1}"` で名前生成（`apps/server/src/routes/decks.ts:30`）。
各サーバーは自分のデッキ数しか知らないため、ローカル「Deck 1」とリモート「Deck 1」が同名になる。

### 達成要件
- 名前未入力時、ローカル＋リモート全デッキ名を考慮してユニーク名を生成する

### 変更ファイル

**`apps/web/src/App.tsx`** — `handleSubmitDeck`（行315-331）

```typescript
const handleSubmitDeck = useCallback(
  async (name: string, workspaceId: string) => {
    if (!workspaceId) {
      setStatusMessage(MESSAGE_SELECT_WORKSPACE);
      return;
    }
    // 名前が空の場合、全デッキを考慮してユニーク名を生成
    let resolvedName = name;
    if (!resolvedName) {
      const allNames = new Set([
        ...decks.map(d => d.name),
        ...remoteDecks.map(d => d.name)
      ]);
      let n = allNames.size + 1;
      while (allNames.has(`Deck ${n}`)) n++;
      resolvedName = `Deck ${n}`;
    }
    if (deckModalNodeId) {
      const deck = await createRemoteDeck(deckModalNodeId, resolvedName, workspaceId);
      if (deck) await refreshRemoteDecks();
    } else {
      await handleCreateDeck(resolvedName, workspaceId);
    }
    setIsDeckModalOpen(false);
    setDeckModalNodeId('');
  },
  [deckModalNodeId, createRemoteDeck, refreshRemoteDecks, handleCreateDeck, decks, remoteDecks]
);
```

依存配列に `decks`, `remoteDecks` を追加。

---

## Task 3: リモートデッキタブにノード名を表示

### 問題
リモートデッキタブには小さなティールドットのみ。同名デッキがある場合に区別不能。

### 達成要件
- リモートデッキタブにノード名ラベルが表示される
- デッキ分割ペインのヘッダーにもノード名が表示される

### 変更ファイル

**`apps/web/src/App.tsx`** — リモートデッキタブ（行759-770）

```tsx
{remoteDecks.map((deck) => (
  <button
    key={`${deck.nodeId}:${deck.id}`}
    type="button"
    className={`deck-tab ${activeDeckIds.includes(deck.id) ? 'active' : ''}`}
    onClick={(e) => handleToggleDeck(deck.id, e.shiftKey)}
    onContextMenu={(e) => handleRemoteDeckTabContextMenu(e, deck)}
    title={`[${deck.nodeName}] ${deck.root}\nShift+クリックで分割表示\n右クリックで編集・削除`}
  >
    <span className="deck-tab-node-dot" style={{ background: '#4ec9b0' }} />
    <span className="deck-tab-node-label">{deck.nodeName}</span>
    {deck.name}
  </button>
))}
```

**デッキ分割ペインヘッダー（行814-817）** にもノード名追加：
```tsx
<span className="deck-split-title">
  {isRemote && (
    <>
      <span className="deck-tab-node-dot" style={{ background: '#4ec9b0', display: 'inline-block', marginRight: 4, verticalAlign: 'middle' }} />
      <span className="deck-tab-node-label" style={{ display: 'inline', verticalAlign: 'middle' }}>{(deck as NodeDeck).nodeName}</span>
    </>
  )}
  {deck.name}
</span>
```

**オフラインノードのデッキタブ対応（行759-770）**：

`offlineNodeIds`を使ってオフラインノードのデッキタブをグレーアウト＋選択不可にする：
```tsx
{remoteDecks.map((deck) => {
  const isOffline = offlineNodeIds.has(deck.nodeId);
  return (
    <button
      key={`${deck.nodeId}:${deck.id}`}
      type="button"
      className={`deck-tab ${activeDeckIds.includes(deck.id) ? 'active' : ''} ${isOffline ? 'deck-tab-offline' : ''}`}
      onClick={(e) => !isOffline && handleToggleDeck(deck.id, e.shiftKey)}
      onContextMenu={(e) => !isOffline && handleRemoteDeckTabContextMenu(e, deck)}
      disabled={isOffline}
      title={isOffline
        ? `[${deck.nodeName}] オフライン`
        : `[${deck.nodeName}] ${deck.root}\nShift+クリックで分割表示\n右クリックで編集・削除`}
    >
      <span className="deck-tab-node-dot" style={{ background: isOffline ? '#888' : '#4ec9b0' }} />
      <span className="deck-tab-node-label">{deck.nodeName}</span>
      {deck.name}
    </button>
  );
})}
```

**`apps/web/src/styles.css`** にスタイル追加：
```css
.deck-tab-node-label {
  font-size: 10px;
  opacity: 0.7;
  margin-right: 4px;
  font-weight: 400;
}
.deck-tab.active .deck-tab-node-label {
  opacity: 0.85;
}
.deck-tab-offline {
  opacity: 0.4;
  cursor: not-allowed;
}
```

---

## Task 4: リモートデッキの右クリックメニュー（編集・削除）

### 問題
リモートデッキタブには`onContextMenu`ハンドラーがない。編集・削除ができない。

### 達成要件
- リモートデッキタブを右クリックで「編集」「削除」メニューが表示される
- 編集時はDeckEditModalを再利用（該当ノードのリモートWSリストを渡す）
- 削除時はConfirmDialogを再利用

### 変更ファイル

**`apps/web/src/remote-nodes/useRemoteDecks.ts`** — `updateRemoteDeck` を追加

UseRemoteDecksReturnに追加：
```typescript
updateRemoteDeck: (nodeId: string, deckId: string, updates: { name?: string; workspaceId?: string }) => Promise<Deck | null>;
```

実装（`deleteRemoteDeck`の後に追加）：
```typescript
const updateRemoteDeck = useCallback(
  async (nodeId: string, deckId: string, updates: { name?: string; workspaceId?: string }): Promise<Deck | null> => {
    const client = getNodeClient(nodeId);
    if (!client) return null;
    try {
      const updated = await client.updateDeck(deckId, updates);
      setRemoteDecks((prev) =>
        prev.map((d) => d.id === deckId && d.nodeId === nodeId ? { ...d, ...updated } : d)
      );
      return updated;
    } catch {
      return null;
    }
  },
  [getNodeClient]
);
```

returnオブジェクトに `updateRemoteDeck` を追加。

**`apps/web/src/App.tsx`** — 以下を追加：

A) useRemoteDecksのdestructureに `updateRemoteDeck`, `deleteRemoteDeck` を追加（行101）

B) ステート追加（行63付近）：
```typescript
const [remoteDeckContextMenu, setRemoteDeckContextMenu] = useState<{ deck: NodeDeck; x: number; y: number } | null>(null);
const [editingRemoteDeck, setEditingRemoteDeck] = useState<NodeDeck | null>(null);
const [deletingRemoteDeck, setDeletingRemoteDeck] = useState<NodeDeck | null>(null);
```

C) ハンドラー追加（handleDeckTabContextMenuの後に）：
```typescript
const handleRemoteDeckTabContextMenu = useCallback(
  (e: React.MouseEvent, deck: NodeDeck) => {
    e.preventDefault();
    e.stopPropagation();
    setRemoteDeckContextMenu({ deck, x: e.clientX, y: e.clientY });
  },
  []
);

const handleSubmitEditRemoteDeck = useCallback(
  async (id: string, updates: { name?: string; workspaceId?: string }) => {
    if (!editingRemoteDeck) return;
    const updated = await updateRemoteDeck(editingRemoteDeck.nodeId, id, updates);
    if (updated) setEditingRemoteDeck(null);
  },
  [editingRemoteDeck, updateRemoteDeck]
);

const handleConfirmDeleteRemoteDeck = useCallback(async () => {
  if (!deletingRemoteDeck) return;
  await deleteRemoteDeck(deletingRemoteDeck.nodeId, deletingRemoteDeck.id);
  setActiveDeckIds((prev) => prev.filter((id) => id !== deletingRemoteDeck.id));
  setDeletingRemoteDeck(null);
}, [deletingRemoteDeck, deleteRemoteDeck, setActiveDeckIds]);
```

D) outside click の useEffect（行509-519）を拡張：
- 条件に `remoteDeckContextMenu` を追加
- mousedownハンドラーで `setRemoteDeckContextMenu(null)` も呼ぶ

E) リモートデッキ用のモーダル/ダイアログ/コンテキストメニューUI追加（既存のdeckContextMenuの後に）：

```tsx
{/* リモートデッキのコンテキストメニュー */}
{remoteDeckContextMenu && (
  <div ref={deckContextMenuRef} className="context-menu"
    style={{ top: remoteDeckContextMenu.y, left: remoteDeckContextMenu.x }}>
    <button type="button" className="context-menu-item"
      onClick={() => { setEditingRemoteDeck(remoteDeckContextMenu.deck); setRemoteDeckContextMenu(null); }}>
      編集
    </button>
    <button type="button" className="context-menu-item delete"
      onClick={() => { setDeletingRemoteDeck(remoteDeckContextMenu.deck); setRemoteDeckContextMenu(null); }}>
      削除
    </button>
  </div>
)}

{/* リモートデッキ編集モーダル */}
<DeckEditModal
  isOpen={editingRemoteDeck !== null}
  deck={editingRemoteDeck}
  workspaces={editingRemoteDeck
    ? remoteWorkspaces.filter(ws => ws.nodeId === editingRemoteDeck.nodeId)
    : []}
  onSubmit={handleSubmitEditRemoteDeck}
  onClose={() => setEditingRemoteDeck(null)}
/>

{/* リモートデッキ削除確認 */}
<ConfirmDialog
  isOpen={deletingRemoteDeck !== null}
  title="リモートデッキ削除"
  message={`「${deletingRemoteDeck?.name ?? ''}」(${deletingRemoteDeck?.nodeName ?? ''})を削除しますか？関連するターミナルも削除されます。`}
  confirmLabel="削除"
  onConfirm={handleConfirmDeleteRemoteDeck}
  onCancel={() => setDeletingRemoteDeck(null)}
/>
```

---

## Task 5: デバッグ・動作確認

### 確認項目
- [x] ローカルデッキ「Deck 1」作成後、リモートで名前なしデッキを作ると「Deck 2」になる
- [x] リモートデッキタブにノード名が表示される
- [x] ローカルデッキ→リモートデッキ切替でファイルツリーがリモートWSに連動する
- [x] リモートデッキ→ローカルデッキ切替でファイルツリーがローカルWSに戻る
- [x] リモートデッキタブ右クリックで「編集」「削除」メニューが表示される
- [x] リモートデッキの編集（名前変更）が動作する
- [x] リモートデッキの削除ダイアログが正しく表示される
- [ ] スプリットビュー（ローカル＋リモート並列）でターミナルが正しく表示される（※別途確認）
- [ ] オフラインノードのデッキタブがグレーアウトして選択不可になる（※オフラインノードが必要）

### デバッグ中に発見・修正した追加の問題
- useDecksのactiveDeckIdsバリデーション効果がリモートデッキIDを不正として除外していた
  - 修正: `remoteDeckIds`パラメータを追加し、リモートデッキIDもバリデーションで有効として扱う
  - フック呼び出し順序を変更: useNodes/useRemoteDecks → useDecks の順に

---

## 引き継ぎ事項

### 既存パターンの再利用
- `deckContextMenu`のステート・ハンドラー・UIパターン → `remoteDeckContextMenu`にコピー
- `DeckEditModal` → リモートデッキ編集に再利用（workspacesにリモートWSを渡す）
- `ConfirmDialog` → リモートデッキ削除に再利用
- `updateRemoteDeck` → `deleteRemoteDeck`と同じパターンで追加

### スプリットビュー時の挙動
- `editorWorkspaceId`は`activeDeckIds[0]`のWSに同期
- スプリットビューで異なるノードのデッキが並ぶ場合、ファイルツリーは最初のデッキのWSを表示
- 各ペインのターミナルは既にデッキごとに正しいノードに接続されている（App.tsx:807-810）

### サーバー側変更
不要。クライアントサイドのみの修正。
