import { createHash } from 'node:crypto';
import type { EntityConfig, SecretReference, SecretResolver } from './types.js';

/** Callable prototype boundary. An eventual transport must authenticate this context. */
export interface TrustedCaller { id: string; kind: 'human' | 'agent' }
export type ManagementAction = 'configureEntity' | 'startScope' | 'endScope' | 'setCapacity' | 'cancelTask';
export type RepositoryOperation = 'clone' | 'read' | 'write';
export type EndPolicy = 'drain' | 'cancel' | 'hold';
export interface EntityTarget { type: 'entity'; id: string }
export interface ScopeTarget { type: 'scope'; id: string }
export interface CapacityTarget { type: 'capacity'; id: string }
export interface TaskTarget { type: 'task'; id: string }
export type ManagementTarget = EntityTarget | ScopeTarget | CapacityTarget | TaskTarget;
export type EditableEntityField = Exclude<keyof EntityConfig, 'id' | 'revision'>;
export interface ConfigureLimits {
  allowedFields: EditableEntityField[];
  maxResourceUnits: number;
  runtimeIds: string[];
  conversationIds: string[];
  repositoryUrls: string[];
  repositoryOperations: RepositoryOperation[];
  secretRefIds: string[];
}
export interface StartScopeLimits { entityIds: string[]; conversationIds: string[] }
export interface EndScopeLimits { policies: EndPolicy[] }
export interface CapacityLimits { maxActive: number; maxUnits: number }
export type ManagementPermission =
  | { action: 'configureEntity'; target: EntityTarget; limits: ConfigureLimits }
  | { action: 'startScope'; target: ScopeTarget; limits: StartScopeLimits }
  | { action: 'endScope'; target: ScopeTarget; limits: EndScopeLimits }
  | { action: 'setCapacity'; target: CapacityTarget; limits: CapacityLimits }
  | { action: 'cancelTask'; target: TaskTarget; limits: Record<string, never> };
export type ManagementGrant = ManagementPermission & {
  caller: TrustedCaller;
  requireApproval?: boolean;
};
interface RequestBase { approvalId?: string }
export type ConfigureEntityRequest = RequestBase & {
  action: 'configureEntity'; target: EntityTarget; config: EntityConfig; expectedRevision: number | null;
};
export type StartScopeRequest = RequestBase & {
  action: 'startScope'; target: ScopeTarget; entityIds: string[]; conversationIds: string[];
};
export type EndScopeRequest = RequestBase & {
  action: 'endScope'; target: ScopeTarget; policy: EndPolicy;
};
export type SetCapacityRequest = RequestBase & {
  action: 'setCapacity'; target: CapacityTarget; maxActive: number; maxUnits: number;
};
export type CancelTaskRequest = RequestBase & { action: 'cancelTask'; target: TaskTarget };
export type ManagementRequest = ConfigureEntityRequest | StartScopeRequest | EndScopeRequest | SetCapacityRequest | CancelTaskRequest;
export type ManagementOutcome = 'success' | 'partial' | 'refused' | 'uncertain';
export type ManagementCode =
  | 'invalid_caller' | 'invalid_request' | 'invalid_target' | 'invalid_configuration'
  | 'revision_conflict' | 'forbidden' | 'limits_exceeded' | 'approval_required'
  | 'approval_invalid' | 'lookup_uncertain' | 'applied' | 'partially_applied'
  | 'handler_refused' | 'outcome_uncertain';
export interface HandlerResult { outcome: ManagementOutcome; appliedRevision?: number | null }
export interface ManagementResult extends HandlerResult { code: ManagementCode; auditId: string }
export interface ManagementHandlers {
  readEntity(id: string): EntityConfig | undefined | Promise<EntityConfig | undefined>;
  /** MUST atomically enforce expectedRevision too; the service pre-check is not a lock. */
  configureEntity(request: ConfigureEntityRequest): HandlerResult | Promise<HandlerResult>;
  startScope(request: StartScopeRequest): HandlerResult | Promise<HandlerResult>;
  endScope(request: EndScopeRequest): HandlerResult | Promise<HandlerResult>;
  setCapacity(request: SetCapacityRequest): HandlerResult | Promise<HandlerResult>;
  cancelTask(request: CancelTaskRequest): HandlerResult | Promise<HandlerResult>;
}
export type RecordedApproval = ManagementPermission & {
  id: string;
  caller: TrustedCaller;
  /** Issuer is verified by the trusted approval store, not inferred from payload text. */
  approverId: string;
  requestDigest: string;
  validFrom: string;
  validUntil: string;
  status: 'approved' | 'revoked' | 'superseded' | 'negated';
};
export interface AuditRecord {
  id: string;
  at: string;
  caller: TrustedCaller | { id: 'unverified'; kind: 'unknown' };
  action: ManagementAction | 'invalid';
  target: ManagementTarget | { type: 'invalid'; id: 'redacted' };
  outcome: ManagementOutcome;
  code: ManagementCode;
  requestedRevision?: number;
  appliedRevision?: number | null;
}
export interface ManagementOptions {
  handlers: ManagementHandlers;
  grants: readonly ManagementGrant[];
  /** Trusted service integration; read afresh for every operation, including revocation. */
  lookupApproval?: (id: string) => RecordedApproval | undefined;
  now?: () => Date;
}

