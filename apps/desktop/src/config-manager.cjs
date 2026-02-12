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
    // asarUnpackされたserverディレクトリを参照
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'server', 'index.js');
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
    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules'),
    path.join(app.getAppPath(), 'node_modules'),
    path.join(process.resourcesPath, 'node_modules')
  ];
  return candidates
    .filter((candidate) => fs.existsSync(candidate))
    .join(path.delimiter);
};

/**
 * ポータブルモードかどうかを判定
 * パッケージ済みかつ exe 隣に .portable マーカーファイルが存在する場合にtrue
 */
const isPortable = () => {
  if (!app.isPackaged) return false;
  const markerPath = path.join(path.dirname(process.execPath), '.portable');
  return fs.existsSync(markerPath);
};

/**
 * macOS の .app バンドルパスを取得
 * process.execPath: /path/to/Agent IDE.app/Contents/MacOS/Agent IDE
 * 返却値: /path/to/Agent IDE.app
 */
const getMacAppPath = () => {
  const appPath = path.resolve(path.dirname(process.execPath), '..', '..');
  if (appPath.endsWith('.app')) {
    return appPath;
  }
  return null;
};

/**
 * データ保存先のベースパスを取得
 * ポータブル時(Windows/Linux): exe隣の data/ フォルダ
 * ポータブル時(macOS): .app バンドルの隣の data/ フォルダ
 * 通常時: app.getPath('userData')
 */
const getDataBasePath = () => {
  if (isPortable()) {
    if (process.platform === 'darwin') {
      // macOS: .app バンドルの親ディレクトリに data/ を作成
      const appPath = getMacAppPath();
      if (appPath) {
        return path.join(path.dirname(appPath), 'data');
      }
    }
    return path.join(path.dirname(process.execPath), 'data');
  }
  return app.getPath('userData');
};

/**
 * データベースファイルのパスを取得
 * ポータブル時: data/agent-ide.db (getDataBasePath直下)
 * 通常時: userData/data/agent-ide.db (既存構造を維持)
 */
const getDbPath = () => {
  if (isPortable()) {
    return path.join(getDataBasePath(), 'agent-ide.db');
  }
  return path.join(getDataBasePath(), 'data', 'agent-ide.db');
};

/**
 * 設定ファイルのパスを取得
 */
const getConfigPath = () => {
  const base = getDataBasePath();
  return path.join(base, 'config.json');
};

/**
 * デフォルト設定
 */
const getDefaultConfig = () => {
  return {
    port: DEFAULT_PORT,
    basicAuth: {
      enabled: false,
      username: '',
      password: ''
    }
  };
};

/**
 * 設定を読み込む
 */
const loadConfig = () => {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return { ...getDefaultConfig(), ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return getDefaultConfig();
};

/**
 * 設定を保存する
 */
const saveConfig = (config) => {
  const configPath = getConfigPath();
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to save config:', error);
    return false;
  }
};

/**
 * サーバー起動時の環境変数を生成
 */
const getServerEnvironment = (config = null) => {
  const nodeBinary = resolveNodeBinary();
  const currentConfig = config || loadConfig();

  const env = {
    ...process.env,
    PORT: String(currentConfig.port),
    NODE_PATH: getNodePath(),
    DB_PATH: getDbPath()
  };

  // Basic認証設定
  if (currentConfig.basicAuth && currentConfig.basicAuth.enabled) {
    env.BASIC_AUTH_USER = currentConfig.basicAuth.username;
    env.BASIC_AUTH_PASSWORD = currentConfig.basicAuth.password;
  }

  if (nodeBinary === process.execPath) {
    env.ELECTRON_RUN_AS_NODE = '1';
  }

  return env;
};

/**
 * macOS LaunchAgent plist のパスを取得
 */
const getMacLaunchAgentPath = () => {
  return path.join(app.getPath('home'), 'Library', 'LaunchAgents', 'com.agent.ide.plist');
};

/**
 * 自動起動設定を取得
 */
const getAutoStartEnabled = () => {
  if (process.platform === 'darwin') {
    return fs.existsSync(getMacLaunchAgentPath());
  }
  return app.getLoginItemSettings().openAtLogin;
};

/**
 * 自動起動設定を変更
 * macOS: LaunchAgent plist を作成/削除
 * Windows/Linux: Electron の setLoginItemSettings を使用
 */
const setAutoStartEnabled = (enabled) => {
  if (process.platform === 'darwin') {
    const plistPath = getMacLaunchAgentPath();
    if (enabled) {
      const appPath = getMacAppPath() || process.execPath;
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.agent.ide</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/open</string>
        <string>-a</string>
        <string>${appPath}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
`;
      const dir = path.dirname(plistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(plistPath, plistContent, 'utf-8');
    } else {
      if (fs.existsSync(plistPath)) {
        fs.unlinkSync(plistPath);
      }
    }
    return;
  }
  app.setLoginItemSettings({
    openAtLogin: Boolean(enabled),
    openAsHidden: true
  });
};

/**
 * 指定ポートを使用しているプロセスをkillする
 */
const killProcessOnPort = async (port) => {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    if (process.platform === 'win32') {
      // Windows: netstat でポートを使用しているPIDを取得
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');

      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && !isNaN(pid)) {
          pids.add(pid);
        }
      }

      if (pids.size === 0) {
        return { success: false, message: `No process found on port ${port}` };
      }

      // 各PIDをkill
      for (const pid of pids) {
        try {
          await execAsync(`taskkill /PID ${pid} /F`);
          console.log(`Killed process ${pid} on port ${port}`);
        } catch (err) {
          console.error(`Failed to kill PID ${pid}:`, err.message);
        }
      }

      return { success: true, message: `Killed ${pids.size} process(es) on port ${port}` };
    } else {
      // Unix系: lsof でPIDを取得
      try {
        const { stdout } = await execAsync(`lsof -ti :${port}`);
        const pids = stdout.trim().split('\n').filter(pid => pid);

        if (pids.length === 0) {
          return { success: false, message: `No process found on port ${port}` };
        }

        // 各PIDをkill
        for (const pid of pids) {
          await execAsync(`kill -9 ${pid}`);
          console.log(`Killed process ${pid} on port ${port}`);
        }

        return { success: true, message: `Killed ${pids.length} process(es) on port ${port}` };
      } catch (err) {
        if (err.message.includes('lsof: command not found')) {
          // lsofが使えない場合、netstatを試す
          const { stdout } = await execAsync(`netstat -vanp tcp | grep ${port}`);
          const lines = stdout.trim().split('\n');
          const pids = new Set();

          for (const line of lines) {
            const match = line.match(/\s+(\d+)\//);
            if (match) {
              pids.add(match[1]);
            }
          }

          if (pids.size === 0) {
            return { success: false, message: `No process found on port ${port}` };
          }

          for (const pid of pids) {
            await execAsync(`kill -9 ${pid}`);
          }

          return { success: true, message: `Killed ${pids.size} process(es) on port ${port}` };
        }
        throw err;
      }
    }
  } catch (error) {
    console.error('Failed to kill process on port:', error);
    return { success: false, message: error.message };
  }
};

module.exports = {
  resolveServerEntry,
  resolveNodeBinary,
  getNodePath,
  isPortable,
  getDataBasePath,
  getDbPath,
  getConfigPath,
  getDefaultConfig,
  loadConfig,
  saveConfig,
  getServerEnvironment,
  getAutoStartEnabled,
  setAutoStartEnabled,
  killProcessOnPort
};
