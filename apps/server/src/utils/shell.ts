import fs from 'node:fs';
import path from 'node:path';

const GIT_BASH_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
];

function findGitBash(): string | null {
  for (const p of GIT_BASH_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  // Check via GIT_INSTALL_ROOT or ProgramFiles env vars
  for (const envKey of ['GIT_INSTALL_ROOT', 'ProgramFiles', 'ProgramFiles(x86)']) {
    const dir = process.env[envKey];
    if (dir) {
      const candidate = path.join(dir, 'Git', 'bin', 'bash.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

export function getDefaultShell(): string {
  if (process.env.SHELL) return process.env.SHELL;

  if (process.platform === 'win32') {
    return findGitBash() ?? 'powershell.exe';
  }
  if (process.platform === 'darwin') {
    return 'zsh';
  }
  return 'bash';
}

/** Check if a shell path points to a bash-like shell (bash, zsh, sh) */
export function isBashLikeShell(shellPath: string): boolean {
  const base = path.basename(shellPath).toLowerCase().replace(/\.exe$/, '');
  return ['bash', 'zsh', 'sh', 'fish'].includes(base);
}
