# P2Pサブノード機能 実装プラン

## Context

AgentIDEは現在、単一サーバー・単一マシン構成で動作しており、リモートPCの操作は不可能。
本機能は、**各PCで既存の構成がそのまま単独動作する前提のもと**、複数ノードを使用したいときにIP+ポートで接続し、1つのブラウザ・UIページから全ノードのターミナル・ファイル・Git・Agentを**Deck単位で混在操作**できるようにするもの。

**核心方針**: 既存機能への影響を最小限にし、リモートノード機能を**完全に隔離されたモジュール**として実装する。既存コードへの変更は「オプショナルpropsの追加」レベルに限定する。

---

## 要件まとめ

- **単独動作が前提**: 各PCで現在の構成を起動して単独で動作する（ノード機能はオプショナル）
- **P2P型**: 各PCが対等なノード（master/slave なし）
- **全機能**: ターミナル・ファイル・Git・Agent をリモートでも利用
- **Deck単位で混在**: 1つのUI内にローカルDeckとリモートDeckが共存
- **手動登録**: IP/ホスト名 + ポートで接続先を登録
- **通信**: WebSocket/HTTP直接（LAN/VPN前提）
- **既存データ互換性**: リセットでOK（マイグレーション不要）
- **ファイルツリー**: アクティブDeckのノードに連動（Deck切替でファイルツリーも自動切替）
- **既存コード隔離**: リモート機能は独立モジュール。既存コンポーネントへは最小限のoptional props追加のみ

---

## アーキテクチャ概要

```
┌──────────────────────────────────────────────────────┐
│  Frontend (Browser)                                  │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐   │
│  │ 既存コード       │  │ 新規隔離モジュール        │   │
│  │ (変更なし/最小限) │  │ (remote-nodes/)          │   │
│  │                 │  │                          │   │
│  │ api.ts          │  │ NodeApiClient            │   │
│  │ useDecks.ts     │  │ useNodes.ts              │   │
│  │ useWorkspaces   │  │ useRemoteDecks.ts        │   │
│  │ useFileOps      │  │ useRemoteWorkspaces.ts   │   │
│  │ useGitState     │  │ useRemoteFileOps.ts      │   │
│  │ useAgents       │  │ useRemoteGitState.ts     │   │
│  │ ...             │  │ useRemoteAgents.ts       │   │
│  └────────┬────────┘  └────────────┬─────────────┘   │
│           │                        │                 │
│      ┌────▼────────────────────────▼──┐              │
│      │  App.tsx (統合レイヤー)          │              │
│      │  activeDeckがlocal → 既存コード  │              │
│      │  activeDeckがremote → 隔離モジュール            │
│      └──────────────┬─────────────────┘              │
│                     │                                │
└─────────────────────┼────────────────────────────────┘
                      │
        ┌─────────────┼───────────────┐
        │             │               │
   HTTP/WS       HTTP/WS        HTTP/WS
        │             │               │
   ┌────▼───┐   ┌────▼────┐   ┌──────▼──┐
   │ Local  │   │ Remote  │   │ Remote  │
   │ Node   │   │ Node B  │   │ Node C  │
   └────────┘   └─────────┘   └─────────┘
```

### 隔離の原則

1. **`api.ts` は一切変更しない** — ローカル専用APIクライアントとしてそのまま
2. **既存フックは基本変更しない** — ローカルデータのみを扱い続ける
3. **リモートノード用に新規フック群を作成** — 既存フックと同じインターフェースだがNodeApiClient使用
4. **`App.tsx` が統合レイヤー** — ローカルDeck選択時は既存コード、リモートDeck選択時は新規コードにルーティング
5. **既存コンポーネントへの変更はオプショナルprops追加のみ**
6. **共通ロジックはユーティリティに抽出** — 既存フックとリモートフックの重複ロジックは共通ユーティリティとして抽出し共有。既存フックのリファクタリングは共通化の範囲に限定

---

## タスクチェックリスト

