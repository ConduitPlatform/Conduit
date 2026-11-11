import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import {
  assertDistinctResources,
  checkPermissionTuple,
  computePermissionTuple,
  escapeRegex,
  getPostgresAccessListQuery,
  getSQLAccessListQuery,
  hasResourceIdentifier,
  PERMISSION_ACTION_PATTERN,
} from '../utils/index.js';
import { IndexController } from './index.controller.js';
import { RuleCache, type SubjectPermissionInventoryEntry } from './cache.controller.js';
import { isEmpty, isNil } from 'lodash-es';
import { Permission, ResourceDefinition } from '../models/index.js';
import { createHash } from 'crypto';

function actionPrefixOrEmpty(actionPrefix?: string) {
  if (actionPrefix === undefined || actionPrefix === '') return '';
  if (!PERMISSION_ACTION_PATTERN.test(actionPrefix)) {
    throw new ModuleError({
      ...errors.INVALID_PERMISSION_ACTION,
      message:
        'Action prefix must start with a letter and contain only letters, numbers, and underscores',
    });
  }
  return actionPrefix;
}

function assertResourceIdentifier(value: string, label: 'Subject' | 'Resource') {
  if (!hasResourceIdentifier(value)) {
    throw new ModuleError({
      ...errors.INVALID_RESOURCE_IDENTIFIER,
      message: `${label} must be a valid resource identifier`,
    });
  }
}