const actions: ManagementAction[] = ['configureEntity', 'startScope', 'endScope', 'setCapacity', 'cancelTask'];
const editableFields: EditableEntityField[] = [
  'displayName', 'role', 'instructions', 'runtimeId', 'model', 'conversationIds',
  'requiredResources', 'resourceUnits', 'secretRefs', 'repositories',
];
const entityKeys = ['id', 'revision', ...editableFields];
const operations = ['clone', 'read', 'write'];
const endPolicies = ['drain', 'cancel', 'hold'];
const expectedTypes: Record<ManagementAction, ManagementTarget['type']> = {
  configureEntity: 'entity', startScope: 'scope', endScope: 'scope', setCapacity: 'capacity', cancelTask: 'task',
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function keys(value: Record<string, unknown>, allowed: string[], required: string[] = allowed): boolean {
  return Object.keys(value).every(key => allowed.includes(key)) && required.every(key => Object.hasOwn(value, key));
}
function identifier(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value);
}
function text(value: unknown, maximum = 8192): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
}
function natural(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function positive(value: unknown): value is number { return natural(value) && value > 0; }
function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}
function list(value: unknown, predicate: (item: unknown) => boolean, nonempty = false): value is string[] {
  return Array.isArray(value) && value.length <= 256 && (!nonempty || value.length > 0)
    && value.every(predicate) && new Set(value).size === value.length;
}
function callerValid(value: unknown): value is TrustedCaller {
  return record(value) && keys(value, ['id', 'kind']) && identifier(value.id) && typeof value.kind === 'string' && ['human', 'agent'].includes(value.kind);
}
function targetValid(value: unknown, action: ManagementAction): value is ManagementTarget {
  return record(value) && keys(value, ['id', 'type']) && identifier(value.id) && value.type === expectedTypes[action];
}
/** Exact canonical HTTPS repository URLs only; no credentials, query, fragments, or wildcards. */
export function isRepositoryUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048 || value.includes('*')) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
      && url.pathname !== '/' && url.href === value;
  } catch { return false; }
}
function secretReferenceValid(value: unknown): value is SecretReference {
  return record(value) && keys(value, ['id', 'purpose']) && identifier(value.id) && text(value.purpose, 256);
}
function entityValid(value: unknown): value is EntityConfig {
  if (!record(value) || !keys(value, entityKeys)) return false;
  if (!identifier(value.id) || !positive(value.revision) || !text(value.displayName, 256)
    || !text(value.role, 256) || !text(value.instructions, 32768) || !identifier(value.runtimeId)
    || !text(value.model, 256) || !list(value.conversationIds, identifier, true)
    || !list(value.requiredResources, identifier) || !positive(value.resourceUnits)) return false;
  if (!Array.isArray(value.secretRefs) || value.secretRefs.length > 256 || !value.secretRefs.every(secretReferenceValid)
    || new Set(value.secretRefs.map(ref => ref.id)).size !== value.secretRefs.length) return false;
  const refs = value.secretRefs as SecretReference[];
  return Array.isArray(value.repositories) && value.repositories.length <= 256
    && new Set(value.repositories.map(repository => record(repository) ? repository.url : undefined)).size === value.repositories.length
    && value.repositories.every(repository => record(repository)
      && keys(repository, ['url', 'operations', 'secretRef'], ['url', 'operations'])
      && isRepositoryUrl(repository.url)
      && list(repository.operations, operation => typeof operation === 'string' && operations.includes(operation), true)
      && (repository.secretRef === undefined || (identifier(repository.secretRef) && refs.some(ref => ref.id === repository.secretRef))));
}
function requestError(value: unknown): ManagementCode | undefined {
  if (!record(value) || !actions.includes(value.action as ManagementAction)) return 'invalid_request';
  const action = value.action as ManagementAction;
  if (!targetValid(value.target, action)) return 'invalid_target';
  if (value.approvalId !== undefined && !identifier(value.approvalId)) return 'invalid_request';
  const base = ['action', 'target', 'approvalId'];
  const required = ['action', 'target'];
  switch (action) {
    case 'configureEntity':
      if (!keys(value, [...base, 'config', 'expectedRevision'], [...required, 'config', 'expectedRevision'])) return 'invalid_request';
      if (!entityValid(value.config) || value.config.id !== value.target.id) return 'invalid_configuration';
      if (!(value.expectedRevision === null || positive(value.expectedRevision))) return 'invalid_request';
      return undefined;
    case 'startScope':
      return keys(value, [...base, 'entityIds', 'conversationIds'], [...required, 'entityIds', 'conversationIds'])
        && list(value.entityIds, identifier, true) && list(value.conversationIds, identifier, true) ? undefined : 'invalid_request';
    case 'endScope':
      return keys(value, [...base, 'policy'], [...required, 'policy']) && typeof value.policy === 'string' && endPolicies.includes(value.policy) ? undefined : 'invalid_request';
    case 'setCapacity':
      return keys(value, [...base, 'maxActive', 'maxUnits'], [...required, 'maxActive', 'maxUnits'])
        && natural(value.maxActive) && natural(value.maxUnits) ? undefined : 'invalid_request';
    case 'cancelTask': return keys(value, base, required) ? undefined : 'invalid_request';
  }
}
function limitsValid(permission: ManagementPermission): boolean {
  const { action, target, limits } = permission;
  if (!actions.includes(action) || !targetValid(target, action) || !record(limits)) return false;
  switch (action) {
    case 'configureEntity':
      return keys(limits, ['allowedFields', 'maxResourceUnits', 'runtimeIds', 'conversationIds', 'repositoryUrls', 'repositoryOperations', 'secretRefIds'])
        && list(limits.allowedFields, field => editableFields.includes(field as EditableEntityField))
        && positive(limits.maxResourceUnits) && list(limits.runtimeIds, identifier)
        && list(limits.conversationIds, identifier) && list(limits.repositoryUrls, isRepositoryUrl)
        && list(limits.repositoryOperations, operation => typeof operation === 'string' && operations.includes(operation)) && list(limits.secretRefIds, identifier);
    case 'startScope': return keys(limits, ['entityIds', 'conversationIds']) && list(limits.entityIds, identifier) && list(limits.conversationIds, identifier);
    case 'endScope': return keys(limits, ['policies']) && list(limits.policies, policy => typeof policy === 'string' && endPolicies.includes(policy));
    case 'setCapacity': return keys(limits, ['maxActive', 'maxUnits']) && natural(limits.maxActive) && natural(limits.maxUnits);
    case 'cancelTask': return keys(limits, []);
  }
}
function sameTarget(left: ManagementTarget, right: ManagementTarget): boolean { return left.type === right.type && left.id === right.id; }
function sameCaller(left: TrustedCaller, right: TrustedCaller): boolean { return left.id === right.id && left.kind === right.kind; }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
/** Bind approval to all requested values and revision, excluding the approval's own id. */
export function managementRequestDigest(request: ManagementRequest): string {
  if (requestError(request)) throw new Error('Cannot bind an invalid management request');
  const { approvalId: _approvalId, ...operation } = request;
  return createHash('sha256').update(canonical(operation)).digest('hex');
}
function covers(permission: ManagementPermission, request: ManagementRequest, current?: EntityConfig): boolean {
  if (permission.action !== request.action || !limitsValid(permission) || !sameTarget(permission.target, request.target)) return false;
  switch (request.action) {
    case 'configureEntity': {
      const limits = permission.limits as ConfigureLimits;
      const config = request.config;
      const changed = editableFields.filter(field => !current || canonical(current[field]) !== canonical(config[field]));
      return changed.every(field => limits.allowedFields.includes(field)) && config.resourceUnits <= limits.maxResourceUnits
        && limits.runtimeIds.includes(config.runtimeId) && config.conversationIds.every(id => limits.conversationIds.includes(id))
        && config.secretRefs.every(ref => limits.secretRefIds.includes(ref.id))
        && config.repositories.every(repository => limits.repositoryUrls.includes(repository.url)
          && repository.operations.every(operation => limits.repositoryOperations.includes(operation)));
    }
    case 'startScope': {
      const limits = permission.limits as StartScopeLimits;
      return request.entityIds.every(id => limits.entityIds.includes(id)) && request.conversationIds.every(id => limits.conversationIds.includes(id));
    }
    case 'endScope': return (permission.limits as EndScopeLimits).policies.includes(request.policy);
    case 'setCapacity': return request.maxActive <= (permission.limits as CapacityLimits).maxActive && request.maxUnits <= (permission.limits as CapacityLimits).maxUnits;
    case 'cancelTask': return true;
  }
}

