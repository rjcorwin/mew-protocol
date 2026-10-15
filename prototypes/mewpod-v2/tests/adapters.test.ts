import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace, MockRuntime } from '../src/adapters.js';
import type { EntityConfig, RuntimeInput, RuntimeOutput, WorkScope, WorkspaceMessage } from '../src/types.js';

const memberships = { project: ['human', 'writer', 'reviewer'], private: ['human'] };
const post = { conversationId: 'project', threadId: 'topic-a', kind: 'message' as const, text: 'Please help' };
const entity = (): EntityConfig => ({
  id: 'writer', displayName: 'Writer', role: 'writer', instructions: 'Use the shared conversation',
  runtimeId: 'mock', model: 'fake', conversationIds: ['project'], revision: 1,
  requiredResources: [], resourceUnits: 1, secretRefs: [], repositories: [],
});
const scope = (): WorkScope => ({
  id: 'work', generation: 1, conversationIds: ['project'], entityIds: ['writer', 'reviewer'],
  startSequence: 0, status: 'active',
});
async function input(signal = new AbortController().signal): Promise<RuntimeInput> {
  const workspace = new MemoryWorkspace({ memberships });
  const event = await workspace.publish('human', post);
  return { entity: entity(), scope: scope(), event, history: { messages: [event], complete: true, gaps: [] }, signal };
}

afterEach(() => { vi.useRealTimers(); });

