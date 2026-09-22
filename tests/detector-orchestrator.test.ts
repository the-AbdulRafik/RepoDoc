import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectStack,
  detectStackSync,
  detectNode,
  detectPython,
  detectRust,
} from '../src/index.js';

describe('Module 5: Detector Orchestrator', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoc-orchestrator-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Done When: Equivalence Verification against Modules 2-4', () => {
    it('returns result identical to detectNode for Node fixtures', async () => {
      const packageJson = {
        name: 'vite-yarn-sample',
        devDependencies: {
          vite: '^5.0.0',
        },
        scripts: {
          dev: 'vite',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');

      const directResult = await detectNode(tempDir);
      const orchestratorResult = await detectStack(tempDir);
      const syncResult = detectStackSync(tempDir);

      expect(orchestratorResult).toEqual(directResult);
      expect(syncResult).toEqual(directResult);
      expect(orchestratorResult).toEqual({
        stack: 'node',
        framework: 'vite',
        packageManager: 'yarn',
        scripts: { dev: 'vite' },
        deepDiagnosisSupported: true,
      });
    });

    it('returns result identical to detectNode for NestJS collision fixtures', async () => {
      const packageJson = {
        name: 'nest-vite-sample',
        dependencies: {
          '@nestjs/core': '^10.0.0',
        },
        devDependencies: {
          vite: '^5.0.0',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const directResult = await detectNode(tempDir);
      const orchestratorResult = await detectStack(tempDir);

      expect(orchestratorResult).toEqual(directResult);
      expect(orchestratorResult.framework).toBe('nest');
      expect(orchestratorResult.deepDiagnosisSupported).toBe(true);
    });

    it('returns result identical to detectPython for Python Django fixtures', async () => {
      const pyproject = `
[project]
name = "django-sample"
dependencies = ["django>=4.2"]
`;
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), pyproject);
      fs.writeFileSync(path.join(tempDir, 'poetry.lock'), '');

      const directResult = await detectPython(tempDir);
      const orchestratorResult = await detectStack(tempDir);
      const syncResult = detectStackSync(tempDir);

      expect(orchestratorResult).toEqual(directResult);
      expect(syncResult).toEqual(directResult);
      expect(orchestratorResult).toEqual({
        stack: 'python',
        framework: 'django',
        packageManager: 'poetry',
        deepDiagnosisSupported: false,
      });
    });

    it('returns result identical to detectRust for Rust Actix fixtures', async () => {
      const cargo = `
[package]
name = "actix-sample"
version = "0.1.0"
[dependencies]
actix-web = "4.0"
`;
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), cargo);

      const directResult = await detectRust(tempDir);
      const orchestratorResult = await detectStack(tempDir);
      const syncResult = detectStackSync(tempDir);

      expect(orchestratorResult).toEqual(directResult);
      expect(syncResult).toEqual(directResult);
      expect(orchestratorResult).toEqual({
        stack: 'rust',
        framework: 'actix-web',
        packageManager: 'cargo',
        deepDiagnosisSupported: false,
      });
    });

    it('returns bare unknown profile for empty or non-matching directories', async () => {
      fs.writeFileSync(path.join(tempDir, 'notes.txt'), 'hello world');

      const result = await detectStack(tempDir);
      const syncResult = detectStackSync(tempDir);

      const expected = {
        stack: 'unknown',
        deepDiagnosisSupported: false,
      };

      expect(result).toEqual(expected);
      expect(syncResult).toEqual(expected);
    });

    it('returns bare unknown profile for non-existent path', async () => {
      const nonExistent = path.join(tempDir, 'missing-dir');

      const result = await detectStack(nonExistent);
      const syncResult = detectStackSync(nonExistent);

      const expected = {
        stack: 'unknown',
        deepDiagnosisSupported: false,
      };

      expect(result).toEqual(expected);
      expect(syncResult).toEqual(expected);
    });
  });
});