### Layer 1: 共有型 + サーバーAPI基盤
- [ ] `packages/shared/types.ts` に Node 関連型を追加
- [ ] `apps/server/src/utils/database.ts` に nodes / node_identity テーブル追加
- [ ] `apps/server/src/routes/nodes.ts` 新規作成（ノードCRUD + /api/node/info）
- [ ] `apps/server/src/server.ts` にノードID初期化 + ルートマウント
- [ ] `apps/server/src/config.ts` に NODE_NAME, APP_VERSION 追加
- [ ] `apps/server/src/middleware/cors.ts` をクロスオリジン対応に更新

### Layer 2: 共通ユーティリティ抽出 + フロントエンド隔離モジュール
- [ ] 既存フックから共通ロジックを `apps/web/src/utils/` にユーティリティ関数として抽出（ファイル操作のステート管理、Gitデータ整形など）
- [ ] 既存フックをユーティリティ関数を使うようにリファクタリング（動作は変えない）
- [ ] `apps/web/src/remote-nodes/NodeApiClient.ts` 新規作成
- [ ] `apps/web/src/remote-nodes/useNodes.ts` 新規作成
- [ ] `apps/web/src/remote-nodes/useRemoteDecks.ts` 新規作成
- [ ] `apps/web/src/remote-nodes/useRemoteWorkspaces.ts` 新規作成
- [ ] `apps/web/src/remote-nodes/useRemoteFileOperations.ts` 新規作成（共通ユーティリティ使用）
- [ ] `apps/web/src/remote-nodes/useRemoteGitState.ts` 新規作成（共通ユーティリティ使用）
- [ ] `apps/web/src/remote-nodes/useRemoteAgents.ts` 新規作成
- [ ] `apps/web/src/remote-nodes/useRemoteDeckGroups.ts` 新規作成（ノード横断DeckGroup対応）
- [ ] `apps/web/src/remote-nodes/useActiveDeckContext.ts` 新規作成（ローカル/リモート切替の統合フック）
- [ ] `apps/web/src/remote-nodes/index.ts` バレルエクスポート

### Layer 3: ノード管理UI（新規ファイルのみ）
- [ ] `apps/web/src/components/NodeManagement.tsx` 新規作成
- [ ] `apps/web/src/components/NodeAddModal.tsx` 新規作成

### Layer 4: 既存コードへの最小限変更
- [ ] `apps/web/src/types.ts` — AppView に `'nodes'` 追加
- [ ] `apps/web/src/constants.ts` — ノード関連メッセージ定数追加
- [ ] `apps/web/src/components/SideNav.tsx` — ノードナビボタン追加
- [ ] `apps/web/src/components/TerminalTile.tsx` — オプショナル `wsTokenFetcher` prop追加
- [ ] `apps/web/src/components/TerminalPane.tsx` — オプショナル `wsTokenFetcher` prop中継
- [ ] `apps/web/src/components/DeckModal.tsx` — オプショナル ノード選択UI追加
- [ ] `apps/web/src/components/DeckGroupCreateModal.tsx` — オプショナル 全ノードDeck一覧props追加
- [ ] `apps/web/src/components/DeckGroupEditModal.tsx` — オプショナル 全ノードDeck一覧props追加
- [ ] `apps/web/src/App.tsx` — useActiveDeckContext/useRemoteDeckGroups統合

### Layer 5: テスト・デバッグ
- [ ] 単独動作の回帰テスト（既存機能が壊れていないこと）
- [ ] 2ノード間の結合テスト（同一PCで異なるポート）
- [ ] オフライン/エラーケースのテスト
- [ ] Playwright E2Eテスト

---

## 各レイヤー詳細

### Layer 1: 共有型 + サーバーAPI基盤

#### `packages/shared/types.ts` 追加型

```typescript
export type NodeStatus = 'online' | 'offline' | 'connecting' | 'error';

export interface RemoteNode {
  id: string;         // UUID（サーバー初回起動時に自動生成）
  name: string;       // ユーザー設定名
  host: string;       // IP or ホスト名
  port: number;
  isLocal: boolean;
  createdAt: string;
}

export interface RemoteNodeWithStatus extends RemoteNode {
  status: NodeStatus;
  lastSeen: string | null;
  version?: string;
  error?: string;
}

export interface NodeInfo {
  id: string;
  name: string;
  version: string;
  capabilities: string[];
}

export interface RegisterNodeRequest {
  name: string;
  host: string;
  port: number;
  authUser?: string;
  authPassword?: string;
}
```

