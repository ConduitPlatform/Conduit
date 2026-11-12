import { Schema } from '../interfaces/index.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';

export function constructSortObj(sort: string[]) {
  const sortObj: { [field: string]: -1 | 1 } = {};
  sort.forEach((sortVal: string) => {
    sortVal = sortVal.trim();
    if (sortVal.indexOf('-') !== -1) {
      sortObj[sortVal.substring(1)] = -1;
    } else {
      sortObj[sortVal] = 1;
    }
  });
  return sortObj;
}

export function parseSortParam(sort: string) {
  return constructSortObj(sort.split(' '));
}

export async function documentPermissionCheck(
  grpcSdk: ConduitGrpcSdk,
  operation: 'create' | 'edit' | 'delete' | 'read',
  userId: string,
  model: Schema,
  documentId: string,
  scope?: string,
) {
  if (
    operation === 'create' ||
    !model.originalSchema.modelOptions.conduit.authorization?.enabled
  ) {
    return;
  }
  const authzOnline = grpcSdk.isAvailable('authorization');
  if (!authzOnline) {
    throw new ModuleError(errors.SCHEMA_AUTHORIZATION_UNAVAILABLE);
  }
  const authz = grpcSdk.authorization;

  if (scope) {
    let permission = await authz?.can({
      subject: `User:${userId}`,
      actions: [operation],
      resource: scope,
    })!;
    if (!permission.allow) {
      throw new ModuleError(errors.RESOURCE_ACCESS_DENIED);
    }
    permission = await authz?.can({
      subject: scope,
      actions: [operation],
      resource: `${model.originalSchema.name}:${documentId}`,
    })!;
    if (!permission.allow) {
      throw new ModuleError(errors.RESOURCE_ACCESS_DENIED);
    }
  } else {
    const permission = await authz?.can({
      subject: `User:${userId}`,
      actions: [operation],
      resource: `${model.originalSchema.name}:${documentId}`,
    })!;
    if (!permission.allow) {
      throw new ModuleError(errors.RESOURCE_ACCESS_DENIED);
    }
  }
}

export async function documentPermissionAddition(
  grpcSdk: ConduitGrpcSdk,
  userId: string,
  model: Schema,
  documentId: string,
  scope?: string,
) {
  if (!model.originalSchema.modelOptions.conduit.authorization?.enabled) {
    return;
  }
  const authzOnline = grpcSdk.isAvailable('authorization');
  if (!authzOnline) {
    throw new ModuleError(errors.SCHEMA_AUTHORIZATION_UNAVAILABLE);
  }
  const authz = grpcSdk.authorization;

  authz?.createRelation({
    subject: `User:${userId}`,
    resource: `${model.originalSchema.name}:${documentId}`,
    relation: 'owner',
  });
  if (scope) {
    authz?.createRelation({
      subject: scope,
      resource: `${model.originalSchema.name}:${documentId}`,
      relation: 'owner',
    });
  }
}

export async function collectionPermissionCheck(
  grpcSdk: ConduitGrpcSdk,
  operation: 'edit' | 'delete' | 'read',
  userId: string,
  model: Schema,
  skip: number,
  limit: number,
  scope?: string,
) {
  if (!model.originalSchema.modelOptions.conduit.authorization?.enabled) {
    return;
  }
  const authzOnline = grpcSdk.isAvailable('authorization');
  if (!authzOnline) {
    throw new ModuleError(errors.SCHEMA_AUTHORIZATION_UNAVAILABLE);
  }
  const authz = grpcSdk.authorization;

  if (scope) {
    const permission = await authz?.can({
      subject: `User:${userId}`,
      actions: [operation],
      resource: scope,
    })!;
    if (!permission.allow) {
      throw new ModuleError(errors.RESOURCE_ACCESS_DENIED);
    }
    return authz!.getAllowedResources({
      subject: scope,
      action: operation,
      resourceType: model.originalSchema.name,
      skip,
      limit,
    });
  } else {
    return authz!.getAllowedResources({
      subject: `User:${userId}`,
      action: operation,
      resourceType: model.originalSchema.name,
      skip,
      limit,
    });
  }
}
