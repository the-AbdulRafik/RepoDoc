# Ideas Parking Lot — Repo Doctor

This document captures ideas, extensions, and features that emerge during development but are strictly out of scope for the current milestones.

## Deferred Features & Enhancements

- **Full Python & Rust Deep Diagnosis**: In-depth dependency auditing, virtualenv/cargo check analysis, lockfile resolution for Python and Rust stacks (`deepDiagnosisSupported: false` is maintained for now).
- **Multi-Stack / Monorepo Support**: Scanning repos containing multiple independent sub-projects or polyglot workspaces in a single repository.
- **Web UI Dashboard**: A graphical interface or web dashboard for visual repository health metrics and interactive fix application.
- **One-Click Deploy**: Cloud deploy integrations (e.g. fly.io, Render, Railway, AWS ECS) using generated Dockerfiles.
- **GitHub App / PR Bot**: Automated GitHub Action or App running scans on PRs or abandoned branches and proposing PRs with automated fixes.
