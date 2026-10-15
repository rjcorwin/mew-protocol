/** Prototype integration contracts, not a public MEW wire protocol. */
export interface SecretReference { id: string; purpose: string }
export interface RepositoryAccess {
  url: string;
  operations: Array<'clone' | 'read' | 'write'>;
  secretRef?: string;
}
export interface EntityConfig {
  id: string;
  displayName: string;
  role: string;
  instructions: string;
  runtimeId: string;
  model: string;
  conversationIds: string[];
  revision: number;
  requiredResources: string[];
  resourceUnits: number;
  secretRefs: SecretReference[];
  repositories: RepositoryAccess[];
}
export interface EntityObserved {
  appliedRevision: number | null;
  sessionId: string | null;
  state: 'idle' | 'ready' | 'busy' | 'blocked';
  blocker?: string;
}
export interface WorkScope {
  id: string;
  generation: number;
  conversationIds: string[];
  entityIds: string[];
  startSequence: number;
  audience?: string[];
  status: 'active' | 'closed';
}
export interface WorkspaceMessage {
  id: string;
  workspaceId: string;
  conversationId: string;
  threadId: string;
  authorId: string;
  sequence: number;
  at: string;
  text: string;
  kind: 'message' | 'status';
  origin?: { chainId: string; depth: number; scopeId?: string; scopeGeneration?: number };
}
export interface HistoryPage {
  messages: WorkspaceMessage[];
  nextCursor?: string;
  gap?: string;
}
export interface ConversationHistory {
  messages: WorkspaceMessage[];
  complete: boolean;
  gaps: string[];
}
export interface PublishInput {
  conversationId: string;
  threadId: string;
  text: string;
  kind: 'message' | 'status';
  origin?: { chainId: string; depth: number; scopeId?: string; scopeGeneration?: number };
}
export interface WorkspaceAdapter {
  readonly id: string;
  readonly ready: boolean;
  sequence(): number;
  members(conversationId: string): string[];
  verify(message: WorkspaceMessage): boolean;
  subscribe(listener: (message: WorkspaceMessage) => void): () => void;
  publish(actorId: string, input: PublishInput): Promise<WorkspaceMessage>;
  history(conversationId: string, threadId: string, cursor: string | undefined, limit: number): Promise<HistoryPage>;
  messages(): WorkspaceMessage[];
}
export interface RuntimeCapabilities {
  modalities: string[];
  instructionUpdates: 'next-turn' | 'unsupported';
  permissions: string;
  steering: 'queued-only' | 'active';
  cancellation: 'confirmed' | 'requested-only' | 'unsupported';
  persistence: string;
  sessionMobility: false;
}
export interface RuntimeSession { id: string }
export interface RuntimeInput {
  entity: EntityConfig;
  scope: WorkScope;
  event: WorkspaceMessage;
  history: ConversationHistory;
  signal: AbortSignal;
}
export interface RuntimeOutput { kind: 'progress' | 'message'; text: string }
export interface RuntimeResult { outcome: 'completed' | 'cancelled'; text: string }
export interface RuntimeAdapter {
  readonly id: string;
  readonly capabilities: RuntimeCapabilities;
  open(entity: EntityConfig, scope: WorkScope): Promise<RuntimeSession>;
  configure(session: RuntimeSession, entity: EntityConfig): Promise<{ appliedRevision: number }>;
  run(session: RuntimeSession, input: RuntimeInput, publish: (output: RuntimeOutput) => Promise<void>): Promise<RuntimeResult>;
  cancel(session: RuntimeSession): Promise<'confirmed' | 'requested' | 'unsupported'>;
}
export type TaskStatus = 'queued' | 'running' | 'blocked' | 'cancel_requested' | 'completed' | 'cancelled' | 'failed' | 'uncertain';
export interface TaskRecord {
  id: string;
  entityId: string;
  scopeId: string;
  scopeGeneration: number;
  sourceMessageId: string;
  conversationId: string;
  threadId: string;
  chainId: string;
  depth: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  progress: string[];
  blocker?: string;
  completionMessageId?: string;
}
export interface PodSnapshot {
  version: 1;
  entities: Array<{ desired: EntityConfig; observed: EntityObserved }>;
  scopes: WorkScope[];
  tasks: TaskRecord[];
  messages: WorkspaceMessage[];
  capacity: { maxActive: number; authorizedMaxActive?: number; maxUnits: number; active: number; usedUnits: number };
  runtimes: Array<{ id: string; capabilities: RuntimeCapabilities }>;
  notices: string[];
}
export interface StateStore { load(): PodSnapshot | undefined; save(state: PodSnapshot): void; close?(): void }
export interface SecretResolver {
  resolve(reference: SecretReference, context: { entityId: string; repositoryUrl: string; operation: 'clone' | 'read' | 'write' }): Promise<{ value: string }>;
}
