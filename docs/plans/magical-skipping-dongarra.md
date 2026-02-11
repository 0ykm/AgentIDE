# DB名変更 + ポータブルモード対応

## Context

リブランド（Deck IDE → Agent IDE）に伴い、データベースファイル名が旧名 `deck-ide.db` のままになっている。また、`make build-app-dir` で作成したポータブルバイナリが `%AppData%` にデータを保存するため、USBメモリ等での持ち運びや複数環境での利用に不便。ポータブルビルドではexe隣の `data/` フォルダにすべての生成ファイルをまとめるようにする。

### 確認事項
- 既存 `deck-ide.db` からの移行対応: **不要**（新規DBで開始）
- ポータブルモードでの自動更新: **無効化**
- ポータブルモードでの自動起動: **有効のまま**

## 変更概要

### 1. DB名変更: `deck-ide.db` → `agent-ide.db`

| ファイル | 行 | 変更内容 |
|---|---|---|
| `apps/desktop/src/config-manager.cjs` | 48 | `'deck-ide.db'` → `'agent-ide.db'` |
| `apps/server/src/config.ts` | 53 | `'deck-ide.db'` → `'agent-ide.db'` |
| `docs/guides/P2Pセットアップガイド.md` | 68,153,156 | `deck-ide.db` → `agent-ide.db` |

### 2. ポータブルモード対応

#### 方式
- `build-app-dir` のビルド後、exe隣に `.portable` マーカーファイルを配置
- アプリ起動時にマーカーファイルを検出し、データ保存先を切り替え

#### ポータブル時のデータ配置
```
win-unpacked/
├── Agent IDE.exe
├── .portable              ← マーカーファイル
├── data/                  ← 生成ファイル格納先
│   ├── agent-ide.db       ← データベース
│   ├── config.json        ← 設定ファイル
│   └── server.log         ← サーバーログ
└── resources/
    └── ...
```

#### 修正ファイル

**`apps/desktop/src/config-manager.cjs`**
- `isPortable()` 関数を追加: `app.isPackaged && path.dirname(process.execPath)/.portable が存在` で判定
- `getDataBasePath()` 関数を追加:
  - ポータブル時: `path.dirname(process.execPath)/data/`
  - 通常時: `app.getPath('userData')` （既存動作）
- `getDbPath()`: DB名変更 + `getDataBasePath()` を使用
- `getConfigPath()`: `getDataBasePath()` を使用
- `isPortable`, `getDataBasePath` をエクスポートに追加

**`apps/desktop/src/main.cjs`**
- `config-manager.cjs` から `getDataBasePath` をインポート
- ログファイルパスに `getDataBasePath()` を使用するよう変更

**`apps/desktop/src/auto-updater.cjs`**
- `config-manager.cjs` から `isPortable` をインポート
- `checkForUpdates()`: ポータブルモード時はスキップ（dev同様にログ出力して return）

**`apps/desktop/scripts/mark-portable.cjs`**（新規）
- `dist/` 内の `*-unpacked` ディレクトリを検索し `.portable` ファイルを作成

**`apps/server/src/config.ts`**
- DB名を `agent-ide.db` に変更

**`Makefile`**
- `build-app-dir` ターゲットに `node scripts/mark-portable.cjs` ステップを追加

**`docs/guides/P2Pセットアップガイド.md`**
- DB名参照を3箇所更新

## タスク

- [x] `config-manager.cjs` に `isPortable()` と `getDataBasePath()` を追加し、`getDbPath()` / `getConfigPath()` を更新
- [x] `main.cjs` のログファイルパスを `getDataBasePath()` 使用に変更
- [x] `auto-updater.cjs` でポータブルモード時に自動更新をスキップ
- [x] `apps/server/src/config.ts` の DB名変更
- [x] `apps/desktop/scripts/mark-portable.cjs` を新規作成
- [x] `Makefile` の `build-app-dir` にマーカー作成ステップ追加
- [x] `docs/guides/P2Pセットアップガイド.md` の DB名更新
- [x] ビルド＆動作確認

## 検証方法

1. `make build-app-dir` でビルド
2. 出力ディレクトリに `.portable` ファイルが存在することを確認
3. ポータブル版を起動し、exe隣の `data/` フォルダにDB・設定・ログが生成されることを確認
4. ポータブル版で自動更新チェックがスキップされることをログで確認
5. `npm run dev` での開発サーバー起動時、DB名が `agent-ide.db` になっていることを確認
