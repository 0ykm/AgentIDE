.PHONY: help setup teardown dev build-server build-app clean serve

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
	node -e "const fs=require('fs');['node_modules','apps/web/node_modules','apps/server/node_modules','apps/desktop/node_modules','packages/shared/node_modules'].forEach(d=>{try{fs.rmSync(d,{recursive:true,force:true});console.log('removed: '+d)}catch(e){}})"

dev: ## 開発サーバー起動 (server + web 並列)
	mise run dev

build-server: ## Web + Server をビルド
	mise run build

build-app: ## デスクトップアプリをビルド (Electron)
	mise run build:desktop

clean: ## ビルド成果物を削除
	mise run clean

serve: ## プロダクションビルドを実行してサーバー起動
	mise run serve
