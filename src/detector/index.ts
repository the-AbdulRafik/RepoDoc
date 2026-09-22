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

export {
  detectStack,
  detectStackSync,
} from './orchestrator.js';

// Backward compatibility alias
export { detectStack as detectStackProfile, detectStackSync as detectStackProfileSync } from './orchestrator.js';
