import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  checkRelation,
  computePermissionTuple,
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
  }

  async can(subject: string, action: string, object: string) {
    checkRelation(subject, action, object);
    const computedTuple = computePermissionTuple(subject, action, object);
    const cachedResponse = await RuleCache.findResolution(this.grpcSdk, computedTuple);
    if (!isNil(cachedResponse)) {
      return cachedResponse;
    }
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
  }

  async evaluatePermission(subject: string, action: string, object: string) {
    checkRelation(subject, action, object);
    const computedTuple = computePermissionTuple(subject, action, object);

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
    const allowedIds = [];
    const permission = await Permission.getInstance().findMany({
      computedTuple: { $like: `${computedTuple}%` },
    });
    for (const perm of permission) {
      allowedIds.push(perm.resource.split(':')[1]);
    }
    let count = await this.indexController.findGeneralIndexCount(
      subject,
      action,
      objectType,
    );
    count += allowedIds.length;
    /**
     * allowedIds may contain ids to return which could be enough to satisfy the skip/limit
     * requirements. If not, we need to query the index for the rest of the ids.
     *
     */
    if (allowedIds.length >= skip + limit) {
      return { resources: allowedIds.slice(skip, skip + limit), count: count };
    } else {
      skip -= allowedIds.length;
      limit -= allowedIds.length;
    }

    const index = await this.indexController.findGeneralIndex(
      subject,
      action,
      objectType,
      skip,
      limit,
    );
    return { resources: allowedIds.concat(index), count };
  }

  async createAccessList(
    subject: string,
    action: string,
    objectType: string,
    requestedViewName?: string,
  ) {
    const computedTuple = `${subject}#${action}@${objectType}`;
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
          // permissions lookup won't work this way
          {
            $lookup: {
              from: 'cnd_permissions',
              let: { x_id: { $toString: '$_id' } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: [
                        '$computedTuple',
                        { $concat: [`${subject}#${action}@${objectType}:`, '$$x_id'] },
                      ],
                    },
                  },
                },
              ],
              as: 'permissions',
            },
          },
          {
            $lookup: {
              from: 'cnd_actorindexes',
              let: {
                subject: subject,
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ['$subject', '$$subject'],
                    },
                  },
                },
              ],
              as: 'actors',
            },
          },
          {
            $lookup: {
              from: 'cnd_objectindexes',
              let: {
                id_action: {
                  $concat: [`${objectType}:`, { $toString: '$_id' }, `#${action}`],
                },
                entities: { $concatArrays: ['$actors.entity', ['*']] },
              },
              pipeline: [
                {
                  $match: {
                    $and: [
                      {
                        $expr: {
                          $eq: ['$subject', '$$id_action'],
                        },
                      },
                      {
                        $expr: {
                          $in: ['$entity', '$$entities'],
                        },
                      },
                    ],
                  },
                },
              ],
              as: 'intersection',
            },
          },
          {
            $match: {
              $or: [
                {
                  'intersection.0': { $exists: true },
                },
                {
                  'permissions.0': { $exists: true },
                },
              ],
            },
          },
          {
            $project: {
              actors: 0,
              objects: 0,
              permissions: 0,
              intersection: 0,
            },
          },
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
  }
}
