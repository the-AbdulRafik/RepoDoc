import { execa } from 'execa';
import type { Finding, Severity } from '../contracts/finding.js';

export type CommandRunner = (
  cmd: string,
  args: string[],
  options: { cwd: string; reject: boolean; timeout: number }
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export interface SecurityAuditOptions {
  cwd?: string;
  timeoutMs?: number;
  runner?: CommandRunner;
}

interface NpmAuditVulnerability {
  name: string;
  severity: string;
  range?: string;
  fixAvailable?: boolean | { name: string; version: string; isSemVerMajor: boolean };
  via?: Array<string | { title?: string; name?: string; severity?: string; url?: string }>;
}

interface NpmAuditReport {
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
  advisories?: Record<
    string,
    {
      module_name: string;
      severity: string;
      title: string;
      patched_versions?: string;
    }
  >;
  error?: {
    code: string;
    summary: string;
    detail: string;
  };
}

function mapAuditSeverity(npmSeverity: string): Severity {
  switch (npmSeverity.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'critical';
    case 'moderate':
      return 'warning';
    case 'low':
    case 'info':
    default:
      return 'info';
  }
}

/**
 * Parses raw JSON output from `npm audit --json` into structured Findings.
 * Handles both exitCode 0 and non-zero exit codes (since npm audit exits non-zero on findings).
 */
export function parseNpmAuditJson(jsonText: string): Finding[] {
  const findings: Finding[] = [];

  let report: NpmAuditReport;
  try {
    report = JSON.parse(jsonText) as NpmAuditReport;
  } catch {
    return findings;
  }

  // Modern npm audit (v7+)
  if (report.vulnerabilities && typeof report.vulnerabilities === 'object') {
    for (const [pkgName, vuln] of Object.entries(report.vulnerabilities)) {
      const severity = mapAuditSeverity(vuln.severity);
      const isAutoFixable = Boolean(vuln.fixAvailable);

      let advisoryTitle = '';
      if (Array.isArray(vuln.via)) {
        const titles = vuln.via
          .map((v) => (typeof v === 'object' && v.title ? v.title : typeof v === 'string' ? v : ''))
          .filter(Boolean);
        if (titles.length > 0) {
          advisoryTitle = `: ${titles[0]}`;
        }
      }

      findings.push({
        severity,
        category: 'security',
        package: pkgName,
        currentVersion: vuln.range,
        message: `Security vulnerability in ${pkgName} (${vuln.severity})${advisoryTitle}`,
        autoFixable: isAutoFixable,
      });
    }
  } else if (report.advisories && typeof report.advisories === 'object') {
    // Legacy npm audit (v6)
    for (const advisory of Object.values(report.advisories)) {
      findings.push({
        severity: mapAuditSeverity(advisory.severity),
        category: 'security',
        package: advisory.module_name,
        suggestedVersion: advisory.patched_versions,
        message: `Security vulnerability in ${advisory.module_name}: ${advisory.title}`,
        autoFixable: false,
      });
    }
  }

  return findings;
}

/**
 * Runs `npm audit --json` on a repository and converts vulnerabilities into Findings.
 * Correctly parses JSON even when npm audit exits with a non-zero code.
 */
export async function auditSecurity(
  repoPath: string,
  options: SecurityAuditOptions = {}
): Promise<Finding[]> {
  const cwd = options.cwd ?? repoPath;
  const timeoutMs = options.timeoutMs ?? 30000;
  const runCmd: CommandRunner =
    options.runner ??
    (async (cmd, args, opts) => {
      const res = await execa(cmd, args, opts);
      return {
        exitCode: res.exitCode ?? 0,
        stdout: res.stdout ?? '',
        stderr: res.stderr ?? '',
      };
    });

  try {
    const result = await runCmd('npm', ['audit', '--json'], {
      cwd,
      reject: false, // npm audit exits with code 1 if vulnerabilities are found!
      timeout: timeoutMs,
    });

    const output = (result.stdout || result.stderr || '').trim();
    if (!output) {
      return [];
    }

    return parseNpmAuditJson(output);
  } catch {
    return [];
  }
}
