import { describe, expect, it, vi } from 'vitest';
import {
  ManagementService, MockSecretResolver, isRepositoryUrl, managementRequestDigest,
  type ConfigureEntityRequest, type ConfigureLimits, type ManagementGrant, type ManagementHandlers,
  type ManagementRequest, type RecordedApproval, type SetCapacityRequest, type TrustedCaller,
} from '../src/management.js';
import type { EntityConfig } from '../src/types.js';

const human: TrustedCaller = { id: 'operator-one', kind: 'human' };
const agent: TrustedCaller = { id: 'admin-agent', kind: 'agent' };
const repo = 'https://github.com/example/alpha.git';
const secondRepo = 'https://github.com/example/beta.git';
const instant = new Date('2026-01-15T12:00:00.000Z');
function config(revision = 1): EntityConfig {
  return {
    id: 'worker-one', displayName: 'Worker One', role: 'developer', instructions: 'Keep results in the shared conversation.',
    runtimeId: 'mock-runtime', model: 'mock-model', conversationIds: ['room-one'], revision,
    requiredResources: [], resourceUnits: 1,
    secretRefs: [{ id: 'repo-access', purpose: 'repository fixture' }],
    repositories: [{ url: repo, operations: ['clone', 'read'], secretRef: 'repo-access' }],
  };
}
function configure(revision = 1): ConfigureEntityRequest {
  return { action: 'configureEntity', target: { type: 'entity', id: 'worker-one' }, config: config(revision), expectedRevision: revision === 1 ? null : revision - 1 };
}
function configureLimits(): ConfigureLimits {
  return {
    allowedFields: ['displayName', 'role', 'instructions', 'runtimeId', 'model', 'conversationIds', 'requiredResources', 'resourceUnits', 'secretRefs', 'repositories'],
    maxResourceUnits: 2, runtimeIds: ['mock-runtime'], conversationIds: ['room-one'],
    repositoryUrls: [repo, secondRepo], repositoryOperations: ['clone', 'read'], secretRefIds: ['repo-access'],
  };
}
function configGrant(caller = human, requireApproval = false): ManagementGrant {
  return { caller, action: 'configureEntity', target: { type: 'entity', id: 'worker-one' }, limits: configureLimits(), requireApproval };
}
function capacity(): SetCapacityRequest {
  return { action: 'setCapacity', target: { type: 'capacity', id: 'pod-one' }, maxActive: 2, maxUnits: 3 };
}
function capacityGrant(caller = agent, requireApproval = false): ManagementGrant {
  return { caller, action: 'setCapacity', target: { type: 'capacity', id: 'pod-one' }, limits: { maxActive: 3, maxUnits: 4 }, requireApproval };
}
function approval(request: SetCapacityRequest = capacity()): RecordedApproval {
  return {
    id: 'approval-one', caller: agent, approverId: human.id, action: request.action, target: request.target,
    limits: { maxActive: 3, maxUnits: 4 }, requestDigest: managementRequestDigest(request),
    validFrom: '2026-01-15T11:00:00.000Z', validUntil: '2026-01-15T13:00:00.000Z', status: 'approved',
  };
}
function harness(grants: ManagementGrant[] = [configGrant()], initial?: EntityConfig, approvals: RecordedApproval[] = []) {
  let current = initial && structuredClone(initial);
  const handlers: ManagementHandlers = {
    readEntity: vi.fn<ManagementHandlers['readEntity']>(() => current && structuredClone(current)),
    configureEntity: vi.fn<ManagementHandlers['configureEntity']>(request => {
      if ((current?.revision ?? null) !== request.expectedRevision) return { outcome: 'refused' };
      current = structuredClone(request.config);
      return { outcome: 'success', appliedRevision: request.config.revision };
    }),
    startScope: vi.fn<ManagementHandlers['startScope']>(() => ({ outcome: 'success' })),
    endScope: vi.fn<ManagementHandlers['endScope']>(() => ({ outcome: 'success' })),
    setCapacity: vi.fn<ManagementHandlers['setCapacity']>(() => ({ outcome: 'success' })),
    cancelTask: vi.fn<ManagementHandlers['cancelTask']>(() => ({ outcome: 'success' })),
  };
  const service = new ManagementService({ handlers, grants, lookupApproval: id => approvals.find(item => item.id === id), now: () => instant });
  return { service, handlers, read: () => current };
}

