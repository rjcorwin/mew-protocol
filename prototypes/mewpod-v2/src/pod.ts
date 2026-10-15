import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { ConversationHistory, EntityConfig, EntityObserved, PodSnapshot, PublishInput, RuntimeAdapter, RuntimeSession, StateStore, TaskRecord, WorkspaceAdapter, WorkspaceMessage, WorkScope } from './types.js';

const terminal = new Set(['completed', 'cancelled', 'failed', 'uncertain']);
const identifier = /^[a-z][a-z0-9_-]{0,63}$/;
const copy = <T>(value: T): T => structuredClone(value);
export interface PodOptions {
  workspace: WorkspaceAdapter;
  runtimes: RuntimeAdapter[];
  store?: StateStore;
  initialState?: PodSnapshot;
  maxActive?: number;
  authorizedMaxActive?: number;
  maxUnits?: number;
  availableResources?: string[];
  maxChainTurns?: number;
  maxTasks?: number;
  historyPages?: number;
  historyPageSize?: number;
}

/** Single-process integration glue. Configured entities do not imply active compute. */
export class Mewpod extends EventEmitter {
  private entities = new Map<string, { desired: EntityConfig; observed: EntityObserved }>();
  private scopes: WorkScope[] = [];
  private tasks: TaskRecord[] = [];
  private runtimes: Map<string, RuntimeAdapter>;
  private sessions = new Map<string, RuntimeSession>();
  private active = new Map<string, { task: TaskRecord; runtime: RuntimeAdapter; session?: RuntimeSession; controller: AbortController; units: number }>();
  private seen = new Set<string>();
  private notices: string[] = [];
  private capacity: number;
  private authorizedMaxActive: number;
  private maxUnits: number;
  private resources: Set<string>;
  private disposed = false;
  private storageFault = false;
  private scheduled = false;
  private unsubscribe: () => void;
  readonly workspace: WorkspaceAdapter;

  constructor(private readonly options: PodOptions) {
    super();
    this.workspace = options.workspace;
    this.runtimes = new Map(options.runtimes.map(runtime => [runtime.id, runtime]));
    this.authorizedMaxActive = options.authorizedMaxActive ?? 4;
    this.capacity = options.maxActive ?? 2;
    this.maxUnits = options.maxUnits ?? 4;
    if (!Number.isSafeInteger(this.authorizedMaxActive) || this.authorizedMaxActive < 1 || this.authorizedMaxActive > 32 || !Number.isSafeInteger(this.capacity) || this.capacity < 0 || this.capacity > this.authorizedMaxActive || !Number.isSafeInteger(this.maxUnits) || this.maxUnits < 1 || this.maxUnits > 10000) throw new Error('Invalid capacity limits');
    for (const [value, maximum] of [[options.maxTasks ?? 1000, 10000], [options.maxChainTurns ?? 6, 100], [options.historyPages ?? 3, 100], [options.historyPageSize ?? 20, 100]]) {
      if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error('Invalid prototype bound');
    }
    this.resources = new Set(options.availableResources ?? ['bridge', 'identity', 'storage', 'routing']);
    const prior = options.initialState;
    if (prior) {
      // Restore the work record only. Never replay uncertain work or pretend sessions survived.
      for (const entity of prior.entities) this.entities.set(entity.desired.id, { desired: copy(entity.desired), observed: { appliedRevision: null, sessionId: null, state: 'idle' } });
      this.scopes = copy(prior.scopes).map(scope => ({ ...scope, status: 'closed' }));
      this.tasks = copy(prior.tasks).map(task => terminal.has(task.status) ? task : { ...task, status: 'uncertain', blocker: 'Process ended before a verified terminal outcome; no automatic replay' });
      this.notices.push('Loaded work record; scopes are closed and native sessions are not restored. Start a new scope explicitly.');
    }
    this.unsubscribe = this.workspace.subscribe(message => this.accept(message));
    this.persist();
  }

  snapshot(): PodSnapshot {
    return copy({ version: 1, entities: [...this.entities.values()], scopes: this.scopes, tasks: this.tasks, messages: this.workspace.messages(), capacity: { maxActive: this.capacity, authorizedMaxActive: this.authorizedMaxActive, maxUnits: this.maxUnits, active: this.active.size, usedUnits: this.usedUnits() }, runtimes: [...this.runtimes.values()].map(runtime => ({ id: runtime.id, capabilities: runtime.capabilities })), notices: this.notices });
  }

