# デッキ一覧の編集・削除機能追加

## Context

ターミナルビューのデッキタブに右クリックコンテキストメニューを追加し、デッキの名前変更・ワークスペース変更・削除を行えるようにする。

既存の `.context-menu` / `.context-menu-item` CSSクラス（styles.css 958行目）と `ConfirmDialog` コンポーネントを再利用する。

## タスク

- [x] 1. バックエンドAPI: PATCH/DELETE エンドポイント追加
- [x] 2. フロントエンドAPIクライアント: updateDeck/deleteDeck 追加
- [x] 3. useDecks Hook: 更新・削除ハンドラ追加
- [x] 4. DeckEditModal コンポーネント作成
- [x] 5. App.tsx: 右クリックメニュー・モーダル統合

## 実装詳細

### 1. バックエンドAPI (`apps/server/src/routes/decks.ts`)

既存シグネチャ: `createDeckRouter(db, workspaces, decks)` — 変更不要

**追加するプリペアドステートメント**:
```
const updateDeckStmt = db.prepare('UPDATE decks SET name = ?, root = ?, workspace_id = ? WHERE id = ?');
const deleteDeckStmt = db.prepare('DELETE FROM decks WHERE id = ?');
const deleteTerminalsForDeck = db.prepare('DELETE FROM terminals WHERE deck_id = ?');
```

**PATCH /:id** - デッキ更新
- リクエストボディ: `{ name?: string, workspaceId?: string }`
- `decks.get(id)` で存在確認 → 404
- workspaceId 変更時: `requireWorkspace(workspaces, workspaceId)` で存在確認 → root を新 workspace.path に更新
- name が空文字の場合は既存の name を維持
- DB更新 + メモリMap更新
- 更新後のデッキオブジェクトを返却

**DELETE /:id** - デッキ削除
- `decks.get(id)` で存在確認 → 404
- カスケード削除順: `deleteTerminalsForDeck.run(id)` → `deleteDeckStmt.run(id)`
- `decks.delete(id)` でメモリMapから削除
- 204 No Content を返却

### 2. フロントエンドAPIクライアント (`apps/web/src/api.ts`)

既存の `createDeck` の後に追加:

```typescript
export function updateDeck(id, updates: { name?, workspaceId? }): Promise<Deck>
// PATCH /api/decks/:id

export function deleteDeck(id): Promise<void>
// DELETE /api/decks/:id
```

### 3. useDecks Hook (`apps/web/src/hooks/useDecks.ts`)

API関数を import に追加: `updateDeck as apiUpdateDeck, deleteDeck as apiDeleteDeck`

**handleUpdateDeck(id, updates)**:
- `apiUpdateDeck(id, updates)` 呼び出し
- 成功時: `setDecks(prev => prev.map(d => d.id === id ? updated : d))` でローカル更新
- エラー時: `setStatusMessage` でエラー表示
- 返却: 更新後の Deck | null

**handleDeleteDeck(id)**:
- `apiDeleteDeck(id)` 呼び出し
- 成功時:
  - `setDecks(prev => prev.filter(d => d.id !== id))`
  - `setActiveDeckIds(prev => prev.filter(id_ => id_ !== id))`
  - `setDeckStates` から該当エントリ削除
- エラー時: `setStatusMessage` でエラー表示
- 返却: boolean

### 4. DeckEditModal (`apps/web/src/components/DeckEditModal.tsx`) - 新規作成

DeckModal.tsx の構造をベースに編集用に拡張。

**Props**: `isOpen`, `deck: Deck | null`, `workspaces: Workspace[]`, `onSubmit(id, updates: { name?, workspaceId? })`, `onClose`

**フォーム構成**:
- modal-title: 「デッキ編集」
- field: 名前 input（初期値: deck.name）
- field: ワークスペース select（初期値: deck.workspaceId、DeckModal と同じ `<select>` パターン）
- modal-actions: キャンセル（ghost-button）+ 保存（primary-button）

**動作**:
- `useEffect([isOpen, deck])` でフォームの初期値をリセット（nameDraft, workspaceIdDraft）
- 変更なしの場合は API を呼ばず `onClose()` で閉じる
- Escape キーで閉じる

### 5. App.tsx (`apps/web/src/App.tsx`)

**import 追加**: `DeckEditModal`, `Deck` 型

**ステート追加**:
```typescript
const [deckContextMenu, setDeckContextMenu] = useState<{ deck: Deck; x: number; y: number } | null>(null);
const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
const [deletingDeck, setDeletingDeck] = useState<Deck | null>(null);
```

**useDecks から追加取得**: `handleUpdateDeck`, `handleDeleteDeck`

**ハンドラ**:

```
handleDeckTabContextMenu(e, deck):
  e.preventDefault(); e.stopPropagation();
  setDeckContextMenu({ deck, x: e.clientX, y: e.clientY });

handleSubmitEditDeck(id, updates):
  handleUpdateDeck → 成功時にモーダル閉じ

handleConfirmDeleteDeck():
  handleDeleteDeck → 成功時にダイアログ閉じ
```

**デッキタブへの右クリックイベント追加** (terminalView 内、既存の deck.map 部分):
```tsx
<button
  ...
  onContextMenu={(e) => handleDeckTabContextMenu(e, deck)}
>
```

**コンテキストメニュー描画** (terminalView 内または return 直前):
- 既存の `.context-menu` / `.context-menu-item` CSSクラスを使用（styles.css 958行目）
- `position: fixed; top: y; left: x;` で配置
- 外側クリック（useEffect + mousedown リスナー）で閉じる
- メニュー項目: 「編集」→ setEditingDeck、「削除」→ setDeletingDeck

**モーダル配置** (既存モーダル群の後):
- `<DeckEditModal>` — isOpen={editingDeck !== null}
- `<ConfirmDialog>` — isOpen={deletingDeck !== null}, title="デッキ削除"

**不要コードの削除**:
- `deckListItems` 変数（L132-136）— 現在どこにも使われていない死にコード

## エッジケース

| ケース | 対処 |
|--------|------|
| アクティブデッキを削除 | activeDeckIds からフィルタ。既存ロジックで残りのデッキが自動選択される |
| 全デッキ削除 | activeDeckIds が空 → 「デッキを作成してください。」の既存空状態表示 |
| ワークスペース変更 | サーバー側で root を新 workspace.path に更新。フロントは返却値で更新 |
| デッキ名空入力 | サーバー側で既存の name を維持 |

## 対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `apps/server/src/routes/decks.ts` | PATCH/DELETE エンドポイント追加 |
| `apps/web/src/api.ts` | updateDeck/deleteDeck 追加 |
| `apps/web/src/hooks/useDecks.ts` | handleUpdateDeck/handleDeleteDeck 追加 |
| `apps/web/src/components/DeckEditModal.tsx` | 新規作成 |
| `apps/web/src/App.tsx` | 右クリックメニュー・モーダル統合・死にコード削除 |

## 検証方法

1. `npm run dev` でサーバー+フロント起動
2. デッキタブを右クリック → コンテキストメニュー「編集」「削除」が表示される
3. 「編集」→ 名前変更 → 保存 → タブ名が更新される
4. 「編集」→ ワークスペース変更 → 保存 → 反映される
5. 「削除」→ 確認ダイアログ表示 → 削除 → タブから消える
6. アクティブデッキ削除 → 別デッキが自動選択される
7. playwright-debug スキルで2ステップデバッグ（スナップショット + スクリーンショット）
