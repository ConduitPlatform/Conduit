import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitString,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { isEmpty } from 'lodash-es';
import { Permission, Relationship } from '../models/index.js';
import { PermissionsController } from '../controllers/index.js';

export class PermissionsAdminHandler {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  registerRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/permissions/can',
        action: ConduitRouteActions.GET,
        description: `Returns if a subject has a permission on a resource.`,
        queryParams: {
          subject: ConduitString.Required,
          permission: ConduitString.Required,
          resource: ConduitString.Required,
          scope: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('CheckPermission', {
        allowed: ConduitBoolean.Required,
      }),
      this.checkPermission.bind(this),
    );
    routingManager.route(
      {
        path: '/permissions/evaluate',
        action: ConduitRouteActions.GET,
        description: `Returns a path-based evaluation of a permission.`,
        queryParams: {
          subject: ConduitString.Required,
          permission: ConduitString.Required,
          resource: ConduitString.Required,
          scope: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('CheckPermission', {
        allowed: ConduitBoolean.Required,
        assigned: ConduitBoolean.Optional,
        paths: [ConduitString.Optional],
        subjectIndex: 'ActorIndex',
        objectIndex: 'ObjectIndex',
      }),
      this.evaluatePermission.bind(this),
    );
  }

  async checkPermission(call: ParsedRouterRequest) {
    const { subject, permission, resource, scope } = call.request.queryParams;
    if (!isEmpty(scope)) {
      const scopeRelations = await Relationship.getInstance().findMany({
        subject: subject,
        resource: scope,
      });
      if (scopeRelations.length === 0) {
        const scopePermissions = await Permission.getInstance().findMany({
          subject: subject,
          resource: scope,
        });
        if (scopePermissions.length === 0) {
          return { allowed: false };
        }
      }
    }
    const allowed = await PermissionsController.getInstance().can(
      scope ?? subject,
      permission,
      resource,
    );
    return { allowed };
  }

  async evaluatePermission(call: ParsedRouterRequest) {
    const { subject, permission, resource, scope } = call.request.queryParams;
    const paths = [];

    if (!isEmpty(scope)) {
      const scopeRelations = await Relationship.getInstance().findMany({
        subject: subject,
        resource: scope,
      });

      if (scopeRelations.length === 0) {
        const scopePermissions = await Permission.getInstance().findMany({
          subject: subject,
          resource: scope,
        });
        if (scopePermissions.length === 0) {
          return { allowed: false };
        } else {
          // assume the first permission
          paths.push(scopePermissions[0].computedTuple);
        }
      } else {
        // assume the first relation
        paths.push(scopeRelations[0].computedTuple);
      }
    }
    const { assigned, objectIndex, subjectIndex } =
      await PermissionsController.getInstance().evaluatePermission(
        scope ?? subject,
        permission,
        resource,
      );
    if (!assigned && !objectIndex) {
      return { allowed: false };
    }
    if (assigned) {
      paths.push(`${scope ?? subject}#${permission}@${resource}`);
      return { allowed: true, paths, assigned: true };
    }
    if (subjectIndex) {
      paths.push(
        `${subjectIndex.subject}#${subjectIndex.relation}@${subjectIndex.entityType}:${subjectIndex.entityId}`,
      );
    } else {
      paths.push('*');
    }
    if (objectIndex?.inheritanceTree && objectIndex?.inheritanceTree.length > 0) {
      paths.push(...objectIndex.inheritanceTree);
    }
    return {
      allowed: true,
      assigned: false,
      paths,
      subjectIndex: subjectIndex,
      objectIndex: objectIndex,
    };
  }
}
