/**
 * ポータブルビルド用マーカーファイル作成スクリプト
 * dist/ 内の *-unpacked ディレクトリに .portable ファイルを配置する
 */

const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('[mark-portable] dist/ directory not found');
  process.exit(1);
}

const entries = fs.readdirSync(distDir, { withFileTypes: true });
const unpackedDirs = entries.filter(
  (e) => e.isDirectory() && e.name.endsWith('-unpacked')
);

if (unpackedDirs.length === 0) {
  console.error('[mark-portable] No *-unpacked directories found in dist/');
  process.exit(1);
}

for (const dir of unpackedDirs) {
  const markerPath = path.join(distDir, dir.name, '.portable');
  fs.writeFileSync(markerPath, '', 'utf-8');
  console.log(`[mark-portable] Created ${markerPath}`);
}
