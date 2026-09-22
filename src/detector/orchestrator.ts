import type { StackProfile } from '../contracts/stack-profile.js';
import { detectStackSignature, detectStackSignatureSync } from './stack-detector.js';
import { detectNode, detectNodeSync } from './node-detector.js';
import { detectPython, detectPythonSync } from './python-detector.js';
import { detectRust, detectRustSync } from './rust-detector.js';

/**
 * Orchestrates stack detection by first checking the repository signature (Module 2)
 * and dispatching to the matching deep or shallow detector (Modules 3 & 4).
 * Adds no new detection logic, acting purely as a routing delegator.
 */
export async function detectStack(repoPath: string): Promise<StackProfile> {
  const stack = await detectStackSignature(repoPath);

  switch (stack) {
    case 'node':
      return detectNode(repoPath);
    case 'python':
      return detectPython(repoPath);
    case 'rust':
      return detectRust(repoPath);
    case 'unknown':
    default:
      return {
        stack: 'unknown',
        deepDiagnosisSupported: false,
      };
  }
}

/**
 * Synchronous variant of detectStack.
 */
export function detectStackSync(repoPath: string): StackProfile {
  const stack = detectStackSignatureSync(repoPath);

  switch (stack) {
    case 'node':
      return detectNodeSync(repoPath);
    case 'python':
      return detectPythonSync(repoPath);
    case 'rust':
      return detectRustSync(repoPath);
    case 'unknown':
    default:
      return {
        stack: 'unknown',
        deepDiagnosisSupported: false,
      };
  }
}
