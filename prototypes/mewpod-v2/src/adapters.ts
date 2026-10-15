import type {
  EntityConfig, HistoryPage, PublishInput, RuntimeAdapter, RuntimeCapabilities,
  RuntimeInput, RuntimeOutput, RuntimeResult, RuntimeSession, WorkScope,
  WorkspaceAdapter, WorkspaceMessage,
} from './types.js';

export interface MemoryWorkspaceOptions {
  id?: string;
  memberships: Record<string, string[]>;
  maxMessages?: number;
  initialMessages?: WorkspaceMessage[];
  now?: () => Date;
  ready?: boolean;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

function nonempty(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be nonempty`);
}

function validateOrigin(origin: WorkspaceMessage['origin']): void {
  if (origin === undefined) return;
  if (origin === null || typeof origin !== 'object') throw new Error('Invalid message origin');
  nonempty(origin.chainId, 'Origin chain ID');
  if (!Number.isSafeInteger(origin.depth) || origin.depth < 0) throw new Error('Invalid origin depth');
  if ('scopeId' in origin || 'scopeGeneration' in origin) {
    nonempty(origin.scopeId, 'Origin scope ID');
    if (!Number.isSafeInteger(origin.scopeGeneration) || (origin.scopeGeneration ?? 0) < 1) {
      throw new Error('Origin scope generation must be a positive safe integer');
    }
  }
}

/** A fake platform record store. actorId is selected by the trusted host, never parsed from text. */
export class MemoryWorkspace implements WorkspaceAdapter {
  readonly id: string;
  readonly maxMessages: number;
  private available: boolean;
  private readonly membership = new Map<string, ReadonlySet<string>>();
  private readonly records = new Map<string, WorkspaceMessage>();
  private readonly listeners = new Set<(message: WorkspaceMessage) => void>();
  private readonly gaps = new Map<string, string>();
  private readonly now: () => Date;
  private lastSequence = 0;
  private nextPublishError?: Error;
  private observerErrors: string[] = [];

  constructor(options: MemoryWorkspaceOptions) {
    this.id = options.id ?? 'memory';
    nonempty(this.id, 'Workspace ID');
    this.maxMessages = options.maxMessages ?? 10_000;
    if (!Number.isSafeInteger(this.maxMessages) || this.maxMessages < 1) {
      throw new Error('maxMessages must be a positive safe integer');
    }
    this.available = options.ready ?? true;
    this.now = options.now ?? (() => new Date());
    for (const [conversationId, members] of Object.entries(options.memberships)) {
      nonempty(conversationId, 'Conversation ID');
      members.forEach(member => nonempty(member, 'Member ID'));
      this.membership.set(conversationId, new Set(members));
    }
    if (options.initialMessages) this.restore(options.initialMessages);
  }

  get ready(): boolean { return this.available; }
  get listenerErrors(): string[] { return [...this.observerErrors]; }
  setReady(ready: boolean): void { this.available = ready; }
  sequence(): number { return this.lastSequence; }
  members(conversationId: string): string[] { return [...(this.membership.get(conversationId) ?? [])]; }
  messages(): WorkspaceMessage[] { return [...this.records.values()]; }

  verify(message: WorkspaceMessage): boolean {
    if (!message || typeof message !== 'object') return false;
    try { validateOrigin(message.origin); } catch { return false; }
    const stored = this.records.get(message.id);
    if (!stored) return false;
    return stored.workspaceId === message.workspaceId && stored.conversationId === message.conversationId
      && stored.threadId === message.threadId && stored.authorId === message.authorId
      && stored.sequence === message.sequence && stored.at === message.at && stored.text === message.text
      && stored.kind === message.kind && stored.origin?.chainId === message.origin?.chainId
      && stored.origin?.depth === message.origin?.depth
      && stored.origin?.scopeId === message.origin?.scopeId
      && stored.origin?.scopeGeneration === message.origin?.scopeGeneration
      && (stored.origin === undefined) === (message.origin === undefined);
  }

  subscribe(listener: (message: WorkspaceMessage) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  async publish(actorId: string, input: PublishInput): Promise<WorkspaceMessage> {
    this.assertReady();
    this.assertMember(input.conversationId, actorId);
    nonempty(input.threadId, 'Thread ID');
    if (typeof input.text !== 'string') throw new Error('Message text must be a string');
    if (input.kind !== 'message' && input.kind !== 'status') throw new Error('Invalid message kind');
    validateOrigin(input.origin);
    if (this.records.size >= this.maxMessages) {
      throw new Error(`Workspace retention limit (${this.maxMessages}) reached; publication refused`);
    }
    if (this.lastSequence >= Number.MAX_SAFE_INTEGER) throw new Error('Workspace sequence exhausted');
    if (this.nextPublishError) {
      const failure = this.nextPublishError;
      this.nextPublishError = undefined;
      throw failure;
    }
    const sequence = this.lastSequence + 1;
    let id = `${this.id}:message:${sequence}`;
    while (this.records.has(id)) id += ':new';
    const message = freeze<WorkspaceMessage>({
      id, workspaceId: this.id, authorId: actorId, sequence, at: this.now().toISOString(),
      conversationId: input.conversationId, threadId: input.threadId,
      text: input.text, kind: input.kind,
      ...(input.origin ? { origin: { ...input.origin } } : {}),
    });
    this.records.set(id, message);
    this.lastSequence = sequence;
    this.deliver(message);
    return message;
  }

  async history(conversationId: string, threadId: string, cursor: string | undefined, limit: number): Promise<HistoryPage> {
    this.assertReady();
    if (!this.membership.has(conversationId)) throw new Error('Unknown conversation');
    nonempty(threadId, 'Thread ID');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error('History limit must be 1–1000');
    let after = 0;
    let through = this.lastSequence;
    if (cursor !== undefined) {
      try {
        const data: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        if (!Array.isArray(data) || data.length !== 5 || data[0] !== this.id
          || data[1] !== conversationId || data[2] !== threadId
          || !Number.isSafeInteger(data[3]) || !Number.isSafeInteger(data[4])
          || data[3] < 0 || data[4] < data[3] || data[4] > this.lastSequence) {
          throw new Error('Invalid cursor');
        }
        after = data[3] as number;
        through = data[4] as number;
      } catch { throw new Error('Invalid history cursor for this conversation/thread'); }
    }
    const candidates = this.messages().filter(message => message.conversationId === conversationId
      && message.threadId === threadId && message.sequence > after && message.sequence <= through);
    const messages = candidates.slice(0, limit);
    const gap = this.gaps.get(JSON.stringify([conversationId, threadId]));
    const nextCursor = candidates.length > limit
      ? Buffer.from(JSON.stringify([this.id, conversationId, threadId, messages[messages.length - 1].sequence, through])).toString('base64url')
      : undefined;
    return { messages, ...(nextCursor ? { nextCursor } : {}), ...(gap ? { gap } : {}) };
  }

  /** Import only trusted local snapshots, atomically, into an empty adapter. No events are emitted. */
  restore(messages: WorkspaceMessage[]): void {
    if (this.records.size) throw new Error('Restore requires an empty workspace');
    if (messages.length > this.maxMessages) throw new Error('Snapshot exceeds workspace retention limit');
    const staged = new Map<string, WorkspaceMessage>();
    const sequences = new Set<number>();
    for (const source of messages) {
      nonempty(source.id, 'Message ID');
      nonempty(source.threadId, 'Thread ID');
      this.assertMember(source.conversationId, source.authorId);
      if (source.workspaceId !== this.id || !Number.isSafeInteger(source.sequence) || source.sequence < 1
        || sequences.has(source.sequence) || staged.has(source.id) || typeof source.text !== 'string'
        || (source.kind !== 'message' && source.kind !== 'status')
        || typeof source.at !== 'string' || !Number.isFinite(Date.parse(source.at))) {
        throw new Error('Invalid workspace snapshot record');
      }
      validateOrigin(source.origin);
      staged.set(source.id, freeze(structuredClone(source)));
      sequences.add(source.sequence);
    }
    for (const message of [...staged.values()].sort((a, b) => a.sequence - b.sequence)) {
      this.records.set(message.id, message);
      this.lastSequence = message.sequence;
    }
  }

  redeliver(messageId: string): void {
    this.assertReady();
    const message = this.records.get(messageId);
    if (!message) throw new Error('Cannot redeliver an unknown message');
    this.deliver(message);
  }

  setHistoryGap(conversationId: string, threadId: string, reason: string | undefined): void {
    if (!this.membership.has(conversationId)) throw new Error('Unknown conversation');
    const key = JSON.stringify([conversationId, threadId]);
    if (reason === undefined) this.gaps.delete(key);
    else { nonempty(reason, 'History gap'); this.gaps.set(key, reason); }
  }

  failNextPublish(reason = 'Mock publication failed'): void { this.nextPublishError = new Error(reason); }

  private assertMember(conversationId: string, actorId: string): void {
    if (!this.membership.get(conversationId)?.has(actorId)) throw new Error('Actor is not a member of this conversation');
  }

  private assertReady(): void { if (!this.available) throw new Error('Workspace is not ready'); }

  private deliver(message: WorkspaceMessage): void {
    for (const listener of [...this.listeners]) {
      try { listener(message); }
      catch (error) {
        // Publication is already committed. Observer failure must not imply it is safe to retry.
        this.observerErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
}

export type MockStep =
  | { kind: 'delay'; ms: number }
  | { kind: 'progress' | 'message'; text: string }
  | { kind: 'final'; text: string; outcome?: RuntimeResult['outcome'] }
  | { kind: 'fail'; message: string };
export type MockPlan = readonly MockStep[];
export type MockPlanFactory = (input: RuntimeInput, session: RuntimeSession) => MockPlan | Promise<MockPlan>;
export interface MockRuntimeOptions {
  id: string;
  capabilities?: Partial<RuntimeCapabilities>;
  delayMs?: number;
  plan?: MockPlan | MockPlanFactory;
}
export interface MockRuntimeCall { sessionId: string; input: RuntimeInput }
interface SessionState {
  session: RuntimeSession;
  entityId: string;
  scopeId: string;
  generation: number;
  instructions: string;
  revision: number;
  configured: boolean;
}
interface ActiveRun {
  cancelled: boolean;
  stopped: Promise<void>;
  markStopped: () => void;
  onCancel: Set<() => void>;
}

/** Deterministic asynchronous runtime. No model, credential, process, network, or real tool calls. */
export class MockRuntime implements RuntimeAdapter {
  readonly id: string;
  readonly capabilities: RuntimeCapabilities;
  private readonly delayMs: number;
  private readonly plan: MockPlan | MockPlanFactory;
  private readonly sessions = new Map<string, SessionState>();
  private readonly scopeSessions = new Map<string, RuntimeSession>();
  private readonly active = new Map<string, ActiveRun>();
  private readonly recordedCalls: MockRuntimeCall[] = [];
  private readonly requestedCancellations: string[] = [];
  private nextOpenError?: Error;
  private nextConfigureError?: Error;
  private nextRunError?: Error;
  private nextCancelError?: Error;

  constructor(options: MockRuntimeOptions) {
    this.id = options.id;
    nonempty(this.id, 'Runtime ID');
    this.delayMs = options.delayMs ?? 10;
    this.validateDelay(this.delayMs);
    this.capabilities = freeze({
      modalities: ['text'], instructionUpdates: 'next-turn', permissions: 'No tools; simulated outputs only',
      steering: 'queued-only', cancellation: 'confirmed', persistence: 'In-memory sessions for this adapter lifetime',
      sessionMobility: false, ...structuredClone(options.capabilities ?? {}),
    } as RuntimeCapabilities);
    if (this.capabilities.steering !== 'queued-only' || this.capabilities.sessionMobility !== false
      || this.capabilities.modalities.length !== 1 || this.capabilities.modalities[0] !== 'text') {
      throw new Error('Mock runtime supports only text, queued-only steering, and no session mobility');
    }
    if (!['confirmed', 'requested-only', 'unsupported'].includes(this.capabilities.cancellation)
      || !['next-turn', 'unsupported'].includes(this.capabilities.instructionUpdates)) {
      throw new Error('Invalid mock runtime capability mode');
    }
    this.plan = typeof options.plan === 'function' ? options.plan : freeze(structuredClone(options.plan ?? [
      { kind: 'progress', text: 'Mock runtime is working' },
      { kind: 'delay', ms: this.delayMs },
      { kind: 'final', text: 'Mock work completed' },
    ]));
  }

  get calls(): MockRuntimeCall[] { return [...this.recordedCalls]; }
  get cancellationRequests(): string[] { return [...this.requestedCancellations]; }

  async open(entity: EntityConfig, scope: WorkScope): Promise<RuntimeSession> {
    if (this.nextOpenError) { const failure = this.nextOpenError; this.nextOpenError = undefined; throw failure; }
    if (entity.runtimeId !== this.id || !scope.entityIds.includes(entity.id) || scope.status !== 'active') {
      throw new Error('Entity/runtime/work-scope binding is invalid');
    }
    const key = JSON.stringify([entity.id, scope.id, scope.generation]);
    const existing = this.scopeSessions.get(key);
    if (existing) return existing;
    const session = freeze({ id: `${this.id}:session:${this.sessions.size + 1}` });
    this.sessions.set(session.id, {
      session, entityId: entity.id, scopeId: scope.id, generation: scope.generation,
      instructions: entity.instructions, revision: entity.revision, configured: false,
    });
    this.scopeSessions.set(key, session);
    return session;
  }

  async configure(session: RuntimeSession, entity: EntityConfig): Promise<{ appliedRevision: number }> {
    const binding = this.getSession(session);
    if (entity.id !== binding.entityId || entity.runtimeId !== this.id) {
      throw new Error('Configuration does not match the session binding');
    }
    if (!Number.isSafeInteger(entity.revision) || entity.revision < 1 || entity.revision < binding.revision) {
      throw new Error('Configuration revision must be a positive, non-stale safe integer');
    }
    if (typeof entity.instructions !== 'string') throw new Error('Instructions must be a string');
    if (entity.revision === binding.revision && entity.instructions !== binding.instructions) {
      throw new Error('Changed instructions require a new configuration revision');
    }
    if (this.capabilities.instructionUpdates === 'unsupported'
      && (binding.instructions !== entity.instructions || binding.revision !== entity.revision)) {
      throw new Error('This runtime does not support instruction updates');
    }
    if (this.nextConfigureError) {
      const failure = this.nextConfigureError;
      this.nextConfigureError = undefined;
      throw failure;
    }
    binding.instructions = entity.instructions;
    binding.revision = entity.revision;
    binding.configured = true;
    return { appliedRevision: binding.revision };
  }

  async run(session: RuntimeSession, input: RuntimeInput, publish: (output: RuntimeOutput) => Promise<void>): Promise<RuntimeResult> {
    const binding = this.getSession(session);
    if (binding.entityId !== input.entity.id || input.entity.runtimeId !== this.id
      || binding.scopeId !== input.scope.id || binding.generation !== input.scope.generation
      || input.scope.status !== 'active' || !input.scope.entityIds.includes(input.entity.id)) {
      throw new Error('Runtime input does not match the session binding');
    }
    if (!binding.configured || binding.instructions !== input.entity.instructions || binding.revision !== input.entity.revision) {
      throw new Error('Runtime input does not match an applied configuration');
    }
    if (this.active.has(session.id)) throw new Error('Session already has an active turn');
    const captured: RuntimeInput = {
      ...freeze(structuredClone({ entity: input.entity, scope: input.scope, event: input.event, history: input.history })),
      signal: input.signal,
    };
    this.recordedCalls.push(Object.freeze({ sessionId: session.id, input: Object.freeze(captured) }));
    let markStopped!: () => void;
    const stopped = new Promise<void>(resolve => { markStopped = resolve; });
    const active: ActiveRun = { cancelled: false, stopped, markStopped, onCancel: new Set() };
    this.active.set(session.id, active);
    const runFailure = this.nextRunError;
    this.nextRunError = undefined;
    const onAbort = (): void => {
      if (this.capabilities.cancellation === 'confirmed') this.stop(active);
    };
    input.signal.addEventListener('abort', onAbort, { once: true });
    if (input.signal.aborted) onAbort();
    const cancelled = (): RuntimeResult => ({ outcome: 'cancelled', text: 'Mock turn cancelled' });
    try {
      // Every plan yields, including plans with only a final result.
      await this.delay(this.delayMs, active);
      if (active.cancelled) return cancelled();
      if (runFailure) throw runFailure;
      const candidate = typeof this.plan === 'function' ? this.plan(captured, binding.session) : this.plan;
      // A synchronous plan factory may abort its own turn before a cancellation waiter exists.
      if (active.cancelled) {
        void Promise.resolve(candidate).catch(() => {});
        return cancelled();
      }
      let cancelPlan!: () => void;
      const cancelledPlan = new Promise<undefined>(resolve => { cancelPlan = () => resolve(undefined); });
      active.onCancel.add(cancelPlan);
      let plan: MockPlan | undefined;
      try { plan = await Promise.race([candidate, cancelledPlan]); }
      finally { active.onCancel.delete(cancelPlan); }
      if (active.cancelled || plan === undefined) return cancelled();
      for (const step of freeze(structuredClone(plan))) {
        if (active.cancelled) return cancelled();
        if (step.kind === 'delay') await this.delay(step.ms, active);
        else if (step.kind === 'fail') throw new Error(step.message);
        else if (step.kind === 'final') return { outcome: step.outcome ?? 'completed', text: step.text };
        else await publish({ kind: step.kind, text: step.text });
      }
      return active.cancelled ? cancelled() : { outcome: 'completed', text: 'Mock work completed' };
    } finally {
      input.signal.removeEventListener('abort', onAbort);
      this.active.delete(session.id);
      active.markStopped();
    }
  }

  async cancel(session: RuntimeSession): Promise<'confirmed' | 'requested' | 'unsupported'> {
    this.getSession(session);
    if (this.nextCancelError) { const failure = this.nextCancelError; this.nextCancelError = undefined; throw failure; }
    this.requestedCancellations.push(session.id);
    if (this.capabilities.cancellation === 'unsupported') return 'unsupported';
    if (this.capabilities.cancellation === 'requested-only') return 'requested';
    const active = this.active.get(session.id);
    if (active) { this.stop(active); await active.stopped; }
    return 'confirmed';
  }

  failNextOpen(reason = 'Mock runtime open failed'): void { this.nextOpenError = new Error(reason); }
  failNextConfigure(reason = 'Mock runtime configuration failed'): void { this.nextConfigureError = new Error(reason); }
  failNextRun(reason = 'Mock runtime turn failed'): void { this.nextRunError = new Error(reason); }
  failNextCancel(reason = 'Mock runtime cancellation failed'): void { this.nextCancelError = new Error(reason); }

  private getSession(session: RuntimeSession): SessionState {
    const binding = this.sessions.get(session.id);
    if (!binding) throw new Error('Unknown runtime session');
    return binding;
  }

  private stop(active: ActiveRun): void {
    active.cancelled = true;
    for (const listener of [...active.onCancel]) listener();
  }

  private validateDelay(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0 || ms > 2_147_483_647) throw new Error('Invalid mock delay');
  }

  private async delay(ms: number, active: ActiveRun): Promise<void> {
    this.validateDelay(ms);
    if (active.cancelled) return;
    await new Promise<void>(resolve => {
      const finish = (): void => { clearTimeout(timer); active.onCancel.delete(finish); resolve(); };
      const timer = setTimeout(finish, ms);
      active.onCancel.add(finish);
    });
  }
}
