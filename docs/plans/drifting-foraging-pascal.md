# ワークスペース一覧の編集・削除機能追加

## Context

ワークスペース一覧には現在、名前とパスの表示および選択機能のみが存在する。ワークスペースの名前・パスの修正や不要なワークスペースの削除を行う手段がないため、ハンバーガーメニュー（ケバブメニュー）経由で編集・削除操作を行えるようにする。

## タスク

- [x] 1. バックエンドAPI: PATCH/DELETE エンドポイント追加
- [x] 2. フロントエンドAPIクライアント: updateWorkspace/deleteWorkspace 追加
- [x] 3. useWorkspaces Hook: 更新・削除ハンドラ追加
- [x] 4. useDecks Hook: ワークスペース削除時のデッキクリーンアップ
- [x] 5. ConfirmDialog コンポーネント作成（汎用確認ダイアログ）
- [x] 6. WorkspaceEditModal コンポーネント作成
- [x] 7. WorkspaceList コンポーネント: ケバブメニューUI追加
- [x] 8. CSS: メニューボタン・ドロップダウンのスタイル追加
- [x] 9. App.tsx: ステート管理・モーダル統合

## 実装詳細

### 1. バックエンドAPI (`apps/server/src/routes/workspaces.ts`)

**シグネチャ変更**: `createWorkspaceRouter` に `decks` 引数を追加（カスケード削除用）

```
createWorkspaceRouter(db, workspaces, workspacePathIndex, decks)
```

`apps/server/src/server.ts` 111行目の呼び出しも合わせて修正。

**PATCH /:id** - ワークスペース更新
- プリペアドステートメント: `UPDATE workspaces SET name = ?, path = ?, normalized_path = ? WHERE id = ?`
- name バリデーション: 既存の `validateName()` を再利用
- path 変更時: `normalizeWorkspacePath()` → `getWorkspaceKey()` → 重複チェック（自身除外）→ `workspacePathIndex` 更新
- 変更がない場合はそのまま返却

**DELETE /:id** - ワークスペース削除
- プリペアドステートメント: workspaces, decks, terminals の DELETE
- カスケード削除順: terminals → decks → workspace
- メモリ上の Map からも削除（workspaces, workspacePathIndex, decks）
- 204 No Content を返却

### 2. フロントエンドAPIクライアント (`apps/web/src/api.ts`)

```typescript
export function updateWorkspace(id, updates: { name?, path? }): Promise<Workspace>
// PATCH /api/workspaces/:id

export function deleteWorkspace(id): Promise<void>
// DELETE /api/workspaces/:id
```

### 3. useWorkspaces Hook (`apps/web/src/hooks/useWorkspaces.ts`)

**handleUpdateWorkspace(id, updates)**: API呼び出し → `setWorkspaces` でローカル更新
**handleDeleteWorkspace(id)**: API呼び出し → `setWorkspaces` からフィルタ → 選択中なら `setEditorWorkspaceId(null)` → `setWorkspaceStates` からエントリ削除

### 4. useDecks Hook (`apps/web/src/hooks/useDecks.ts`)

**removeDecksForWorkspace(workspaceId)** を追加:
- `setDecks` で該当 workspaceId のデッキを除外
- `setActiveDeckIds` から該当デッキIDを除外
- `setDeckStates` から該当エントリを削除

### 5. ConfirmDialog (`apps/web/src/components/ConfirmDialog.tsx`) - 新規作成

汎用確認ダイアログ。既存の `modal-backdrop` + `modal` パターンを使用。

Props: `isOpen`, `title`, `message`, `confirmLabel`(デフォルト: '削除'), `onConfirm`, `onCancel`

確認ボタンは `.danger-button`（styles.css 767行目に既存）を使用。Escキーで閉じる。

### 6. WorkspaceEditModal (`apps/web/src/components/WorkspaceEditModal.tsx`) - 新規作成

既存の `WorkspaceModal.tsx` をベースに拡張。名前フィールドを追加し、FileTreeブラウザによるパス選択UIを含める。

Props: `isOpen`, `workspace: Workspace | null`, `onSubmit(id, { name?, path? })`, `onClose`

フォーム構成:
- modal-title: 「ワークスペース編集」
- field: 名前 input（初期値: workspace.name）
- field: パス input（初期値: workspace.path、monospace）
- modal-explorer: FileTree（mode="navigator"）- WorkspaceModalと同じパターン
  - `previewFiles` APIでディレクトリ内容を表示
  - ディレクトリクリックでパスを遷移
  - 戻るボタン対応
