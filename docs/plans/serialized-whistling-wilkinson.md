# デッキグループ機能 実装プラン

## Context

デッキ新規作成時にactiveDeckIdsに自動追加されるため2デッキが横並びになるが、作成時以外にこのレイアウトを再現する手段がない（Shift+クリックは一時的）。2つのデッキをグループ化し、1タブクリックで左右分割レイアウトを復元できる機能を実装する。

**確定仕様**:
- 作成方法: デッキタブ右クリック → 「グループ作成」→ もう1つのデッキを選択
- タブ表示: 1つのタブとして表示（例: 「Deck 1 | Deck 4」）
- 永続化: DBに保存
- デッキ数: **2つ固定**（左右分割のみ）
- ワークスペース: **異なるWSのデッキ同士も可** → グループにworkspaceIdは持たない

## タスクチェックリスト

- [x] タスク1: shared型定義の追加
- [x] タスク2: DB スキーマ + loadDeckGroups
- [x] タスク3: バックエンドAPIルーター（deckGroups.ts）
- [x] タスク4: decks.ts にデッキ削除時のグループクリーンアップ追加
- [x] タスク5: server.ts への統合
- [x] タスク6: フロントエンドAPIクライアント（api.ts）
- [x] タスク7: useDeckGroups フック
- [x] タスク8: DeckGroupCreateModal コンポーネント
- [x] タスク9: DeckGroupEditModal コンポーネント
- [x] タスク10: App.tsx への統合（タブ描画・コンテキストメニュー・ハンドラ・モーダル配置）
- [x] タスク11: urlUtils.ts に groupId パラメータ追加
- [x] タスク12: CSS スタイリング
- [ ] タスク13: playwright-debug で動作確認

## 達成要件

- グループタブをクリックすると、含まれる2つのデッキが `activeDeckIds` にセットされ横並び表示
- 個別デッキタブクリック時はグループ選択が解除される
- グループ内のデッキが削除されたらグループ自体を自動削除（2固定のため片方欠けたら成立しない）
- グループの編集（名前変更・デッキ入れ替え）と削除が右クリックメニューから可能
- ブラウザリロード後もグループが保持される（DB永続化 + URL state）

## エッジケース

| ケース | 対処 |
|--------|------|
| グループ内デッキ削除 | サーバー側: decks.ts DELETEでそのデッキを含むグループを自動削除 |
| 1デッキが複数グループ所属 | 許可（制約なし） |
| グループ選択中にデッキ個別クリック | activeGroupId をnullにリセット |
| グループ名未入力 | デッキ名を「 \| 」結合で自動生成 |
| ワークスペース削除 | デッキ削除のカスケードで自動的にグループも削除される |

---

## タスク詳細

### タスク1: shared型定義の追加

**ファイル**: `packages/shared/types.ts`

`Deck` インターフェースの後に追加:

```ts
export interface DeckGroup {
  id: string;
  name: string;
  deckIds: [string, string];  // 常に2つのデッキID（左, 右）
  createdAt: string;
}
```

**ファイル**: `apps/web/src/types.ts` — re-exportに `DeckGroup` 追加
**ファイル**: `apps/server/src/types.ts` — re-exportに `DeckGroup` 追加

※ `workspaceId` はグループに持たない（異なるWS可のため）

---

### タスク2: DBスキーマ + loadDeckGroups

**ファイル**: `apps/server/src/utils/database.ts`

`initializeDatabase` 内にテーブル追加:

```sql
CREATE TABLE IF NOT EXISTS deck_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  deck_ids TEXT NOT NULL,       -- JSON配列 '["uuid1","uuid2"]'
  created_at TEXT NOT NULL
);
```

`loadDeckGroups(db, decks)` 関数を追加:
- DBからグループ読み込み
- 無効デッキIDを持つグループは自動削除（2固定のためどちらか無効→グループ削除）
- `Map<string, DeckGroup>` を返却

