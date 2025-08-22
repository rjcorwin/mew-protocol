# MCPx Studio - Architecture Design

## Overview

MCPx Studio is a desktop application built with Electron that provides a graphical interface for managing the MCPx ecosystem. It acts as a visual wrapper around the mcpx-cli, providing an intuitive way to manage agents, servers, bridges, and topics.

## Architecture Principles

1. **Separation of Concerns**: Clear separation between UI (renderer process) and system operations (main process)
2. **CLI Integration**: Leverage existing mcpx-cli for all operations rather than reimplementing
3. **State Management**: Centralized state management for consistency across views
4. **Real-time Updates**: WebSocket connections for live monitoring
5. **Cross-platform**: Single codebase for Mac, Windows, and Linux
6. **Security**: Sandboxed renderer with controlled IPC communication

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Interface                       │
│                    (Electron Renderer Process)               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    React Application                 │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │   │
│  │  │Dashboard │  │  Agents  │  │   Monitoring  │     │   │
│  │  └──────────┘  └──────────┘  └──────────────┘     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │   │
│  │  │ Bridges  │  │  Topics  │  │  MCP Servers │     │   │
│  │  └──────────┘  └──────────┘  └──────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                     IPC Communication                        │
│                            │                                 │
└─────────────────────────────┼─────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                    Electron Main Process                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Service Layer                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │   │
│  │  │   CLI    │  │WebSocket │  │  File System │     │   │
│  │  │  Service │  │  Client  │  │    Service   │     │   │
│  │  └──────────┘  └──────────┘  └──────────────┘     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │   │
│  │  │  Process │  │  Config  │  │   Logging    │     │   │
│  │  │  Manager │  │  Manager │  │    Service   │     │   │
│  │  └──────────┘  └──────────┘  └──────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────┼─────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────┐
│                      System Resources                       │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────────┐   │
│  │ mcpx-cli │  │ ~/.mcpx  │  │   MCPx Server/Agents   │   │
│  └──────────┘  └──────────┘  └────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Renderer Process (UI Layer)

#### React Application
- **Framework**: React 18+ with TypeScript
- **Routing**: React Router for navigation
- **State Management**: Redux Toolkit for global state
- **UI Library**: Ant Design for consistent components
- **Styling**: CSS Modules + Tailwind CSS

#### Key Views
1. **Dashboard**: System overview, quick actions, status summary
2. **Agents**: Create, configure, start/stop agents
3. **Bridges**: Manage MCP server bridges
4. **Topics**: Browse and join topics/channels
5. **MCP Servers**: Browse, install, configure MCP servers
6. **Monitoring**: Real-time logs, metrics, message flow
7. **Settings**: Application preferences, theme, advanced options

### 2. Main Process (Service Layer)

#### CLI Service
```typescript
interface CLIService {
  // Execute mcpx-cli commands
  execute(command: string, args: string[]): Promise<CLIResult>;
  
  // Stream output for long-running commands
  stream(command: string, args: string[]): Observable<string>;
  
  // Kill running processes
  kill(processId: number): Promise<void>;
}
```

#### WebSocket Client
```typescript
interface WebSocketService {
  // Connect to MCPx server for monitoring
  connect(url: string, token: string): Promise<void>;
  
  // Subscribe to topics
  subscribe(topic: string): Observable<Message>;
  
  // Send messages
  send(topic: string, message: any): Promise<void>;
}
```

#### File System Service
```typescript
interface FileSystemService {
  // Read/write configuration files
  readConfig(path: string): Promise<Config>;
  writeConfig(path: string, config: Config): Promise<void>;
  
  // Watch for file changes
  watch(path: string): Observable<FileChange>;
  
  // Manage logs
  readLogs(component: string, lines: number): Promise<string[]>;
}
```

#### Process Manager
```typescript
interface ProcessManager {
  // Track running processes
  register(process: ChildProcess): string;
  
  // Get process status
  getStatus(id: string): ProcessStatus;
  
  // Clean up on exit
  cleanup(): Promise<void>;
}
```

### 3. IPC Communication

#### Channel Structure
```typescript
// Main -> Renderer
interface MainToRenderer {
  'system:status': SystemStatus;
  'agent:list': Agent[];
  'log:update': LogEntry;
  'error': ErrorMessage;
}

// Renderer -> Main
interface RendererToMain {
  'agent:create': CreateAgentRequest;
  'agent:start': StartAgentRequest;
  'system:refresh': void;
  'config:save': ConfigUpdate;
}
```