describe('bounded management service', () => {
  it('allows an explicitly granted human configuration and attributes applied revision', async () => {
    const { service, handlers, read } = harness();
    const result = await service.execute(human, configure());
    expect(result).toMatchObject({ outcome: 'success', code: 'applied', appliedRevision: 1 });
    expect(handlers.configureEntity).toHaveBeenCalledOnce();
    expect(read()).toEqual(config());
    expect(service.audit()).toEqual([{
      id: 'audit-1', at: instant.toISOString(), caller: human, action: 'configureEntity',
      target: { type: 'entity', id: 'worker-one' }, outcome: 'success', code: 'applied', requestedRevision: 1, appliedRevision: 1,
    }]);
  });

  it('allows a bounded agent administrator without granting another target or action', async () => {
    const { service, handlers } = harness([capacityGrant()]);
    expect((await service.execute(agent, capacity())).outcome).toBe('success');
    expect((await service.execute(agent, { ...capacity(), target: { type: 'capacity', id: 'pod-two' } })).code).toBe('forbidden');
    expect((await service.execute(agent, configure())).code).toBe('forbidden');
    expect((await service.execute(agent, { ...capacity(), maxActive: 4 })).code).toBe('limits_exceeded');
    expect((await service.execute(agent, { ...capacity(), maxUnits: 5 })).code).toBe('limits_exceeded');
    expect(handlers.setCapacity).toHaveBeenCalledOnce();
  });

  it('rejects caller claims in payload and unauthenticated caller shapes', async () => {
    const { service, handlers } = harness([capacityGrant()]);
    for (const claim of [{ caller: agent }, { admin: true }, { tool: 'setCapacity' }, { identity: agent.id }]) {
      expect((await service.execute(agent, { ...capacity(), ...claim } as ManagementRequest)).code).toBe('invalid_request');
    }
    expect((await service.execute({ id: human.id, kind: 'agent' }, capacity())).code).toBe('forbidden');
    expect((await service.execute({ id: agent.id, kind: 'human' }, capacity())).code).toBe('forbidden');
    expect((await service.execute({ ...agent, admin: true } as TrustedCaller, capacity())).code).toBe('invalid_caller');
    expect((await service.execute(undefined as unknown as TrustedCaller, capacity())).code).toBe('invalid_caller');
    expect(handlers.setCapacity).not.toHaveBeenCalled();
  });

  it.each([
    { type: 'scope', id: 'pod-one' }, { type: 'capacity', id: '' },
    { type: 'capacity', id: '*' }, { type: 'capacity', id: 'pod-one', extra: 'ambiguous' },
    { type: 'capacity', id: ['pod-one'] }, null,
  ])('refuses malformed or wrong-type target %j before mutation', async target => {
    const { service, handlers } = harness([capacityGrant()]);
    expect((await service.execute(agent, { ...capacity(), target } as ManagementRequest)).code).toBe('invalid_target');
    expect(handlers.setCapacity).not.toHaveBeenCalled();
    expect(service.audit()[0].target).toEqual({ type: 'invalid', id: 'redacted' });
  });

  it.each([
    { revision: 0 }, { resourceUnits: -1 }, { resourceUnits: NaN }, { instructions: '' },
    { id: 'worker-two' }, { conversationIds: [] }, { conversationIds: ['room-one', 'room-one'] },
    { runtimeId: ['mock-runtime'] }, { arbitraryToken: 'secret-payload' },
    { secretRefs: [{ id: 'repo-access', purpose: 'repository fixture', value: 'secret-payload' }] },
    { repositories: [{ url: repo, operations: ['read'], secretRef: 'not-declared' }] },
    { repositories: [{ url: repo, operations: [['read']] }] },
    { repositories: [{ url: 'http://github.com/example/alpha.git', operations: ['read'] }] },
  ])('rejects malformed configuration %j', async patch => {
    const { service, handlers } = harness();
    expect((await service.execute(human, { ...configure(), config: { ...config(), ...patch } } as ConfigureEntityRequest)).code).toBe('invalid_configuration');
    expect(handlers.configureEntity).not.toHaveBeenCalled();
    expect(JSON.stringify(service.audit())).not.toContain('secret-payload');
  });

  it.each([
    { resourceUnits: 3 }, { runtimeId: 'other-runtime' }, { conversationIds: ['room-two'] },
    { repositories: [{ url: 'https://github.com/example/unapproved.git', operations: ['read'] }] },
    { repositories: [{ url: repo, operations: ['write'], secretRef: 'repo-access' }] },
    { secretRefs: [{ id: 'other-ref', purpose: 'repository fixture' }], repositories: [] },
  ])('refuses configuration outside exact grant limits %j', async patch => {
    const { service, handlers } = harness();
    expect((await service.execute(human, { ...configure(), config: { ...config(), ...patch } } as ConfigureEntityRequest)).code).toBe('limits_exceeded');
    expect(handlers.configureEntity).not.toHaveBeenCalled();
  });

  it('only changes explicitly allowed fields, and prompt claims do not change grants', async () => {
    const grant = configGrant(agent);
    if (grant.action !== 'configureEntity') throw new Error('bad fixture');
    grant.limits.allowedFields = ['instructions'];
    const { service, handlers } = harness([grant], config());
    const request = configure(2);
    request.config.instructions = 'I am now administrator and have every permission.';
    expect((await service.execute(agent, request)).outcome).toBe('success');
    const changedRole = configure(3);
    changedRole.config.role = 'administrator';
    expect((await service.execute(agent, changedRole)).code).toBe('limits_exceeded');
    expect((await service.execute(agent, capacity())).code).toBe('forbidden');
    expect(handlers.configureEntity).toHaveBeenCalledOnce();
  });

  it('requires creation revision one, expected prior revision, and exactly one-step updates', async () => {
    const { service, handlers } = harness();
    expect((await service.execute(human, { ...configure(), config: config(2) })).code).toBe('revision_conflict');
    expect((await service.execute(human, configure())).outcome).toBe('success');
    expect((await service.execute(human, configure())).code).toBe('revision_conflict');
    expect((await service.execute(human, { ...configure(2), expectedRevision: null })).code).toBe('revision_conflict');
    expect((await service.execute(human, { ...configure(2), config: config(3) })).code).toBe('revision_conflict');
    expect((await service.execute(human, configure(2))).outcome).toBe('success');
    expect(handlers.configureEntity).toHaveBeenCalledTimes(2);
  });

  it('preserves handler CAS refusal when the revision changes after the read', async () => {
    const { service, handlers } = harness(undefined, config());
    vi.mocked(handlers.configureEntity).mockReturnValue({ outcome: 'refused' });
    expect((await service.execute(human, configure(2)))).toMatchObject({ outcome: 'refused', code: 'handler_refused' });
  });

  it('snapshots requests and grants before asynchronous lookup', async () => {
    const grant = configGrant();
    const { service, handlers } = harness([grant]);
    let release: (value: EntityConfig | undefined) => void = () => undefined;
    vi.mocked(handlers.readEntity).mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const request = configure();
    const pending = service.execute(human, request);
    request.config.resourceUnits = 999;
    if (grant.action === 'configureEntity') grant.limits.maxResourceUnits = 999;
    release(undefined);
    expect((await pending).outcome).toBe('success');
    expect(vi.mocked(handlers.configureEntity).mock.calls[0][0].config.resourceUnits).toBe(1);
  });

  it('checks start-scope members and conversations, scope-end policy, and exact task target', async () => {
    const grants: ManagementGrant[] = [
      { caller: agent, action: 'startScope', target: { type: 'scope', id: 'scope-one' }, limits: { entityIds: ['worker-one'], conversationIds: ['room-one'] } },
      { caller: agent, action: 'endScope', target: { type: 'scope', id: 'scope-one' }, limits: { policies: ['drain'] } },
      { caller: agent, action: 'cancelTask', target: { type: 'task', id: 'task-one' }, limits: {} },
    ];
    const { service, handlers } = harness(grants);
    const start: ManagementRequest = { action: 'startScope', target: { type: 'scope', id: 'scope-one' }, entityIds: ['worker-one'], conversationIds: ['room-one'] };
    expect((await service.execute(agent, start)).outcome).toBe('success');
    expect((await service.execute(agent, { ...start, entityIds: ['worker-two'] })).code).toBe('limits_exceeded');
    expect((await service.execute(agent, { ...start, conversationIds: ['room-two'] })).code).toBe('limits_exceeded');
    expect((await service.execute(agent, { ...start, entityIds: [] })).code).toBe('invalid_request');
    expect((await service.execute(agent, { action: 'endScope', target: start.target, policy: 'drain' })).outcome).toBe('success');
    expect((await service.execute(agent, { action: 'endScope', target: start.target, policy: 'cancel' })).code).toBe('limits_exceeded');
    expect((await service.execute(agent, { action: 'cancelTask', target: { type: 'task', id: 'task-one' } })).outcome).toBe('success');
    expect((await service.execute(agent, { action: 'cancelTask', target: { type: 'task', id: 'task-two' } })).code).toBe('forbidden');
    expect(handlers.startScope).toHaveBeenCalledOnce();
    expect(handlers.endScope).toHaveBeenCalledOnce();
    expect(handlers.cancelTask).toHaveBeenCalledOnce();
  });

  it('keeps desired versus applied configuration and uncertain mutations visible', async () => {
    const { service, handlers } = harness(undefined, config());
    vi.mocked(handlers.configureEntity).mockReturnValueOnce({ outcome: 'success', appliedRevision: 1 });
    expect((await service.execute(human, configure(2)))).toMatchObject({ outcome: 'partial', appliedRevision: 1 });
    vi.mocked(handlers.configureEntity).mockReturnValueOnce({ outcome: 'success' });
    expect((await service.execute(human, configure(2)))).toMatchObject({ outcome: 'partial' });
    vi.mocked(handlers.configureEntity).mockReturnValueOnce({ outcome: 'success', appliedRevision: 3 });
    expect((await service.execute(human, configure(2)))).toMatchObject({ outcome: 'uncertain' });
    vi.mocked(handlers.configureEntity).mockImplementationOnce(() => { throw new Error('provider error contains secret-payload'); });
    expect((await service.execute(human, configure(2)))).toMatchObject({ outcome: 'uncertain' });
    expect(JSON.stringify(service.audit())).not.toContain('secret-payload');
  });

  it('never logs request contents or raw errors, and returns detached audit records', async () => {
    const { service, handlers } = harness();
    const request = configure();
    request.config.instructions = 'secret-payload in sensitive instructions';
    vi.mocked(handlers.configureEntity).mockImplementation(() => { throw new Error('secret-payload raw-error'); });
    await service.execute(human, request);
    const audit = service.audit();
    expect(audit[0]).toMatchObject({ caller: human, outcome: 'uncertain', code: 'outcome_uncertain' });
    expect(JSON.stringify(audit)).not.toMatch(/secret-payload|instructions|raw-error|repositories|repo-access/);
    audit[0].caller.id = 'changed';
    audit[0].target.id = 'changed';
    expect(service.audit()[0].caller.id).toBe(human.id);
    expect(service.audit()[0].target.id).toBe('worker-one');
  });

  it('preserves caller attribution for uncloneable input and target attribution if handlers mutate arguments', async () => {
    const { service, handlers } = harness([capacityGrant()]);
    const invalid = { ...capacity(), unsupported: () => undefined } as ManagementRequest;
    expect((await service.execute(agent, invalid)).code).toBe('invalid_request');
    expect(service.audit()[0].caller).toEqual(agent);
    vi.mocked(handlers.setCapacity).mockImplementation(request => {
      request.target.id = 'changed-by-handler';
      return { outcome: 'success' };
    });
    expect((await service.execute(agent, capacity())).outcome).toBe('success');
    expect(service.audit()[1].target.id).toBe('pod-one');
  });

  it('rejects malformed policy instead of treating accessible tools as blanket authority', () => {
    const { handlers } = harness();
    for (const grant of [
      { ...capacityGrant(), target: { type: 'capacity', id: '*' } },
      { ...capacityGrant(), target: { type: 'scope', id: 'pod-one' } },
      { ...capacityGrant(), limits: {} },
      { ...capacityGrant(), limits: { maxActive: Infinity, maxUnits: 5 } },
      { ...capacityGrant(), action: 'admin' },
    ]) {
      expect(() => new ManagementService({ handlers, grants: [grant as ManagementGrant] })).toThrow('Invalid management grant');
    }
  });

  it('reports lookup and malformed handler output as uncertainty without raw data', async () => {
    const { service, handlers } = harness();
    vi.mocked(handlers.readEntity).mockImplementationOnce(() => { throw new Error('private lookup failure'); });
    expect((await service.execute(human, configure())).code).toBe('lookup_uncertain');
    vi.mocked(handlers.configureEntity).mockReturnValueOnce({ outcome: 'invented', secret: 'private output' } as never);
    expect((await service.execute(human, configure())).code).toBe('outcome_uncertain');
    expect(JSON.stringify(service.audit())).not.toContain('private');
  });
});