  configureEntity(config: EntityConfig): void {
    this.assertWritable();
    if (!identifier.test(config.id) || !this.runtimes.has(config.runtimeId) || !Number.isSafeInteger(config.revision) || config.revision < 1 || !Number.isSafeInteger(config.resourceUnits) || config.resourceUnits < 1 || !Array.isArray(config.requiredResources) || !Array.isArray(config.conversationIds) || !config.conversationIds.length) throw new Error('Invalid entity configuration');
    if (config.instructions.length > 12000 || config.displayName.length > 100 || config.model.length > 100) throw new Error('Configuration exceeds prototype limits');
    for (const conversation of config.conversationIds) if (!this.workspace.members(conversation).includes(config.id)) throw new Error('Entity lacks workspace membership');
    const prior = this.entities.get(config.id);
    if (prior && config.revision !== prior.desired.revision + 1) throw new Error('Stale configuration revision');
    const hasScope = this.scopes.some(scope => scope.status === 'active' && scope.entityIds.includes(config.id));
    if (prior && hasScope && (config.runtimeId !== prior.desired.runtimeId || JSON.stringify(config.conversationIds) !== JSON.stringify(prior.desired.conversationIds))) throw new Error('Runtime or access changes require ending the active scope');
    if (prior) prior.desired = copy(config);
    else this.entities.set(config.id, { desired: copy(config), observed: { appliedRevision: null, sessionId: null, state: 'idle' } });
    this.persist();
    this.schedule();
  }

  startScope(input: { id: string; conversationIds: string[]; entityIds: string[] }): WorkScope {
    this.assertWritable();
    if (!identifier.test(input.id) || !input.conversationIds.length || !input.entityIds.length || new Set(input.conversationIds).size !== input.conversationIds.length || new Set(input.entityIds).size !== input.entityIds.length) throw new Error('Invalid scope');
    if (this.scopes.some(scope => scope.status === 'active' && (scope.id === input.id || scope.conversationIds.some(id => input.conversationIds.includes(id)) || scope.entityIds.some(id => input.entityIds.includes(id))))) throw new Error('Scope overlaps an active mapping');
    const audience = JSON.stringify([...this.workspace.members(input.conversationIds[0])].sort());
    if (audience === '[]' || input.conversationIds.some(id => JSON.stringify([...this.workspace.members(id)].sort()) !== audience)) throw new Error('Incompatible conversation access boundaries');
    for (const id of input.entityIds) {
      const entity = this.entities.get(id);
      if (!entity || input.conversationIds.some(conversation => !entity.desired.conversationIds.includes(conversation))) throw new Error('Entity is not configured for this scope');
    }
    const generation = 1 + Math.max(0, ...this.scopes.filter(scope => scope.id === input.id).map(scope => scope.generation));
    const scope: WorkScope = { ...copy(input), generation, startSequence: this.workspace.sequence(), audience: [...this.workspace.members(input.conversationIds[0])].sort(), status: 'active' };
    this.scopes.push(scope);
    this.persist();
    return copy(scope);
  }

  endScope(id: string): void {
    this.assertWritable();
    const scope = this.scopes.find(item => item.id === id && item.status === 'active');
    if (!scope) throw new Error('No active scope');
    scope.status = 'closed';
    for (const task of this.tasks.filter(task => task.scopeId === id && task.scopeGeneration === scope.generation)) {
      if (task.status === 'queued' || task.status === 'blocked') { task.status = 'cancelled'; task.blocker = 'Scope closed before execution'; }
    }
    this.persist();
    // Active turns drain; their output is quarantined, never routed into a successor scope.
  }

  setCapacity(maxActive: number): void {
    this.assertWritable();
    if (!Number.isInteger(maxActive) || maxActive < 0 || maxActive > this.authorizedMaxActive) throw new Error('Outside authorized capacity');
    this.capacity = maxActive;
    this.persist();
    this.schedule();
  }

  async postMessage(input: { text: string; conversationId: string; threadId: string }): Promise<WorkspaceMessage> {
    this.assertWritable();
    if (!input.text.trim() || input.text.length > 8000) throw new Error('Message must contain 1–8000 characters');
    return this.workspace.publish('human', { ...input, kind: 'message' });
  }

