import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  detectPython,
  detectPythonSync,
  detectRust,
  detectRustSync,
  detectStackProfile,
  detectStackProfileSync,
  detectPythonFramework,
  detectRustFramework,
} from '../src/index.js';

describe('Module 4: Python & Rust Shallow Detectors', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoc-shallow-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Done When: Spec Verification', () => {
    it('returns framework: "django" and deepDiagnosisSupported: false for pyproject.toml containing "django"', async () => {
      const pyprojectContent = `
[project]
name = "my-django-app"
version = "0.1.0"
dependencies = [
    "django>=4.2,<5.0",
    "psycopg2-binary>=2.9.6",
]
`;
      fs.writeFileSync(path.join(tempDir, 'pyproject.toml'), pyprojectContent);

      const profile = await detectPython(tempDir);

      expect(profile.stack).toBe('python');
      expect(profile.framework).toBe('django');
      expect(profile.deepDiagnosisSupported).toBe(false);

      // Verify sync variant as well
      const syncProfile = detectPythonSync(tempDir);
      expect(syncProfile).toEqual(profile);
    });

    it('returns framework: "actix-web" and deepDiagnosisSupported: false for Cargo.toml containing "actix-web"', async () => {
      const cargoContent = `
[package]
name = "my-actix-service"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4.4.0"
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.0", features = ["full"] }
`;
      fs.writeFileSync(path.join(tempDir, 'Cargo.toml'), cargoContent);

      const profile = await detectRust(tempDir);

      expect(profile.stack).toBe('rust');
      expect(profile.framework).toBe('actix-web');
      expect(profile.packageManager).toBe('cargo');
      expect(profile.deepDiagnosisSupported).toBe(false);

      // Verify sync variant as well
      const syncProfile = detectRustSync(tempDir);
      expect(syncProfile).toEqual(profile);
    });
  });

  describe('Python Detection & Framework Sniffing', () => {
    it('sniffs frameworks from requirements.txt', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.txt'),
        'fastapi>=0.100.0\nuvicorn>=0.23.0\npydantic>=2.0\n'
      );

      const profile = await detectPython(tempDir);
      expect(profile.stack).toBe('python');
      expect(profile.framework).toBe('fastapi');
      expect(profile.deepDiagnosisSupported).toBe(false);
    });

    it('sniffs flask from Pipfile', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'Pipfile'),
        '[[source]]\nurl = "https://pypi.org/simple"\n\n[packages]\nflask = "*"\n'
      );

      const profile = await detectPython(tempDir);
      expect(profile.framework).toBe('flask');
    });

    it('detects package managers: uv, poetry, pipenv, conda, and pip', async () => {
      // Poetry via lockfile
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'requests');
      fs.writeFileSync(path.join(tempDir, 'poetry.lock'), '');
      let profile = await detectPython(tempDir);
      expect(profile.packageManager).toBe('poetry');

      // UV via lockfile
      fs.unlinkSync(path.join(tempDir, 'poetry.lock'));
      fs.writeFileSync(path.join(tempDir, 'uv.lock'), '');
      profile = await detectPython(tempDir);
      expect(profile.packageManager).toBe('uv');

      // Pipenv via Pipfile
      fs.unlinkSync(path.join(tempDir, 'uv.lock'));
      fs.writeFileSync(path.join(tempDir, 'Pipfile'), '');
      profile = await detectPython(tempDir);
      expect(profile.packageManager).toBe('pipenv');

      // Conda via environment.yml
      fs.unlinkSync(path.join(tempDir, 'Pipfile'));
      fs.writeFileSync(path.join(tempDir, 'environment.yml'), 'name: test');
      profile = await detectPython(tempDir);
      expect(profile.packageManager).toBe('conda');

      // Default pip
      fs.unlinkSync(path.join(tempDir, 'environment.yml'));
      profile = await detectPython(tempDir);
      expect(profile.packageManager).toBe('pip');
    });

    it('detects poetry tool section in pyproject.toml', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'pyproject.toml'),
        '[tool.poetry]\nname = "demo"\n[tool.poetry.dependencies]\npython = "^3.11"\n'
      );

      const profile = await detectPython(tempDir);
      expect(profile.packageManager).toBe('poetry');
    });

    it('returns undefined framework for generic python projects', () => {
      expect(detectPythonFramework('numpy==1.24.0\nscipy==1.10.0')).toBeUndefined();
    });
  });

  describe('Rust Detection & Framework Sniffing', () => {
    it('sniffs axum, rocket, warp, tauri, bevy from Cargo.toml', () => {
      expect(detectRustFramework('axum = "0.7"')).toBe('axum');
      expect(detectRustFramework('rocket = "0.5"')).toBe('rocket');
      expect(detectRustFramework('warp = "0.3"')).toBe('warp');
      expect(detectRustFramework('tauri = "1.5"')).toBe('tauri');
      expect(detectRustFramework('bevy = "0.13"')).toBe('bevy');
    });

    it('returns undefined framework when no web/app framework is listed', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'Cargo.toml'),
        '[package]\nname = "cli-tool"\nversion = "0.1.0"\n[dependencies]\nclap = "4.0"\n'
      );

      const profile = await detectRust(tempDir);
      expect(profile.stack).toBe('rust');
      expect(profile.framework).toBeUndefined();
      expect(profile.packageManager).toBe('cargo');
      expect(profile.deepDiagnosisSupported).toBe(false);
    });
  });

  describe('Unified detectStackProfile Router', () => {
    it('routes Node stack with deepDiagnosisSupported: true', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.18.0' } })
      );

      const profile = await detectStackProfile(tempDir);
      expect(profile.stack).toBe('node');
      expect(profile.framework).toBe('express');
      expect(profile.deepDiagnosisSupported).toBe(true);

      const syncProfile = detectStackProfileSync(tempDir);
      expect(syncProfile.deepDiagnosisSupported).toBe(true);
    });

    it('routes Python stack with deepDiagnosisSupported: false', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'requirements.txt'),
        'django==4.2'
      );

      const profile = await detectStackProfile(tempDir);
      expect(profile.stack).toBe('python');
      expect(profile.framework).toBe('django');
      expect(profile.deepDiagnosisSupported).toBe(false);
    });

    it('routes Rust stack with deepDiagnosisSupported: false', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'Cargo.toml'),
        '[dependencies]\nactix-web = "4.0"'
      );

      const profile = await detectStackProfile(tempDir);
      expect(profile.stack).toBe('rust');
      expect(profile.framework).toBe('actix-web');
      expect(profile.deepDiagnosisSupported).toBe(false);
    });

    it('routes unknown stack with deepDiagnosisSupported: false', async () => {
      const profile = await detectStackProfile(tempDir);
      expect(profile.stack).toBe('unknown');
      expect(profile.deepDiagnosisSupported).toBe(false);
    });
  });
});
