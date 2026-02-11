/**
 * ポータブルビルドのzip圧縮スクリプト
 * dist/ 内の *-unpacked ディレクトリをzipファイルに圧縮する
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
const unpackedDirs = entries.filter(
  (e) => e.isDirectory() && e.name.endsWith('-unpacked')
);

if (unpackedDirs.length === 0) {
  console.error('[zip-portable] No *-unpacked directories found in dist/');
  process.exit(1);
}

// プラットフォーム名のマッピング
const platformMap = {
  'win-unpacked': 'win-x64',
  'linux-unpacked': 'linux-x64',
  'mac-unpacked': 'mac-x64',
  'mac-arm64-unpacked': 'mac-arm64',
};

for (const dir of unpackedDirs) {
  const platform = platformMap[dir.name] || dir.name.replace('-unpacked', '');
  const zipName = `Agent-IDE-${version}-${platform}-portable.zip`;
  const zipPath = path.join(distDir, zipName);
  const sourceDir = path.join(distDir, dir.name);

  // 既存のzipを削除
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  console.log(`[zip-portable] Compressing ${dir.name} -> ${zipName}`);

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
    console.error(`[zip-portable] Failed to compress ${dir.name}: ${err.message}`);
    process.exit(1);
  }
}
