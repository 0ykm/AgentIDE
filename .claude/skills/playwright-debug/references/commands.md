# playwright-cli コマンドリファレンス

`mise exec -- playwright-cli <command> [args] [options]` の形式で実行する。

## コア操作

| コマンド | 説明 | 例 |
|---------|------|-----|
| `open [url]` | ブラウザを開く | `open http://localhost:5173` |
| `close` | ブラウザを閉じる | `close` |
| `goto <url>` | URLに遷移 | `goto http://localhost:5173/settings` |
| `snapshot` | アクセシビリティツリーを取得（ref ID付き） | `snapshot` |
| `screenshot [ref]` | スクリーンショットを取得 | `screenshot` / `screenshot e38` |

## インタラクション

| コマンド | 説明 | 例 |
|---------|------|-----|
| `click <ref> [button]` | 要素をクリック | `click e38` |
| `dblclick <ref>` | ダブルクリック | `dblclick e38` |
| `fill <ref> <text>` | 入力フィールドをクリアして入力 | `fill e47 "テスト"` |
| `type <text>` | 編集可能要素にテキスト入力 | `type "hello"` |
| `hover <ref>` | 要素にホバー | `hover e38` |
| `select <ref> <val>` | ドロップダウンで選択 | `select e50 "option1"` |
| `check <ref>` | チェックボックスをチェック | `check e60` |
| `uncheck <ref>` | チェックボックスを外す | `uncheck e60` |
| `drag <startRef> <endRef>` | ドラッグ＆ドロップ | `drag e10 e20` |
| `upload <file>` | ファイルアップロード | `upload ./test.png` |

## ナビゲーション

| コマンド | 説明 |
|---------|------|
| `go-back` | 前のページに戻る |
| `go-forward` | 次のページに進む |
| `reload` | ページをリロード |

## キーボード

| コマンド | 説明 | 例 |
|---------|------|-----|
| `press <key>` | キーを押す | `press Escape` / `press Enter` |
| `keydown <key>` | キーを押し下げる | `keydown Shift` |
| `keyup <key>` | キーを離す | `keyup Shift` |

## マウス

| コマンド | 説明 | 例 |
|---------|------|-----|
| `mousemove <x> <y>` | マウスを移動 | `mousemove 100 200` |
| `mousedown [button]` | マウスボタンを押す | `mousedown` |
| `mouseup [button]` | マウスボタンを離す | `mouseup` |
| `mousewheel <dx> <dy>` | スクロール | `mousewheel 0 -100` |

## 保存

| コマンド | 説明 |
|---------|------|
| `screenshot [ref]` | ビューポートまたは要素のスクリーンショット |
| `pdf` | ページをPDFとして保存 |

## タブ

| コマンド | 説明 | 例 |
|---------|------|-----|
| `tab-list` | タブ一覧 | `tab-list` |
| `tab-new [url]` | 新しいタブ | `tab-new http://localhost:5173` |
| `tab-close [index]` | タブを閉じる | `tab-close 1` |
| `tab-select <index>` | タブを選択 | `tab-select 0` |

## ストレージ

| コマンド | 説明 |
|---------|------|
| `cookie-list` | Cookie一覧 |
| `cookie-get <name>` | Cookie取得 |
| `cookie-set <name> <value>` | Cookie設定 |
| `cookie-delete <name>` | Cookie削除 |
| `cookie-clear` | 全Cookie削除 |
| `localstorage-list` | localStorage一覧 |
| `localstorage-get <key>` | localStorage取得 |
| `localstorage-set <key> <value>` | localStorage設定 |
| `sessionstorage-list` | sessionStorage一覧 |

## DevTools

| コマンド | 説明 |
|---------|------|
| `console [min-level]` | コンソールメッセージ一覧 |
| `network` | ネットワークリクエスト一覧 |
| `run-code <code>` | Playwright コードスニペット実行 |
| `eval <func> [ref]` | JavaScript式を評価 |

## ネットワーク

| コマンド | 説明 | 例 |
|---------|------|-----|
| `route <pattern>` | リクエストをモック | `route "**/api/**"` |
| `route-list` | アクティブなルート一覧 | `route-list` |
| `unroute [pattern]` | ルートを削除 | `unroute` |

## セッション管理

| コマンド | 説明 |
|---------|------|
| `list` | ブラウザセッション一覧 |
| `close-all` | 全セッション閉じる |
| `kill-all` | 全セッション強制終了 |
| `state-save [filename]` | 認証状態を保存 |
| `state-load <filename>` | 認証状態を読み込み |

## グローバルオプション

| オプション | 説明 |
|-----------|------|
| `--help [command]` | ヘルプ表示 |
| `--version` | バージョン表示 |
| `-s=<session>` | セッション指定 |

## 出力ファイルの保存先

全ての出力ファイルは `.playwright-cli/` ディレクトリに保存される:

- スナップショット: `.playwright-cli/page-{timestamp}.yml`
- スクリーンショット: `.playwright-cli/page-{timestamp}.png`
- コンソールログ: `.playwright-cli/console-{timestamp}.log`
