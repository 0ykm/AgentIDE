/**
 * ウィンドウ管理モジュール
 * Electronウィンドウの作成と管理を担当
 */

const { BrowserWindow } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
  }

  /**
   * メインウィンドウを作成
   */
  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 420,
      height: 320,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    this.mainWindow.loadFile(path.join(__dirname, 'index.html'));

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  /**
   * メインウィンドウの参照を取得
   */
  getMainWindow() {
    return this.mainWindow;
  }

  /**
   * メインウィンドウが存在するかチェック
   */
  hasMainWindow() {
    return this.mainWindow !== null;
  }
}

module.exports = new WindowManager();
