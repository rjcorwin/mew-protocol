import { describe, it, expect } from 'vitest';
import { createDemo } from '../src/demo.js';
import { createPodManagement } from '../src/admin.js';
import type { ManagementGrant } from '../src/management.js';

describe('management service bound to pod outcomes', () => {
  it('applies an authorized capacity limit and refuses a different target or caller', async () => {
    const pod = createDemo(); const caller = { id: 'operator', kind: 'human' as const };
    const grants: ManagementGrant[] = [{ caller, action: 'setCapacity', target: { type: 'capacity', id: 'local-pool' }, limits: { maxActive: 4, maxUnits: 4 } }];
    const admin = createPodManagement(pod, grants);
    const request = { action: 'setCapacity' as const, target: { type: 'capacity' as const, id: 'local-pool' }, maxActive: 3, maxUnits: 4 };
    expect((await admin.execute(caller, request)).outcome).toBe('success'); expect(pod.snapshot().capacity.maxActive).toBe(3);
    expect((await admin.execute({ id: 'builder', kind: 'agent' }, request)).outcome).toBe('refused');
    expect((await admin.execute(caller, { ...request, target: { type: 'capacity', id: 'other-pool' } })).outcome).toBe('refused');
    expect((await admin.execute(caller, { ...request, maxUnits: 3 })).outcome).toBe('refused'); pod.dispose();
  });
  it('configuration save reports partial until the runtime acknowledges the new revision', async () => {
    const pod = createDemo({ delayMs: 5 }); const caller = { id: 'maintainer', kind: 'agent' as const };
    const before = pod.snapshot().entities.find(entity => entity.desired.id === 'builder')!.desired;
    const admin = createPodManagement(pod, [{ caller, action: 'configureEntity', target: { type: 'entity', id: 'builder' }, limits: { allowedFields: ['instructions'], maxResourceUnits: 1, runtimeIds: ['mock-local'], conversationIds: ['project'], repositoryUrls: [], repositoryOperations: [], secretRefIds: [] } }]);
    const config = { ...before, revision: 2, instructions: 'Updated instructions for the next turn.' };
    expect(await admin.execute(caller, { action: 'configureEntity', target: { type: 'entity', id: 'builder' }, expectedRevision: 1, config })).toMatchObject({ outcome: 'partial', appliedRevision: null });
    await pod.postMessage({ conversationId: 'project', threadId: 'task-a', text: '@builder try the new instructions' }); await pod.idle();
    expect(pod.snapshot().entities.find(entity => entity.desired.id === 'builder')!.observed.appliedRevision).toBe(2);
    expect((await admin.execute(caller, { action: 'configureEntity', target: { type: 'entity', id: 'builder' }, expectedRevision: 1, config })).code).toBe('revision_conflict');
    pod.dispose();
  });
});
