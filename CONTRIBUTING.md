# Contributing to MEW Protocol

Thank you for contributing to MEW Protocol! This guide covers how to contribute changes, from initial design through implementation to release.

---

## Quick Start

1. Fork and clone the repository
2. `npm install && npm run build`
3. `npm test` to verify everything works
4. Make changes following the workflow below
5. `npm run lint && npm test`
6. Submit PR

---

## Spec-Driven Development Workflow

MEW Protocol follows a spec-driven development approach where specifications are designed and documented before code implementation. All changes begin with a CHANGELOG entry that tracks the proposal and implementation status throughout the lifecycle.

**Note:** If you've already implemented code changes, that's okay! Before opening your PR, create a proposal documenting the design, incorporate it into the relevant spec, and add a CHANGELOG entry. This ensures we maintain clear documentation of all changes.

### Lifecycle Stages

1. **Draft** - Add CHANGELOG entry, design and write proposals in proposals/ (in Draft PR)
2. **Incorporate** - Update specs, mark CHANGELOG entry as needing implementation (still Draft PR)
3. **Implementation Planning** - Create implementation plan in integration-plans/, reference from CHANGELOG (still Draft PR)
4. **Implementation** - Write code, tests, examples, update CHANGELOG status (still Draft PR)
5. **Review** - Get feedback, iterate or revert if needed (PR Ready for Review)
6. **Merge** - Merge approved changes (specs + code together)
7. **Release** - Tag version with all merged changes (happens later)

### Folder Structure & Naming

**Note:** `<area>` refers to the spec area: `protocol`, `cli`, `sdk`, or `bridge`

**Proposals:** `spec/<area>/proposals/XXX-name/`
- XXX = unique 3-character alphanumeric code (e.g., `a7z`, `k3p`, `m9w`; avoid 001, 002, or bat, tok)
- name = kebab-case description (e.g., `message-batching`, `token-limits`)
- Each proposal directory contains:
  - `proposal.md` - Main specification with motivation, goals, technical details
  - `research.md` - Background research, constraints, current state, prior art
  - `decision-XXX-name.md` - Individual ADR-style decision records as needed

**Rejected proposals:** `spec/<area>/rejected/XXX-name/`

**Implementation plans:** `spec/integration-plans/XXX-name.md`
- Same XXX-name format as proposals
- Optional, for complex changes requiring coordination

### Core Documents

- **Proposals** - Design rationale, research, decisions (stay in `proposals/` permanently)
- **Main Specs** - Authoritative documentation (updated from proposals)
- **CHANGELOG.md** - Tracks status of all proposals (Draft → Needs Implementation → In Progress → Done → Released)
- **Implementation Plans** - Guides code development (optional, for complex changes)

---

## Development Setup

See [Development Guide](docs/development.md) for detailed development setup, testing, and practices.

---

## Submitting PRs

### PR Guidelines

- Keep PRs focused on a logical unit of changes (may include multiple proposals)
- Follow the spec-driven workflow above
- Add tests for new functionality
- Update specs if changing protocol/behavior
- Run full test suite before submitting: `npm run lint && npm test`

### PR Structure

A typical PR includes:
1. **Proposals** in `spec/<area>/proposals/XXX-name/`
2. **Spec updates** incorporating the proposals
3. **CHANGELOG entries** tracking status
4. **Implementation plan** (if complex changes)
5. **Code implementation** with tests and examples

### Review Process

- Open as **Draft PR** while working through stages 1-4
- Mark **Ready for Review** when implementation is complete
- Address feedback; may need to iterate or revert to draft
- Once approved, maintainers will merge

---

## Getting Help

- Open an issue for questions or discussions
- Check [Documentation Hub](docs/README.md) for guides
- Review existing proposals in `spec/<area>/proposals/` for examples