  /** Only verified adapter records are admitted; message text never grants authority. */
  accept(message: WorkspaceMessage): void {
    if (this.disposed || this.storageFault || !this.workspace.verify(message)) return;
    if (!this.workspace.members(message.conversationId).includes(message.authorId)) return;
    const scope = this.scopes.find(scope => scope.status === 'active' && scope.conversationIds.includes(message.conversationId) && message.sequence > scope.startSequence);
    if (!scope || message.kind !== 'message') { this.persist(); return; }
    if (message.origin?.scopeId !== undefined && (message.origin.scopeId !== scope.id || message.origin.scopeGeneration !== scope.generation)) { this.persist(); return; }
    for (const id of scope.entityIds) {
      if (id === message.authorId || !new RegExp(`(^|[^a-zA-Z0-9_-])@${id}(?![a-zA-Z0-9_-])`).test(message.text)) continue;
      const key = `${scope.id}:${scope.generation}:${id}:${message.id}`;
      if (this.seen.has(key)) continue;
      const chainId = message.origin?.chainId ?? message.id;
      const depth = message.origin?.depth ?? 0;
      if (depth >= (this.options.maxChainTurns ?? 6) || this.tasks.filter(task => task.chainId === chainId).length >= (this.options.maxChainTurns ?? 6)) { this.notice('Conversation turn limit reached; a human must start a fresh request.'); continue; }
      if (this.tasks.length >= (this.options.maxTasks ?? 1000)) { this.notice('Task retention limit reached; intake is paused rather than evicting deduplication evidence.'); continue; }
      this.seen.add(key);
      const at = new Date().toISOString();
      this.tasks.push({ id: `task-${randomUUID()}`, entityId: id, scopeId: scope.id, scopeGeneration: scope.generation, sourceMessageId: message.id, conversationId: message.conversationId, threadId: message.threadId, chainId, depth, status: 'queued', createdAt: at, updatedAt: at, progress: [] });
    }
    this.persist();
    this.schedule();
  }

  async cancelTask(id: string): Promise<string> {
    this.assertWritable();
    const task = this.tasks.find(task => task.id === id);
    if (!task) throw new Error('Unknown task');
    if (terminal.has(task.status)) return task.status;
    if (task.status === 'queued' || task.status === 'blocked') { task.status = 'cancelled'; this.persist(); return 'cancelled'; }
    const active = this.active.get(id);
    if (!active?.session) { task.status = 'cancel_requested'; task.blocker = 'Runtime start in progress; cancellation is not confirmed'; this.persist(); return 'requested'; }
    const runtime = active.runtime;
    task.status = 'cancel_requested'; this.persist();
    try {
      const outcome = await runtime.cancel(active.session);
      if (outcome === 'confirmed') active.controller.abort();
      task.blocker = outcome === 'confirmed' ? 'Cancellation confirmed; awaiting terminal result' : `Cancellation ${outcome}; operation may still produce effects`;
      this.persist(); return outcome;
    } catch { task.blocker = 'Cancellation outcome uncertain'; this.persist(); return 'uncertain'; }
  }

