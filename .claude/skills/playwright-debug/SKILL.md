---
name: playwright-debug
description: |
  playwright-cli を使用してブラウザ操作によるUI機能のデバッグ・検証を行うスキル。
  This skill should be used when the user asks to "ブラウザで確認", "UIを確認", "画面確認", "playwright-cli", "動作確認", "表示確認", "E2Eテスト", "ブラウザテスト", "画面テスト", "UIデバッグ", "画面が崩れている", "表示がおかしい", "見た目を確認", "スクリーンショット撮って".
  Also activate when the user asks to verify UI changes after implementation, or when debugging visual/functional issues in the web frontend.
  Requires `mise exec -- playwright-cli` to be available (configured in .mise.toml).
---

# Playwright CLI Debug - ブラウザ操作によるUIデバッグスキル

`mise exec -- playwright-cli` を使用して、ブラウザを自動操作しながらUI機能の検証とデバッグを行う。

## 前提条件

- `.mise.toml` に `"npm:@playwright/cli" = "latest"` が設定済みであること
- 開発サーバーが起動済みであること（`npm run dev` 等）
- `.gitignore` に `.playwright-cli/` が含まれていること

---

## 2ステップデバッグ手法

UI変更を伴う改修時には、以下の2ステップで検証を行う。**必ず両方のステップを実施すること。**

### Step 1: 機能検証（スナップショット）

`snapshot` コマンドでアクセシビリティツリーを取得し、要素の存在・構造・操作結果を検証する。

**検出できるもの:**
- 要素の存在確認（ボタン、入力フィールド、メニュー項目等）
- DOM構造の正しさ
- テキスト内容の確認
- インタラクション後の状態変化

**検出できないもの:**
- CSSによる表示崩れ（overflow切れ、z-index問題）
- レイアウトの位置ずれ
- 要素の重なり・隠れ

### Step 2: 視覚検証（スクリーンショット）

`screenshot` コマンドでビューポートの画像を取得し、視覚的な表示崩れを検証する。

**検出できるもの:**
- overflow による要素の見切れ
- z-index によるメニュー等の隠れ
- レイアウト崩れ、位置ずれ
- スタイル適用漏れ

> **実例**: ドロップダウンメニューが `position: absolute` で親要素の `overflow: auto` により見切れていた問題は、Step 1のスナップショットでは「編集」「削除」の両方が存在していたが、Step 2のスクリーンショットで初めて「削除」が視覚的に隠れていることを検出できた。

---

## 基本ワークフロー

> コマンドの詳細は **`references/commands.md`** を参照。

以下のワークフローでは、Step 2（スナップショット）と Step 4（スクリーンショット）が上記の2ステップデバッグに対応する。

### 1. ブラウザ起動

```bash
mise exec -- playwright-cli open <URL>
```

headless Chrome が起動し、指定URLを読み込む。初回のスナップショットとコンソールエラーが出力される。

### 2. ページ状態の確認

```bash
mise exec -- playwright-cli snapshot
```

`.playwright-cli/page-{timestamp}.yml` にアクセシビリティツリーが保存される。Read ツールで内容を確認し、要素の `ref` IDを取得する。

### 3. 要素の操作

```bash
# クリック
mise exec -- playwright-cli click <ref>

# テキスト入力（フィールドをクリアして入力）
mise exec -- playwright-cli fill <ref> <text>

# ホバー
mise exec -- playwright-cli hover <ref>

# キー入力
mise exec -- playwright-cli press Escape
```

各操作後に自動でスナップショットが生成される。

### 4. 視覚確認

```bash
# ビューポート全体のスクリーンショット
mise exec -- playwright-cli screenshot

# 特定要素のスクリーンショット
mise exec -- playwright-cli screenshot <ref>
```

`.playwright-cli/page-{timestamp}.png` に保存される。Read ツールで画像を確認。

### 5. ブラウザ終了

```bash
mise exec -- playwright-cli close
```

---

## 検証パターン

### モーダル/ダイアログの検証

1. トリガー要素をクリック → snapshot でモーダルの存在確認
2. フォームフィールドの初期値確認
3. 入力 → 送信 → snapshot で結果確認
4. **screenshot でモーダルの表示位置・レイアウト確認**

### ドロップダウンメニューの検証

1. メニューボタンをクリック → snapshot で項目の存在確認
2. **screenshot でメニューが見切れていないか確認**（overflow問題の検出）
3. 各メニュー項目をクリック → 動作確認

### CRUD操作の検証

1. 一覧表示の初期状態を snapshot で確認
2. 作成 → 一覧に反映されたか確認
3. 編集 → 値が変わったか確認
4. 削除 → 確認ダイアログ → 一覧から消えたか確認
5. サーバーAPI（curl）で永続化確認

---

## 出力ファイルの読み取り

### スナップショット (.yml)

```
# コマンド出力からファイルパスを取得
### Snapshot
- [Snapshot](.playwright-cli\page-{timestamp}.yml)
```

Read ツールでYAMLを読み、要素の ref ID やテキスト内容を確認する。Grep で特定要素を検索可能。

### スクリーンショット (.png)

```
### Result
- [Screenshot of viewport](.playwright-cli\page-{timestamp}.png)
```

Read ツールで画像を確認する（マルチモーダル対応）。

### コンソールログ (.log)

```
### Events
- New console entries: .playwright-cli\console-{timestamp}.log
```

エラーの有無を確認。favicon.ico の 404 等は無害。

---

## 注意事項

- 全コマンドは `mise exec -- playwright-cli` プレフィックスで実行する
- `click` や `fill` の引数は ref ID（例: `e38`）で指定する。文字列での指定は不可
- ref ID はスナップショットごとに変わる可能性がある。操作後は新しいスナップショットの ref を使用する
- テストデータの作成・クリーンアップはAPIを直接呼ぶ（curl）方が効率的
- `.playwright-cli/` ディレクトリは `.gitignore` に含まれているため、出力ファイルはコミット対象外

## 追加リソース

### リファレンスファイル

- **`references/commands.md`** - playwright-cli の全コマンドリファレンス
