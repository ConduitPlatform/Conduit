import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  checkPermissionTuple,
  checkRelation,
  computePermissionTuple,
  escapeRegex,
  getPostgresAccessListQuery,
  getSQLAccessListQuery,
} from '../utils/index.js';
import { IndexController } from './index.controller.js';
import { RuleCache } from './cache.controller.js';
import { isEmpty, isNil } from 'lodash-es';
import { Permission } from '../models/index.js';
import { createHash } from 'crypto';

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
    // action is not a relation but still validates the input
    checkRelation(subject, action, resource);
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
    // action is not a relation but still validates the input
    checkRelation(subject, action, resource);
    const computedTuple = computePermissionTuple(subject, action, resource);
    const permission = await Permission.getInstance().findOne({
      computedTuple,
    });
    if (!permission) {
      throw new Error(`Permission does not exist!`);
    }
    await Permission.getInstance().deleteOne({ _id: permission._id });
    await RuleCache.invalidateSubject(this.grpcSdk, subject);
  }

  async can(subject: string, action: string, object: string) {
    const started = Date.now();
    try {
      checkPermissionTuple(subject, action, object);
      const computedTuple = computePermissionTuple(subject, action, object);
      const cachedResponse = await RuleCache.findResolution(this.grpcSdk, computedTuple);
      if (!isNil(cachedResponse)) {
        ConduitGrpcSdk.Metrics?.increment('authorization_rule_cache_hit_total');
        return cachedResponse;
      }
      ConduitGrpcSdk.Metrics?.increment('authorization_rule_cache_miss_total');
      // if the actor is the object itself, all permissions are provided
      if (subject === object) {
        await RuleCache.storeResolution(this.grpcSdk, computedTuple, true);
        return true;
      }

      const permission = await Permission.getInstance().findOne({
        computedTuple,
      });
      if (permission) {
        await RuleCache.storeResolution(this.grpcSdk, computedTuple, true);
        return true;
      }

      const index = await this.indexController.findIndex(subject, action, object);

      await RuleCache.storeResolution(this.grpcSdk, computedTuple, index ?? false);

      return index ?? false;
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
    const computedTuple = `${subject}#${action}@${objectType}`;
    const permission = await Permission.getInstance().findMany({
      computedTuple: { $like: `${computedTuple}%` },
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
                  computedTuple,
                  subject,
                  objectType,
                  action,
                )
              : getSQLAccessListQuery(
                  objectTypeCollection,
                  computedTuple,
                  subject,
                  objectType,
                  action,
                ),
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