  async idle(timeoutMs = 5000): Promise<void> {
    const until = Date.now() + timeoutMs;
    while (this.active.size || this.scheduled || (!this.storageFault && this.tasks.some(task => task.status === 'queued'))) {
      if (Date.now() > until) throw new Error('Timed out waiting for idle');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
  dispose(): void { this.disposed = true; this.unsubscribe(); }

  private schedule(): void {
    if (this.scheduled || this.disposed || this.storageFault) return;
    this.scheduled = true;
    queueMicrotask(() => { this.scheduled = false; try { this.pump(); } catch { /* persist has already paused intake */ } });
  }
  private pump(): void {
    if (this.disposed || this.storageFault) return;
    for (const task of this.tasks) {
      if (task.status !== 'queued' && task.status !== 'blocked') continue;
      const entity = this.entities.get(task.entityId)!;
      const config = entity.desired;
      const scope = this.scopes.find(scope => scope.id === task.scopeId && scope.generation === task.scopeGeneration)!;
      let blocker: string | undefined;
      if (!this.routeAllowed(task, scope)) blocker = 'Scope access changed; explicit remapping is required';
      else if (!this.workspace.ready) blocker = 'Workspace bridge unavailable';
      else if (config.requiredResources.some(resource => !this.resources.has(resource))) blocker = 'Required supporting resource unavailable';
      else if (this.sessions.has(`${task.entityId}:${task.scopeId}:${task.scopeGeneration}`) && entity.observed.appliedRevision !== null && entity.observed.appliedRevision !== config.revision && this.runtimes.get(config.runtimeId)!.capabilities.instructionUpdates === 'unsupported') blocker = 'Runtime cannot apply configuration updates; end this scope before changing sessions';
      else if (this.active.size >= this.capacity) blocker = 'Active-worker capacity limit';
      else if (this.usedUnits() + config.resourceUnits > this.maxUnits) blocker = 'Aggregate resource budget exceeded';
      else if ([...this.active.values()].some(item => item.task.entityId === task.entityId)) blocker = 'Entity already has an active turn; input queued';
      if (blocker) { task.status = 'blocked'; task.blocker = blocker; if (entity.observed.state !== 'busy') entity.observed = { ...entity.observed, state: 'blocked', blocker }; continue; }
      task.status = 'running'; delete task.blocker;
      entity.observed.state = 'busy'; delete entity.observed.blocker;
      this.active.set(task.id, { task, runtime: this.runtimes.get(config.runtimeId)!, controller: new AbortController(), units: config.resourceUnits });
      try { this.persist(); } catch {
        this.active.delete(task.id); task.status = 'failed'; task.blocker = 'Work record failed before execution; runtime not started';
        entity.observed = { ...entity.observed, state: 'blocked', blocker: task.blocker }; return;
      }
      void this.run(task, copy(config));
    }
    this.persist();
  }
  private async run(task: TaskRecord, config: EntityConfig): Promise<void> {
    const active = this.active.get(task.id)!;
    const scope = this.scopes.find(scope => scope.id === task.scopeId && scope.generation === task.scopeGeneration)!;
    const runtime = this.runtimes.get(config.runtimeId)!;
    const entity = this.entities.get(task.entityId)!;
    try {
      const key = `${task.entityId}:${scope.id}:${scope.generation}`;
      let session = this.sessions.get(key);
      if (!session) { session = await runtime.open(config, copy(scope)); this.sessions.set(key, session); }
      active.session = session;
      if (!this.routeAllowed(task, scope) || this.disposed) throw new Error('Scope changed while runtime was opening');
      if (task.status === 'cancel_requested') {
        const outcome = await runtime.cancel(session);
        if (outcome === 'confirmed') { active.controller.abort(); task.status = 'cancelled'; task.blocker = 'Cancelled before runtime turn began'; return; }
        task.blocker = `Cancellation ${outcome}; operation may still produce effects`;
      }
      const configured = await runtime.configure(session, config);
      if (configured.appliedRevision !== config.revision || !this.routeAllowed(task, scope) || this.disposed) throw new Error('Configuration not confirmed for the active scope');
      entity.observed = { appliedRevision: configured.appliedRevision, sessionId: session.id, state: 'busy' };
      this.persist();
      const event = this.workspace.messages().find(message => message.id === task.sourceMessageId);
      if (!event) throw new Error('Source message unavailable');
      const history = await this.history(task);
      if (!this.routeAllowed(task, scope) || this.disposed || this.storageFault) throw new Error('Scope changed before runtime turn');
      const result = await runtime.run(session, { entity: config, scope: copy(scope), event, history, signal: active.controller.signal }, async output => {
        if (this.disposed || scope.status !== 'active') { task.blocker = 'Late output withheld from closed scope'; return; }
        if (active.controller.signal.aborted) return;
        if (output.kind === 'progress') { task.progress.push(output.text.slice(0, 4000)); task.progress = task.progress.slice(-20); this.persist(); }
        await this.publish(task, scope, output.kind === 'progress' ? 'status' : 'message', output.text);
      });
      if (scope.status !== 'active' || this.disposed) { task.status = 'uncertain'; task.blocker = 'Scope closed before final publication; no successor-scope delivery'; }
      else if (result.outcome === 'cancelled' || active.controller.signal.aborted) {
        const message = await this.publish(task, scope, 'status', 'Task cancelled; earlier effects are not rolled back.');
        task.completionMessageId = message.id; task.status = 'cancelled';
      } else {
        const message = await this.publish(task, scope, 'message', result.text);
        task.completionMessageId = message.id; task.status = 'completed'; delete task.blocker;
      }
    } catch {
      // A failed publish may already have reached the workspace. Never retry blindly.
      task.status = active.controller.signal.aborted ? 'cancelled' : 'uncertain';
      task.blocker = active.controller.signal.aborted ? 'Runtime cancellation confirmed' : 'Runtime or publication failed; outcome uncertain, no automatic retry';
    } finally {
      task.updatedAt = new Date().toISOString();
      this.active.delete(task.id);
      entity.observed = { appliedRevision: entity.observed.appliedRevision, sessionId: entity.observed.sessionId, state: task.status === 'uncertain' ? 'blocked' : 'ready', ...(task.status === 'uncertain' ? { blocker: task.blocker } : {}) };
      try { this.persist(); } catch { task.status = 'uncertain'; task.blocker = 'Terminal work-record persistence failed'; entity.observed = { ...entity.observed, state: 'blocked', blocker: task.blocker }; }
      this.schedule();
    }
  }
  private async publish(task: TaskRecord, scope: WorkScope, kind: 'message' | 'status', text: string): Promise<WorkspaceMessage> {
    if (!this.routeAllowed(task, scope) || this.disposed || this.storageFault) throw new Error('Scope changed or storage unavailable before publication');
    const input: PublishInput = { conversationId: task.conversationId, threadId: task.threadId, kind, text, origin: { chainId: task.chainId, depth: task.depth + 1, scopeId: scope.id, scopeGeneration: scope.generation } };
    const message = await this.workspace.publish(task.entityId, input);
    if (!this.workspace.verify(message) || message.workspaceId !== this.workspace.id || message.authorId !== task.entityId || message.conversationId !== input.conversationId || message.threadId !== input.threadId || message.text !== input.text || message.kind !== input.kind || message.origin?.chainId !== input.origin!.chainId || message.origin?.depth !== input.origin!.depth || message.origin?.scopeId !== scope.id || message.origin?.scopeGeneration !== scope.generation) throw new Error('Publication evidence does not match the requested reply');
    // An already in-flight external publication cannot be retracted. Its scope provenance
    // prevents it from activating a successor; never claim it as a timely completion.
    if (!this.routeAllowed(task, scope) || this.disposed || this.storageFault) throw new Error('Scope changed or storage unavailable during publication');
    return message;
  }
  private async history(task: TaskRecord): Promise<ConversationHistory> {
    const messages = new Map<string, WorkspaceMessage>(); const gaps: string[] = []; let cursor: string | undefined;
    const pages = this.options.historyPages ?? 3;
    const boundary = this.scopes.find(scope => scope.id === task.scopeId && scope.generation === task.scopeGeneration)!.startSequence;
    for (let page = 0; page < pages; page++) {
      try {
        const result = await this.workspace.history(task.conversationId, task.threadId, cursor, this.options.historyPageSize ?? 20);
        for (const message of result.messages.slice(0, this.options.historyPageSize ?? 20)) {
          if (message.origin?.scopeId !== undefined && (message.origin.scopeId !== task.scopeId || message.origin.scopeGeneration !== task.scopeGeneration)) { gaps.push('Earlier-scope output excluded'); continue; }
          if (message.conversationId === task.conversationId && message.threadId === task.threadId && message.sequence > boundary && this.workspace.verify(message)) messages.set(message.id, message);
          else if (message.conversationId !== task.conversationId || message.threadId !== task.threadId || !this.workspace.verify(message)) gaps.push('Invalid history entry excluded');
        }
        if (result.gap) gaps.push(result.gap);
        cursor = result.nextCursor;
        if (!cursor) break;
      } catch { gaps.push('History page unavailable'); break; }
    }
    if (cursor) gaps.push('History page limit reached');
    return { messages: [...messages.values()].sort((a, b) => a.sequence - b.sequence), complete: gaps.length === 0, gaps };
  }
  private usedUnits(): number { return [...this.active.values()].reduce((sum, item) => sum + item.units, 0); }
  private routeAllowed(task: TaskRecord, scope: WorkScope): boolean {
    if (scope.status !== 'active' || !scope.audience || !scope.entityIds.includes(task.entityId)) return false;
    const entity = this.entities.get(task.entityId);
    return Boolean(entity && scope.conversationIds.every(conversation => entity.desired.conversationIds.includes(conversation) && this.workspace.members(conversation).includes(task.entityId) && JSON.stringify([...this.workspace.members(conversation)].sort()) === JSON.stringify(scope.audience)));
  }
  private notice(text: string): void { if (!this.notices.includes(text)) this.notices.push(text); }
  private assertWritable(): void { if (this.disposed || this.storageFault) throw new Error('Pod is closed or storage is unavailable'); }
  private persist(): void {
    if (this.storageFault) return;
    try { this.options.store?.save(this.snapshot()); }
    catch {
      this.storageFault = true; this.notice('Work-record storage failed; further intake is paused.');
      for (const task of this.tasks) if (task.status === 'queued' || task.status === 'blocked') { task.status = 'blocked'; task.blocker = 'Work-record storage unavailable'; }
      throw new Error('Work-record storage failed');
    }
    this.emit('change');
  }
}
