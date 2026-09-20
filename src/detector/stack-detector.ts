import fs from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import type { SupportedStack } from '../contracts/stack-profile.js';

const NODE_SIGNATURES = ['package.json'] as const;
const PYTHON_SIGNATURES = ['pyproject.toml', 'requirements.txt'] as const;
const RUST_SIGNATURES = ['Cargo.toml'] as const;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function fileExistsSync(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Detects the stack of a repository based exclusively on signature file existence.
 * Does not read any file contents.
 */
export async function detectStackSignature(repoPath: string): Promise<SupportedStack> {
  // Check for Node signatures
  for (const sig of NODE_SIGNATURES) {
    if (await fileExists(path.join(repoPath, sig))) {
      return 'node';
    }
  }

  // Check for Python signatures
  for (const sig of PYTHON_SIGNATURES) {
    if (await fileExists(path.join(repoPath, sig))) {
      return 'python';
    }
  }

  // Check for Rust signatures
  for (const sig of RUST_SIGNATURES) {
    if (await fileExists(path.join(repoPath, sig))) {
      return 'rust';
    }
  }

  return 'unknown';
}

/**
 * Synchronous variant of detectStackSignature.
 * Detects the stack based exclusively on signature file existence without reading file contents.
 */
export function detectStackSignatureSync(repoPath: string): SupportedStack {
  // Check for Node signatures
  for (const sig of NODE_SIGNATURES) {
    if (fileExistsSync(path.join(repoPath, sig))) {
      return 'node';
    }
  }

  // Check for Python signatures
  for (const sig of PYTHON_SIGNATURES) {
    if (fileExistsSync(path.join(repoPath, sig))) {
      return 'python';
    }
  }

  // Check for Rust signatures
  for (const sig of RUST_SIGNATURES) {
    if (fileExistsSync(path.join(repoPath, sig))) {
      return 'rust';
    }
  }

  return 'unknown';
}
