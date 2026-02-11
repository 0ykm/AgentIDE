# デッキ内ターミナルレイアウト方向切り替え

## Context

デッキでターミナルを2つ表示する際、現在は常に横並び（cols=2, rows=1）になる。ユーザーが横並び/上下並びを選択できるようにする。設定はデッキごとにDB永続化する。

## 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `packages/shared/types.ts` | `TerminalLayout` 型と `Deck.terminalLayout` フィールド追加 |
| `apps/server/src/utils/database.ts` | decks テーブルに `terminal_layout` カラム追加 |
| `apps/server/src/routes/decks.ts` | Deck CRUD で `terminalLayout` を読み書き |
| `apps/web/src/components/TerminalPane.tsx` | `layout` prop を受け取りグリッド計算に反映 |
| `apps/web/src/App.tsx` | レイアウト切替ボタン追加、TerminalPane に layout 渡す |
| `apps/web/src/styles.css` | レイアウト切替ボタンのスタイル |

## タスク

- [x] 1. 型定義追加（shared）
- [x] 2. DBスキーマ・APIルート更新（server）
- [x] 3. TerminalPane にレイアウトprop追加（web）
- [x] 4. App.tsx にレイアウト切替UIとAPI呼び出し追加（web）
- [x] 5. スタイル追加（web）
- [x] 6. 動作確認

## 確認済み事項

- [x] レイアウト設定はデッキごとにDB永続化する
- [x] 適用範囲はターミナル2個のときだけ（3個以上は従来の正方形グリッド）
- [x] UIはデッキヘッダー内の既存ボタン横に配置

## 詳細

### 1. 型定義追加 — `packages/shared/types.ts`

```ts
export type TerminalLayout = 'horizontal' | 'vertical';
```

`Deck` インターフェースに追加:
```ts
terminalLayout: TerminalLayout;  // デフォルト: 'horizontal'
```

### 2. DBスキーマ・APIルート更新 — server

**`apps/server/src/utils/database.ts`:**
- `decks` テーブルに `terminal_layout TEXT NOT NULL DEFAULT 'horizontal'` カラムを `ALTER TABLE` で追加（既存DB互換）

**`apps/server/src/routes/decks.ts`:**
- `createDeck`: `terminalLayout: 'horizontal'` をデフォルトで設定、INSERT に含める
- `PATCH /:id`: `terminalLayout` の更新に対応
- GET レスポンス: `terminal_layout` → `terminalLayout` のマッピング

### 3. TerminalPane レイアウト反映 — `apps/web/src/components/TerminalPane.tsx`

- `TerminalPaneProps` に `layout: TerminalLayout` を追加
- `getOptimalGrid` を修正: ターミナル2個のとき `layout` に応じて切替
  - `horizontal`: `{ cols: 2, rows: 1 }`（現状通り）
  - `vertical`: `{ cols: 1, rows: 2 }`
- 3個以上の場合は既存の正方形ロジックを維持

### 4. レイアウト切替UI — `apps/web/src/App.tsx`

- `deck-split-header` の `deck-split-actions` 内にレイアウト切替ボタンを追加
  - ターミナルがちょうど2個の場合のみ表示
  - 横/縦のアイコン（SVG）で現在のレイアウトを表示
  - クリックでトグル → PATCH API でサーバーに保存 → ローカルの deck 状態も更新

### 5. スタイル

- `.layout-toggle-btn` — 既存の `topbar-btn-sm` を踏襲した小さなボタン

## 引き継ぎ事項

- 既存DBに `terminal_layout` カラムがない場合の `ALTER TABLE` による安全なマイグレーション
- `horizontal` をデフォルトとすることで既存デッキの動作は変わらない

## 検証方法

1. デッキにターミナルを2つ作成
2. レイアウト切替ボタンをクリック → 横/縦が切り替わることを確認
3. ページリロード後も設定が維持されることを確認
4. ターミナル3個以上では従来通り正方形グリッドになることを確認
