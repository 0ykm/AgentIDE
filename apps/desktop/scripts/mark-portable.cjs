/**
 * ポータブルビルド用マーカーファイル作成スクリプト
 * dist/ 内の *-unpacked ディレクトリ（Windows/Linux）または
 * mac / mac-arm64 ディレクトリ（macOS）に .portable ファイルを配置する
 */

const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('[mark-portable] dist/ directory not found');
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
  console.error('[mark-portable] No target directories found in dist/');
  process.exit(1);
}

// Windows/Linux: ディレクトリ直下に .portable を配置
for (const dir of unpackedDirs) {
  const markerPath = path.join(distDir, dir.name, '.portable');
  fs.writeFileSync(markerPath, '', 'utf-8');
  console.log(`[mark-portable] Created ${markerPath}`);
}

// macOS: .app 内の実行ファイル隣に .portable を配置
// (process.execPath の dirname = .app/Contents/MacOS/)
for (const dir of macDirs) {
  const macDir = path.join(distDir, dir.name);
  const apps = fs.readdirSync(macDir).filter((n) => n.endsWith('.app'));
  for (const appName of apps) {
    const macosDir = path.join(macDir, appName, 'Contents', 'MacOS');
    if (fs.existsSync(macosDir)) {
      const markerPath = path.join(macosDir, '.portable');
      fs.writeFileSync(markerPath, '', 'utf-8');
      console.log(`[mark-portable] Created ${markerPath}`);
    }
  }
}
