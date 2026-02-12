/**
 * node-pty prebuild の spawn-helper に実行権限を付与する
 * node-pty@1.1.0 の prebuild バイナリに実行権限がないため、
 * macOS/Linux で posix_spawnp が失敗する問題を修正
 */

const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  process.exit(0);
}

const prebuildsDir = path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds');

if (!fs.existsSync(prebuildsDir)) {
  process.exit(0);
}

let fixed = 0;
for (const dir of fs.readdirSync(prebuildsDir)) {
  const helper = path.join(prebuildsDir, dir, 'spawn-helper');
  if (fs.existsSync(helper)) {
    const stat = fs.statSync(helper);
    if ((stat.mode & 0o111) === 0) {
      fs.chmodSync(helper, stat.mode | 0o755);
      console.log(`[fix-node-pty] Fixed execute permission: ${helper}`);
      fixed++;
    }
  }
}

if (fixed > 0) {
  console.log(`[fix-node-pty] Fixed ${fixed} spawn-helper binary(ies)`);
}
