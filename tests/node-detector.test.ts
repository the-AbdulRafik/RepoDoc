import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectNode,
  detectNodeSync,
  detectPackageManager,
  detectPackageManagerSync,
  detectFramework,
  getRunScriptCommand,
} from '../src/index.js';

describe('Module 3: Node Deep Detector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoc-node-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Done When: Spec Verification', () => {
    it('returns framework: "vite", packageManager: "yarn", and scripts.dev matching package.json', async () => {
      const packageJson = {
        name: 'vite-yarn-sample',
        devDependencies: {
          vite: '^5.0.0',
        },
        scripts: {
          dev: 'vite --port 3000',
          build: 'vite build',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '# Yarn lockfile v1\n');

      const profile = await detectNode(tempDir);

      expect(profile.stack).toBe('node');
      expect(profile.framework).toBe('vite');
      expect(profile.packageManager).toBe('yarn');
      expect(profile.scripts?.dev).toBe('vite --port 3000');
      expect(profile.deepDiagnosisSupported).toBe(true);

      // Verify sync variant as well
      const syncProfile = detectNodeSync(tempDir);
      expect(syncProfile).toEqual(profile);
    });
  });

  describe('Framework Collision: NestJS vs Vite', () => {
    it('resolves framework: "nest" when both @nestjs/core and vite exist', async () => {
      const packageJson = {
        name: 'nest-with-vite',
        dependencies: {
          '@nestjs/core': '^10.0.0',
          '@nestjs/common': '^10.0.0',
        },
        devDependencies: {
          vite: '^5.0.0',
        },
        scripts: {
          start: 'nest start',
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      const profile = await detectNode(tempDir);
      expect(profile.framework).toBe('nest');

      const syncProfile = detectNodeSync(tempDir);
      expect(syncProfile.framework).toBe('nest');
    });
  });

  describe('Framework Detection & Priority Order', () => {
    it('detects Next.js when "next" is in dependencies', () => {
      expect(detectFramework({ dependencies: { next: '14.0.0' } })).toBe('next');
    });

    it('detects Create React App when "react-scripts" is in dependencies', () => {
      expect(detectFramework({ dependencies: { 'react-scripts': '5.0.1' } })).toBe('cra');
    });

    it('detects NestJS when "@nestjs/core" is in dependencies', () => {
      expect(detectFramework({ dependencies: { '@nestjs/core': '^10.0.0' } })).toBe('nest');
    });

    it('detects NestJS when "@nestjs/common" is in dependencies', () => {
      expect(detectFramework({ dependencies: { '@nestjs/common': '^10.0.0' } })).toBe('nest');
    });

    it('detects Vite when "vite" is in devDependencies', () => {
      expect(detectFramework({ devDependencies: { vite: '^5.1.0' } })).toBe('vite');
    });

    it('detects Express when "express" is in dependencies', () => {
      expect(detectFramework({ dependencies: { express: '^4.19.0' } })).toBe('express');
    });

    it('prioritizes next > cra > nest > vite > express when multiple frameworks coexist', () => {
      // next beats cra, nest, vite, express
      expect(
        detectFramework({
          dependencies: { next: '14.0.0', 'react-scripts': '5.0.0', '@nestjs/core': '10.0.0', express: '4.18.0' },
          devDependencies: { vite: '5.0.0' },
        })
      ).toBe('next');

      // cra beats nest, vite, express
      expect(
        detectFramework({
          dependencies: { 'react-scripts': '5.0.0', '@nestjs/core': '10.0.0', express: '4.18.0' },
          devDependencies: { vite: '5.0.0' },
        })
      ).toBe('cra');

      // nest beats vite and express
      expect(
        detectFramework({
          dependencies: { '@nestjs/core': '10.0.0', express: '4.18.0' },
          devDependencies: { vite: '5.0.0' },
        })
      ).toBe('nest');

      // vite beats express
      expect(
        detectFramework({
          dependencies: { express: '4.18.0' },
          devDependencies: { vite: '5.0.0' },
        })
      ).toBe('vite');
    });

    it('returns undefined when no known framework is present', () => {
      expect(detectFramework({ dependencies: { lodash: '^4.17.21' } })).toBeUndefined();
      expect(detectFramework(undefined)).toBeUndefined();
    });
  });

  describe('Package Manager Detection from Lockfiles', () => {
    it('detects "bun" from bun.lock or bun.lockb', async () => {
      fs.writeFileSync(path.join(tempDir, 'bun.lock'), '');
      expect(await detectPackageManager(tempDir)).toBe('bun');
      expect(detectPackageManagerSync(tempDir)).toBe('bun');

      fs.unlinkSync(path.join(tempDir, 'bun.lock'));
      fs.writeFileSync(path.join(tempDir, 'bun.lockb'), '');
      expect(await detectPackageManager(tempDir)).toBe('bun');
      expect(detectPackageManagerSync(tempDir)).toBe('bun');
    });

    it('detects "pnpm" from pnpm-lock.yaml', async () => {
      fs.writeFileSync(path.join(tempDir, 'pnpm-lock.yaml'), '');
      expect(await detectPackageManager(tempDir)).toBe('pnpm');
      expect(detectPackageManagerSync(tempDir)).toBe('pnpm');
    });

    it('detects "yarn" from yarn.lock', async () => {
      fs.writeFileSync(path.join(tempDir, 'yarn.lock'), '');
      expect(await detectPackageManager(tempDir)).toBe('yarn');
      expect(detectPackageManagerSync(tempDir)).toBe('yarn');
    });

    it('detects "npm" from package-lock.json', async () => {
      fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
      expect(await detectPackageManager(tempDir)).toBe('npm');
      expect(detectPackageManagerSync(tempDir)).toBe('npm');
    });

    it('falls back to packageManager field in package.json if no lockfile is present', async () => {
      const packageJson = {
        name: 'sample',
        packageManager: 'pnpm@8.15.0',
      };
      expect(await detectPackageManager(tempDir, packageJson)).toBe('pnpm');
      expect(detectPackageManagerSync(tempDir, packageJson)).toBe('pnpm');
    });

    it('defaults to "npm" when neither lockfile nor packageManager field is present', async () => {
      expect(await detectPackageManager(tempDir)).toBe('npm');
      expect(detectPackageManagerSync(tempDir)).toBe('npm');
    });
  });

  describe('getRunScriptCommand Helper', () => {
    it('generates correct commands for yarn, pnpm, bun, and npm', () => {
      expect(getRunScriptCommand('yarn', 'dev')).toBe('yarn dev');
      expect(getRunScriptCommand('pnpm', 'build')).toBe('pnpm build');
      expect(getRunScriptCommand('bun', 'start')).toBe('bun run start');
      expect(getRunScriptCommand('npm', 'test')).toBe('npm run test');
      expect(getRunScriptCommand(undefined, 'lint')).toBe('npm run lint');
    });
  });

  describe('Corrupted & Missing Manifests Handling', () => {
    it('gracefully handles missing package.json', async () => {
      const profile = await detectNode(tempDir);
      expect(profile.stack).toBe('node');
      expect(profile.framework).toBeUndefined();
      expect(profile.packageManager).toBe('npm');
      expect(profile.scripts).toBeUndefined();
      expect(profile.deepDiagnosisSupported).toBe(true);
    });

    it('gracefully handles invalid JSON in package.json', async () => {
      fs.writeFileSync(path.join(tempDir, 'package.json'), '{ invalid-json');
      const profile = await detectNode(tempDir);
      expect(profile.stack).toBe('node');
      expect(profile.framework).toBeUndefined();
      expect(profile.scripts).toBeUndefined();
      expect(profile.deepDiagnosisSupported).toBe(true);
    });
  });
});
