import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectStackSignature,
  detectStackSignatureSync,
} from '../src/index.js';

describe('Module 2: Generic Stack Detector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects "node" when package.json exists', async () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), '');

    expect(await detectStackSignature(tempDir)).toBe('node');
    expect(detectStackSignatureSync(tempDir)).toBe('node');
  });

  it('detects "python" when pyproject.toml exists', async () => {
    fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), '');

    expect(await detectStackSignature(tempDir)).toBe('python');
    expect(detectStackSignatureSync(tempDir)).toBe('python');
  });

  it('detects "python" when requirements.txt exists', async () => {
    fs.writeFileSync(path.join(tempDir, 'requirements.txt'), '');

    expect(await detectStackSignature(tempDir)).toBe('python');
    expect(detectStackSignatureSync(tempDir)).toBe('python');
  });

  it('detects "rust" when Cargo.toml exists', async () => {
    fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '');

    expect(await detectStackSignature(tempDir)).toBe('rust');
    expect(detectStackSignatureSync(tempDir)).toBe('rust');
  });

  it('detects "unknown" when directory has no matching signatures', async () => {
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Hello');
    fs.writeFileSync(path.join(tempDir, 'Makefile'), 'all:');

    expect(await detectStackSignature(tempDir)).toBe('unknown');
    expect(detectStackSignatureSync(tempDir)).toBe('unknown');
  });

  it('detects "unknown" when directory is completely empty', async () => {
    expect(await detectStackSignature(tempDir)).toBe('unknown');
    expect(detectStackSignatureSync(tempDir)).toBe('unknown');
  });

  it('detects "unknown" when repoPath does not exist', async () => {
    const nonExistentPath = path.join(tempDir, 'does-not-exist');

    expect(await detectStackSignature(nonExistentPath)).toBe('unknown');
    expect(detectStackSignatureSync(nonExistentPath)).toBe('unknown');
  });

  it('detects signature without reading file content (works with corrupted/invalid syntax)', async () => {
    // Write invalid/corrupt syntax into signature files
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{ invalid json @!#$%^&*');

    expect(await detectStackSignature(tempDir)).toBe('node');
    expect(detectStackSignatureSync(tempDir)).toBe('node');
  });

  it('respects deterministic precedence when multiple signatures exist (node > python > rust)', async () => {
    // Both package.json and requirements.txt exist
    fs.writeFileSync(path.join(tempDir, 'package.json'), '{}');
    fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'flask');
    fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), '[package]');

    expect(await detectStackSignature(tempDir)).toBe('node');
    expect(detectStackSignatureSync(tempDir)).toBe('node');

    // Remove package.json -> python should now precede rust
    fs.unlinkSync(path.join(tempDir, 'package.json'));
    expect(await detectStackSignature(tempDir)).toBe('python');
    expect(detectStackSignatureSync(tempDir)).toBe('python');

    // Remove requirements.txt -> rust should be detected
    fs.unlinkSync(path.join(tempDir, 'requirements.txt'));
    expect(await detectStackSignature(tempDir)).toBe('rust');
    expect(detectStackSignatureSync(tempDir)).toBe('rust');
  });
});