export class PermissionsController {
  private static _instance: PermissionsController;

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly indexController = IndexController.getInstance(grpcSdk),
  ) {}

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (PermissionsController._instance) return PermissionsController._instance;
    if (grpcSdk) {
      return (PermissionsController._instance = new PermissionsController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  async grantPermission(subject: string, action: string, resource: string) {
    checkPermissionTuple(subject, action, resource);
    assertDistinctResources(subject, resource);
    const computedTuple = computePermissionTuple(subject, action, resource);
    await Permission.getInstance().create({
      subject,
      subjectId: subject.split(':')[1],
      subjectType: subject.split(':')[0],
      permission: action,
      resource,
      resourceId: resource.split(':')[1],
      resourceType: resource.split(':')[0],
      computedTuple,
    });
    await RuleCache.invalidateSubject(this.grpcSdk, subject);
  }

  async removePermission(subject: string, action: string, resource: string) {
    checkPermissionTuple(subject, action, resource);
    assertDistinctResources(subject, resource);
    const computedTuple = computePermissionTuple(subject, action, resource);
    const permission = await Permission.getInstance().findOne({
      computedTuple,
    });
    if (!permission) {
      throw new ModuleError(errors.PERMISSION_NOT_FOUND);
    }
    await Permission.getInstance().deleteOne({ _id: permission._id });
    await RuleCache.invalidateSubject(this.grpcSdk, subject);
  }

  async getSubjectPermissions(
    subject: string,
    resource: string,
    actionPrefix?: string,
  ): Promise<SubjectPermissionInventoryEntry[]> {
    const started = Date.now();
    try {
      const prefix = actionPrefixOrEmpty(actionPrefix);
      assertResourceIdentifier(subject, 'Subject');
      assertResourceIdentifier(resource, 'Resource');
      const cached = await RuleCache.findInventory(
        this.grpcSdk,
        subject,
        resource,
        prefix,
      );
      if (cached.value) {
        ConduitGrpcSdk.Metrics?.increment('authorization_rule_cache_hit_total');
        return cached.value;
      }
      ConduitGrpcSdk.Metrics?.increment('authorization_rule_cache_miss_total');
      const permissions = await this.loadSubjectPermissions(subject, resource, prefix);
      await RuleCache.storeInventory(
        this.grpcSdk,
        subject,
        resource,
        prefix,
        permissions,
        cached.versions,
      );
      return permissions;
    } finally {
      ConduitGrpcSdk.Metrics?.observe(
        'authorization_subject_permissions_duration_ms',
        Date.now() - started,
      );
    }
  }

  private async loadSubjectPermissions(
    subject: string,
    resource: string,
    prefix: string,
  ): Promise<SubjectPermissionInventoryEntry[]> {
    const resourceType = resource.slice(0, resource.indexOf(':'));
    const definition = await ResourceDefinition.getInstance().findOne({
      name: resourceType,
    });
    if (!definition) {
      throw new ModuleError(errors.RESOURCE_DEFINITION_NOT_FOUND);
    }
    const actions = Object.keys(definition.permissions ?? {})
      .filter(action => prefix === '' || action.startsWith(prefix))
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    if (actions.length === 0) return [];
    const [directActions, inheritedActions] = await Promise.all([
      this.findDirectActions(subject, resource, actions),
      this.indexController.findInheritedActions(subject, resource, actions),
    ]);
    const implicit = subject === resource;
    return actions.map(action => {
      const direct = directActions.has(action);
      const inherited = inheritedActions.has(action);
      return {
        action,
        direct,
        inherited,
        implicit,
        allowed: direct || inherited || implicit,
      };
    });
  }

  private async findDirectActions(subject: string, resource: string, actions: string[]) {
    if (actions.length === 0) return new Set<string>();
    type DirectPermission = Pick<Permission, 'permission'>;
    const rows = (await Permission.getInstance().findMany(
      {
        subject,
        resource,
        permission: { $in: actions },
      },
      { select: 'permission' },
    )) as DirectPermission[];
    return new Set(rows.map(row => row.permission));
  }

  async can(subject: string, action: string, object: string) {
    const started = Date.now();
    try {
      checkPermissionTuple(subject, action, object);
      const computedTuple = computePermissionTuple(subject, action, object);
      const cachedResponse = await RuleCache.findResolution(this.grpcSdk, computedTuple);
      if (!isNil(cachedResponse.value)) {
        ConduitGrpcSdk.Metrics?.increment('authorization_rule_cache_hit_total');
        return cachedResponse.value;
      }
      ConduitGrpcSdk.Metrics?.increment('authorization_rule_cache_miss_total');
      // if the actor is the object itself, all permissions are provided
      let allowed = subject === object;
      if (!allowed) {
        const permission = await Permission.getInstance().findOne({ computedTuple });
        allowed = !!permission;
      }
      if (!allowed) {
        allowed =
          (await this.indexController.findIndex(subject, action, object)) ?? false;
      }
      await RuleCache.storeResolution(
        this.grpcSdk,
        computedTuple,
        allowed,
        cachedResponse.versions,
      );
      return allowed;
    } finally {
      ConduitGrpcSdk.Metrics?.observe(
        'authorization_can_duration_ms',
        Date.now() - started,
      );
    }
  }

  async evaluatePermission(subject: string, action: string, object: string) {
    checkPermissionTuple(subject, action, object);
    const computedTuple = computePermissionTuple(subject, action, object);

    if (subject === object) {
      return { assigned: true };
    }

    const permission = await Permission.getInstance().findOne({
      computedTuple,
    });
    if (permission) {
      return {
        assigned: true,
      };
    }

    const index = await this.indexController.evaluateIndex(subject, action, object);

    return { assigned: false, objectIndex: index.object, subjectIndex: index.subject };
  }

  async findPermissions(
    subject: string,
    action: string,
    objectType: string,
    skip: number,
    limit: number,
  ) {
    const permission = await Permission.getInstance().findMany({
      subject,
      permission: action,
      resourceType: objectType,
    });
    const directIds = [
      ...new Set(permission.map(perm => perm.resource.split(':')[1]).filter(Boolean)),
    ];
    const indexIds = await this.indexController.findGeneralIndexAllResourceIds(
      subject,
      action,
      objectType,
    );
    const merged = [...new Set([...directIds, ...indexIds])].sort();
    const count = merged.length;
    return {
      resources: merged.slice(skip, skip + limit),
      count,
    };
  }

  async createAccessList(
    subject: string,
    action: string,
    objectType: string,
    requestedViewName?: string,
  ) {
    const started = Date.now();
    try {
      const computedTuple = `${subject}#${action}@${objectType}`;
      const computedTuplePrefix = `${computedTuple}:`;
      const escapedComputedTuplePrefix = `^${escapeRegex(computedTuplePrefix)}`;
      const objectTypeCollection = await this.grpcSdk
        .database!.getSchema(objectType)
        .then(r => r.collectionName);
      let viewName = requestedViewName;
      if (!viewName || isEmpty(viewName)) {
        viewName = createHash('sha256')
          .update(`${objectType}_${subject}_${action}`)
          .digest('hex');
      }

      const dbType = await this.grpcSdk.database!.getDatabaseType().then(r => r.result);
      await this.grpcSdk.database?.createView(
        objectType,
        viewName,
        ['Permission', 'ActorIndex', 'ObjectIndex'],
        {
          mongoQuery: [
            // Use a single seed document so auth index lookups run once per query.
            { $limit: 1 },
            { $project: { _id: 0 } },
            {
              $lookup: {
                from: 'cnd_permissions',
                pipeline: [
                  {
                    $match: {
                      computedTuple: {
                        $regex: escapedComputedTuplePrefix,
                      },
                    },
                  },
                  { $project: { _id: 0, resourceId: 1 } },
                ],
                as: 'directPermissions',
              },
            },
            {
              $lookup: {
                from: 'cnd_actorindexes',
                pipeline: [
                  {
                    $match: {
                      subject: subject,
                    },
                  },
                  { $project: { _id: 0, entity: 1 } },
                ],
                as: 'actors',
              },
            },
            {
              $project: {
                directIds: '$directPermissions.resourceId',
                actorEntities: {
                  $setUnion: ['$actors.entity', ['*']],
                },
              },
            },
            {
              $lookup: {
                from: 'cnd_objectindexes',
                localField: 'actorEntities',
                foreignField: 'entity',
                pipeline: [
                  {
                    $match: {
                      subjectType: objectType,
                      subjectPermission: action,
                    },
                  },
                  { $project: { _id: 0, subjectId: 1 } },
                ],
                as: 'indexedPermissions',
              },
            },
            {
              $project: {
                authorizedIds: {
                  $setUnion: ['$directIds', '$indexedPermissions.subjectId'],
                },
              },
            },
            // Convert string IDs to ObjectIds so $lookup can use _id index; skip invalid ids.
            {
              $addFields: {
                authorizedObjectIds: {
                  $filter: {
                    input: {
                      $map: {
                        input: '$authorizedIds',
                        as: 'id',
                        in: {
                          $convert: {
                            input: '$$id',
                            to: 'objectId',
                            onError: null,
                            onNull: null,
                          },
                        },
                      },
                    },
                    as: 'oid',
                    cond: { $ne: ['$$oid', null] },
                  },
                },
              },
            },
            {
              $lookup: {
                from: objectTypeCollection,
                localField: 'authorizedObjectIds',
                foreignField: '_id',
                as: 'authorizedDocs',
              },
            },
            { $unwind: '$authorizedDocs' },
            { $replaceRoot: { newRoot: '$authorizedDocs' } },
          ],
          sqlQuery:
            dbType === 'PostgreSQL'
              ? getPostgresAccessListQuery(
                  objectTypeCollection,
                  subject,
                  objectType,
                  action,
                )
              : getSQLAccessListQuery(objectTypeCollection, subject, objectType, action),
        },
      );
      return viewName;
    } finally {
      ConduitGrpcSdk.Metrics?.observe(
        'authorization_access_list_duration_ms',
        Date.now() - started,
      );
    }
  }
}
