# P2Pサブノード機能 実装プラン

## タスクチェックリスト

### Layer 1: 共有型 + サーバーAPI基盤
- [x] `packages/shared/types.ts` に Node 関連型を追加
- [x] `apps/server/src/config.ts` に APP_VERSION 追加
- [x] `apps/server/src/utils/database.ts` に nodes / node_identity テーブル追加
- [x] `apps/server/src/routes/nodes.ts` 新規作成（ノードCRUD + /api/node/info）
- [x] `apps/server/src/server.ts` にノードID初期化 + ルートマウント
- [x] `apps/server/src/middleware/cors.ts` をクロスオリジン対応に更新

### Layer 2: フロントエンド隔離モジュール
- [x] `apps/web/src/remote-nodes/NodeApiClient.ts` 新規作成
- [x] `apps/web/src/remote-nodes/useNodes.ts` 新規作成
- [x] `apps/web/src/remote-nodes/useRemoteDecks.ts` 新規作成
- [x] `apps/web/src/remote-nodes/useRemoteWorkspaces.ts` 新規作成
- [x] `apps/web/src/remote-nodes/useRemoteFileOperations.ts` 新規作成
- [x] `apps/web/src/remote-nodes/useRemoteGitState.ts` 新規作成
- [x] `apps/web/src/remote-nodes/useRemoteAgents.ts` 新規作成
- [x] `apps/web/src/remote-nodes/useRemoteDeckGroups.ts` 新規作成
- [x] `apps/web/src/remote-nodes/useActiveDeckContext.ts` 新規作成
- [x] `apps/web/src/remote-nodes/index.ts` バレルエクスポート

### Layer 3: ノード管理UI（新規ファイルのみ）
- [x] `apps/web/src/components/NodeManagement.tsx` 新規作成
- [x] `apps/web/src/components/NodeAddModal.tsx` 新規作成

### Layer 4: 既存コードへの最小限変更
- [x] `apps/web/src/types.ts` — AppView に `'nodes'` 追加 + Node型re-export
- [x] `apps/web/src/constants.ts` — ノード関連メッセージ定数追加
- [x] `apps/web/src/utils/urlUtils.ts` — AppView更新 + nodes対応
- [x] `apps/web/src/components/SideNav.tsx` — ノードナビボタン追加
- [x] `apps/web/src/components/TerminalTile.tsx` — オプショナル `wsTokenFetcher` prop追加
- [x] `apps/web/src/components/TerminalPane.tsx` — オプショナル `wsTokenFetcher` prop中継
- [x] `apps/web/src/components/DeckModal.tsx` — オプショナル ノード選択UI追加
- [x] `apps/web/src/App.tsx` — useNodes/useRemoteDecks/useActiveDeckContext統合
- [x] `apps/web/src/styles.css` — ノード管理UI用CSS追加

### Layer 5: テスト・デバッグ
- [x] TypeScriptコンパイルチェック（server + web 両方OK）
- [ ] 単独動作の回帰テスト
- [ ] 2ノード間の結合テスト
- [ ] Playwright E2Eテスト

## 引き継ぎメモ
- `api.ts` は変更していない（ローカル専用として据え置き）
- 既存フック（useDecks, useWorkspaces, useFileOperations, useGitState, useAgents, useDeckGroups）は変更していない
- リモートノード未登録時は既存動作と完全に同一
- CORS: CORS_ORIGIN未設定時はリクエストOriginを動的許可に変更
- /api/node/info はauthミドルウェアの前にマウント（認証不要）
- DeckModalにnodes propを渡してもオプショナルなのでローカルのみの場合は影響なし
