---
name: sync-upstream
description: |
  fork元リポジトリ（upstream）の最新変更を取り込むスキル。original/mainブランチの差分を分析し、自動マージまたは競合解決を行います。
  This skill should be used when the user asks to "sync upstream", "fork元を同期", "upstream同期", "fork元の変更を取り込む", "original/mainをマージ", "上流をマージ", "sync fork", "フォーク同期", "upstream merge", "merge upstream", "pull upstream", "最新を取り込む", "上流の変更を反映".
  Also activate when the user mentions syncing with the original repository or pulling upstream changes.
version: 0.1.0
---

# Sync Upstream - Fork元リポジトリ同期スキル

fork元（upstream）リポジトリの最新変更を現在のリポジトリに取り込む。非競合変更は自動マージし、競合する変更はaskmeスキルでユーザーにヒアリングして解決する。

---

## 前提条件

- fork元リポジトリのリモート名: `original`
- fork元リポジトリURL: GitHub API (`gh repo view --json parent`) から自動取得
- 作業ブランチ命名規則: `future/{yyyyMMddHH}`
- 対象ブランチ: `origin/main` ← `original/main`

---

## 実行フロー

### Phase 1: 環境準備

#### 1.1 リモート確認と設定

`original` リモートの存在を確認する。

```bash
git remote -v | grep original
```

**リモートが存在しない場合:**

GitHub APIでfork元を特定し、リモートを追加する。

```bash
# fork元リポジトリ情報を取得
gh repo view --json parent --jq '.parent.owner.login + "/" + .parent.name'

# リモートを追加（SSH）
git remote add original git@github.com:{owner}/{repo}.git
```

**`gh` CLIが利用できない場合:**
ユーザーにfork元のリポジトリURLを確認し、手動でリモートを追加する。

#### 1.2 最新情報の取得

```bash
git fetch origin
git fetch original
```

#### 1.3 作業ブランチの作成

`origin/main` を起点に作業ブランチを作成する。

```bash
# 現在時刻でブランチ名を生成
BRANCH_NAME="future/$(date +%Y%m%d%H)"

# origin/mainから作業ブランチを作成
git checkout -b "$BRANCH_NAME" origin/main
```

**同名ブランチが既に存在する場合:**
末尾に連番を付与する（例: `future/2026021115-2`）。

---

### Phase 2: 差分分析

マージ前にoriginal/mainとの差分を確認する。

```bash
# コミット差分の概要を確認
git log --oneline origin/main..original/main

# ファイル変更の統計情報を確認
git diff --stat origin/main...original/main

# 変更されたファイル一覧を取得
git diff --name-status origin/main...original/main
```

**差分がない場合:**
「fork元に新しい変更はありません」と報告して終了する。

**差分がある場合:**
変更内容のサマリーをユーザーに報告してからPhase 3に進む。報告内容:
- 新規コミット数
- 変更ファイル数
- 主要な変更内容の概要

---

### Phase 3: マージ実行

#### 3.1 マージの試行

```bash
git merge original/main --no-edit
```

#### 3.2 結果による分岐

**マージ成功（競合なし）の場合:**
→ Phase 5（完了報告）へ進む。自動マージされた変更の概要を報告する。

**マージ競合が発生した場合:**
→ Phase 4（競合解決）へ進む。

---

### Phase 4: 競合解決

#### 4.1 競合ファイルの特定

```bash
git diff --name-only --diff-filter=U
```

#### 4.2 競合の分類と解決

各競合ファイルについて以下の手順で対応する。ファイルタイプ別の詳細な解決パターンは `references/merge-patterns.md` を参照すること。

**ステップ1: 競合内容の分析**

競合ファイルを読み取り、`<<<<<<<`、`=======`、`>>>>>>>`マーカーで囲まれた競合箇所を特定する。

**ステップ2: 両立可能性の判断**

以下の基準で自動解決可能か判断する。

| 状況 | 判断 | 対応 |
|------|------|------|
| 異なる箇所への追加（近接していない） | 両立可能 | 自動マージ |
| 同一行の変更だがfork元のみ変更（こちらは未変更） | 両立可能 | fork元の変更を採用 |
| import文の追加（重複なし） | 両立可能 | 両方のimportを保持 |
| 設定ファイルの異なるキーの変更 | 両立可能 | 両方の変更を保持 |
| 同一行・同一ロジックへの異なる変更 | **競合** | **ユーザーにヒアリング** |
| アーキテクチャに影響する構造変更 | **競合** | **ユーザーにヒアリング** |
| 削除 vs 変更の競合 | **競合** | **ユーザーにヒアリング** |

**ステップ3-A: 自動解決（両立可能な場合）**

競合マーカーを除去し、両方の変更を適切に統合してファイルを保存する。ユーザーへの許可は不要。

```bash
# 解決後にステージング
git add <resolved-file>
```

**ステップ3-B: ユーザーヒアリング（競合する場合）**

askmeスキルの手法（AskUserQuestionツールによる選択肢提示とヒアリング）を使用して以下の情報を提示し、対応方法を確認する。

提示する情報:
1. 競合ファイルのパス
2. fork元（original/main）の変更内容と意図
3. 現在のリポジトリ（origin/main）の変更内容と意図
4. 推奨される解決方法の選択肢

選択肢の例:
- fork元の変更を採用する（ours を破棄）
- 現在の変更を維持する（theirs を破棄）
- 両方の変更を手動で統合する（具体的な統合案を提示）
- 後で手動対応する（スキップ）

ユーザーの回答に基づいてファイルを編集し、ステージングする。

#### 4.3 全競合解決後のコミット

全ての競合が解決されたらマージコミットを完了する。

```bash
git commit --no-edit
```

---

### Phase 5: 完了報告

マージ完了後、以下を報告する。

1. **作業ブランチ名**: `future/{yyyyMMddHH}`
2. **取り込んだコミット一覧**: コミットハッシュとメッセージ
3. **自動マージされたファイル**: 一覧
4. **ユーザー判断で解決したファイル**: 一覧と選択内容
5. **スキップされたファイル**: ある場合のみ
6. **次のステップの提案**:
   - 動作確認の推奨
   - main へのマージ方法（PR作成など）

---

## 重要な注意事項

- **破壊的操作の禁止**: `--force`、`--hard reset`等は絶対に使用しない
- **pushは行わない**: ローカルでのマージのみ実行し、pushはユーザーの指示を待つ
- **既存の作業を保護**: 未コミットの変更がある場合は事前にstashを提案する
- **段階的な報告**: 各フェーズの結果をユーザーに報告してから次に進む
- **askmeスキルの活用**: 競合解決時はaskmeスキルのIntent Understandingモードを使用し、ユーザーの意図を正確に把握する

---

## Additional Resources

### Reference Files

詳細なマージ戦略と競合解決パターンについて:
- **`references/merge-patterns.md`** - マージ戦略と競合解決の詳細パターン集
