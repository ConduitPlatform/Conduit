import ConduitGrpcSdk, {
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ParsedRouterRequest,
  Query,
  RoutingManager,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { RelationsController } from '../controllers/relations.controller';
import { isNil } from 'lodash';
import { Relationship } from '../models';

export class RelationHandler {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  registerRoutes(routingManager: RoutingManager) {
    routingManager.route(
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
      this.createRelation.bind(this),
    );
    routingManager.route(
      {
        path: '/relations/:id',
        action: ConduitRouteActions.GET,
        description: `Returns a relation.`,
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('Relation', Relationship.getInstance().fields),
      this.getRelation.bind(this),
    );
    routingManager.route(
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
      this.getRelations.bind(this),
    );
    routingManager.route(
      {
        path: '/relations/:id',
        action: ConduitRouteActions.DELETE,
        description: `Deletes a relation.`,
        urlParams: {
          id: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('DeleteRelation'),
      this.deleteRelation.bind(this),
    );
  }

  async createRelation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { subject, relation, object } = call.request.params;
    const newRelation = await RelationsController.getInstance().createRelation(
      subject,
      relation,
      object,
    );
    this.grpcSdk.bus?.publish(
      'authentication:create:relation',
      JSON.stringify(newRelation),
    );
    return newRelation;
  }

  async getRelation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const found = await Relationship.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new Error('Relation not found');
    }
    return found;
  }

  async getRelations(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { subject, relation, resource, sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query: Query = {};
    if (subject) query['subject'] = subject;
    if (relation) query['relation'] = relation;
    if (resource) query['resource'] = resource;
    const found = await Relationship.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort,
    );
    if (isNil(found)) {
      throw new Error('Relations not found');
    }
    const count = await Relationship.getInstance().countDocuments(query);
    return { found, count };
  }

  async deleteRelation(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const found = Relationship.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new Error('Relation not found');
    }
    await RelationsController.getInstance().deleteRelationById(id);
    return 'Relation deleted successfully';
  }
}
