#!/bin/bash
# Claude Code Custom Status Line

# 依存コマンドチェック
MISSING_DEPS=()
for cmd in jq awk git; do
    if ! command -v "$cmd" > /dev/null 2>&1; then
        MISSING_DEPS+=("$cmd")
    fi
done

input=$(cat)

# モデル名
MODEL=$(echo "$input" | jq -r '.model.display_name // "Unknown"')

# コンテキスト残量（%）
CTX_REMAINING=$(echo "$input" | jq -r '.context_window.remaining_percentage // 100')
CTX_DISPLAY=$(printf "%.0f" "$CTX_REMAINING")

# ゲージ生成（10セグメント）- bcを使わずawk使用
generate_gauge() {
    local percent=$1
    local filled=$(awk "BEGIN {printf \"%.0f\", $percent / 10}")
    local empty=$((10 - filled))
    local gauge=""
    for ((i=0; i<filled; i++)); do gauge+="█"; done
    for ((i=0; i<empty; i++)); do gauge+="░"; done
    echo "[$gauge]"
}
CTX_GAUGE=$(generate_gauge "$CTX_REMAINING")

# Claude Code バージョン
VERSION=$(echo "$input" | jq -r '.version // "Unknown"')

# 現在のディレクトリ（フォルダ名のみ）
CWD=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // ""')
CWD_SHORT="${CWD##*/}"

# Git ブランチ取得
BRANCH=""
if [ -n "$CWD" ] && [ -d "$CWD/.git" ] || git -C "$CWD" rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null)
fi
BRANCH_DISPLAY="${BRANCH:-"-"}"

# 1行目: Model, Context (ゲージ付き), Version
VERSION_DISPLAY="${VERSION}"
[ "$VERSION" != "Unknown" ] && VERSION_DISPLAY="v${VERSION}"
LINE1="Model: ${MODEL} | Ctx: ${CTX_GAUGE} ${CTX_DISPLAY}% | CC: ${VERSION_DISPLAY}"

# 2行目: Branch, Cwd
LINE2="Branch: ${BRANCH_DISPLAY} | Cwd: ${CWD_SHORT}"

# 出力
echo "$LINE1"
echo "$LINE2"

# 3行目: 依存コマンドが見つからない場合はエラーメッセージを赤文字で表示
if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    RED='\033[31m'
    RESET='\033[0m'
    echo -e "${RED}Error: Missing commands: ${MISSING_DEPS[*]}${RESET}"
fi
