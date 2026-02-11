.PHONY: help setup teardown dev kill-dev build-server build-app build-app-dir clean serve

.DEFAULT_GOAL := help

help: ## ヘルプを表示
ifeq ($(OS),Windows_NT)
  ifdef MSYSTEM
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
  else
	@for /F "tokens=1,2 delims=#" %%a in ('findstr /R "^[a-zA-Z0-9_-]*:.*##" $(MAKEFILE_LIST)') do @echo %%a %%b
  endif
else
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
endif

setup: ## フルセットアップ (mise trust + install + npm install + shared ビルド)
	mise trust
	mise install
	mise run setup

teardown: ## セットアップの完全クリーンアップ (node_modules + ビルド成果物を削除)
	mise run clean
	rm -rf node_modules apps/web/node_modules apps/server/node_modules apps/desktop/node_modules packages/shared/node_modules

dev: ## 開発サーバー起動 (server + web 並列)
	mise run dev

kill-dev: ## 開発サーバーのプロセスを停止 (port 8787, 5173)
ifeq ($(OS),Windows_NT)
	-@pid=$$(netstat -ano | grep ':8787 ' | grep LISTENING | awk '{print $$5}'); [ -n "$$pid" ] && taskkill //F //PID $$pid 2>/dev/null && echo "Stopped server (port 8787)" || true
	-@pid=$$(netstat -ano | grep ':5173 ' | grep LISTENING | awk '{print $$5}'); [ -n "$$pid" ] && taskkill //F //PID $$pid 2>/dev/null && echo "Stopped web (port 5173)" || true
else
	-@lsof -ti:8787 | xargs kill 2>/dev/null && echo "Stopped server (port 8787)" || true
	-@lsof -ti:5173 | xargs kill 2>/dev/null && echo "Stopped web (port 5173)" || true
endif

build-server: ## Web + Server をビルド
	mise run build

build-app: ## デスクトップアプリをビルド (Electron インストーラー)
	mise run build:desktop

build-app-dir: ## デスクトップアプリをビルド (ポータブル版、コード署名スキップ)
	mise run build
	cd apps/desktop && node scripts/prepare.cjs && npx electron-builder --dir

clean: ## ビルド成果物を削除
	mise run clean

serve: ## プロダクションビルドを実行してサーバー起動
	mise run serve
