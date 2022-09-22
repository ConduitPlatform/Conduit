import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { checkRelation, computePermissionTuple } from '../utils';
import { IndexController } from './index.controller';
import { RuleCache } from './cache.controller';
import { isNil } from 'lodash';
import { ResourceDefinition } from '../models';

export class PermissionsController {
  private static _instance: PermissionsController;

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly indexController: IndexController,
  ) {}

  static getInstance(grpcSdk?: ConduitGrpcSdk, indexController?: IndexController) {
    if (PermissionsController._instance) return PermissionsController._instance;
    if (grpcSdk && indexController) {
      return (PermissionsController._instance = new PermissionsController(
        grpcSdk,
        indexController,
      ));
    }
    throw new Error('Missing grpcSdk or indexController!');
  }

  async can(subject: string, action: string, object: string) {
    checkRelation(subject, action, object);
    const computedTuple = computePermissionTuple(subject, action, object);
    let cachedResponse = await RuleCache.findResolution(this.grpcSdk, computedTuple);
    if (!isNil(cachedResponse)) {
      return cachedResponse;
    }

    let validPermission = await ResourceDefinition.getInstance().findOne({
      name: object.split(':')[0],
      [`permissions.${action}`]: { $exists: true },
    });

    // if the action does not exist at all
    if (!validPermission) throw new Error('Invalid action');
    // if none is allowed to do action
    if (
      Array.isArray(validPermission.permissions[action]) &&
      validPermission.permissions[action].length === 0
    ) {
      await RuleCache.storeResolution(this.grpcSdk, computedTuple, false);
      return false;
    }
    // if the actor is the object itself and the permission is allowed for self
    if (
      subject === object &&
      (validPermission.permissions[action] === '_self' ||
        (validPermission.permissions[action] as string[]).indexOf('_self') !== -1)
    ) {
      await RuleCache.storeResolution(this.grpcSdk, computedTuple, true);
      return true;
    }

    // if the action is allowed for everyone
    if (
      validPermission.permissions[action] === '*' ||
      (validPermission.permissions[action] as string[]).indexOf('*') !== -1
    ) {
      await RuleCache.storeResolution(this.grpcSdk, computedTuple, true);
      return true;
    }

    let index = await this.indexController.findIndex(subject, action, object);

    await RuleCache.storeResolution(this.grpcSdk, computedTuple, index ?? false);

    return index ?? false;
  }
}