#### `apps/server/src/utils/database.ts` テーブル追加

```sql
CREATE TABLE IF NOT EXISTS node_identity (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Local',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  auth_user TEXT,
  auth_password_enc TEXT,
  created_at TEXT NOT NULL
);
```

#### `apps/server/src/routes/nodes.ts` 新規ルート

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/api/node/info` | このノード自身の情報 | 不要 |
| GET | `/api/nodes` | 登録済みリモートノード一覧 | 必要 |
| POST | `/api/nodes` | リモートノード登録 | 必要 |
| PATCH | `/api/nodes/:id` | ノード情報更新 | 必要 |
| DELETE | `/api/nodes/:id` | ノード登録解除 | 必要 |

#### `apps/server/src/server.ts` 変更

`createServer()` 内に追加:
1. `node_identity` テーブルからノードIDをロード（なければUUID生成して保存）
2. `/api/node/info` エンドポイントをauthミドルウェアの**前**にマウント
3. ノードCRUDルーターをauthミドルウェアの後にマウント

#### `apps/server/src/middleware/cors.ts` 更新

変更点:
- リクエストの `Origin` ヘッダに基づく動的許可（`CORS_ORIGIN` 未設定時は全Origin許可）
- `Access-Control-Allow-Credentials: true` 追加
- `PATCH`, `DELETE` メソッド許可追加

---

### Layer 2: フロントエンド隔離モジュール

全ファイルを `apps/web/src/remote-nodes/` ディレクトリに配置。既存コードからは独立。

#### `remote-nodes/NodeApiClient.ts`

`api.ts` と同じインターフェースの全API関数をインスタンスメソッドとして実装。
**`api.ts` は参照するが変更しない。**

```typescript
export class NodeApiClient {
  constructor(
    private baseUrl: string,    // "http://192.168.1.10:8787"
    private credentials?: { user: string; password: string }
  )

  private async request<T>(path: string, options?: RequestInit): Promise<T>

  getWsBase(): string
  getWsToken(): Promise<{ token: string; authEnabled: boolean }>

  // api.ts と同じシグネチャのメソッド群
  listWorkspaces(): Promise<Workspace[]>
  listDecks(): Promise<Deck[]>
  createDeck(name: string, workspaceId: string): Promise<Deck>
  deleteDeck(id: string): Promise<void>
  createTerminal(deckId: string, title?: string, command?: string): Promise<...>
  deleteTerminal(terminalId: string): Promise<void>
  listTerminals(deckId: string): Promise<...>
  listFiles(workspaceId: string, path?: string): Promise<FileSystemEntry[]>
  readFile(workspaceId: string, path: string): Promise<...>
  writeFile(workspaceId: string, path: string, contents: string): Promise<...>
  createFile(...): Promise<...>
  deleteFile(...): Promise<...>
  createDirectory(...): Promise<...>
  deleteDirectory(...): Promise<...>
  getGitStatus(...): Promise<GitStatus>
  stageFiles(...): Promise<...>
  // ... Git全操作, Agent全操作
  streamAgentSession(id, onMessage, onStatus, onError): () => void
}
```

#### `remote-nodes/useNodes.ts`

ノードレジストリの管理。起動時にローカルサーバーからノード一覧を取得し、定期ヘルスチェック。

```typescript
interface UseNodesReturn {
  nodes: RemoteNodeWithStatus[];
  localNode: RemoteNodeWithStatus;
  onlineRemoteNodes: RemoteNodeWithStatus[];
  getNodeClient: (nodeId: string) => NodeApiClient;
  addNode: (req: RegisterNodeRequest) => Promise<void>;
  removeNode: (nodeId: string) => Promise<void>;
  testConnection: (host: string, port: number) => Promise<NodeInfo | null>;
  refreshAllStatuses: () => Promise<void>;
}
```

- ヘルスチェック: 15秒間隔で `/health` をポーリング
- APIクライアントキャッシュ: `Map<nodeId, NodeApiClient>`

#### `remote-nodes/useRemoteDecks.ts`

全オンラインリモートノードからDeckを集約。

```typescript
interface NodeDeck extends Deck {
  nodeId: string;
  nodeName: string;
}

