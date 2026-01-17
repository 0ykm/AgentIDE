import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_ROOT } from '../config.js';
import { createHttpError } from './error.js';
import {
  normalizeWorkspacePath as sharedNormalizeWorkspacePath,
  getWorkspaceKey as sharedGetWorkspaceKey,
  getWorkspaceName as sharedGetWorkspaceName
} from '@deck-ide/shared/utils-node';

export function normalizeWorkspacePath(inputPath = ''): string {
  return sharedNormalizeWorkspacePath(inputPath || '', DEFAULT_ROOT);
}

export function getWorkspaceKey(workspacePath: string): string {
  return sharedGetWorkspaceKey(workspacePath);
}

export function getWorkspaceName(workspacePath: string, index: number): string {
  return sharedGetWorkspaceName(workspacePath, index);
}

export async function resolveSafePath(workspacePath: string, inputPath = ''): Promise<string> {
  const root = path.resolve(workspacePath);
  const resolved = path.resolve(root, inputPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw createHttpError('Path escapes root', 400);
  }
  try {
    const realPath = await fs.realpath(resolved);
    const realRoot = await fs.realpath(root);
    const realRelative = path.relative(realRoot, realPath);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw createHttpError('Symlink target escapes root', 400);
    }
    return realPath;
  } catch (error) {
    const parent = path.dirname(resolved);
    if (fsSync.existsSync(parent)) {
      const realParent = await fs.realpath(parent);
      const realRoot = await fs.realpath(root);
      const parentRelative = path.relative(realRoot, realParent);
      if (parentRelative.startsWith('..') || path.isAbsolute(parentRelative)) {
        throw createHttpError('Parent directory escapes root', 400);
      }
    }
    return resolved;
  }
}
