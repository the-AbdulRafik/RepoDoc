import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { StackProfile } from '../contracts/stack-profile.js';

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
 * Sniffs Rust framework from Cargo.toml manifest text.
 * Priority: actix-web > axum > rocket > warp > tauri > bevy
 */
export function detectRustFramework(cargoTomlText: string): string | undefined {
  const lower = cargoTomlText.toLowerCase();

  if (/(\b|['"])actix-web(\b|['"=<>~!~])/.test(lower)) {
    return 'actix-web';
  }
  if (/(\b|['"])axum(\b|['"=<>~!~])/.test(lower)) {
    return 'axum';
  }
  if (/(\b|['"])rocket(\b|['"=<>~!~])/.test(lower)) {
    return 'rocket';
  }
  if (/(\b|['"])warp(\b|['"=<>~!~])/.test(lower)) {
    return 'warp';
  }
  if (/(\b|['"])tauri(\b|['"=<>~!~])/.test(lower)) {
    return 'tauri';
  }
  if (/(\b|['"])bevy(\b|['"=<>~!~])/.test(lower)) {
    return 'bevy';
  }

  return undefined;
}

/**
 * Performs shallow detection for Rust projects.
 * Identifies framework from Cargo.toml, sets packageManager to 'cargo', and strictly sets deepDiagnosisSupported: false.
 */
export async function detectRust(repoPath: string): Promise<StackProfile> {
  const cargoPath = path.join(repoPath, 'Cargo.toml');
  const cargoContent = await readFileSafe(cargoPath);

  const framework = cargoContent ? detectRustFramework(cargoContent) : undefined;

  return {
    stack: 'rust',
    framework,
    packageManager: 'cargo',
    deepDiagnosisSupported: false,
  };
}

/**
 * Synchronous variant of detectRust.
 */
export function detectRustSync(repoPath: string): StackProfile {
  const cargoPath = path.join(repoPath, 'Cargo.toml');
  const cargoContent = readFileSafeSync(cargoPath);

  const framework = cargoContent ? detectRustFramework(cargoContent) : undefined;

  return {
    stack: 'rust',
    framework,
    packageManager: 'cargo',
    deepDiagnosisSupported: false,
  };
}