interface UseRemoteDecksReturn {
  remoteDecks: NodeDeck[];
  loading: boolean;
  createRemoteDeck: (nodeId: string, name: string, workspaceId: string) => Promise<Deck>;
  deleteRemoteDeck: (nodeId: string, deckId: string) => Promise<void>;
  createRemoteTerminal: (nodeId: string, deckId: string, title?: string, command?: string) => Promise<...>;
  deleteRemoteTerminal: (nodeId: string, terminalId: string) => Promise<void>;
  refreshRemoteDecks: () => Promise<void>;
}
```

`Promise.allSettled` で並列に全リモートノードから取得。一部ノードがオフラインでもエラーにならない。

#### `remote-nodes/useRemoteWorkspaces.ts`

リモートノードのワークスペース取得・作成。アクティブDeckがリモートの場合に使用。

```typescript
interface NodeWorkspace extends Workspace {
  nodeId: string;
}

interface UseRemoteWorkspacesReturn {
  getWorkspacesForNode: (nodeId: string) => Promise<NodeWorkspace[]>;
  createRemoteWorkspace: (nodeId: string, path: string) => Promise<Workspace>;
  deleteRemoteWorkspace: (nodeId: string, workspaceId: string) => Promise<void>;
  cachedWorkspaces: Map<string, NodeWorkspace[]>;
}
```

#### `remote-nodes/useRemoteFileOperations.ts`

既存の `useFileOperations` と同じインターフェースだがNodeApiClient使用。
アクティブDeckがリモートの場合にApp.tsxで切り替えて使用。

```typescript
// 既存 useFileOperations と同じ戻り値型
interface UseRemoteFileOperationsReturn {
  handleOpenFile: (path: string) => Promise<void>;
  handleSaveFile: (fileId: string) => Promise<void>;
  handleCreateFile: (path: string) => Promise<void>;
  handleDeleteFile: (path: string) => Promise<void>;
  // ...
}
```

#### `remote-nodes/useRemoteGitState.ts`

既存の `useGitState` と同じインターフェースだがNodeApiClient使用。

#### `remote-nodes/useRemoteAgents.ts`

リモートノードでのAgent実行。

#### `remote-nodes/useRemoteDeckGroups.ts`

既存 `useDeckGroups` をラップし、リモートDeckを含むグループ対応。
DeckGroupのdeckIdsは `nodeId:deckId` の複合ID形式で保存。

```typescript
interface UseRemoteDeckGroupsReturn {
  allDeckGroups: DeckGroup[];  // ローカル+リモート対応のDeckGroup一覧
  createDeckGroup: (name: string, deck1: { nodeId: string; deckId: string }, deck2: { nodeId: string; deckId: string }) => Promise<DeckGroup>;
  updateDeckGroup: (id: string, updates: { name?: string; deckIds?: [string, string] }) => Promise<DeckGroup>;
  deleteDeckGroup: (id: string) => Promise<void>;
  resolveDeckGroupDecks: (group: DeckGroup) => { deck1: NodeDeck | null; deck2: NodeDeck | null };
}
```

DeckGroupはローカルDBにのみ保存。deckIds内のIDをパースしてノード情報を解決する。

#### `remote-nodes/useActiveDeckContext.ts`

App.tsxの統合ロジックを分離した専用フック。ローカル/リモートの切替判定とデータソースのルーティングを一元管理。

```typescript
interface ActiveDeckContext {
  // 判定
  isRemoteDeck: boolean;
  activeNodeId: string | null;
  activeNodeClient: NodeApiClient | null;

  // ファイルツリー用データ（ローカル or リモートを自動選択）
  workspaceState: WorkspaceState;
  fileOperations: FileOperationsInterface;

