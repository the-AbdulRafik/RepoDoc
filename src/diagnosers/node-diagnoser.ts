import fs from 'node:fs/promises';
import path from 'node:path';
import type { Finding, Severity } from '../contracts/finding.js';
import type { StackProfile } from '../contracts/stack-profile.js';
import type { PackageJson } from '../detector/node-detector.js';
import { auditDependencies, type DependencyAuditOptions, type RegistryCache, type NpmPackageMeta } from './dependency-audit.js';
import { auditSecurity, type SecurityAuditOptions } from './security-audit.js';
import { checkInstall, type InstallCheckOptions } from './install-check.js';
import { checkNodeRuntime } from './runtime-check.js';

export interface DiagnoseNodeOptions {
  skipInstallCheck?: boolean;
  skipSecurityAudit?: boolean;
  skipDependencyAudit?: boolean;
  dependencyOptions?: DependencyAuditOptions;
  securityOptions?: SecurityAuditOptions;
  installOptions?: InstallCheckOptions;
}

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

async function readPackageJson(repoPath: string): Promise<PackageJson | undefined> {
  try {
    const raw = await fs.readFile(path.join(repoPath, 'package.json'), 'utf8');
    return JSON.parse(raw) as PackageJson;
  } catch {
    return undefined;
  }
}

/**
 * Deep diagnostic engine for Node.js repositories.
 * Produces real findings across dependency deprecations, major version gaps,
 * npm security vulnerabilities, install failures (dry-run), and runtime drift.
 */
export async function diagnoseNode(
  repoPath: string,
  stackProfile: StackProfile,
  options: DiagnoseNodeOptions = {}
): Promise<Finding[]> {
  const packageJson = await readPackageJson(repoPath);

  // Single-run in-memory cache instantiated here and discarded when diagnoseNode completes
  const singleRunCache: RegistryCache = new Map<string, NpmPackageMeta | null>();

  const tasks: Array<Promise<Finding[]>> = [];

  // 1. Dependency freshness and deprecation audit
  if (!options.skipDependencyAudit) {
    tasks.push(
      auditDependencies(packageJson, {
        cache: singleRunCache,
        ...options.dependencyOptions,
      })
    );
  }

  // 2. npm audit security vulnerabilities
  if (!options.skipSecurityAudit) {
    tasks.push(auditSecurity(repoPath, options.securityOptions));
  }

  // 3. Dry-run install failure check (captures raw error output)
  if (!options.skipInstallCheck) {
    tasks.push(checkInstall(repoPath, options.installOptions));
  }

  // 4. Node engine and LTS runtime drift check
  tasks.push(Promise.resolve(checkNodeRuntime(packageJson)));

  const results = await Promise.all(tasks);
  const allFindings = results.flat();

  // Deduplicate and sort by severity (critical > warning > info)
  const seenMessages = new Set<string>();
  const uniqueFindings: Finding[] = [];

  for (const finding of allFindings) {
    const key = `${finding.severity}:${finding.category}:${finding.package ?? ''}:${finding.message}`;
    if (!seenMessages.has(key)) {
      seenMessages.add(key);
      uniqueFindings.push(finding);
    }
  }

  uniqueFindings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return uniqueFindings;
}
