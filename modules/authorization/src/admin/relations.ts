import ConduitGrpcSdk, {
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteObject,
  ConduitRouteReturnDefinition,
  ConduitString,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { RelationsController } from '../controllers/relations.controller';
import { isNil } from 'lodash';
import { Relationship } from '../models';

export class RelationHandler {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  getRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/relations',
          action: ConduitRouteActions.POST,
          description: `Creates a new relation.`,
          bodyParams: {
            subject: ConduitString.Required,
            relation: ConduitString.Required,
            object: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition(
          'CreateRelation',
          Relationship.getInstance().fields,
        ),
        'createRelation',
      ),
      constructConduitRoute(
        {
          path: '/relation',
          action: ConduitRouteActions.GET,
          description: `Returns a relation.`,
          queryParams: {
            subject: ConduitString.Required,
            relation: ConduitString.Required,
            object: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition(
          'GetRelation',
          Relationship.getInstance().fields,
        ),
        'getRelation',
      ),
      constructConduitRoute(
        {
          path: '/relations',
          action: ConduitRouteActions.GET,
          description: `Returns queried relations.`,
          queryParams: {
            subject: ConduitString.Optional,
            relation: ConduitString.Optional,
            object: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetRelations', {
          relations: [Relationship.getInstance().fields],
        }),
        'getRelations',
      ),
      constructConduitRoute(
        {
          path: '/relations',
          action: ConduitRouteActions.DELETE,
          description: `Deletes a relation.`,
          bodyParams: {
            subject: ConduitString.Required,
            relation: ConduitString.Required,
            object: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('DeleteRelation'),
        'deleteRelation',
      ),
      constructConduitRoute(
        {
          path: '/relations/:resource',
          action: ConduitRouteActions.DELETE,
          description: `Deletes all relations associated with a resource.`,
          urlParams: {
            resource: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('DeleteRelationsOfResource'),
        'deleteRelationsOfResource',
      ),
    ];
  }

  async createRelation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { subject, relation, object } = call.request.params;
    return RelationsController.getInstance().createRelation(subject, relation, object);
  }

  async getRelation(call: ParsedRouterRequest): Promise<Relationship | null> {
    const { subject, relation, object } = call.request.params;
    const found = RelationsController.getInstance().getRelation(
      subject,
      relation,
      object,
    );
    if (isNil(found)) {
      throw new Error('Relation not found');
    }
    return found;
  }

  async getRelations(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { subject, relation, resource } = call.request.params;
    return RelationsController.getInstance().findRelations({
      subject,
      relation,
      resource,
    });
  }

  async deleteRelation(call: ParsedRouterRequest) {
    const { subject, relation, object } = call.request.params;
    return RelationsController.getInstance().deleteRelation(subject, relation, object);
  }

  async deleteRelationsOfResource(call: ParsedRouterRequest) {
    const { name } = call.request.params;
    return RelationsController.getInstance().removeResource(name);
  }
}