  // Git用データ
  gitState: GitStateInterface;

  // ターミナル用データ
  wsBase: string;
  wsTokenFetcher: (() => Promise<{ token: string; authEnabled: boolean }>) | undefined;
  terminals: TerminalSession[];

  // Deck操作
  handleCreateTerminal: (...) => Promise<void>;
  handleDeleteTerminal: (...) => Promise<void>;
}
```

App.tsxはこのフックの返り値をそのまま既存コンポーネントに渡すだけでよくなる。

---

### Layer 3: ノード管理UI

#### `components/NodeManagement.tsx`

ノード一覧画面。`AppView === 'nodes'` のとき表示。

- ローカルノード（常に最上位、削除不可、ステータス常にonline）
- リモートノード一覧（名前、host:port、ステータスバッジ）
- 各ノードのアクション: 編集、削除、接続テスト
- 「ノード追加」ボタン

#### `components/NodeAddModal.tsx`

- ホスト名/IP入力
- ポート入力（デフォルト: 8787）
- ノード名入力（任意）
- 認証情報入力（任意）
- 「接続テスト」ボタン → 対象の `/api/node/info` へアクセスして到達確認

---

### Layer 4: 既存コードへの最小限変更

各ファイルの**具体的な変更箇所と影響範囲**を明記。

#### `apps/web/src/types.ts` （1行変更）

```diff
- export type AppView = 'workspace' | 'terminal' | 'agent';
+ export type AppView = 'workspace' | 'terminal' | 'agent' | 'nodes';
```

#### `apps/web/src/constants.ts` （定数追加のみ）

```typescript
// ノード関連メッセージ追加
export const MESSAGE_NODE_OFFLINE = 'ノードがオフラインです';
export const MESSAGE_NODE_ADD_ERROR = 'ノードの追加に失敗しました';
export const MESSAGE_NODE_CONNECTION_TEST_OK = '接続テスト成功';
export const MESSAGE_NODE_CONNECTION_TEST_FAIL = '接続テスト失敗';
export const NODE_HEALTH_CHECK_INTERVAL = 15000;
```

#### `apps/web/src/components/SideNav.tsx` （ボタン1つ追加）

`activity-bar-top` にノード管理ボタンを1つ追加するのみ。既存ボタンは変更なし。

#### `apps/web/src/components/TerminalTile.tsx` （オプショナルprop 1つ追加）

```diff
  interface TerminalTileProps {
    session: TerminalSession;
    wsUrl: string;
+   wsTokenFetcher?: () => Promise<{ token: string; authEnabled: boolean }>;
    onDelete: () => void;
  }
```

内部の `getWsToken()` 呼び出し箇所を:
```typescript
const tokenData = wsTokenFetcher ? await wsTokenFetcher() : await getWsToken();
```
に変更。**wsTokenFetcherが未指定なら従来通り動作。**

#### `apps/web/src/components/TerminalPane.tsx` （オプショナルprop 1つ追加・中継）

```diff
  interface TerminalPaneProps {
    terminals: TerminalSession[];
    wsBase: string;
    layout: TerminalLayout;
+   wsTokenFetcher?: () => Promise<{ token: string; authEnabled: boolean }>;
    onDeleteTerminal: (terminalId: string) => void;
  }
```

TerminalTileへ `wsTokenFetcher` を中継するのみ。

#### `apps/web/src/components/DeckModal.tsx` （オプショナルprops追加）

```diff
  interface DeckModalProps {
    isOpen: boolean;
    workspaces: Workspace[];
+   nodes?: RemoteNodeWithStatus[];  // 未指定ならノード選択UI非表示
+   onNodeChange?: (nodeId: string) => void;
+   remoteWorkspaces?: Workspace[];  // リモートノード選択時のWS一覧
    onSubmit: (name: string, workspaceId: string) => Promise<void>;
    onClose: () => void;
  }
