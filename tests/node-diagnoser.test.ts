import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  diagnoseNode,
  checkInstall,
  auditSecurity,
  parseNpmAuditJson,
  auditDependencies,
  checkNodeRuntime,
  NODE_LTS,
  type StackProfile,
  type NpmPackageMeta,
  type RegistryCache,
} from '../src/index.js';

describe('Module 6: Node Deep Diagnosers', () => {
  let tempDir: string;
  const mockNodeProfile: StackProfile = {
    stack: 'node',
    packageManager: 'npm',
    deepDiagnosisSupported: true,
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repodoc-diagnose-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Checklist 5: NODE_LTS Named Constant', () => {
    it('verifies NODE_LTS is a single named constant and values are referenced', () => {
      expect(NODE_LTS.ACTIVE).toBe(22);
      expect(NODE_LTS.MAINTENANCE).toBe(20);

      // Warning when engine min version is below maintenance LTS
      const oldEngineFindings = checkNodeRuntime({ engines: { node: '>= 12.0.0' } });
      expect(oldEngineFindings).toHaveLength(1);
      expect(oldEngineFindings[0].severity).toBe('warning');
      expect(oldEngineFindings[0].category).toBe('runtime');
      expect(oldEngineFindings[0].message).toContain(`minimum v12`);
      expect(oldEngineFindings[0].message).toContain(`Maintenance LTS is Node ${NODE_LTS.MAINTENANCE}`);

      // Info when engine min version is on maintenance LTS (< active LTS)
      const maintEngineFindings = checkNodeRuntime({ engines: { node: '>= 20.0.0' } });
      expect(maintEngineFindings).toHaveLength(1);
      expect(maintEngineFindings[0].severity).toBe('info');
      expect(maintEngineFindings[0].message).toContain(`Node ${NODE_LTS.ACTIVE}`);

      // Info when no engine is declared
      const noEngineFindings = checkNodeRuntime({});
      expect(noEngineFindings).toHaveLength(1);
      expect(noEngineFindings[0].severity).toBe('info');
      expect(noEngineFindings[0].message).toContain(`No Node engine specified`);
    });
  });

  describe('Checklist 4: Security Audit & Non-Zero Exit Code Handling', () => {
    it('parses npm audit JSON vulnerabilities correctly', () => {
      const sampleAuditReport = JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {
          lodash: {
            name: 'lodash',
            severity: 'high',
            range: '<4.17.21',
            fixAvailable: true,
            via: [{ title: 'Prototype Pollution' }],
          },
          minimist: {
            name: 'minimist',
            severity: 'moderate',
            range: '<0.2.4',
            fixAvailable: false,
            via: [{ title: 'Prototype Pollution' }],
          },
        },
      });

      const findings = parseNpmAuditJson(sampleAuditReport);
      expect(findings).toHaveLength(2);

      const lodashFinding = findings.find((f) => f.package === 'lodash');
      expect(lodashFinding).toBeDefined();
      expect(lodashFinding?.severity).toBe('critical'); // high/critical maps to critical
      expect(lodashFinding?.category).toBe('security');
      expect(lodashFinding?.autoFixable).toBe(true);

      const minimistFinding = findings.find((f) => f.package === 'minimist');
      expect(minimistFinding).toBeDefined();
      expect(minimistFinding?.severity).toBe('warning'); // moderate maps to warning
      expect(minimistFinding?.category).toBe('security');
      expect(minimistFinding?.autoFixable).toBe(false);
    });

    it('handles non-zero exit code simulation without throwing', async () => {
      // In a real repo where npm audit finds vulnerabilities, npm audit exits with code 1.
      // auditSecurity must handle this cleanly and return findings, not throw.
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'audit-test',
          version: '1.0.0',
          dependencies: {
            lodash: '4.17.15',
          },
        })
      );

      // Should not throw even if npm audit exits with non-zero or fails lockfile validation
      const findings = await auditSecurity(tempDir, { timeoutMs: 5000 });
      expect(Array.isArray(findings)).toBe(true);
    });

    it('specifically parses vulnerabilities when npm audit exits with non-zero exit code 1', async () => {
      const auditJson = JSON.stringify({
        auditReportVersion: 2,
        vulnerabilities: {
          axios: {
            name: 'axios',
            severity: 'critical',
            range: '<0.21.1',
            fixAvailable: true,
            via: [{ title: 'SSRF in axios' }],
          },
        },
      });

      // Mock runner that explicitly exits with code 1 (standard npm audit behavior when vulnerabilities exist)
      const mockNonZeroRunner = async () => ({
        exitCode: 1,
        stdout: auditJson,
        stderr: '',
      });

      const findings = await auditSecurity(tempDir, {
        runner: mockNonZeroRunner,
      });

      expect(findings).toHaveLength(1);
      expect(findings[0].package).toBe('axios');
      expect(findings[0].severity).toBe('critical');
      expect(findings[0].category).toBe('security');
      expect(findings[0].autoFixable).toBe(true);
    });
  });

  describe('Checklist 3 & Traps: Dry-Run Install Check Preserves Raw Logs', () => {
    it('captures raw failure text when install-check fails, with zero regex parsing', async () => {
      // Create a deliberately broken package.json with an impossible/non-existent package
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'broken-install-fixture',
          dependencies: {
            'this-package-definitely-does-not-exist-999888777': '1.0.0',
          },
        })
      );

      const findings = await checkInstall(tempDir, { timeoutMs: 15000 });

      expect(findings).toHaveLength(1);
      const installFinding = findings[0];
      expect(installFinding.severity).toBe('critical');
      expect(installFinding.category).toBe('install');
      expect(installFinding.autoFixable).toBe(false);

      // Confirm raw error output is preserved intact (contains npm failure details / 404 / E404)
      expect(installFinding.message.length).toBeGreaterThan(10);
      expect(installFinding.message.toLowerCase()).toMatch(/404|not found|e404|failed/);
    });
  });

  describe('Dependency Audit: Bounded Concurrency & Single-Run Cache', () => {
    it('deduplicates package lookups between dependencies and devDependencies using in-memory cache', async () => {
      let lookupCount = 0;
      const customFetcher = async (pkgName: string, cache: RegistryCache): Promise<NpmPackageMeta | null> => {
        lookupCount += 1;
        const meta: NpmPackageMeta = {
          name: pkgName,
          latestVersion: '5.0.0',
        };
        cache.set(pkgName, meta);
        return meta;
      };

      const packageJson = {
        dependencies: {
          sharedPkg: '^1.0.0',
        },
        devDependencies: {
          sharedPkg: '^1.0.0',
          uniqueDevPkg: '^2.0.0',
        },
      };

      const findings = await auditDependencies(packageJson, {
        fetcher: customFetcher,
        concurrencyLimit: 8,
      });

      // 'sharedPkg' appeared twice but should only be looked up once! Total lookups: 2
      expect(lookupCount).toBe(2);
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe('Checklist 2 & Done When: Old Fixture with express@3.2.0 and request@2.88.2', () => {
    it('produces real findings: deprecation as critical, major version gap as warning', async () => {
      const packageJson = {
        name: 'old-express-fixture',
        version: '0.1.0',
        engines: {
          node: '>= 0.10.0',
        },
        dependencies: {
          express: '3.2.0',
          request: '2.88.2', // Widely known deprecated package
        },
      };

      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // We run diagnoseNode with real network lookups for express and request!
      const findings = await diagnoseNode(tempDir, mockNodeProfile, {
        skipInstallCheck: true, // test install check independently to keep this test fast
        skipSecurityAudit: true, // test security audit independently
      });

      // 1. Deprecated finding for request (severity: 'critical')
      const requestDeprecation = findings.find(
        (f) => f.package === 'request' && f.severity === 'critical' && f.category === 'dependency'
      );
      expect(requestDeprecation).toBeDefined();
      expect(requestDeprecation?.message.toLowerCase()).toContain('deprecated');
      expect(requestDeprecation?.autoFixable).toBe(false);

      // 2. Major version gap for express (severity: 'warning')
      const expressMajorGap = findings.find(
        (f) => f.package === 'express' && f.severity === 'warning' && f.category === 'dependency'
      );
      expect(expressMajorGap).toBeDefined();
      expect(expressMajorGap?.currentVersion).toBe('3.2.0');
      expect(expressMajorGap?.message).toContain('major version gap');
      expect(expressMajorGap?.autoFixable).toBe(false);

      // 3. EOL Node runtime check for node >= 0.10.0 (severity: 'warning')
      const runtimeFinding = findings.find((f) => f.category === 'runtime' && f.severity === 'warning');
      expect(runtimeFinding).toBeDefined();
      expect(runtimeFinding?.message).toContain(`allows end-of-life Node.js`);

      // 4. Confirm findings are sorted by severity: critical first, then warning, then info
      const severities = findings.map((f) => f.severity);
      const isSorted = severities.every((val, idx) => {
        if (idx === 0) return true;
        const prev = severities[idx - 1];
        const order = { critical: 0, warning: 1, info: 2 };
        return order[prev] <= order[val];
      });
      expect(isSorted).toBe(true);
    });
  });
});
