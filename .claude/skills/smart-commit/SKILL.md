---
name: smart-commit
description: |
  ローカルのGit差分を論理的に分割してコミットする。変更内容を自動分析し、適切なコミットメッセージを生成します。
  This skill should be used when the user asks to "commit", "コミット", "コミットして", "変更をコミット", "差分をコミット", "smart commit", "スマートコミット".
  **Important**: Unless the user explicitly requests to use git commands directly, this skill should be used for all commit-related requests.
---

# Smart Commit

Analyze local Git diffs, split them into logical units, and commit with appropriate commit messages.

**Principle**: Use this skill for commit-related requests unless the user explicitly instructs to "use git commit directly".

---

## Execution Flow

### Phase 1: Lightweight Status Check

**Collect only summary information first.**

Execute the following Git commands in parallel:

```bash
# Get current branch name
git branch --show-current

# List staged and unstaged files (short format)
git status -s

# Staged changes statistics (file names and line counts only)
git diff --cached --stat

# Unstaged changes statistics (file names and line counts only)
git diff --stat

# Recent commit history (for commit message style reference)
git log --oneline -5
```

### Phase 1.5: Detailed Retrieval When Needed

Retrieve detailed diffs for specific files only when commit classification cannot be determined from Phase 1 summary information:

```bash
# Detailed diff for specific file (only when needed)
git diff --cached -- <specific-file>
git diff -- <specific-file>
```

**Cases requiring detailed retrieval:**
- When change content cannot be determined from file name alone
- When multiple logical changes may be mixed in the same file
- When specific change content is needed to create commit message

**Cases NOT requiring detailed retrieval:**
- When change content can be clearly inferred from file name
- When only new file additions (`??`) or deletions (`D`)
- When only config files or meta files are changed

### Phase 2: Branch Compatibility Check

Compare change content with current branch name and evaluate compatibility from these perspectives:

**Cases judged as incompatible:**
- Working directly on `main`/`master` branch
- Branch name is clearly unrelated to change content (e.g., implementing logout feature on `feature/login` branch)
- Violating branch naming conventions

**Response for incompatible cases:**
Use AskUserQuestion tool to inquire:
- Whether to create a new branch and commit
- Whether to commit on current branch as-is

If user wants a new branch:
1. Propose appropriate branch name
2. Create branch with `git checkout -b {branch-name}`

### Phase 3: Diff Analysis and Classification

Classify based on summary information obtained in Phase 1 (`git status -s`, `git diff --stat`).
Retrieve individual file diffs via Phase 1.5 only when detailed diff is needed.

**Logical grouping criteria:**
- By feature (changes related to same functionality)
- By file type (config files, source code, tests, etc.)
- By nature of change (new feature, bug fix, refactoring)

**Detection of potentially out-of-scope changes:**

Mark changes matching these patterns as "potentially out-of-scope":
- Unity project `.meta` files
- Package manager lock files (`package-lock.json`, `yarn.lock`, `Pipfile.lock`, etc.)
- IDE/editor config files (`.vscode/`, `.idea/`, etc.)
- Auto-generated files
- Temporary files and intermediate artifacts

**When potentially out-of-scope changes exist:**
Use AskUserQuestion tool to inquire whether to include these changes in commit.

Example inquiry:
```
The following changes may be out-of-scope:
- Assets/Scenes/MainScene.unity.meta
- package-lock.json

Include these changes in the commit?
```

### Phase 4: Execute Commits

Execute commits for each classified group with the following procedure:

1. **Staging**: Stage relevant files with `git add`
2. **Create commit message**: Analyze change content and auto-generate appropriate message
3. **Execute commit**: Run `git commit`

**Commit message format:**
```
{type}: {concise description}

{detailed description (if needed)}
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Refactoring
- `docs`: Documentation
- `style`: Format changes
- `test`: Add/modify tests
- `chore`: Build/config changes

**Notes on commit message creation:**
- Do not inquire about commit message content to user
- Auto-generate appropriate message from change content
- Reference existing commit message style in the repository

### Phase 5: Completion Report

After all commits are complete, report:
- List of created commits (commit hash and message)
- Files included in each commit
- Remaining uncommitted changes (if any)

---

## Detailed Judgment Criteria

### Branch Compatibility Judgment

| Situation | Judgment | Response |
|-----------|----------|----------|
| Working on main/master branch | Incompatible | Inquire about branch creation |
| Related feature branch | Compatible | Commit as-is |
| Unrelated feature branch | Incompatible | Inquire about branch creation |
| Unclear case | Treat as compatible | Commit as-is |

### Logical Split Priority

1. **Functional cohesion**: Changes related to same feature go in same commit
2. **Dependencies**: Commit dependent code first
3. **Readability**: Split into review-friendly units

### Commit Order

1. Config file changes
2. Library/utility additions
3. Main feature implementation
4. Test additions
5. Documentation updates

---

## Important Notes

- **Do not inquire about commit messages**: auto-generates from change content
- **Do not perform destructive Git operations**: Never use `--force`, `--hard reset`, etc.
- **Do not push**: Only execute commits, wait for user instruction to push
- **Respect existing staging**: Consider content user has already staged