export class ManagementService {
  private readonly handlers: ManagementHandlers;
  private readonly grants: readonly ManagementGrant[];
  private readonly lookupApproval?: ManagementOptions['lookupApproval'];
  private readonly now: () => Date;
  private readonly records: AuditRecord[] = [];

  constructor(options: ManagementOptions) {
    this.handlers = options.handlers;
    this.grants = structuredClone(options.grants);
    if (!this.grants.every(grant => callerValid(grant.caller) && limitsValid(grant)
      && (grant.requireApproval === undefined || typeof grant.requireApproval === 'boolean'))) throw new Error('Invalid management grant');
    this.lookupApproval = options.lookupApproval;
    this.now = options.now ?? (() => new Date());
  }

  audit(): AuditRecord[] { return structuredClone(this.records); }

  async execute(caller: TrustedCaller, request: ManagementRequest): Promise<ManagementResult> {
    // Snapshot input before any await: payload mutation cannot widen a validated request.
    let input: unknown;
    let identity: unknown;
    try { identity = structuredClone(caller); }
    catch { return this.finish(undefined, undefined, 'refused', 'invalid_caller'); }
    if (!callerValid(identity)) return this.finish(undefined, undefined, 'refused', 'invalid_caller');
    try { input = structuredClone(request); }
    catch { return this.finish(identity, undefined, 'refused', 'invalid_request'); }
    const error = requestError(input);
    if (error) return this.finish(identity, input, 'refused', error);
    const operation = input as ManagementRequest;
    const candidates = this.grants.filter(grant => sameCaller(grant.caller, identity)
      && grant.action === operation.action && sameTarget(grant.target, operation.target));
    if (!candidates.length) return this.finish(identity, operation, 'refused', 'forbidden');
    let current: EntityConfig | undefined;
    if (operation.action === 'configureEntity') {
      try {
        const found = await this.handlers.readEntity(operation.target.id);
        current = found === undefined ? undefined : structuredClone(found);
        if (current && (!entityValid(current) || current.id !== operation.target.id)) return this.finish(identity, operation, 'uncertain', 'lookup_uncertain');
      } catch { return this.finish(identity, operation, 'uncertain', 'lookup_uncertain'); }
      if ((current?.revision ?? null) !== operation.expectedRevision || operation.config.revision !== (current?.revision ?? 0) + 1) {
        return this.finish(identity, operation, 'refused', 'revision_conflict');
      }
    }
    const bounded = candidates.filter(grant => covers(grant, operation, current));
    if (!bounded.length) return this.finish(identity, operation, 'refused', 'limits_exceeded');
    if (!bounded.some(grant => !grant.requireApproval)) {
      if (!operation.approvalId) return this.finish(identity, operation, 'refused', 'approval_required');
      let approval: RecordedApproval | undefined;
      try { approval = structuredClone(this.lookupApproval?.(operation.approvalId)); }
      catch { return this.finish(identity, operation, 'refused', 'approval_invalid'); }
      const now = this.now().getTime();
      if (!approval || approval.id !== operation.approvalId || !callerValid(approval.caller)
        || !sameCaller(approval.caller, identity) || !identifier(approval.approverId) || approval.status !== 'approved'
        || !timestamp(approval.validFrom) || !timestamp(approval.validUntil)
        || !(Date.parse(approval.validFrom) <= now && now < Date.parse(approval.validUntil))
        || approval.requestDigest !== managementRequestDigest(operation) || !covers(approval, operation, current)) {
        return this.finish(identity, operation, 'refused', 'approval_invalid');
      }
    }
    let result: HandlerResult;
    try {
      switch (operation.action) {
        case 'configureEntity': result = await this.handlers.configureEntity(structuredClone(operation)); break;
        case 'startScope': result = await this.handlers.startScope(structuredClone(operation)); break;
        case 'endScope': result = await this.handlers.endScope(structuredClone(operation)); break;
        case 'setCapacity': result = await this.handlers.setCapacity(structuredClone(operation)); break;
        case 'cancelTask': result = await this.handlers.cancelTask(structuredClone(operation)); break;
      }
      if (!record(result) || !['success', 'partial', 'refused', 'uncertain'].includes(result.outcome)
        || (result.appliedRevision !== undefined && result.appliedRevision !== null && !positive(result.appliedRevision))) {
        return this.finish(identity, operation, 'uncertain', 'outcome_uncertain');
      }
    } catch {
      // A thrown response could follow effects; never serialize raw provider errors or retry here.
      return this.finish(identity, operation, 'uncertain', 'outcome_uncertain');
    }
    let outcome = result.outcome;
    if (operation.action === 'configureEntity' && outcome === 'success' && result.appliedRevision !== operation.config.revision) outcome = 'partial';
    if (operation.action === 'configureEntity' && typeof result.appliedRevision === 'number' && result.appliedRevision > operation.config.revision) outcome = 'uncertain';
    const codes: Record<ManagementOutcome, ManagementCode> = {
      success: 'applied', partial: 'partially_applied', refused: 'handler_refused', uncertain: 'outcome_uncertain',
    };
    return this.finish(identity, operation, outcome, codes[outcome], result.appliedRevision);
  }