---

### タスク3: バックエンドAPIルーター

**新規ファイル**: `apps/server/src/routes/deckGroups.ts`

既存 `decks.ts` のパターンに従い作成:

```
createDeckGroupRouter(db, decks, deckGroups)
```

| Method | Endpoint | 内容 |
|--------|----------|------|
| GET | `/api/deck-groups` | 全グループ一覧 |
| POST | `/api/deck-groups` | グループ作成（deckIds: 正確に2個、存在チェック） |
| PATCH | `/api/deck-groups/:id` | 名前・デッキ構成更新 |
| DELETE | `/api/deck-groups/:id` | グループ削除 |

名前未指定時のデフォルト: `decks.get(deckIds[0]).name + ' | ' + decks.get(deckIds[1]).name`

※ `workspaces` は不要（グループにworkspaceIdがないため）

---

### タスク4: decks.ts にグループクリーンアップ追加

**ファイル**: `apps/server/src/routes/decks.ts`

- `createDeckRouter` シグネチャに `deckGroups: Map<string, DeckGroup>` 追加
- `DELETE /:id` ハンドラ末尾: 削除デッキを含むグループを全削除（2固定のため片方欠けたら成立しない）

---

### タスク5: server.ts への統合

**ファイル**: `apps/server/src/server.ts`

- `import { createDeckGroupRouter }` と `import { loadDeckGroups }` 追加
- `loadDeckGroups(db, decks)` 呼び出し追加
- `app.route('/api/deck-groups', createDeckGroupRouter(db, decks, deckGroups))`
- `createDeckRouter` に `deckGroups` を渡す

---

### タスク6: フロントエンドAPIクライアント

**ファイル**: `apps/web/src/api.ts`

4関数追加:
- `listDeckGroups(): Promise<DeckGroup[]>`
- `createDeckGroup(name: string, deckIds: [string, string]): Promise<DeckGroup>`
- `updateDeckGroup(id: string, updates: { name?: string; deckIds?: [string, string] }): Promise<DeckGroup>`
- `deleteDeckGroup(id: string): Promise<void>`

---

### タスク7: useDeckGroups フック

**新規ファイル**: `apps/web/src/hooks/useDeckGroups.ts`

既存 `useDecks.ts` パターンに従う:
- 初期ロード（listDeckGroups）
- decks変更時のローカルフィルタリング（片方でも消えたグループはフィルタ）
- CRUD ハンドラ: `handleCreateDeckGroup`, `handleUpdateDeckGroup`, `handleDeleteDeckGroup`

※ `removeGroupsForWorkspace` は不要（デッキ削除のカスケードで対応）

---

### タスク8: DeckGroupCreateModal

**新規ファイル**: `apps/web/src/components/DeckGroupCreateModal.tsx`

既存 `DeckModal.tsx` パターンに従う。

Props: `isOpen`, `initialDeck`（右クリック元）, `decks`, `onSubmit`, `onClose`

UXフロー:
1. 右クリック元デッキが「デッキ1」として表示（固定、変更不可）
2. 残りの全デッキをドロップダウンで「デッキ2」として選択
3. グループ名入力欄（任意、デフォルト: 「Deck 1 | Deck 4」のように自動生成）
4. 「作成」ボタンで送信

---

### タスク9: DeckGroupEditModal

**新規ファイル**: `apps/web/src/components/DeckGroupEditModal.tsx`

`DeckEditModal.tsx` パターンに従う。

- グループ名変更
- デッキ1/デッキ2 をドロップダウンで変更可能

---

### タスク10: App.tsx への統合

**ファイル**: `apps/web/src/App.tsx`

**追加ステート**:
- `activeGroupId: string | null` — 現在選択中のグループ
- `groupCreateInitialDeck: Deck | null` — グループ作成モーダル用
- `editingDeckGroup / deletingDeckGroup` — 編集・削除用
- `groupContextMenu` — グループタブ右クリック用