describe('recorded conditional approvals', () => {
  it('accepts exact caller/action/typed target/limits/request and current validity', async () => {
    const { service, handlers } = harness([capacityGrant(agent, true)], undefined, [approval()]);
    expect((await service.execute(agent, capacity())).code).toBe('approval_required');
    expect((await service.execute(agent, { ...capacity(), approvalId: 'missing' })).code).toBe('approval_invalid');
    expect((await service.execute(agent, { ...capacity(), approvalId: 'approval-one' })).outcome).toBe('success');
    expect(handlers.setCapacity).toHaveBeenCalledOnce();
  });

  it.each([
    { caller: human }, { caller: { ...agent, kind: 'human' } }, { action: 'cancelTask' },
    { target: { type: 'scope', id: 'pod-one' } }, { target: { type: 'capacity', id: 'pod-two' } },
    { limits: { maxActive: 1, maxUnits: 4 } }, { limits: { maxActive: 3, maxUnits: 2 } },
    { status: 'negated' }, { status: 'revoked' }, { status: 'superseded' },
    { validFrom: '2026-01-15T12:00:00.001Z' }, { validUntil: '2026-01-15T12:00:00.000Z' },
    { validUntil: 'not-a-date' }, { validUntil: '2026-01-15T13:00:00' }, { requestDigest: 'wrong-digest' }, { target: undefined },
  ])('refuses an unrelated or invalid approval %j', async patch => {
    const record = { ...approval(), ...patch } as RecordedApproval;
    const { service, handlers } = harness([capacityGrant(agent, true)], undefined, [record]);
    expect((await service.execute(agent, { ...capacity(), approvalId: 'approval-one' })).code).toBe('approval_invalid');
    expect(handlers.setCapacity).not.toHaveBeenCalled();
    expect(service.audit()[0].outcome).toBe('refused');
  });

  it('binds even a smaller requested limit and checks revocation on later calls', async () => {
    const recorded = approval();
    const { service, handlers } = harness([capacityGrant(agent, true)], undefined, [recorded]);
    expect((await service.execute(agent, { ...capacity(), maxActive: 1, approvalId: recorded.id })).code).toBe('approval_invalid');
    expect((await service.execute(agent, { ...capacity(), approvalId: recorded.id })).outcome).toBe('success');
    recorded.status = 'revoked';
    expect((await service.execute(agent, { ...capacity(), approvalId: recorded.id })).code).toBe('approval_invalid');
    expect(handlers.setCapacity).toHaveBeenCalledOnce();
  });

  it('binds configuration revisions and payloads while ignoring key order and approval id', async () => {
    const request = configure();
    expect(managementRequestDigest(request)).toBe(managementRequestDigest({ ...request, approvalId: 'any-approval' }));
    expect(managementRequestDigest(request)).toBe(managementRequestDigest({ config: request.config, expectedRevision: null, target: request.target, action: request.action }));
    expect(managementRequestDigest(request)).not.toBe(managementRequestDigest(configure(2)));
    expect(managementRequestDigest(request)).not.toBe(managementRequestDigest({ ...request, config: { ...request.config, instructions: 'Different instructions' } }));
    const grant = configGrant(human, true);
    const recorded: RecordedApproval = {
      ...grant, id: 'config-approval', approverId: 'operator-two', requestDigest: managementRequestDigest(request),
      validFrom: '2026-01-15T11:00:00.000Z', validUntil: '2026-01-15T13:00:00.000Z', status: 'approved',
    };
    const { service } = harness([grant], undefined, [recorded]);
    expect((await service.execute(human, { ...request, config: { ...request.config, instructions: 'Different instructions' }, approvalId: recorded.id })).code).toBe('approval_invalid');
    expect((await service.execute(human, { ...request, approvalId: recorded.id })).outcome).toBe('success');
  });
});

