import type { StackProfile } from '../contracts/stack-profile.js';
import { detectStackSignature, detectStackSignatureSync } from './stack-detector.js';
import { detectNode, detectNodeSync } from './node-detector.js';
import { detectPython, detectPythonSync } from './python-detector.js';
import { detectRust, detectRustSync } from './rust-detector.js';

export {
  detectStackSignature,
  detectStackSignatureSync,
} from './stack-detector.js';

export {
  detectNode,
  detectNodeSync,
  detectPackageManager,
  detectPackageManagerSync,
  detectFramework,
  getRunScriptCommand,
  type PackageJson,
} from './node-detector.js';

export {
  detectPython,
  detectPythonSync,
  detectPythonPackageManager,
  detectPythonPackageManagerSync,
  detectPythonFramework,
} from './python-detector.js';

export {
  detectRust,
  detectRustSync,
  detectRustFramework,
} from './rust-detector.js';

/**
 * High-level detection router that detects stack signature and executes
 * the corresponding deep (Node) or shallow (Python, Rust) detector.
 */
export async function detectStackProfile(repoPath: string): Promise<StackProfile> {
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
 * Synchronous variant of detectStackProfile.
 */
export function detectStackProfileSync(repoPath: string): StackProfile {
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