  private finish(caller: TrustedCaller | undefined, input: unknown, outcome: ManagementOutcome, code: ManagementCode, appliedRevision?: number | null): ManagementResult {
    const action = record(input) && actions.includes(input.action as ManagementAction) ? input.action as ManagementAction : 'invalid';
    const target = record(input) && action !== 'invalid' && targetValid(input.target, action)
      ? structuredClone(input.target) : { type: 'invalid' as const, id: 'redacted' as const };
    const entry: AuditRecord = {
      id: `audit-${this.records.length + 1}`, at: this.now().toISOString(),
      caller: caller ? structuredClone(caller) : { id: 'unverified', kind: 'unknown' }, action, target, outcome, code,
    };
    if (record(input) && action === 'configureEntity' && record(input.config) && positive(input.config.revision)) entry.requestedRevision = input.config.revision;
    if (appliedRevision !== undefined) entry.appliedRevision = appliedRevision;
    this.records.push(entry);
    return { outcome, code, auditId: entry.id, ...(appliedRevision === undefined ? {} : { appliedRevision }) };
  }
}

export interface MockSecretGrant {
  reference: SecretReference;
  entityId: string;
  repositoryUrls: string[];
  operations: RepositoryOperation[];
}
/** Synthetic values only. No environment, filesystem, network, vault, or checkout access. */
export class MockSecretResolver implements SecretResolver {
  private readonly grants: readonly MockSecretGrant[];
  constructor(grants: readonly MockSecretGrant[]) {
    this.grants = structuredClone(grants);
    if (!this.grants.every(grant => record(grant) && keys(grant, ['reference', 'entityId', 'repositoryUrls', 'operations'])
      && secretReferenceValid(grant.reference) && identifier(grant.entityId)
      && list(grant.repositoryUrls, isRepositoryUrl, true) && list(grant.operations, operation => typeof operation === 'string' && operations.includes(operation), true))) {
      throw new Error('Invalid mock secret grant');
    }
  }
  async resolve(reference: SecretReference, context: { entityId: string; repositoryUrl: string; operation: RepositoryOperation }): Promise<{ value: string }> {
    if (!secretReferenceValid(reference) || !record(context) || !keys(context, ['entityId', 'repositoryUrl', 'operation'])
      || !identifier(context.entityId) || !isRepositoryUrl(context.repositoryUrl) || !operations.includes(context.operation)) throw new Error('Mock secret access refused');
    const grant = this.grants.find(item => item.reference.id === reference.id && item.reference.purpose === reference.purpose
      && item.entityId === context.entityId && item.repositoryUrls.includes(context.repositoryUrl) && item.operations.includes(context.operation));
    if (!grant) throw new Error('Mock secret access refused');
    return { value: `mock-only:${reference.id}:${context.entityId}` };
  }
}
