import fs from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { StackProfile } from '../contracts/stack-profile.js';

export interface PackageJson {
  name?: string;
  version?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  packageManager?: string;
  [key: string]: unknown;
}

const LOCKFILES: Array<{ filename: string; pm: string }> = [
  { filename: 'bun.lock', pm: 'bun' },
  { filename: 'bun.lockb', pm: 'bun' },
  { filename: 'pnpm-lock.yaml', pm: 'pnpm' },
  { filename: 'yarn.lock', pm: 'yarn' },
  { filename: 'package-lock.json', pm: 'npm' },
];

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
 * Detects package manager from lockfile evidence or package.json's packageManager field.
 * Defaults to 'npm' if no evidence is found.
 */
export async function detectPackageManager(
  repoPath: string,
  packageJson?: PackageJson
): Promise<string> {
  for (const { filename, pm } of LOCKFILES) {
    if (await fileExists(path.join(repoPath, filename))) {
      return pm;
    }
  }

  if (packageJson?.packageManager) {
    const match = packageJson.packageManager.match(/^([a-z]+)/);
    if (match) {
      return match[1];
    }
  }

  return 'npm';
}

/**
 * Synchronous variant of detectPackageManager.
 */
export function detectPackageManagerSync(
  repoPath: string,
  packageJson?: PackageJson
): string {
  for (const { filename, pm } of LOCKFILES) {
    if (fileExistsSync(path.join(repoPath, filename))) {
      return pm;
    }
  }

  if (packageJson?.packageManager) {
    const match = packageJson.packageManager.match(/^([a-z]+)/);
    if (match) {
      return match[1];
    }
  }

  return 'npm';
}

/**
 * Detects framework based on dependencies and devDependencies in package.json.
 * Priority order: next > cra > nest > vite > express
 */
export function detectFramework(packageJson?: PackageJson): string | undefined {
  if (!packageJson) {
    return undefined;
  }

  const allDeps: Record<string, string> = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
  };

  if ('next' in allDeps) {
    return 'next';
  }
  if ('react-scripts' in allDeps) {
    return 'cra';
  }
  if ('@nestjs/core' in allDeps || '@nestjs/common' in allDeps) {
    return 'nest';
  }
  if ('vite' in allDeps) {
    return 'vite';
  }
  if ('express' in allDeps) {
    return 'express';
  }

  return undefined;
}

/**
 * Formats a command to run a package.json script according to the detected package manager.
 */
export function getRunScriptCommand(
  packageManager: string | undefined,
  scriptName: string
): string {
  const pm = packageManager?.toLowerCase() ?? 'npm';

  switch (pm) {
    case 'yarn':
      return `yarn ${scriptName}`;
    case 'pnpm':
      return `pnpm ${scriptName}`;
    case 'bun':
      return `bun run ${scriptName}`;
    case 'npm':
    default:
      return `npm run ${scriptName}`;
  }
}

function parsePackageJsonContent(content: string): PackageJson | undefined {
  try {
    return JSON.parse(content) as PackageJson;
  } catch {
    return undefined;
  }
}

/**
 * Performs deep inspection of a Node.js repository to determine framework,
 * package manager (from lockfiles), scripts, and returns a verified StackProfile.
 */
export async function detectNode(repoPath: string): Promise<StackProfile> {
  const pkgPath = path.join(repoPath, 'package.json');
  let packageJson: PackageJson | undefined;

  if (await fileExists(pkgPath)) {
    try {
      const raw = await readFile(pkgPath, 'utf8');
      packageJson = parsePackageJsonContent(raw);
    } catch {
      packageJson = undefined;
    }
  }

  const packageManager = await detectPackageManager(repoPath, packageJson);
  const framework = detectFramework(packageJson);
  const scripts = packageJson?.scripts;

  return {
    stack: 'node',
    framework,
    packageManager,
    scripts,
    deepDiagnosisSupported: true,
  };
}

/**
 * Synchronous variant of detectNode.
 */
export function detectNodeSync(repoPath: string): StackProfile {
  const pkgPath = path.join(repoPath, 'package.json');
  let packageJson: PackageJson | undefined;

  if (fileExistsSync(pkgPath)) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf8');
      packageJson = parsePackageJsonContent(raw);
    } catch {
      packageJson = undefined;
    }
  }

  const packageManager = detectPackageManagerSync(repoPath, packageJson);
  const framework = detectFramework(packageJson);
  const scripts = packageJson?.scripts;

  return {
    stack: 'node',
    framework,
    packageManager,
    scripts,
    deepDiagnosisSupported: true,
  };
}