```

`nodes` propが未指定の場合は現在と完全に同じ表示。指定時のみノード選択ドロップダウンを表示。

#### `apps/web/src/App.tsx` （統合レイヤー — useActiveDeckContextで簡潔化）

`useActiveDeckContext` フックにより、App.tsx自体の変更は最小限に抑える。

```typescript
import { useNodes, useRemoteDecks, useActiveDeckContext, useRemoteDeckGroups } from './remote-nodes';

// ノード管理
const { nodes, localNode, onlineRemoteNodes, getNodeClient } = useNodes();
const { remoteDecks, ... } = useRemoteDecks(onlineRemoteNodes, getNodeClient);

// ローカル+リモートDeckの結合
const allDecks = [...decks.map(d => ({ ...d, nodeId: localNode.id })), ...remoteDecks];

// 統合フック: アクティブDeckに基づいてデータソースを自動選択
const ctx = useActiveDeckContext({
  activeDeckIds, allDecks, localNode, getNodeClient,
  localWorkspaceState, localFileOps, localGitState, localTerminals
});

// DeckGroupもリモートDeck対応
const { allDeckGroups, ... } = useRemoteDeckGroups({ localDeckGroups, allDecks });
```

レンダリング部分（既存コンポーネントにctxのデータを渡すだけ）:
```tsx
<FileTree tree={ctx.workspaceState.tree} onExpand={ctx.fileOperations.handleExpandDir} ... />
<EditorPane files={ctx.workspaceState.files} onSave={ctx.fileOperations.handleSaveFile} ... />
<TerminalPane terminals={ctx.terminals} wsBase={ctx.wsBase} wsTokenFetcher={ctx.wsTokenFetcher} ... />
<SourceControl gitStatus={ctx.gitState} ... />