#### Security Model
- Context isolation enabled
- Node integration disabled
- Preload script for secure IPC bridge
- Input validation on all IPC messages
- Sandboxed file system access

## Data Flow

### 1. Command Execution Flow
```
User Action → React Component → Redux Action → IPC Message 
    → Main Process → CLI Service → mcpx-cli → Response
    → IPC Response → Redux Reducer → UI Update
```

### 2. Real-time Monitoring Flow
```
MCPx Server → WebSocket → Main Process WebSocket Client
    → IPC Stream → Redux Middleware → UI Updates
```

### 3. Configuration Management Flow
```
UI Form → Validation → IPC Message → File System Service
    → ~/.mcpx/config → File Watcher → IPC Update → UI Sync
```

## State Management

### Redux Store Structure
```typescript
interface StudioState {
  system: {
    status: 'running' | 'stopped' | 'starting' | 'error';
    components: ComponentStatus[];
    metrics: SystemMetrics;
  };
  
  agents: {
    list: Agent[];
    selected: string | null;
    creating: boolean;
    templates: Template[];
  };
  
  bridges: {
    list: Bridge[];
    selected: string | null;
  };
  
  topics: {
    list: Topic[];
    active: string | null;
    messages: Message[];
    participants: Participant[];
  };
  
  mcpServers: {
    available: MCPServer[];
    installed: MCPServer[];
    installing: string[];
  };
  
  ui: {
    theme: 'light' | 'dark';
    activeView: string;
    sidebarCollapsed: boolean;
    notifications: Notification[];
  };
  
  logs: {
    entries: LogEntry[];
    filters: LogFilter;
    following: boolean;
  };
}
```

## File System Structure

```
~/.mcpx/
├── studio/
│   ├── preferences.json       # Studio-specific settings
│   ├── layouts/               # Saved UI layouts
│   ├── themes/                # Custom themes
│   └── plugins/               # Future: plugin directory
├── agents/                    # Existing agent configs
├── bridges/                   # Existing bridge configs
├── runtime/                   # Process PIDs and status
└── logs/                      # Component logs
```

## Security Considerations

1. **Process Isolation**: Main and renderer processes are isolated
2. **IPC Validation**: All IPC messages are validated with schemas
3. **File Access**: Limited to ~/.mcpx directory and user-selected paths
4. **Command Injection**: Parameterized CLI execution, no string concatenation
5. **Authentication**: Secure storage of tokens using electron-store
6. **Updates**: Signed updates with automatic security patches

## Performance Optimizations

1. **Virtual Scrolling**: For large lists (agents, logs, messages)
2. **Debounced Updates**: Batch UI updates for high-frequency events
3. **Lazy Loading**: Load views and data on demand
4. **Worker Threads**: Offload heavy processing to worker threads
5. **Caching**: Cache MCP server metadata and configurations
6. **Incremental Logs**: Stream logs instead of loading entire files

## Testing Strategy

### Unit Tests
- Service layer functions
- Redux reducers and actions
- UI component logic
- Utility functions

### Integration Tests
- IPC communication
- CLI command execution
- File system operations
- WebSocket connections

### E2E Tests
- Complete user workflows
- Cross-platform compatibility
- Performance benchmarks
- Error recovery scenarios

## Deployment Architecture

### Build Pipeline
```
Source Code → TypeScript Compilation → Webpack Bundle 
    → Electron Builder → Platform Installers → Code Signing
    → Auto-update Server → Distribution
```

### Platform Targets
- **macOS**: DMG, pkg installers, Apple notarization
- **Windows**: NSIS installer, MSI package, code signing
- **Linux**: AppImage, deb, rpm packages

## Future Extensibility

### Plugin System
- Plugin API for extending functionality
- Sandboxed plugin execution
- UI component injection points
- Event hooks for plugin integration

### Cloud Integration
- Cloud backup of configurations
- Remote management capabilities
- Collaborative features
- Analytics and telemetry (opt-in)

### AI Enhancements
- Intelligent agent suggestions
- Automated troubleshooting
- Performance optimization recommendations
- Natural language configuration

## Technology Stack Summary

- **Desktop Framework**: Electron 28+
- **Frontend**: React 18 + TypeScript 5
- **State Management**: Redux Toolkit
- **UI Components**: Ant Design 5
- **Build Tool**: Vite
- **Testing**: Jest + Playwright
- **Process Management**: Node.js child_process
- **WebSocket**: ws library
- **Logging**: Winston
- **Storage**: electron-store
- **Packaging**: electron-builder