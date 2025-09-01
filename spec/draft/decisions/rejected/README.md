# Rejected ADRs

This folder contains ADRs (Architecture Decision Records) that have been reviewed and rejected.

## Format

**Filename:** `[rejection-number]-[adr-id]-[descriptive-name].md`

- **Rejection number:** Sequential number based on order of rejection (may have gaps)
- **ADR ID:** Original unique 3-character alphanumeric identifier (preserved from proposal)
- **Descriptive name:** Original kebab-case description

Note: Numbering may have gaps if ADRs were moved or reorganized.

## Rejected ADRs

- `001-h9j-pod-discovery-and-hub-architecture.md` - Hub discovery architecture
  - **Rejection Date:** 2025-08-31
  - **Reason:** Out of scope for initial version. Pod configuration (ADR-d4n) provides a different approach that needs to mature first.
  
- `002-a3j-request-cancellation-mechanism.md` - Request cancellation mechanism
  - **Reason:** Conflicts with fire-and-forget philosophy of MCP/MECP
  
- `004-j99-targeted-proposals-and-rejection.md` - Targeted proposals and rejection
  - **Reason:** Adds complexity without clear benefit over existing patterns
  
- `005-38e-proposal-cancellation-mechanism.md` - Proposal cancellation mechanism
  - **Reason:** Overlaps with request cancellation, adds unnecessary state management

## Rejection Reasons

ADRs may be rejected for various reasons:
- Out of scope for current version
- Superseded by alternative approach
- Technical infeasibility
- Complexity outweighs benefits
- Conflicts with core design principles