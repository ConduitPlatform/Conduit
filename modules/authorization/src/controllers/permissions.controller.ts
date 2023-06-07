import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { checkRelation, computePermissionTuple } from '../utils';
import { IndexController } from './index.controller';
import { RuleCache } from './cache.controller';
import { isNil } from 'lodash';
import { Permission } from '../models';

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
    throw new Error('Missing grpcSdk or indexController!');
  }

  async grantPermission(subject: string, action: string, resource: string) {
    // action is not a relation but still validates the input
    checkRelation(subject, action, resource);
    const computedTuple = computePermissionTuple(subject, action, resource);
    await Permission.getInstance().create({
      subject,
      permission: action,
      resource,
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

  async createAccessList(subject: string, action: string, objectType: string) {
    const computedTuple = `${subject}#${action}@${objectType}`;
    await this.grpcSdk.database?.createView(
      objectType,
      `${objectType}_${subject}_${action}`,
      {
        mongoQuery: [
          // permissions lookup won't work this way
          {
            $lookup: {
              from: 'cnd_permissions',
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $regexMatch: {
                        input: '$computedTuple',
                        regex: `${subject}#${action}@${objectType}.*`,
                        options: 'i',
                      },
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
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $eq: ['$subject', '$$id_action'],
                    },
                  },
                },
              ],
              as: 'objects',
            },
          },
          {
            $project: {
              resource: '$$ROOT',
              intersection: {
                $setIntersection: ['$actors.entity', '$objects.entity'],
              },
            },
          },
          {
            $match: {
              intersection: { $ne: [] },
            },
          },
          {
            $replaceRoot: {
              newRoot: '$resource',
            },
          },

          {
            $project: {
              actors: 0,
              objects: 0,
            },
          },
        ],
        sqlQuery: `SELECT 
    ${objectType}.*
FROM 
    ${objectType}
INNER JOIN (
    SELECT 
        *
    FROM 
        cnd_permissions
    WHERE 
        computedTuple LIKE '${computedTuple}%'
) permissions ON 1=1
INNER JOIN (
    SELECT 
        *
    FROM 
        cnd_actorindexes
    WHERE 
        subject = '${subject}'
) actors ON 1=1
INNER JOIN (
    SELECT 
        *
    FROM 
        cnd_objectindexes
    WHERE 
        subject LIKE '${objectType}:%#${action}'
) objects ON actors.entity = objects.entity;`,
      },
    );

    return;
  }
}