- modal-actions: キャンセル（ghost-button）+ 保存（primary-button）

`isOpen` / `workspace` 変更時にフォームの初期値をリセット（名前・パス両方）。変更なしの場合はAPIを呼ばず閉じる。

**WorkspaceModal.tsx から再利用するロジック**: previewFiles取得、previewTree状態管理、handlePreviewToggleDir、handlePreviewBack、canPreviewBack算出

### 7. WorkspaceList (`apps/web/src/components/WorkspaceList.tsx`)

**Props追加**: `onEdit(workspace)`, `onDelete(workspace)`

**ケバブメニュー（⋮ 縦3点）**: 各 `workspace-item` の右上に配置。ホバー時のみ表示（opacity遷移）。

**WorkspaceItemMenu** サブコンポーネント（同ファイル内）:
- useState で開閉管理
- useRef + mousedown リスナーで外側クリック閉じ
- 既存 `.context-menu` / `.context-menu-item` CSSクラスを再利用
- メニュー項目: 「編集」「削除」（`.context-menu-item.delete`）

### 8. CSS (`apps/web/src/styles.css`)

Workspace & Deck Items セクション（1256行目付近）に追加:

- `.workspace-item` に `position: relative` を追記
- `.workspace-menu-container`: `position: absolute; top: 8px; right: 8px;`
- `.workspace-menu-btn`: 28x28px、transparent背景、ホバー時に表示（opacity 0→1）
- `.workspace-context-menu`: `.context-menu` を継承し `position: absolute; top: 100%; right: 0;`

### 9. App.tsx (`apps/web/src/App.tsx`)

**ステート追加**:
- `editingWorkspace: Workspace | null`
- `deletingWorkspace: Workspace | null`

**useWorkspaces から**: `handleUpdateWorkspace`, `handleDeleteWorkspace` を取得
**useDecks から**: `removeDecksForWorkspace` を取得

**ハンドラ**:
- `handleOpenEditWorkspace(workspace)`: `setEditingWorkspace(workspace)`
- `handleSubmitEditWorkspace(id, updates)`: `handleUpdateWorkspace` → 成功時にモーダル閉じ
- `handleOpenDeleteWorkspace(workspace)`: `setDeletingWorkspace(workspace)`
- `handleConfirmDeleteWorkspace()`: `handleDeleteWorkspace` → 成功時に `removeDecksForWorkspace` → ダイアログ閉じ

**WorkspaceList に props 追加**: `onEdit={handleOpenEditWorkspace}`, `onDelete={handleOpenDeleteWorkspace}`
**モーダル配置**: 他のモーダルと同じ位置に `WorkspaceEditModal` と `ConfirmDialog` を追加

## エッジケース

| ケース | 対処 |
|--------|------|
| 選択中のワークスペースを削除 | editorWorkspaceId を null にし、エディタビュー自動解除 |
| パス重複（409） | statusMessage にエラー表示 |
| 名前空入力 | サーバー側で元の名前を維持 |
| 関連デッキのカスケード | サーバー: DB+メモリ削除、フロント: removeDecksForWorkspace |

## 対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `apps/server/src/routes/workspaces.ts` | PATCH/DELETE エンドポイント追加 |
| `apps/server/src/server.ts` | createWorkspaceRouter 呼び出し修正 |
| `apps/web/src/api.ts` | updateWorkspace/deleteWorkspace 追加 |
| `apps/web/src/hooks/useWorkspaces.ts` | 更新・削除ハンドラ追加 |
| `apps/web/src/hooks/useDecks.ts` | removeDecksForWorkspace 追加 |
| `apps/web/src/components/ConfirmDialog.tsx` | 新規作成 |
| `apps/web/src/components/WorkspaceEditModal.tsx` | 新規作成 |
| `apps/web/src/components/WorkspaceList.tsx` | ケバブメニューUI追加 |
| `apps/web/src/styles.css` | メニューボタンCSS追加 |
| `apps/web/src/App.tsx` | ステート管理・モーダル統合 |

## 検証方法

1. `npm run dev` でサーバー+フロント起動
2. ワークスペース一覧でケバブメニュークリック → 「編集」「削除」が表示される
3. 「編集」→ 名前変更 → 保存 → 一覧に反映される
4. 「編集」→ パス変更 → 保存 → 一覧に反映される
5. 「削除」→ 確認ダイアログ表示 → 削除 → 一覧から消える
6. 選択中のワークスペース削除 → エディタビューが解除される
7. デッキを持つワークスペース削除 → デッキも削除される