**useDeckGroups フック呼び出し**

**デッキタブ右クリックメニュー拡張**（既存743行目付近）:
- 「グループ作成」項目追加（区切り線で分離、既存の「編集」「削除」の上に配置）

**タブバー変更**（560行目付近）:
- 個別デッキタブの後に区切り線 + グループタブを描画
- グループタブは `.deck-tab-group` クラスで視覚的に区別
- グループタブにも右クリックメニュー（編集・削除）

**handleToggleGroup ハンドラ**:
- クリック → `setActiveGroupId(groupId)` + `setActiveDeckIds(group.deckIds)`
- 再クリック → 解除して最初のデッキのみ表示

**handleToggleDeck 修正**:
- 個別デッキクリック時に `setActiveGroupId(null)` 追加

**モーダル配置**: DeckGroupCreateModal, DeckGroupEditModal, ConfirmDialog（グループ削除用）

---

### タスク11: urlUtils.ts に groupId パラメータ追加

**ファイル**: `apps/web/src/utils/urlUtils.ts`

- `UrlState` に `groupId: string | null` 追加
- `parseUrlState` で `params.get('group')` パース
- App.tsx URL sync effectで `activeGroupId` をURLに反映
- popstateハンドラにも対応

URL例: `?view=terminal&decks=uuid1,uuid2&group=group-uuid`

---

### タスク12: CSSスタイリング

**ファイル**: `apps/web/src/styles.css`

- `.deck-tab-separator` — デッキタブとグループタブ間の縦区切り線
- `.deck-tab-group` — 破線ボーダー + 左に2枚重ねアイコンで視覚的に区別
- `.deck-tab-group.active` — アクセントカラー実線ボーダー

---

### タスク13: 動作確認

playwright-debug スキルで以下を確認:
- グループ作成 → タブ表示 → クリックで2デッキ横並び
- グループ編集（名前変更）
- グループ削除
- デッキ削除時のグループ自動削除
- ブラウザリロード後のグループ保持

---

## コミット単位

1. `feat: add deck group backend (type, DB, API)` — タスク1~5
2. `feat: add deck group frontend state management` — タスク6~7
3. `feat: add deck group UI (modals, tabs, context menu)` — タスク8~12
4. チェックリスト更新

## 修正ファイル一覧

| ファイル | 種別 |
|---------|------|
| `packages/shared/types.ts` | 修正 |
| `apps/server/src/types.ts` | 修正 |
| `apps/web/src/types.ts` | 修正 |
| `apps/server/src/utils/database.ts` | 修正 |
| `apps/server/src/routes/deckGroups.ts` | **新規** |
| `apps/server/src/routes/decks.ts` | 修正 |
| `apps/server/src/server.ts` | 修正 |
| `apps/web/src/api.ts` | 修正 |
| `apps/web/src/hooks/useDeckGroups.ts` | **新規** |
| `apps/web/src/components/DeckGroupCreateModal.tsx` | **新規** |
| `apps/web/src/components/DeckGroupEditModal.tsx` | **新規** |
| `apps/web/src/utils/urlUtils.ts` | 修正 |
| `apps/web/src/App.tsx` | 修正 |
| `apps/web/src/styles.css` | 修正 |

## 引き継ぎメモ

- 既存の `DeckModal.tsx`, `DeckEditModal.tsx`, コンテキストメニューパターンを踏襲する
- `deck_ids` はJSON文字列としてSQLiteに格納（常に2要素）
- `createDeckRouter` のシグネチャ変更により `server.ts` の呼び出し側も修正必要
- グループタブのアクティブ判定は `activeGroupId` で行い、個別デッキの `activeDeckIds.includes` とは独立
- グループに `workspaceId` は不要（異なるWSデッキ可のため）。ワークスペース削除時はデッキ削除→カスケードでグループ削除
