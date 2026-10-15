import { ManagementService, type ManagementGrant, type ManagementOptions } from './management.js';
import { Mewpod } from './pod.js';

/** Bind an already authenticated transport's bounded grants to this local pod. */
export function createPodManagement(pod: Mewpod, grants: ManagementGrant[], lookupApproval?: ManagementOptions['lookupApproval']): ManagementService {
  return new ManagementService({ grants, lookupApproval, handlers: {
    readEntity: id => pod.snapshot().entities.find(entity => entity.desired.id === id)?.desired,
    configureEntity: request => {
      // Synchronous comparison + mutation; no await between the CAS and configuration save.
      const current = pod.snapshot().entities.find(entity => entity.desired.id === request.target.id);
      if ((current?.desired.revision ?? null) !== request.expectedRevision) return { outcome: 'refused' };
      pod.configureEntity(request.config);
      const appliedRevision = pod.snapshot().entities.find(entity => entity.desired.id === request.target.id)!.observed.appliedRevision;
      return { outcome: appliedRevision === request.config.revision ? 'success' : 'partial', appliedRevision };
    },
    startScope: request => { pod.startScope({ id: request.target.id, entityIds: request.entityIds, conversationIds: request.conversationIds }); return { outcome: 'success' }; },
    endScope: request => {
      if (request.policy !== 'drain') return { outcome: 'refused' };
      pod.endScope(request.target.id);
      return { outcome: 'success' }; // Routing ended; does not claim native runtime termination.
    },
    setCapacity: request => {
      if (request.target.id !== 'local-pool' || request.maxUnits !== pod.snapshot().capacity.maxUnits) return { outcome: 'refused' };
      pod.setCapacity(request.maxActive); return { outcome: 'success' };
    },
    cancelTask: async request => {
      const outcome = await pod.cancelTask(request.target.id);
      return { outcome: ['cancelled', 'confirmed'].includes(outcome) ? 'success' : outcome === 'uncertain' ? 'uncertain' : 'partial' };
    },
  } });
}
