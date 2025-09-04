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
- [x] release-1: Move all proposed ADRs to accepted folder
- [x] release-2: Update ADR statuses to Accepted with Complete incorporation
- [x] release-3: Fix all spec inconsistencies and errors
- [x] release-4: Update spec date to 2025-01-03
- [x] release-5: Create v0.2 release commit and tag

## Future Work (v0.2 and beyond)

### SDK Implementation
- [x] sdk-1: Update client SDK for v0.2 spec (@meup/client)
- [x] sdk-2: Update agent SDK for v0.2 spec (@meup/agent)
- [x] sdk-3: Implement reference gateway (@meup/gateway)
- [ ] sdk-4: Create TypeScript types package (@meup/types)

### Test Planning and Review
- [x] test-plan-1: Create test plan document
- [x] test-plan-2: Define test scenarios
- [x] test-plan-3: Create test directory structure
- [ ] test-plan-4: Editor review and approval of test plan
- [ ] test-plan-5: Finalize test agent specifications

### Test Agents and Examples (After Plan Approval)
- [ ] test-agent-1: Create echo agent (simple response agent)
- [ ] test-agent-2: Create calculator agent (MCP tool provider)
- [ ] test-agent-3: Create proposer agent (untrusted, makes proposals)
- [ ] test-agent-4: Create fulfiller agent (trusted, executes proposals)
- [ ] test-agent-5: Create coordinator agent (reviews and routes)
- [ ] test-agent-6: Create context-aware agent (uses sub-contexts)

### CLI and Integration Testing (After Agent Implementation)
- [ ] cli-1: Implement CLI with space configuration (using ADR-d4n)
- [ ] cli-2: CLI command to start gateway
- [ ] cli-3: CLI command to run agents
- [ ] cli-4: CLI command to monitor spaces
- [ ] test-1: Test basic message flow (echo agent)
- [ ] test-2: Test MCP tool calls (calculator agent)
- [ ] test-3: Test proposal-execute pattern (proposer + fulfiller)
- [ ] test-4: Test capability enforcement
- [ ] test-5: Test context management (push/pop/resume)
- [ ] test-6: Test multi-agent collaboration scenario

### Package Publishing (After Integration Testing)
- [ ] pub-1: Run full integration test suite
- [ ] pub-2: Update package versions if needed
- [ ] pub-3: Publish @meup/client to npm
- [ ] pub-4: Publish @meup/agent to npm
- [ ] pub-5: Publish @meup/gateway to npm
- [ ] pub-6: Publish @meup/types to npm
- [ ] pub-7: Create GitHub release with examples

### Additional Tools
- [ ] tool-1: Create meup-inspector debugging tool
- [ ] tool-2: Build proposal review UI/tool
- [ ] tool-3: Create space admin dashboard

### Future SDKs
- [ ] sdk-5: Create Python SDK (@meup/python-sdk)
- [ ] sdk-6: Create Go SDK (@meup/go-sdk)

### Example Implementations
- [ ] example-1: Create trusted coordinator agent example
- [ ] example-2: Create untrusted assistant agent example
- [ ] example-3: Create MCP tool provider agent example
- [ ] example-4: Build multi-agent collaboration demo
- [ ] example-5: Create progressive automation demo

### Testing and Documentation
- [ ] test-1: Write gateway integration tests
- [ ] test-2: Write SDK unit tests
- [ ] test-3: Create end-to-end test suite
- [ ] test-4: Add performance benchmarks
- [ ] doc-1: Create migration guide from MCPx v0.1
- [ ] doc-2: Add SDK usage examples and tutorials
- [ ] doc-3: Document gateway implementation requirements
- [ ] doc-4: Create architecture diagrams
- [ ] doc-5: Write deployment guide

### Community
- [ ] community-1: Gather implementation feedback for v0.3
- [ ] community-2: Create Discord/discussion forum
- [ ] community-3: Write blog post announcing v0.2
- [ ] community-4: Create video tutorial series
- [ ] community-5: Establish governance process

### v0.3 Planning
- [ ] v03-1: Design authentication improvements
- [ ] v03-2: Specify message persistence layer
- [ ] v03-3: Define rate limiting and quotas
- [ ] v03-4: Add message routing between spaces
- [ ] v03-5: Specify federation protocol