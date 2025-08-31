# Accepted ADRs

This folder contains ADRs that have been reviewed and accepted for implementation.

## Format

**Filename:** `[proposal-number]-[adr-id]-[descriptive-name].md`

- **Proposal number:** Maintains the original number from when it was proposed
- **ADR ID:** The same unique identifier from the proposal stage
- **Descriptive name:** Same descriptive name from proposal

## Status Tracking

Each accepted ADR should have:
- **Status:** "Accepted"
- **Incorporation:** Track implementation progress
  - "Not Incorporated" - Accepted but not yet in spec
  - "Partial" - Some aspects implemented
  - "Complete" - Fully incorporated into specification

## Currently Accepted

(No ADRs have been accepted yet - all are still in proposed status)

## Moving from Proposed

When an ADR is accepted:
1. Move file from `proposed/` to `accepted/`
2. Keep the same filename (preserves proposal order)
3. Update Status to "Accepted"
4. Track Incorporation status as implementation progresses