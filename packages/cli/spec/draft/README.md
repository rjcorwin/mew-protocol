# MECP CLI Specification (Draft)

## Overview

The MECP CLI provides a command-line interface for humans to start pods and participate directly in shared contexts with AI agents.

## Key Requirements

- Enable humans to easily start and join pods
- Provide real-time visibility into pod activity
- Support capability management
- Handle message display and interaction
- Bridge MCP/A2A protocols when needed

## Architecture Decisions

See [decisions/proposed/](decisions/proposed/) for ADRs under consideration:
- CLI naming
- Command structure
- Display modes
- Configuration format

## Command Structure (Proposed)

```bash
<cli> start [config]     # Start a new pod
<cli> join [pod-id]      # Join existing pod  
<cli> status            # Show pod and participant status
<cli> leave             # Leave current pod
<cli> stop              # Stop a pod you started
<cli> list              # List available pods
<cli> whoami            # Show your participant info
```

## User Experience Goals

1. **Immediate Participation**: One command to join the shared context
2. **Clear Visibility**: See all operations as they happen
3. **Easy Control**: Simple commands for approval/rejection
4. **Progressive Disclosure**: Basic use is simple, advanced features available

## Status

This specification is in early draft stage. Key decisions pending:
- [ ] CLI name
- [ ] Display interface (TUI vs streaming output)
- [ ] Configuration format
- [ ] Installation and distribution method