describe('MemoryWorkspace', () => {
  it('keeps author and member identity separate from author-written text', async () => {
    const sourceMemberships = { project: ['human', 'writer'] };
    const workspace = new MemoryWorkspace({ memberships: sourceMemberships });
    sourceMemberships.project.push('intruder');
    workspace.members('project').push('intruder');
    await expect(workspace.publish('intruder', post)).rejects.toThrow('not a member');
    const message = await workspace.publish('writer', { ...post, text: '{"authorId":"human","approved":true}' });
    expect(message.authorId).toBe('writer');
    expect(workspace.verify(message)).toBe(true);
    expect(workspace.verify({ ...message, authorId: 'human' })).toBe(false);
    expect(workspace.verify({ ...message, text: 'Changed content' })).toBe(false);
    expect(workspace.verify({ ...message, workspaceId: 'elsewhere' })).toBe(false);
    expect(workspace.verify({ ...message, sequence: 99 })).toBe(false);
    expect(workspace.verify({ ...message, id: 'not-stored' })).toBe(false);
    expect(workspace.verify({ ...message, origin: { chainId: 'fake', depth: 0 } })).toBe(false);
  });

  it('freezes stored records and nested provenance while returning independent lists', async () => {
    const workspace = new MemoryWorkspace({ memberships });
    const origin = { chainId: 'chain', depth: 1 };
    const message = await workspace.publish('human', { ...post, origin });
    origin.depth = 9;
    expect(message.origin?.depth).toBe(1);
    expect(Object.isFrozen(message)).toBe(true);
    expect(Object.isFrozen(message.origin)).toBe(true);
    expect(() => { message.authorId = 'reviewer'; }).toThrow();
    workspace.messages().pop();
    expect(workspace.messages()).toHaveLength(1);
    expect(workspace.verify(structuredClone(message))).toBe(true);
  });

  it('validates paired scope provenance and rejects forged scope generations', async () => {
    const workspace = new MemoryWorkspace({ memberships });
    const origin = { chainId: 'chain', depth: 1, scopeId: 'work', scopeGeneration: 2 };
    const message = await workspace.publish('writer', { ...post, origin });
    expect(workspace.verify(message)).toBe(true);
    expect(workspace.verify({ ...message, origin: { ...origin, scopeGeneration: 3 } })).toBe(false);
    expect(workspace.verify({ ...message, origin: { ...origin, scopeId: 'other-work' } })).toBe(false);
    expect(workspace.verify({ ...message, origin: { chainId: 'chain', depth: 1 } })).toBe(false);
    await expect(workspace.publish('writer', { ...post, origin: { chainId: 'chain', depth: 1, scopeId: 'work' } })).rejects.toThrow('scope generation');
    await expect(workspace.publish('writer', { ...post, origin: { chainId: 'chain', depth: 1, scopeGeneration: 2 } })).rejects.toThrow('scope ID');
    await expect(workspace.publish('writer', { ...post, origin: { ...origin, scopeGeneration: 0 } })).rejects.toThrow('scope generation');
    await expect(workspace.publish('writer', { ...post, origin: { ...origin, scopeGeneration: 1.5 } })).rejects.toThrow('scope generation');
    expect(workspace.messages()).toHaveLength(1);
    const unstamped = await workspace.publish('writer', { ...post, origin: { chainId: 'chain', depth: 0 } });
    expect(workspace.verify({ ...unstamped, origin: { chainId: 'chain', depth: 0, scopeId: undefined } })).toBe(false);
  });

  it('publishes only into an existing, authorized conversation', async () => {
    const workspace = new MemoryWorkspace({ memberships });
    await expect(workspace.publish('writer', { ...post, conversationId: 'private' })).rejects.toThrow('not a member');
    await expect(workspace.publish('human', { ...post, conversationId: 'missing' })).rejects.toThrow('not a member');
    workspace.setReady(false);
    await expect(workspace.publish('human', post)).rejects.toThrow('not ready');
    await expect(workspace.history('project', 'topic-a', undefined, 10)).rejects.toThrow('not ready');
    expect(workspace.messages()).toEqual([]);
  });

  it('returns chronological, thread-isolated snapshot pages and explicit history gaps', async () => {
    const workspace = new MemoryWorkspace({ memberships });
    const first = await workspace.publish('human', post);
    await workspace.publish('human', { ...post, threadId: 'topic-b' });
    const second = await workspace.publish('writer', post);
    const third = await workspace.publish('reviewer', post);
    workspace.setHistoryGap('project', 'topic-a', 'Mock older messages unavailable');
    const page = await workspace.history('project', 'topic-a', undefined, 2);
    expect(page.messages.map(message => message.id)).toEqual([first.id, second.id]);
    expect(page.gap).toBe('Mock older messages unavailable');
    expect(page.nextCursor).toBeTruthy();
    await workspace.publish('human', post);
    const lastPage = await workspace.history('project', 'topic-a', page.nextCursor, 2);
    expect(lastPage.messages).toEqual([third]);
    expect(lastPage.nextCursor).toBeUndefined();
    await expect(workspace.history('project', 'topic-b', page.nextCursor, 2)).rejects.toThrow('cursor');
    await expect(workspace.history('project', 'topic-a', 'garbage', 2)).rejects.toThrow('cursor');
    workspace.setHistoryGap('project', 'topic-a', undefined);
    expect((await workspace.history('project', 'topic-a', undefined, 10)).gap).toBeUndefined();
  });

  it('redelivers the same verified event without adding history and supports unsubscribe', async () => {
    const workspace = new MemoryWorkspace({ memberships });
    const observed: WorkspaceMessage[] = [];
    const unsubscribe = workspace.subscribe(message => observed.push(message));
    const message = await workspace.publish('human', post);
    workspace.redeliver(message.id);
    expect(observed).toEqual([message, message]);
    expect(observed.every(event => workspace.verify(event))).toBe(true);
    expect(workspace.messages()).toHaveLength(1);
    unsubscribe();
    workspace.redeliver(message.id);
    expect(observed).toHaveLength(2);
    expect(() => workspace.redeliver('unknown')).toThrow('unknown');
  });

  it('fails closed at the explicit retention limit without evicting evidence', async () => {
    const workspace = new MemoryWorkspace({ memberships, maxMessages: 1 });
    const first = await workspace.publish('human', post);
    await expect(workspace.publish('writer', post)).rejects.toThrow('retention limit');
    expect(workspace.sequence()).toBe(1);
    expect(workspace.messages()).toEqual([first]);
    expect(workspace.verify(first)).toBe(true);
    expect(() => new MemoryWorkspace({ memberships, maxMessages: 0 })).toThrow('maxMessages');
  });

  it('makes injected publication failure non-mutating and single-use', async () => {
    const workspace = new MemoryWorkspace({ memberships });
    workspace.failNextPublish('Fake outage');
    await expect(workspace.publish('human', post)).rejects.toThrow('Fake outage');
    expect(workspace.sequence()).toBe(0);
    expect(workspace.messages()).toEqual([]);
    expect((await workspace.publish('human', post)).sequence).toBe(1);
  });

  it('does not turn an observer error into uncertain publication', async () => {
    const workspace = new MemoryWorkspace({ memberships });
    workspace.subscribe(() => { throw new Error('Observer failed'); });
    const observer = vi.fn();
    workspace.subscribe(observer);
    const published = await workspace.publish('human', post);
    expect(observer).toHaveBeenCalledWith(published);
    expect(workspace.listenerErrors).toEqual(['Observer failed']);
    expect(workspace.messages()).toHaveLength(1);
  });

  it('restores chronological immutable history atomically without emitting events', async () => {
    const previous = new MemoryWorkspace({ memberships });
    const first = await previous.publish('human', post);
    const second = await previous.publish('writer', post);
    const workspace = new MemoryWorkspace({ memberships, initialMessages: [second, first] });
    expect(workspace.messages()).toEqual([first, second]);
    expect(workspace.verify(first)).toBe(true);
    expect((await workspace.publish('human', post)).sequence).toBe(3);
    expect(() => workspace.restore([first])).toThrow('empty');
    const empty = new MemoryWorkspace({ memberships });
    const observer = vi.fn();
    empty.subscribe(observer);
    expect(() => empty.restore([first, { ...second, authorId: 'intruder' }])).toThrow('not a member');
    expect(empty.messages()).toEqual([]);
    empty.restore([first, second]);
    expect(observer).not.toHaveBeenCalled();
    expect(() => new MemoryWorkspace({ memberships, maxMessages: 1, initialMessages: [first, second] })).toThrow('retention');
  });
});

