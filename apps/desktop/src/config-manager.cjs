/**
 * 設定管理モジュール
 * アプリケーション設定の読み書きを担当
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { DEFAULT_PORT } = require('./constants.cjs');

/**
 * サーバーエントリーポイントのパスを解決
 */
const resolveServerEntry = () => {
  if (app.isPackaged) {
    return path.join(app.getAppPath(), 'server', 'index.js');
  }
  return path.resolve(__dirname, '..', '..', 'server', 'dist', 'index.js');
};

/**
 * Node.jsバイナリのパスを解決
 */
const resolveNodeBinary = () => {
  return process.env.DECK_IDE_NODE || process.execPath;
};

/**
 * NODE_PATH環境変数の値を取得
 */
const getNodePath = () => {
  const candidates = [
    path.join(app.getAppPath(), 'node_modules'),
    path.join(process.resourcesPath, 'node_modules')
  ];
  return candidates
    .filter((candidate) => fs.existsSync(candidate))
    .join(path.delimiter);
};

/**
 * データベースファイルのパスを取得
 */
const getDbPath = () => {
  const base = app.getPath('userData');
  return path.join(base, 'data', 'deck-ide.db');
};

/**
 * サーバー起動時の環境変数を生成
 */
const getServerEnvironment = () => {
  const nodeBinary = resolveNodeBinary();
  const env = {
    ...process.env,
    PORT: String(DEFAULT_PORT),
    NODE_PATH: getNodePath(),
    DB_PATH: getDbPath()
  };

  if (nodeBinary === process.execPath) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  return env;
};

/**
 * 自動起動設定を取得
 */
const getAutoStartEnabled = () => {
  return app.getLoginItemSettings().openAtLogin;
};

/**
 * 自動起動設定を変更
 */
const setAutoStartEnabled = (enabled) => {
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    openAsHidden: true
  });
};

module.exports = {
  resolveServerEntry,
  resolveNodeBinary,
  getNodePath,
  getDbPath,
  getServerEnvironment,
  getAutoStartEnabled,
  setAutoStartEnabled
};
