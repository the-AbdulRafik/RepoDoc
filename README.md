# 🩺 RepoDoc (Repo Doctor)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tested%20with-Vitest-729B1B?logo=vitest)](https://vitest.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/the-AbdulRafik/RepoDoc/pulls)

> **Scans abandoned repositories, diagnoses broken dependencies, and generates deployment assets to bring dormant code back to life.**

---

## ⚡ The Problem

Every developer has been there: you stumble across a fascinating open-source project or clone an old side-project from a few years ago, excited to run it. Instead, you're greeted with:

* 💥 **Failed Installations:** Obsolete package managers, broken lockfiles, or incompatible peer dependencies.
* 📦 **Dependency Bitrot:** Deprecated libraries containing known critical vulnerabilities or unmaintained packages that fail to build on modern engines.
* ⏳ **Runtime Drift:** Code written for Node.js 14 or older Python versions that chokes on modern active LTS runtimes.
* 🚢 **Missing Deployment Configs:** No `Dockerfile`, no container recipes, or obsolete scripts, forcing you to spend hours triaging and configuring before seeing a single line of code work.

**RepoDoc** acts as an automated triage physician for dormant and bitrotted codebases.

---

## 💡 What RepoDoc Does

RepoDoc inspects a target repository, profiles its technology ecosystem, pinpoints failure points, and provides deterministic reports and fixes:

1. **Stack & Ecosystem Profiling:** Automatically detects project stack (Node.js, Python, Rust, and more), package managers (`npm`, `yarn`, `pnpm`, `poetry`, `cargo`), frameworks, and build scripts.
2. **Deep Diagnostic Engine:** Scans across 4 vital dimensions:
   - 🛡️ **Security:** Flags critical vulnerabilities and deprecated dependencies.
   - 📦 **Dependency:** Identifies broken or out-of-date packages and suggests safe upgrade targets.
   - ⚙️ **Install:** Detects installation blockers and peer-dependency mismatches.
   - 🏃 **Runtime:** Flags engine incompatibilities and environment mismatches.
3. **Actionable Remediation & Auto-Fix:** Categorizes findings by severity (`critical`, `warning`, `info`) and identifies whether an issue can be automatically resolved (`autoFixable: true`).
4. **Deterministic Reports:** Validated at runtime using strict [Zod](https://zod.dev) schemas to ensure reproducible, predictable diagnostic data for both CLI consumers and CI/CD pipelines.
5. **Deployment Asset Generation *(In Progress)*:** Synthesizes clean, production-ready `Dockerfile` and container setups so you can boot legacy projects safely in isolated environments.

---

## 🏗️ Architecture & Core Contracts

RepoDoc is architected around strict, type-safe data contracts that define how diagnostic findings and repository profiles are collected and summarized.

```mermaid
flowchart LR
    A[Target Repository] --> B[Stack Profiler]
    A --> C[Diagnostic Scanners]
    B -->|StackProfile| D[Report Engine]
    C -->|Finding[]| D
    D --> E[Validated Report]
    E --> F[CLI Summary]
    E --> G[Auto-Fixer & Deployment Generator]
```

### Core Data Models

* **`StackProfile`**: Captures detected stack type (`node`, `python`, `rust`, `unknown`), framework, package manager, and script manifests.
* **`Finding`**: Represents an individual diagnostic issue with:
  * `severity`: `'critical' | 'warning' | 'info'`
  * `category`: `'dependency' | 'install' | 'runtime' | 'security'`
  * `message`: Human-readable explanation of the issue
  * `package`, `currentVersion`, `suggestedVersion` (optional)
  * `autoFixable`: Boolean indicating if RepoDoc can resolve it automatically
* **`Report`**: Comprehensive, timestamped analysis including all findings and aggregate summary counts.

---

## 🚀 Quick Start

### Prerequisites

* [Node.js](https://nodejs.org/) (version 18.0.0 or higher recommended)
* [npm](https://www.npmjs.com/) or your package manager of choice

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/the-AbdulRafik/RepoDoc.git
cd RepoDoc
npm install
```

### Build & Typecheck

```bash
# Compile TypeScript to dist/
npm run build

# Run typechecker without emitting files
npm run typecheck
```

### Running Tests

RepoDoc uses [Vitest](https://vitest.dev/) for blazing-fast unit and contract tests:

```bash
npm test
```

---

## 💻 Programmatic Usage

RepoDoc exports strongly-typed schemas and helper factories for integration into tools and workflows:

```typescript
import {
  createReport,
  generateReportSummary,
  type Finding,
  type StackProfile,
} from 'repo-doctor';

// 1. Define detected stack profile
const profile: StackProfile = {
  stack: 'node',
  framework: 'Express',
  packageManager: 'npm',
  deepDiagnosisSupported: true,
};

// 2. Collect diagnostic findings
const findings: Finding[] = [
  {
    severity: 'critical',
    category: 'security',
    message: 'Lodash prototype pollution vulnerability',
    package: 'lodash',
    currentVersion: '4.17.15',
    suggestedVersion: '4.17.21',
    autoFixable: true,
  },
];

// 3. Generate a validated report
const report = createReport({
  repoPath: '/path/to/dormant-project',
  stackProfile: profile,
  findings,
});

console.log(report.summary);
// => { totalFindings: 1, bySeverity: { critical: 1, warning: 0, info: 0 }, autoFixableCount: 1 }
```

---

## 🗺️ Roadmap

- [x] **Milestone 1: Core Contracts & Schema Layer**
  - Strongly-typed Zod schemas for Findings, Stack Profiles, and Reports.
  - Deterministic report summary computation.
  - Unit test testbed with 100% contract coverage.
- [ ] **Milestone 2: Stack Profiler & Detection Engine**
  - Heuristics to auto-detect Node.js, Python, Rust, and ecosystem tools.
  - Dependency manifest parsing (`package.json`, `requirements.txt`, `Cargo.toml`).
- [ ] **Milestone 3: Diagnostic Auditing & Vulnerability Scanners**
  - Offline and online dependency vulnerability database queries.
  - Node engine & peer dependency compatibility checkers.
- [ ] **Milestone 4: Auto-Fixer & Deployment Generator**
  - Automated package version bump suggestions.
  - Automatic `Dockerfile` and container recipe generation.
- [ ] **Milestone 5: Interactive CLI Interface**
  - Rich terminal UI with colored diagnostics tables and interactive prompt.
- [ ] **Future Horizons:**
  - Multi-stack / monorepo scanning.
  - Web UI Dashboard for visual health metrics.
  - GitHub App / PR Bot for automatic pull request diagnostics.

---

## 🤝 Contributing

Contributions make the open-source community an incredible place to learn, inspire, and create. Any contributions you make are **greatly appreciated**!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: add some AmazingFeature'`)
4. Ensure all tests and typechecks pass (`npm test && npm run typecheck`)
5. Push to the Branch (`git push origin feature/AmazingFeature`)
6. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

---

## 👤 Author

**Abdul Rafik**
* GitHub: [@the-AbdulRafik](https://github.com/the-AbdulRafik)

Give a ⭐️ if this project helped you revive old code!
