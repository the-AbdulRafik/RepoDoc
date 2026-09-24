import semver from 'semver';
import type { Finding } from '../contracts/finding.js';
import type { PackageJson } from '../detector/node-detector.js';

// NODE LTS SCHEDULE — update manually as Node's release schedule advances.
// Check https://nodejs.org/en/about/previous-releases for current values.
// Last verified: 2026-09-24
export const NODE_LTS = {
  ACTIVE: 22,
  MAINTENANCE: 20,
  // Node versions below this have been EOL for multiple years — treat as critical,
  // not just "somewhat behind." Node 14 went EOL in April 2023.
  SEVERELY_OUTDATED: 14,
} as const;

/**
 * Checks the Node.js engine requirement declared in package.json against current Node LTS releases.
 * Three-tier severity rules:
 * - minVersion < NODE_LTS.SEVERELY_OUTDATED (< 14) -> critical (ancient EOL, very likely broken)
 * - minVersion < NODE_LTS.MAINTENANCE (< 20, >= 14) -> warning (EOL but more recently)
 * - minVersion < NODE_LTS.ACTIVE (>= 20) -> info (on Maintenance LTS)
 * - missing engine -> info
 */
export function checkNodeRuntime(packageJson?: PackageJson): Finding[] {
  const findings: Finding[] = [];
  const nodeEngine = packageJson?.engines && typeof packageJson.engines === 'object'
    ? (packageJson.engines as Record<string, string>)['node']
    : undefined;

  if (!nodeEngine || !nodeEngine.trim()) {
    findings.push({
      severity: 'info',
      category: 'runtime',
      message: `No Node engine specified in package.json. Recommended to target Node ${NODE_LTS.MAINTENANCE} (Maintenance LTS) or Node ${NODE_LTS.ACTIVE} (Active LTS).`,
      autoFixable: false,
    });
    return findings;
  }

  const minVersion = semver.minVersion(nodeEngine);

  if (minVersion && minVersion.major < NODE_LTS.SEVERELY_OUTDATED) {
    findings.push({
      severity: 'critical',
      category: 'runtime',
      message: `Node engine requirement "${nodeEngine}" requires severely outdated, ancient Node.js (minimum v${minVersion.major}). Node ${minVersion.major} has been end-of-life for multiple years (threshold: < v${NODE_LTS.SEVERELY_OUTDATED}). Current Active LTS is Node ${NODE_LTS.ACTIVE}, Maintenance LTS is Node ${NODE_LTS.MAINTENANCE}.`,
      autoFixable: false,
    });
  } else if (minVersion && minVersion.major < NODE_LTS.MAINTENANCE) {
    findings.push({
      severity: 'warning',
      category: 'runtime',
      message: `Node engine requirement "${nodeEngine}" allows end-of-life Node.js (minimum v${minVersion.major}). Current Maintenance LTS is Node ${NODE_LTS.MAINTENANCE}, and Active LTS is Node ${NODE_LTS.ACTIVE}.`,
      autoFixable: false,
    });
  } else if (minVersion && minVersion.major < NODE_LTS.ACTIVE) {
    findings.push({
      severity: 'info',
      category: 'runtime',
      message: `Node engine requirement "${nodeEngine}" is on Maintenance LTS (v${minVersion.major}). Consider upgrading to Active LTS (Node ${NODE_LTS.ACTIVE}).`,
      autoFixable: false,
    });
  }

  return findings;
}
