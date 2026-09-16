import { describe, it, expect } from 'vitest';
import {
  FindingSchema,
  StackProfileSchema,
  ReportSchema,
  ReportSummarySchema,
  generateReportSummary,
  createReport,
  type Finding,
  type StackProfile,
} from '../src/index.js';

describe('Module 1: Core Data Contracts', () => {
  describe('FindingSchema', () => {
    it('accepts valid findings with required and optional fields', () => {
      const validFinding: Finding = {
        severity: 'critical',
        category: 'dependency',
        message: 'Lodash has a critical prototype pollution vulnerability',
        package: 'lodash',
        currentVersion: '4.17.15',
        suggestedVersion: '4.17.21',
        autoFixable: true,
      };

      const parsed = FindingSchema.parse(validFinding);
      expect(parsed).toEqual(validFinding);
    });

    it('accepts finding without optional package and version fields', () => {
      const findingWithoutOptionals: Finding = {
        severity: 'info',
        category: 'runtime',
        message: 'Node.js version is older than active LTS',
        autoFixable: false,
      };

      const parsed = FindingSchema.parse(findingWithoutOptionals);
      expect(parsed.package).toBeUndefined();
      expect(parsed.currentVersion).toBeUndefined();
      expect(parsed.suggestedVersion).toBeUndefined();
      expect(parsed.autoFixable).toBe(false);
    });

    it('rejects severities outside critical | warning | info', () => {
      const invalidSeverity = {
        severity: 'error', // Explicitly excluded from core contract
        category: 'install',
        message: 'Install failed',
        autoFixable: false,
      };

      expect(() => FindingSchema.parse(invalidSeverity)).toThrow();
    });

    it('rejects categories outside dependency | install | runtime | security', () => {
      const invalidCategories = ['node_drift', 'deprecated', 'syntax', 'environment', 'other'];

      for (const cat of invalidCategories) {
        expect(() =>
          FindingSchema.parse({
            severity: 'warning',
            category: cat,
            message: 'Testing category rejection',
            autoFixable: false,
          })
        ).toThrow();
      }
    });

    it('rejects empty messages or missing autoFixable', () => {
      expect(() =>
        FindingSchema.parse({
          severity: 'warning',
          category: 'security',
          message: '',
          autoFixable: true,
        })
      ).toThrow();

      expect(() =>
        FindingSchema.parse({
          severity: 'warning',
          category: 'security',
          message: 'Valid message',
        })
      ).toThrow();
    });
  });

  describe('StackProfileSchema', () => {
    it('accepts a fully populated Node stack profile with deepDiagnosisSupported: true', () => {
      const profile: StackProfile = {
        stack: 'node',
        framework: 'Next.js',
        packageManager: 'npm',
        scripts: {
          dev: 'next dev',
          build: 'next build',
        },
        deepDiagnosisSupported: true,
      };

      const parsed = StackProfileSchema.parse(profile);
      expect(parsed.stack).toBe('node');
      expect(parsed.deepDiagnosisSupported).toBe(true);
      expect(parsed.framework).toBe('Next.js');
    });

    it('accepts shallow Python and Rust stack profiles with deepDiagnosisSupported: false', () => {
      const pythonProfile: StackProfile = {
        stack: 'python',
        framework: 'FastAPI',
        packageManager: 'poetry',
        deepDiagnosisSupported: false,
      };
      const rustProfile: StackProfile = {
        stack: 'rust',
        framework: 'actix-web',
        packageManager: 'cargo',
        deepDiagnosisSupported: false,
      };

      expect(StackProfileSchema.parse(pythonProfile).deepDiagnosisSupported).toBe(false);
      expect(StackProfileSchema.parse(rustProfile).deepDiagnosisSupported).toBe(false);
    });

    it('accepts unknown stack profile', () => {
      const unknownProfile: StackProfile = {
        stack: 'unknown',
        deepDiagnosisSupported: false,
      };

      expect(StackProfileSchema.parse(unknownProfile).stack).toBe('unknown');
    });

    it('rejects unsupported stack types or missing deepDiagnosisSupported', () => {
      expect(() =>
        StackProfileSchema.parse({
          stack: 'ruby',
          deepDiagnosisSupported: false,
        })
      ).toThrow();

      expect(() =>
        StackProfileSchema.parse({
          stack: 'node',
        })
      ).toThrow();
    });
  });

  describe('ReportSchema & Utilities', () => {
    const mockFindings: Finding[] = [
      {
        severity: 'critical',
        category: 'security',
        message: 'Vulnerable dep',
        autoFixable: true,
      },
      {
        severity: 'critical',
        category: 'install',
        message: 'Install failed',
        autoFixable: false,
      },
      {
        severity: 'warning',
        category: 'dependency',
        message: 'Outdated package',
        autoFixable: true,
      },
      {
        severity: 'info',
        category: 'runtime',
        message: 'Consider updating Node engine',
        autoFixable: false,
      },
    ];

    it('calculates accurate summary stats via generateReportSummary', () => {
      const summary = generateReportSummary(mockFindings);

      expect(summary).toEqual({
        totalFindings: 4,
        bySeverity: {
          critical: 2,
          warning: 1,
          info: 1,
        },
        autoFixableCount: 2,
      });

      // Verify deepDiagnosisSupported is NOT in ReportSummary
      expect((summary as Record<string, unknown>).deepDiagnosisSupported).toBeUndefined();
      expect(ReportSummarySchema.safeParse(summary).success).toBe(true);
    });

    it('creates a valid report via createReport factory', () => {
      const stackProfile: StackProfile = {
        stack: 'node',
        framework: 'Express',
        packageManager: 'yarn',
        deepDiagnosisSupported: true,
      };

      const report = createReport({
        repoPath: '/home/user/my-old-project',
        stackProfile,
        findings: mockFindings,
        scannedAt: '2026-09-16T12:00:00.000Z',
      });

      expect(report.repoPath).toBe('/home/user/my-old-project');
      expect(report.stackProfile.deepDiagnosisSupported).toBe(true);
      expect(report.summary.totalFindings).toBe(4);
      expect(report.summary.autoFixableCount).toBe(2);
      expect(report.findings).toHaveLength(4);

      // Verify schema parses without errors
      expect(ReportSchema.safeParse(report).success).toBe(true);
    });

    it('rejects invalid reports with empty paths or invalid summary', () => {
      const stackProfile: StackProfile = {
        stack: 'unknown',
        deepDiagnosisSupported: false,
      };

      expect(() =>
        ReportSchema.parse({
          repoPath: '',
          stackProfile,
          scannedAt: '2026-09-16T12:00:00.000Z',
          findings: [],
          summary: {
            totalFindings: 0,
            bySeverity: { critical: 0, warning: 0, info: 0 },
            autoFixableCount: 0,
          },
        })
      ).toThrow();
    });
  });
});
