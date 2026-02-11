# ノード設定編集機能の追加

## タスク

- [x] 1. shared型定義に認証フィールドを追加
- [x] 2. useNodes で認証情報を NodeApiClient に渡す
- [x] 3. NodeAddModal を追加/編集兼用にリファクタリング
- [x] 4. NodeManagement に編集機能を追加
- [x] 5. App.tsx で props を接続
- [x] 6. 動作確認（playwright-debug）

## 引き継ぎメモ

- バックエンド PATCH `/api/nodes/:id` は authUser/authPasswordEnc 対応済み
- NodeApiClient.updateNode は Partial<RegisterNodeRequest> を受け取る（型拡張で自動対応）
- パスワード空欄 = 変更なし（PATCH に authPasswordEnc を含めない）
- パスワードはuseNodesの `passwordsRef` で管理（RemoteNode型には含めない）
