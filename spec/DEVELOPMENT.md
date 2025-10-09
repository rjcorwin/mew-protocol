# Spec-Driven Development Workflow

This document describes MEW Protocol's spec-driven development workflow: how changes are proposed, designed, incorporated into specs, implemented in code, and released.

---

## Overview

All changes begin with a CHANGELOG entry that tracks the proposal and implementation status throughout the lifecycle.

**Lifecycle Stages**:
1. **Draft** - Add CHANGELOG entry, design and write proposals in proposals/ (in Draft PR)
2. **Incorporate** - Update specs, mark CHANGELOG entry as needing implementation (still Draft PR)
3. **Implementation Planning** - Create implementation plan in integration-plans/, reference from CHANGELOG (still Draft PR)
4. **Implementation** - Write code, tests, examples, update CHANGELOG status (still Draft PR)
5. **Review** - Get feedback, iterate or revert if needed (PR Ready for Review)
6. **Merge** - Merge approved changes (specs + code together)
7. **Release** - Tag version with all merged changes (happens later)

**Folder Structure**:
- **`spec/<area>/proposals/XXX-name/`** - All proposals (status tracked in CHANGELOG)
  - XXX = unique 3-character alphanumeric code (e.g., `a7z`, `k3p`, `m9w`)
- **`spec/<area>/rejected/XXX-name/`** - Rejected proposals (moved out of proposals/)
- **`spec/integration-plans/XXX-name.md`** - Implementation plans for complex changes
  - XXX = unique 3-character alphanumeric code (e.g., `b4x`, `r8n`)

**Core Documents**:
- **Proposals** - Design rationale, research, decisions (stay in `proposals/` permanently)
- **Main Specs** - Authoritative documentation (updated from proposals)
- **CHANGELOG.md** - Tracks status of all proposals (Draft → Needs Implementation → In Progress → Done → Released)
- **Implementation Plans** - Guides code development (optional, for complex changes)

**Naming Convention**:
- Proposals and implementation plans use unique 3-character alphanumeric codes
- Format: `XXX-descriptive-name` (e.g., `a7z-message-batching`, `k3p-token-limits`, `m9w-new-feature`)
- Codes must be unique within their scope (proposals per spec area, implementation plans globally)
- Use random alphanumeric combinations (mix letters and numbers) to avoid conflicts across concurrent PRs
- Avoid sequential numbers (001, 002) or word-like abbreviations (bat, tok) that may conflict
