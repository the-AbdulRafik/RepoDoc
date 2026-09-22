import { execa } from 'execa';
import type { Finding } from '../contracts/finding.js';

export interface InstallCheckOptions {
  cwd?: string;
  timeoutMs?: number;
}

/**
 * SAFETY RATIONALE FOR --dry-run:
 * We intentionally execute `npm install --dry-run` rather than performing a real install
 * or copying the repository to a temporary directory.
 * This guarantees Repo Doctor is strictly read-only during scans, ensuring zero disk
 * mutations, zero side-effects from lifecycle scripts, and zero package installations
 * without explicit user confirmation (the --fix flow).
 */
export async function checkInstall(
  repoPath: string,
  options: InstallCheckOptions = {}
): Promise<Finding[]> {
  const cwd = options.cwd ?? repoPath;
  const timeoutMs = options.timeoutMs ?? 30000;

  try {
    const result = await execa('npm', ['install', '--dry-run', '--ignore-scripts'], {
      cwd,
      reject: false,
      timeout: timeoutMs,
    });

    if (result.exitCode !== 0) {
      // CAPTURE RAW UNTRUNCATED ERROR LOG — zero regex parsing here.
      // Raw error text is preserved completely to pass directly to Module 7.
      const rawError =
        [result.stderr, result.stdout].filter(Boolean).join('\n').trim() ||
        `npm install --dry-run failed with exit code ${result.exitCode}`;

      return [
        {
          severity: 'critical',
          category: 'install',
          message: rawError,
          autoFixable: false,
        },
      ];
    }
  } catch (err: unknown) {
    const rawError = err instanceof Error ? err.message : String(err);
    return [
      {
        severity: 'critical',
        category: 'install',
        message: rawError,
        autoFixable: false,
      },
    ];
  }

  return [];
}
