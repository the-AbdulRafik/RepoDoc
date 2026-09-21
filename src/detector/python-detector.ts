import fs from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { StackProfile } from '../contracts/stack-profile.js';

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

async function readFileSafe(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

function readFileSafeSync(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Sniffs Python framework from dependency manifest text.
 * Priority: django > fastapi > flask > tornado > pyramid
 */
export function detectPythonFramework(manifestText: string): string | undefined {
  const lower = manifestText.toLowerCase();

  // Match whole dependency or quoted dependency
  if (/(\b|['"])django(\b|['"=<>~!~])/.test(lower)) {
    return 'django';
  }
  if (/(\b|['"])fastapi(\b|['"=<>~!~])/.test(lower)) {
    return 'fastapi';
  }
  if (/(\b|['"])flask(\b|['"=<>~!~])/.test(lower)) {
    return 'flask';
  }
  if (/(\b|['"])tornado(\b|['"=<>~!~])/.test(lower)) {
    return 'tornado';
  }
  if (/(\b|['"])pyramid(\b|['"=<>~!~])/.test(lower)) {
    return 'pyramid';
  }

  return undefined;
}

/**
 * Sniffs Python package manager from lockfiles, environment files, or pyproject tool headers.
 */
export async function detectPythonPackageManager(
  repoPath: string,
  pyprojectContent?: string
): Promise<string> {
  if (await fileExists(path.join(repoPath, 'uv.lock'))) {
    return 'uv';
  }
  if (await fileExists(path.join(repoPath, 'poetry.lock'))) {
    return 'poetry';
  }
  if (
    (await fileExists(path.join(repoPath, 'Pipfile'))) ||
    (await fileExists(path.join(repoPath, 'Pipfile.lock')))
  ) {
    return 'pipenv';
  }
  if (
    (await fileExists(path.join(repoPath, 'environment.yml'))) ||
    (await fileExists(path.join(repoPath, 'environment.yaml')))
  ) {
    return 'conda';
  }

  if (pyprojectContent) {
    if (pyprojectContent.includes('[tool.poetry]')) {
      return 'poetry';
    }
    if (pyprojectContent.includes('[tool.uv]')) {
      return 'uv';
    }
    if (pyprojectContent.includes('[tool.pdm]')) {
      return 'pdm';
    }
  }

  return 'pip';
}

/**
 * Synchronous variant of detectPythonPackageManager.
 */
export function detectPythonPackageManagerSync(
  repoPath: string,
  pyprojectContent?: string
): string {
  if (fileExistsSync(path.join(repoPath, 'uv.lock'))) {
    return 'uv';
  }
  if (fileExistsSync(path.join(repoPath, 'poetry.lock'))) {
    return 'poetry';
  }
  if (
    fileExistsSync(path.join(repoPath, 'Pipfile')) ||
    fileExistsSync(path.join(repoPath, 'Pipfile.lock'))
  ) {
    return 'pipenv';
  }
  if (
    fileExistsSync(path.join(repoPath, 'environment.yml')) ||
    fileExistsSync(path.join(repoPath, 'environment.yaml'))
  ) {
    return 'conda';
  }

  if (pyprojectContent) {
    if (pyprojectContent.includes('[tool.poetry]')) {
      return 'poetry';
    }
    if (pyprojectContent.includes('[tool.uv]')) {
      return 'uv';
    }
    if (pyprojectContent.includes('[tool.pdm]')) {
      return 'pdm';
    }
  }

  return 'pip';
}

/**
 * Performs shallow detection for Python projects.
 * Identifies package manager and framework from manifests, strictly setting deepDiagnosisSupported: false.
 */
export async function detectPython(repoPath: string): Promise<StackProfile> {
  const pyprojectPath = path.join(repoPath, 'pyproject.toml');
  const reqsPath = path.join(repoPath, 'requirements.txt');
  const pipfilePath = path.join(repoPath, 'Pipfile');

  const pyprojectContent = await readFileSafe(pyprojectPath);
  const reqsContent = await readFileSafe(reqsPath);
  const pipfileContent = await readFileSafe(pipfilePath);

  const combinedManifest = [pyprojectContent, reqsContent, pipfileContent]
    .filter(Boolean)
    .join('\n');

  const packageManager = await detectPythonPackageManager(repoPath, pyprojectContent);
  const framework = combinedManifest ? detectPythonFramework(combinedManifest) : undefined;

  return {
    stack: 'python',
    framework,
    packageManager,
    deepDiagnosisSupported: false,
  };
}

/**
 * Synchronous variant of detectPython.
 */
export function detectPythonSync(repoPath: string): StackProfile {
  const pyprojectPath = path.join(repoPath, 'pyproject.toml');
  const reqsPath = path.join(repoPath, 'requirements.txt');
  const pipfilePath = path.join(repoPath, 'Pipfile');

  const pyprojectContent = readFileSafeSync(pyprojectPath);
  const reqsContent = readFileSafeSync(reqsPath);
  const pipfileContent = readFileSafeSync(pipfilePath);

  const combinedManifest = [pyprojectContent, reqsContent, pipfileContent]
    .filter(Boolean)
    .join('\n');

  const packageManager = detectPythonPackageManagerSync(repoPath, pyprojectContent);
  const framework = combinedManifest ? detectPythonFramework(combinedManifest) : undefined;

  return {
    stack: 'python',
    framework,
    packageManager,
    deepDiagnosisSupported: false,
  };
}
