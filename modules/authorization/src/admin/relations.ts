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
          path: '/relations/:id',
          action: ConduitRouteActions.GET,
          description: `Returns a relation.`,
          urlParams: {
            id: ConduitString.Required,
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
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
            sort: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetRelations', {
          relations: [Relationship.getInstance().fields],
          count: ConduitNumber.Required,
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
    ];
  }

  async createRelation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { subject, relation, object } = call.request.params;
    const newRelation = await RelationsController.getInstance().createRelation(
      subject,
      relation,
      object,
    );
    this.grpcSdk.bus?.publish('authentication:create:relation', JSON.stringify(relation));
    return newRelation;
  }

  async getRelation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const found = await Relationship.getInstance().findOne({ id });
    if (isNil(found)) {
      throw new Error('Relation not found');
    }
    return found;
  }

  async getRelations(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { subject, relation, resource, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const found = await Relationship.getInstance().findMany(
      {
        subject,
        relation,
        resource,
      },
      undefined,
      skip,
      limit,
      sort,
    );
    if (isNil(found)) {
      throw new Error('Relations not found');
    }
    const count = await Relationship.getInstance().countDocuments({});
    return { found, count };
  }

  async deleteRelation(call: ParsedRouterRequest) {
    const { id } = call.request.params;
    const found = Relationship.getInstance().findOne({ id });
    if (isNil(found)) {
      throw new Error('Relation not found');
    }
    await RelationsController.getInstance().deleteRelationById(id);
    return 'Relation deleted successfully';
  }
}
