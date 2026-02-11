/**
 * ウィンドウ管理モジュール
 * Electronウィンドウの作成と管理を担当
 */

const { BrowserWindow, Tray, Menu, nativeImage, app } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.isQuitting = false;
  }

  /**
   * メインウィンドウを作成
   */
  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 420,
      height: 520,
      resizable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    this.mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // 閉じるボタンでウィンドウを非表示にする（トレイに最小化）
    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // システムトレイを作成
    this.createTray();

    return this.mainWindow;
  }

  /**
   * システムトレイを作成
   */
  createTray() {
    // アプリアイコンをファイルから読み込む
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'icon.png')
      : path.join(__dirname, '..', 'build', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });

    this.tray = new Tray(icon);
    this.tray.setToolTip('Agent IDE Server');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show',
        click: () => {
          this.showWindow();
        }
      },
      {
        label: 'Hide',
        click: () => {
          this.mainWindow?.hide();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);

    // トレイアイコンをダブルクリックでウィンドウを表示
    this.tray.on('double-click', () => {
      this.showWindow();
    });
  }

  /**
   * ウィンドウを表示
   */
  showWindow() {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  /**
   * アプリケーションを終了
   */
  quit() {
    this.isQuitting = true;
    app.quit();
  }

  /**
   * 終了フラグを設定
   */
  setQuitting(value) {
    this.isQuitting = value;
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