describe('mock secret references', () => {
  const reference = { id: 'repo-access', purpose: 'repository fixture' };
  const context = { entityId: 'worker-one', repositoryUrl: repo, operation: 'read' as const };
  function resolver() {
    return new MockSecretResolver([{ reference, entityId: context.entityId, repositoryUrls: [repo, secondRepo], operations: ['clone', 'read'] }]);
  }
  it('supports exact allowlisted multi-repo references and only generates mock values', async () => {
    expect(await resolver().resolve(reference, context)).toEqual({ value: 'mock-only:repo-access:worker-one' });
    expect(await resolver().resolve(reference, { ...context, repositoryUrl: secondRepo, operation: 'clone' })).toEqual({ value: 'mock-only:repo-access:worker-one' });
  });
  it.each([
    { entityId: 'worker-two' }, { repositoryUrl: 'https://github.com/example/other.git' },
    { repositoryUrl: 'https://github.com/example/alpha.git/' }, { repositoryUrl: `${repo}?token=secret-payload` },
    { repositoryUrl: 'https://username:password@github.com/example/alpha.git' },
    { repositoryUrl: 'http://github.com/example/alpha.git' }, { operation: 'write' },
  ])('refuses incorrect principal, repository or operation %j', async patch => {
    await expect(resolver().resolve(reference, { ...context, ...patch } as typeof context)).rejects.toThrow('Mock secret access refused');
  });
  it('refuses undeclared references and cannot accept a real credential value', async () => {
    await expect(resolver().resolve({ ...reference, id: 'other-ref' }, context)).rejects.toThrow('Mock secret access refused');
    await expect(resolver().resolve({ ...reference, purpose: 'other-purpose' }, context)).rejects.toThrow('Mock secret access refused');
    expect(() => new MockSecretResolver([{ reference, entityId: 'worker-one', repositoryUrls: [repo], operations: ['read'], value: 'secret-payload' } as never])).toThrow('Invalid mock secret grant');
    expect(() => new MockSecretResolver([{ reference: { ...reference, value: 'secret-payload' }, entityId: 'worker-one', repositoryUrls: [repo], operations: ['read'] } as never])).toThrow('Invalid mock secret grant');
  });
  it('validates canonical exact HTTPS URLs rather than prefixes or wildcard grants', () => {
    expect(isRepositoryUrl(repo)).toBe(true);
    for (const url of ['https://github.com/', 'https://github.com/example/*', `${repo}#fragment`, 'https://GITHUB.com/example/alpha.git', 'file:///example/repo', 'git@github.com:example/repo.git']) {
      expect(isRepositoryUrl(url)).toBe(false);
    }
  });
});
