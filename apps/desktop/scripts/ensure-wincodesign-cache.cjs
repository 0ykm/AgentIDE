/**
 * winCodeSign キャッシュ事前作成スクリプト
 *
 * electron-builder が winCodeSign-2.6.0.7z を展開する際、
 * macOS用シンボリックリンクの作成に失敗して異常終了する問題を回避する。
 * 事前に 7za で展開（シンボリックリンクのエラーは無視）し、
 * 正しいキャッシュディレクトリ名にリネームすることで
 * electron-builder のダウンロード・展開ステップをスキップさせる。
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const VERSION = 'winCodeSign-2.6.0';
const DOWNLOAD_URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${VERSION}/${VERSION}.7z`;

const CACHE_DIR = path.join(
  process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
  'electron-builder',
  'Cache',
  'winCodeSign'
);
const TARGET_DIR = path.join(CACHE_DIR, VERSION);

// 7za binary bundled with electron-builder
const SEVEN_ZIP = path.resolve(
  __dirname,
  '..',
  'node_modules',
  '7zip-bin',
  'win',
  'x64',
  '7za.exe'
);

if (process.platform !== 'win32') {
  console.log('[ensure-wincodesign-cache] Not Windows, skipping');
  process.exit(0);
}

if (fs.existsSync(TARGET_DIR)) {
  console.log(`[ensure-wincodesign-cache] Cache already exists: ${TARGET_DIR}`);
  process.exit(0);
}

console.log(`[ensure-wincodesign-cache] Cache not found, creating...`);
fs.mkdirSync(CACHE_DIR, { recursive: true });

// Download
const tempId = crypto.randomBytes(4).toString('hex');
const tempArchive = path.join(CACHE_DIR, `${tempId}.7z`);
const tempDir = path.join(CACHE_DIR, tempId);

try {
  console.log(`[ensure-wincodesign-cache] Downloading ${VERSION}.7z ...`);
  execSync(`curl -L -o "${tempArchive}" "${DOWNLOAD_URL}"`, { stdio: 'inherit' });

  // Extract (exit code 2 = sub-item errors for symlinks, which is OK)
  console.log(`[ensure-wincodesign-cache] Extracting (symlink errors are expected) ...`);
  try {
    execSync(`"${SEVEN_ZIP}" x -bd -y "${tempArchive}" "-o${tempDir}"`, { stdio: 'inherit' });
  } catch (e) {
    // exit code 2 means "sub-item errors" (symlinks) - acceptable
    if (e.status !== 2) {
      throw e;
    }
    console.log('[ensure-wincodesign-cache] Symlink errors ignored (darwin-only, not needed on Windows)');
  }

  // Rename to expected cache directory name
  fs.renameSync(tempDir, TARGET_DIR);
  console.log(`[ensure-wincodesign-cache] Cache created: ${TARGET_DIR}`);
} finally {
  // Clean up temp archive
  try { fs.unlinkSync(tempArchive); } catch {}
  try { fs.rmSync(tempDir, { recursive: true }); } catch {}
}
