/**
 * ポータブルビルドのzip圧縮スクリプト
 * dist/ 内の *-unpacked ディレクトリ（Windows/Linux）または
 * mac / mac-arm64 ディレクトリ（macOS）をzipファイルに圧縮する
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.resolve(__dirname, '..', 'dist');
const pkg = require(path.resolve(__dirname, '..', 'package.json'));
const version = pkg.version;

if (!fs.existsSync(distDir)) {
  console.error('[zip-portable] dist/ directory not found');
  process.exit(1);
}

const entries = fs.readdirSync(distDir, { withFileTypes: true });

// Windows/Linux: *-unpacked ディレクトリ
const unpackedDirs = entries.filter(
  (e) => e.isDirectory() && e.name.endsWith('-unpacked')
);

// macOS: mac / mac-arm64 ディレクトリ
const macDirs = entries.filter(
  (e) => e.isDirectory() && (e.name === 'mac' || e.name === 'mac-arm64')
);

if (unpackedDirs.length === 0 && macDirs.length === 0) {
  console.error('[zip-portable] No target directories found in dist/');
  process.exit(1);
}

// プラットフォーム名のマッピング
const platformMap = {
  'win-unpacked': 'win-x64',
  'linux-unpacked': 'linux-x64',
  'mac': 'mac-x64',
  'mac-arm64': 'mac-arm64',
};

/**
 * ディレクトリをzip圧縮する
 */
function zipDirectory(dirName, sourceDir) {
  const platform = platformMap[dirName] || dirName.replace('-unpacked', '');
  const zipName = `Agent-IDE-${version}-${platform}-portable.zip`;
  const zipPath = path.join(distDir, zipName);

  // 既存のzipを削除
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  console.log(`[zip-portable] Compressing ${dirName} -> ${zipName}`);

  try {
    if (process.platform === 'win32') {
      // PowerShell の Compress-Archive を使用
      execSync(
        `powershell -NoProfile -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`,
        { stdio: 'inherit' }
      );
    } else {
      // Unix系: zip コマンドを使用
      execSync(`cd "${sourceDir}" && zip -r "${zipPath}" .`, {
        stdio: 'inherit',
      });
    }
    console.log(`[zip-portable] Created ${zipPath}`);
  } catch (err) {
    console.error(`[zip-portable] Failed to compress ${dirName}: ${err.message}`);
    process.exit(1);
  }
}

// Windows/Linux: *-unpacked ディレクトリを圧縮
for (const dir of unpackedDirs) {
  zipDirectory(dir.name, path.join(distDir, dir.name));
}

// macOS: mac / mac-arm64 ディレクトリを圧縮
for (const dir of macDirs) {
  zipDirectory(dir.name, path.join(distDir, dir.name));
}
