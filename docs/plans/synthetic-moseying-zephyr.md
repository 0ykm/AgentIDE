# mise 導入によるビルド・開発環境の整備

## Context

開発サーバーの起動に複数のターミナルと手動のビルドステップが必要で、特に `packages/shared` のビルド忘れが頻発している。`mise` を導入し、環境構築からビルド・開発サーバー起動まで統一的に管理する。

## タスク

- [x] `.mise.toml` を作成（ツールバージョン + 環境変数 + タスク定義）
- [x] `Makefile` を更新（空ターゲットを `mise run` 呼び出しに置換）
- [x] `.gitignore` に `.mise.local.toml` を追加

## 対象ファイル

| ファイル | 操作 |
|---------|------|
| `.mise.toml` | 新規作成 |
| `Makefile` | 更新 |
| `.gitignore` | 追記 |

## `.mise.toml` 設計

### ツール・環境変数

```toml
[tools]
node = "22"

[env]
NODE_ENV = "development"
```

- Node 22 LTS（`node:sqlite` が Node 22.5.0+ 必須、tsconfig が ES2022 ターゲット、Electron 40 が Node 22 ベース）

### タスク依存グラフ

```
build:shared
    ├──→ dev:server ──┐
    └──→ dev:web ─────┴──→ dev（並列起動、プレフィックス付き出力）

build:shared
    ├──→ build:server ─┐
    └──→ build:web ────┴──→ build

build:web + build:server ──→ build:desktop
```

### タスク一覧

| タスク | 説明 | depends |
|--------|------|---------|
| `setup` | npm install + shared ビルド | - |
| `build:shared` | shared パッケージビルド（sources/outputs キャッシュ付き） | - |
| `dev:server` | バックエンド起動 (port 8787) | build:shared |
| `dev:web` | フロントエンド起動 (port 5173) | build:shared |
| `dev` | server + web 並列起動 | dev:server, dev:web |
| `build:server` | サーバービルド | build:shared |
| `build:web` | Web ビルド | build:shared |
| `build` | Web + Server ビルド | build:server, build:web |
| `build:desktop` | デスクトップビルド | build:web, build:server |
| `serve` | プロダクション起動 | build:web, build:server |
| `clean` | dist 削除（node -e でクロスプラットフォーム対応） | - |

### `mise run dev` の実行フロー

```
1. build:shared  (shared のソース未変更ならスキップ)
       ↓
2. dev:server + dev:web  (並列起動、出力にタスク名プレフィックス)
```

## Makefile 設計

- 既存の help ターゲットは維持
- 各ターゲットは `mise run <task>` へ委譲するだけの薄いラッパー
- 不要な変数（`MISE := mise exec`, `DIST_DIR`）は削除

## 検証手順

1. `mise install` でツールがインストールされること
2. `mise run setup` で npm install + shared ビルドが成功すること
3. `mise run dev` で server(8787) と web(5173) が並列起動し、プレフィックス付き出力が表示されること
4. `mise run build` で shared → server/web が正しい順序でビルドされること
5. `make dev` が `mise run dev` と同等に動作すること