{view === 'nodes' && <NodeManagement nodes={nodes} onAddNode={...} onRemoveNode={...} />}
```

Deckタブバーへのノードインジケーター: リモートDeckにはカラードット + ツールチップ(ノード名)を表示。

#### DeckGroupのリモートDeck対応

`useRemoteDeckGroups` がローカルの `useDeckGroups` をラップし、deckIdsに `nodeId:deckId` 形式を使用。
DeckGroup作成/編集モーダルでは全ノードのDeck一覧からペアを選択可能。

---

### セキュリティ考慮事項

- **CORS**: リモートノードへのクロスオリジンリクエストを許可する動的CORS
- **ノード認証**: 各ノードのBasic Auth資格情報をローカルDBに保存
- **WebSocket認証**: 既存のトークンベース認証を維持。リモートノードのトークンはそのノードから取得
- **LAN前提**: TLS必須としないが、baseUrlで `https` にも対応可能

---

### 重要な注意事項・引き継ぎメモ

- **`api.ts` は変更しない**: ローカル専用として完全に据え置き
- **既存フックは変更しない**: useDecks, useWorkspaces, useFileOperations, useGitState, useAgents はそのまま
- **リモートノード未登録時**: `useNodes` が空リストを返し、`useRemoteDecks` が空配列を返すため、既存の動作と完全に同一
- **ブラウザWS接続制限**: 同一ホストあたり6-8本。多数ターミナル開放時の制限に注意
- **DeckGroup**: `useRemoteDeckGroups` でラップし、deckIdsに `nodeId:deckId` 形式でリモートDeckも対応。既存の `useDeckGroups` は変更しない
- **`apps/desktop`**: 変更不要（サーバーは既に `0.0.0.0` にバインド）

---

## 検証方法

1. **回帰テスト（最優先）**: リモートノード未登録の状態で、全既存機能が従来通り動作すること
2. **サーバーAPIテスト**: curlで `/api/node/info`, `/api/nodes` CRUD を確認
3. **2ノード結合テスト**: 同一PCで異なるポートで2サーバー起動し、片方からもう片方をノード登録
4. **UI操作テスト**:
   - ノード追加 → 接続テスト成功
   - リモートノードのワークスペースでDeck作成
   - リモートDeckでターミナル操作
   - リモートノードのファイル閲覧・編集
   - リモートノードのGit操作
   - リモートノードでAgent実行
   - Deck切替でファイルツリーが連動すること
5. **オフラインテスト**: リモートノード停止時のUI表示とエラーハンドリング
6. **Playwright E2Eテスト**: 主要ユースケースの自動テスト

---

## 修正対象ファイル一覧

### 新規ファイル（隔離モジュール）

| ファイル | 説明 |
|---------|------|
| `apps/web/src/remote-nodes/NodeApiClient.ts` | リモートノード用APIクライアント |
| `apps/web/src/remote-nodes/useNodes.ts` | ノードレジストリ管理フック |
| `apps/web/src/remote-nodes/useRemoteDecks.ts` | リモートDeck集約フック |
| `apps/web/src/remote-nodes/useRemoteWorkspaces.ts` | リモートWorkspace取得フック |
| `apps/web/src/remote-nodes/useRemoteFileOperations.ts` | リモートファイル操作フック |
| `apps/web/src/remote-nodes/useRemoteGitState.ts` | リモートGit状態フック |
| `apps/web/src/remote-nodes/useRemoteAgents.ts` | リモートAgent管理フック |
| `apps/web/src/remote-nodes/index.ts` | バレルエクスポート |
| `apps/web/src/components/NodeManagement.tsx` | ノード管理画面 |
| `apps/web/src/components/NodeAddModal.tsx` | ノード追加モーダル |
| `apps/server/src/routes/nodes.ts` | ノードCRUDルート |

### サーバー側の変更（最小限）

| ファイル | 変更内容 | 影響範囲 |
|---------|---------|---------|
| `packages/shared/types.ts` | Node関連型追加（既存型は変更なし） | 追記のみ |
| `apps/server/src/utils/database.ts` | テーブル2つ追加 + DB関数追加 | 追記のみ |
| `apps/server/src/server.ts` | ノードID初期化 + ルートマウント | 数行追加 |
| `apps/server/src/config.ts` | NODE_NAME, APP_VERSION 定数追加 | 追記のみ |
| `apps/server/src/middleware/cors.ts` | CORS動的許可対応 | 既存ロジック拡張 |

### フロントエンド既存ファイルの変更（最小限）

| ファイル | 変更内容 | 変更量 |
|---------|---------|--------|
| `apps/web/src/types.ts` | AppView に `'nodes'` 追加 | 1行 |
| `apps/web/src/constants.ts` | ノード関連メッセージ定数追加 | 数行追記 |
| `apps/web/src/components/SideNav.tsx` | ノードボタン追加 | ~15行追加 |
| `apps/web/src/components/TerminalTile.tsx` | オプショナル `wsTokenFetcher` prop | ~5行変更 |
| `apps/web/src/components/TerminalPane.tsx` | prop中継 | ~3行変更 |
| `apps/web/src/components/DeckModal.tsx` | オプショナル ノード選択UI | ~20行追加 |
| `apps/web/src/App.tsx` | 統合レイヤー（最大の変更） | ~80行追加 |

### 変更しないファイル

| ファイル | 理由 |
|---------|------|
| `apps/web/src/api.ts` | ローカル専用として据え置き |
| `apps/web/src/hooks/useDecks.ts` | ローカルDecksのみ。リモートは別フック |
| `apps/web/src/hooks/useWorkspaces.ts` | ローカルWorkspacesのみ |
| `apps/web/src/hooks/useWorkspaceState.ts` | 変更不要 |
| `apps/web/src/hooks/useDeckState.ts` | 変更不要 |
| `apps/web/src/hooks/useFileOperations.ts` | ローカル操作用。リモートは別フック |
| `apps/web/src/hooks/useGitState.ts` | ローカル操作用。リモートは別フック |
| `apps/web/src/hooks/useAgents.ts` | ローカル操作用。リモートは別フック |
| `apps/web/src/hooks/useDeckGroups.ts` | 変更不要。`useRemoteDeckGroups` がラップしてリモートDeck対応を実現 |
| `apps/web/src/components/EditorPane.tsx` | props経由でデータ受取のため変更不要 |
| `apps/web/src/components/FileTree.tsx` | 同上 |
| `apps/web/src/components/SourceControl.tsx` | 同上 |
