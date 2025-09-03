# TODO

## MEUP v0.2 - COMPLETED ✓

All tasks for the v0.2 release have been completed on 2025-01-03.

### Completed ADR Implementation Tasks
- [x] h2n-1: Update ADR-h2n to select Option 2 (Always Array) with decision rationale
- [x] h2n-2: Add workflow context and Go compatibility reasoning to ADR-h2n
- [x] d4n-1: Review ADR-d4n for arbitrary participant configuration support
- [x] d4n-2: Ensure ADR-d4n supports workflow engine configuration (DAG structure, runtime config)
- [x] readme-1: Update proposed ADRs README with ADR-h2n entry

### Completed Implementation Priority Order
- [x] impl-1: Implement core protocol (ADRs x7k, m3p, q8f)
- [x] impl-1.5: Standardize property naming convention (ADR j3k)
- [x] impl-2: Implement basic operations (ADR v2c - proposals and lifecycle)
- [x] impl-3: Implement correlation (ADR h2n - array correlation IDs)
- [x] impl-4: Implement reasoning transparency and sub-context (ADRs t8k, k9j, p4m)
- [x] impl-5: Implement space management (ADRs g7r - delegation)
- [x] impl-6: Space configuration moved to future CLI implementation (ADR d4n)
- [x] review-1: Editor review of draft spec and accept proposals

### Release Tasks
- [x] Move all proposed ADRs to accepted folder
- [x] Update ADR statuses to Accepted with Complete incorporation
- [x] Fix all spec inconsistencies and errors
- [x] Update spec date to 2025-01-03

## Future Work (v0.2 and beyond)

### SDK Implementation
- [x] Update client SDK for v0.2 spec (@meup/client)
- [ ] Update agent SDK for v0.2 spec (@meup/agent)
- [ ] Implement reference gateway (@meup/gateway)
- [ ] Create TypeScript types package (@meup/types)
- [ ] Publish packages to npm under @meup org

### CLI and Tools
- [ ] Implement CLI with space configuration (using ADR-d4n)
- [ ] Create example participants
- [ ] Build proposal review UI/tool

### Testing and Documentation
- [ ] Write integration tests
- [ ] Create migration guide from v0.1
- [ ] Add SDK usage examples
- [ ] Document gateway implementation requirements

### Community
- [ ] Community feedback and iteration
- [ ] Create Discord/discussion forum
- [ ] Gather implementation feedback for v0.3