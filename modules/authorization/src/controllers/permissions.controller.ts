import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import {
  AccessListQueryParams,
  checkRelation,
  computePermissionTuple,
  getMongoAccessListQuery,
  getPostgresAccessListQuery,
  getSQLAccessListQuery,
} from '../utils';
import { IndexController } from './index.controller';
import { RuleCache } from './cache.controller';
import { isNil } from 'lodash';
import { Permission } from '../models';
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
      RuleCache.storeResolution(this.grpcSdk, computedTuple, true);
      return true;
    }

    const permission = await Permission.getInstance().findOne({
      computedTuple,
    });
    if (permission) {
      RuleCache.storeResolution(this.grpcSdk, computedTuple, true);
      return true;
    }

    const index = await this.indexController.findIndex(subject, action, object);

    RuleCache.storeResolution(this.grpcSdk, computedTuple, index ?? false);

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
    const query = await this.getAuthorizedQuery(subject, action, objectType);
    await this.grpcSdk.database?.createView(
      objectType,
      createHash('sha256').update(`${objectType}_${subject}_${action}`).digest('hex'),
      ['Permission', 'ActorIndex', 'ObjectIndex'],
      query,
    );
    return;
  }

  async getAuthorizedQuery(subject: string, action: string, objectType: string) {
    const computedTuple = `${subject}#${action}@${objectType}`;
    const objectTypeCollection = await this.grpcSdk
      .database!.getSchema(objectType)
      .then(r => r.collectionName);
    const dbType = await this.grpcSdk.database!.getDatabaseType().then(r => r.result);
    const params: AccessListQueryParams = {
      objectTypeCollection,
      computedTuple,
      subject,
      objectType,
      action,
    };
    return {
      mongoQuery: getMongoAccessListQuery(params),
      sqlQuery:
        dbType === 'PostgreSQL'
          ? getPostgresAccessListQuery(params)
          : getSQLAccessListQuery(params),
    };
  }
}