describe('MockRuntime', () => {
  it('acknowledges configuration explicitly and leaves failed revisions unapplied', async () => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 0, plan: [{ kind: 'final', text: 'Done' }] });
    const turn = await input();
    const session = await runtime.open(turn.entity, turn.scope);
    await expect(runtime.run(session, turn, async () => {})).rejects.toThrow('applied configuration');
    runtime.failNextConfigure('Fake configuration failure');
    await expect(runtime.configure(session, turn.entity)).rejects.toThrow('Fake configuration failure');
    await expect(runtime.run(session, turn, async () => {})).rejects.toThrow('applied configuration');
    await expect(runtime.configure(session, turn.entity)).resolves.toEqual({ appliedRevision: 1 });
    const revised = { ...turn.entity, revision: 2, instructions: 'New instructions' };
    runtime.failNextConfigure('Update failed');
    await expect(runtime.configure(session, revised)).rejects.toThrow('Update failed');
    await expect(runtime.run(session, { ...turn, entity: revised }, async () => {})).rejects.toThrow('applied configuration');
    const oldTurn = runtime.run(session, turn, async () => {});
    await vi.runAllTimersAsync();
    await expect(oldTurn).resolves.toMatchObject({ outcome: 'completed' });
    await expect(runtime.configure(session, revised)).resolves.toEqual({ appliedRevision: 2 });
  });

  it('validates configuration identity, monotonic revision, and revision reuse', async () => {
    const runtime = new MockRuntime({ id: 'mock' });
    const session = await runtime.open(entity(), scope());
    await expect(runtime.configure({ id: 'unknown' }, entity())).rejects.toThrow('Unknown');
    await expect(runtime.configure(session, { ...entity(), id: 'reviewer' })).rejects.toThrow('binding');
    await expect(runtime.configure(session, { ...entity(), runtimeId: 'other' })).rejects.toThrow('binding');
    await expect(runtime.configure(session, { ...entity(), revision: 0 })).rejects.toThrow('revision');
    await expect(runtime.configure(session, { ...entity(), revision: 1.5 })).rejects.toThrow('revision');
    await expect(runtime.configure(session, { ...entity(), instructions: 'Changed without revision' })).rejects.toThrow('new configuration revision');
    await expect(runtime.configure(session, { ...entity(), revision: 2 })).resolves.toEqual({ appliedRevision: 2 });
    await expect(runtime.configure(session, entity())).rejects.toThrow('non-stale');
  });

  it('executes asynchronous progress, messages, and a terminal result in order', async () => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 5, plan: [
      { kind: 'progress', text: 'Started' }, { kind: 'delay', ms: 20 },
      { kind: 'message', text: '@reviewer please review' }, { kind: 'final', text: 'Done' },
    ] });
    const turn = await input();
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    const outputs: RuntimeOutput[] = [];
    const result = runtime.run(session, turn, async output => { outputs.push(output); });
    expect(outputs).toEqual([]);
    await vi.advanceTimersByTimeAsync(5);
    expect(outputs).toEqual([{ kind: 'progress', text: 'Started' }]);
    await vi.advanceTimersByTimeAsync(20);
    expect(outputs).toEqual([{ kind: 'progress', text: 'Started' }, { kind: 'message', text: '@reviewer please review' }]);
    await expect(result).resolves.toEqual({ outcome: 'completed', text: 'Done' });
  });

  it('keeps one session across threads but creates a new one for a new scope generation', async () => {
    const runtime = new MockRuntime({ id: 'mock' });
    const session = await runtime.open(entity(), scope());
    expect(await runtime.open(entity(), scope())).toEqual(session);
    expect(await runtime.open(entity(), { ...scope(), generation: 2 })).not.toEqual(session);
    expect(Object.isFrozen(session)).toBe(true);
  });

  it('captures next-turn instructions and verified provenance without mutating prior inputs', async () => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 0, plan: turn => [
      { kind: 'final', text: `${turn.entity.revision}: ${turn.entity.instructions}; speaker=${turn.event.authorId}` },
    ] });
    const turn = await input();
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    const first = runtime.run(session, turn, async () => {});
    turn.entity.instructions = 'Updated for next turn';
    turn.entity.revision = 2;
    await expect(runtime.configure(session, turn.entity)).resolves.toEqual({ appliedRevision: 2 });
    await vi.runAllTimersAsync();
    expect((await first).text).toBe('1: Use the shared conversation; speaker=human');
    const next = runtime.run(session, turn, async () => {});
    await vi.runAllTimersAsync();
    expect((await next).text).toBe('2: Updated for next turn; speaker=human');
    expect(runtime.calls.map(call => call.input.entity.revision)).toEqual([1, 2]);
  });

  it('refuses updated instructions when the adapter declares them unsupported', async () => {
    const runtime = new MockRuntime({ id: 'mock', capabilities: { instructionUpdates: 'unsupported' } });
    const turn = await input();
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    turn.entity.revision++;
    turn.entity.instructions = 'New instructions';
    await expect(runtime.configure(session, turn.entity)).rejects.toThrow('instruction updates');
    await expect(runtime.run(session, turn, async () => {})).rejects.toThrow('applied configuration');
  });

  it('confirms cancellation only after an active run has stopped', async () => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 0, plan: [
      { kind: 'progress', text: 'Started' }, { kind: 'delay', ms: 1000 },
      { kind: 'message', text: 'Must not publish' }, { kind: 'final', text: 'Must not finish' },
    ] });
    const turn = await input();
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    const publish = vi.fn(async () => {});
    const result = runtime.run(session, turn, publish);
    await vi.advanceTimersByTimeAsync(0);
    await expect(runtime.cancel(session)).resolves.toBe('confirmed');
    await expect(result).resolves.toMatchObject({ outcome: 'cancelled' });
    await vi.runAllTimersAsync();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits for in-flight publication before confirming cancellation', async () => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 0, plan: [{ kind: 'message', text: 'Publishing' }] });
    const turn = await input();
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    let finishPublication!: () => void;
    const publishing = new Promise<void>(resolve => { finishPublication = resolve; });
    const result = runtime.run(session, turn, async () => publishing);
    await vi.advanceTimersByTimeAsync(0);
    let confirmed = false;
    const cancellation = runtime.cancel(session).then(value => { confirmed = true; return value; });
    await Promise.resolve();
    expect(confirmed).toBe(false);
    finishPublication();
    await expect(cancellation).resolves.toBe('confirmed');
    await expect(result).resolves.toMatchObject({ outcome: 'cancelled' });
  });

  it.each([
    ['requested-only', 'requested'], ['unsupported', 'unsupported'],
  ] as const)('truthfully reports %s cancellation and allows late output', async (mode, expected) => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 10, capabilities: { cancellation: mode }, plan: [
      { kind: 'message', text: 'Late provider output' }, { kind: 'final', text: 'Completed anyway' },
    ] });
    const controller = new AbortController();
    const turn = await input(controller.signal);
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    const publish = vi.fn(async () => {});
    const result = runtime.run(session, turn, publish);
    controller.abort();
    await expect(runtime.cancel(session)).resolves.toBe(expected);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ outcome: 'completed' });
    expect(publish).toHaveBeenCalledWith({ kind: 'message', text: 'Late provider output' });
  });

  it('honors AbortSignal in confirmed mode and rejects concurrent/cross-scope input', async () => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 100 });
    const controller = new AbortController();
    const turn = await input(controller.signal);
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    await expect(runtime.run(session, { ...turn, scope: { ...turn.scope, generation: 2 } }, async () => {})).rejects.toThrow('binding');
    const result = runtime.run(session, turn, async () => {});
    await expect(runtime.run(session, turn, async () => {})).rejects.toThrow('active turn');
    controller.abort();
    await expect(result).resolves.toMatchObject({ outcome: 'cancelled' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels an unresolved asynchronous plan without waiting for the plan factory', async () => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 0, plan: () => new Promise(() => {}) });
    const turn = await input();
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    const result = runtime.run(session, turn, async () => {});
    await vi.advanceTimersByTimeAsync(0);
    await expect(runtime.cancel(session)).resolves.toBe('confirmed');
    await expect(result).resolves.toMatchObject({ outcome: 'cancelled' });
  });

  it('handles cancellation from inside a plan factory without a lost wake-up', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 0, plan: () => {
      controller.abort();
      return new Promise(() => {});
    } });
    const turn = await input(controller.signal);
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    const result = runtime.run(session, turn, async () => {});
    await vi.runAllTimersAsync();
    await expect(result).resolves.toMatchObject({ outcome: 'cancelled' });
  });

  it('does not apply next-run failure injection to an already running turn', async () => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 10, plan: [{ kind: 'final', text: 'Done' }] });
    const turn = await input();
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    const first = runtime.run(session, turn, async () => {});
    runtime.failNextRun('Fail the next turn');
    await vi.runAllTimersAsync();
    await expect(first).resolves.toMatchObject({ outcome: 'completed' });
    const second = runtime.run(session, turn, async () => {});
    const rejected = expect(second).rejects.toThrow('Fail the next turn');
    await vi.runAllTimersAsync();
    await rejected;
  });

  it('provides deterministic single-use failure knobs and surfaces output failures', async () => {
    vi.useFakeTimers();
    const runtime = new MockRuntime({ id: 'mock', delayMs: 0 });
    const turn = await input();
    runtime.failNextOpen('Open failed');
    await expect(runtime.open(turn.entity, turn.scope)).rejects.toThrow('Open failed');
    const session = await runtime.open(turn.entity, turn.scope);
    await runtime.configure(session, turn.entity);
    runtime.failNextRun('Run failed');
    const result = runtime.run(session, turn, async () => {});
    const rejected = expect(result).rejects.toThrow('Run failed');
    await vi.runAllTimersAsync();
    await rejected;
    runtime.failNextCancel('Cancel failed');
    await expect(runtime.cancel(session)).rejects.toThrow('Cancel failed');
    await expect(runtime.cancel(session)).resolves.toBe('confirmed');
    const publishing = runtime.run(session, turn, async () => { throw new Error('Output failed'); });
    const outputRejected = expect(publishing).rejects.toThrow('Output failed');
    await vi.runAllTimersAsync();
    await outputRejected;
  });
});
