# Ideas Parking Lot — Repo Doctor

This document captures out-of-scope ideas, enhancements, and forward-looking research tracks that emerge during development. Per project context, these are tracked here rather than allowed into the current milestone scope.

---

## 1. JEV (Joint Expected Value) Decision-Making Engine

### Concept & Rationale
When reviving legacy repositories, upgrading dependencies is rarely an all-or-nothing choice. Upgrading package $A$ to major version $N$ carries a probability of breaking package $B$, requiring a balance between:
- **Value of Upgrade ($V_s$)**: Eliminating critical CVEs, supporting active Node LTS, unlocking modern tooling.
- **Risk & Cost of Failure ($C_f$)**: Silent runtime regressions, peer dependency deadlocks, native compilation failures.
- **Cognitive Overhead ($C_a$)**: Human review burden for massive breaking changes.

Rather than a naive greedy bump (always jumping to latest `*`), a **JEV Decision-Making Engine** evaluates candidate upgrade paths as a graph:
$$\text{JEV}(\text{Plan}) = \sum P(\text{compatible}_i) \cdot V(\text{security}_i) - \sum P(\text{break}_j) \cdot C(\text{regression}_j)$$

### Upcoming AI Capabilities to Integrate
1. **Stepping-Stone Trajectory Search (MCTS over Dependency Graphs)**:
   - Instead of jumping from `v1.0` directly to `v5.0`, the agent identifies the highest-JEV stepping stone (e.g. `v1.0` $\rightarrow$ `v2.4` $\rightarrow$ `v4.0`) that preserves intermediate compatibility.
2. **AST-Grounded Breakage Prediction**:
   - An LLM parses the changelog/migration guides of major bumps and cross-references them against AST call sites in the repository, calculating a calibrated $P(\text{break})$ for that specific codebase.
3. **Calibrated Risk Budgeting**:
   - The CLI accepts a risk profile (`--risk=conservative|balanced|aggressive`). The JEV engine filters proposed fixes to only those exceeding the corresponding utility threshold.
4. **Transition from Single-Shot to Graph-Based Agent Seam (LangGraph / Strands Graphs)**:
   - If upgrade planning expands from single-shot log explanation to iterative hypothesis testing (propose $\rightarrow$ dry-run $\rightarrow$ verify $\rightarrow$ backtrack), the agent architecture can transition to a state-graph with clear decision nodes.

---

## 2. Other Parked Features & Enhancements

- **Deep Python & Rust Diagnosers**: Full virtualenv/pip audit and cargo check resolution.
- **Monorepo / Multi-Stack Support**: Polyglot scanning within a single repository.
- **Web UI & Visualization Dashboard**: Interactive graph visualization of health debt.
- **One-Click Cloud Deployment**: Generating cloud infrastructure definitions (Fly.io, Railway, Docker Compose).
- **GitHub App / PR Automation**: Automated health scans and migration PRs on abandoned branches.
