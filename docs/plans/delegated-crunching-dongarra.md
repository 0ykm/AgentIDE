# ノード管理: 認証状態の可視化

## Context

ヘルスチェックは `/api/node/info`（認証不要）を使っているため、認証が有効なリモートノードでも常に「オンライン」と表示される。
ユーザーが認証を有効化しても接続状態として区別できないため、認証の成否をUIに反映する必要がある。

## 方針

`/api/ws-token` エンドポイントを利用する。このエンドポイントは:
- 認証ミドルウェアの**後ろ**に登録されているため、認証が有効なら401が返る
- レスポンスに `authEnabled: boolean` を含むため、認証の有無を正確に判定できる
- 既に `NodeApiClient.getWsToken()` としてクライアントメソッドが存在する

判定ロジック:
| ws-token結果 | authEnabled | 判定 |
|---|---|---|
| 成功 | false | 認証なし (`'none'`) |
| 成功 | true | 認証OK (`'ok'`) |
| 401エラー | - | 認証エラー (`'unauthorized'`) |

## タスク

- [x] **1. `RemoteNodeWithStatus` に `authStatus` フィールドを追加**
  - ファイル: `packages/shared/types.ts`
  - `authStatus?: 'ok' | 'unauthorized' | 'none'` を追加
  - 達成要件: 型チェックが通ること

- [x] **2. `NodeApiClient` に `verifyAuth()` メソッドを追加**
  - ファイル: `apps/web/src/remote-nodes/NodeApiClient.ts`
  - 直接 fetch で `/api/ws-token` を呼び出し、HTTP ステータスコードから判定
  - 達成要件: 認証あり/なし/エラーの3パターンが判別できること

- [x] **3. `useNodes` のヘルスチェックで `verifyAuth()` を呼び出す**
  - ファイル: `apps/web/src/remote-nodes/useNodes.ts`
  - `checkNodeHealth` 内で `getNodeInfo()` 成功後に `verifyAuth()` を実行
  - 結果を `authStatus` として `RemoteNodeWithStatus` に反映
  - 達成要件: ヘルスチェックごとに認証状態が更新されること

- [x] **4. `NodeManagement` で認証エラーを表示**
  - ファイル: `apps/web/src/components/NodeManagement.tsx`
  - リモートノードカードのステータスバッジ横に認証エラー時のみ表示:
    - `'unauthorized'` → 「認証エラー」（赤系バッジ）を「オンライン」バッジの隣に並列表示
    - `'ok'` / `'none'` → 追加表示なし
  - 達成要件: 認証エラー状態がノードカード上で視覚的に確認できること

- [x] **5. 認証エラーバッジのCSS追加**
  - ファイル: `apps/web/src/styles.css`
  - `.node-auth-error` / `.node-status-badges` のスタイル追加

- [x] **6. 動作確認（playwright-debug）**

## 修正対象ファイル

| ファイル | 変更内容 |
|---|---|
| `packages/shared/types.ts` | `authStatus` フィールド追加 |
| `apps/web/src/remote-nodes/NodeApiClient.ts` | `verifyAuth()` メソッド追加 |
| `apps/web/src/remote-nodes/useNodes.ts` | ヘルスチェックに認証検証追加 |
| `apps/web/src/components/NodeManagement.tsx` | 認証状態バッジ表示 |
| `apps/web/src/styles.css` | 認証バッジCSS |

## 再利用する既存実装

- `NodeApiClient.getWsToken()` (`NodeApiClient.ts:72-74`) — `/api/ws-token` 呼び出し
- `checkNodeHealth` (`useNodes.ts:101-120`) — ヘルスチェックフロー
- `.node-status` CSS (`styles.css:2950-2976`) — バッジスタイルの参考

## UI仕様（確定）

- 認証エラー時: 「オンライン」+「認証エラー」バッジを並列表示（疎通OKだが操作不可であることが明確）
- 認証OK時 / 認証なし時: 追加表示なし（正常時はクリーンな表示を維持）

## 検証方法

1. 認証なしのリモートノード → 「オンライン」のみ表示（認証バッジなし）
2. 認証ありのリモートノード（正しい認証情報設定済み） → 「オンライン」のみ表示
3. 認証ありのリモートノード（認証情報未設定/不正） → 「オンライン」+「認証エラー」
