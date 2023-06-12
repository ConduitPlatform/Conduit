import { Schema } from '../interfaces';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

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
    !model.originalSchema.modelOptions.conduit.authorization.enabled
  ) {
    return;
  }
  const authzOnline = grpcSdk.isAvailable('authorization');
  if (!authzOnline) {
    throw new GrpcError(status.INTERNAL, 'Authorization service is not available');
  }
  const authz = grpcSdk.authorization;

  if (scope) {
    let permission = await authz?.can({
      subject: `User:${userId}`,
      actions: [operation],
      resource: scope,
    })!;
    if (!permission.allow) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Permission denied');
    }
    permission = await authz?.can({
      subject: scope,
      actions: [operation],
      resource: `${model.originalSchema.name}:${documentId}`,
    })!;
    if (!permission.allow) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Permission denied');
    }
  } else {
    const permission = await authz?.can({
      subject: `User:${userId}`,
      actions: [operation],
      resource: `${model.originalSchema.name}:${documentId}`,
    })!;
    if (!permission.allow) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Permission denied');
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
  if (!model.originalSchema.modelOptions.conduit.authorization.enabled) {
    return;
  }
  const authzOnline = grpcSdk.isAvailable('authorization');
  if (!authzOnline) {
    throw new GrpcError(status.INTERNAL, 'Authorization service is not available');
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
  if (!model.originalSchema.modelOptions.conduit.authorization.enabled) {
    return;
  }
  const authzOnline = grpcSdk.isAvailable('authorization');
  if (!authzOnline) {
    throw new GrpcError(status.INTERNAL, 'Authorization service is not available');
  }
  const authz = grpcSdk.authorization;

  if (scope) {
    const permission = await authz?.can({
      subject: `User:${userId}`,
      actions: [operation],
      resource: scope,
    })!;
    if (!permission.allow) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Permission denied');
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
