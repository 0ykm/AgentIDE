<thinking_language>English</thinking_language>
<conversation_language>Japanese</conversation_language>
<character_code>UTF-8</character_code>

<architecture>

- npmワークスペースによるモノレポ構成（apps/* + packages/*）
- apps/web: React 18 + Vite + TypeScript（フロントエンド、port 5173）
- apps/server: Hono + Node.js + SQLite（バックエンドAPI、port 8787）
- apps/desktop: Electron（server + webをバンドルしたデスクトップアプリ）
- packages/shared: @deck-ide/shared（共通型定義・ユーティリティ、web/serverが依存）
- エディタ: Monaco Editor、ターミナル: xterm.js (WebSocket)
- AIエージェント連携: Claude SDK / Codex SDK（SSE streaming）
- webはAPIリクエストを/api経由でserverへプロキシ
- デスクトップビルド順序: shared → web → server → desktop（prepare.cjsが成果物をコピー）

</architecture>
<development_rules>

# ルール
## コミット
- 論理的な単位でこまめにコミットする
- 機能追加、バグ修正、リファクタリングは分けてコミット

## タスク管理（中規模以上のタスクでは必須）
- プランファイルの作成ルールに従ってプランを作成する
- プランファイルへのソースコード記載はユーザーから依頼があった場合のみ行う
- 必須記載内容:
  - [ ] 分割タスクのチェックリスト
  - 各タスクの達成要件
  - 以後の実装への引き継ぎ事項・メモ
- コミット前に必ずチェックリストを更新する

## デバッグ
skill: playwright-debugを使用して実装後にデバッグを行うこと

</development_rules>
<document_management>

ドキュメントは `[Gitリポジトリルート]/docs` に保存し、ジャンルごとに構造化されたフォルダを使用し常に整理された状態で作成・更新を行ってください。フォルダ名は英語で、ファイル名と内容は日本語で記述します。
一時的なメモなどGit管理が不要なドキュメントは、`[Gitリポジトリルート]/docs/.agent` フォルダに保存してください。

</document_management>
