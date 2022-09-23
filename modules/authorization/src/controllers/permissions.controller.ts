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
    // if the actor is the object itself, all permissions are provided
    if (subject === object) {
      await RuleCache.storeResolution(this.grpcSdk, computedTuple, true);
      return true;
    }

    let index = await this.indexController.findIndex(subject, action, object);

    await RuleCache.storeResolution(this.grpcSdk, computedTuple, index ?? false);

    return index ?? false;
  }
}
