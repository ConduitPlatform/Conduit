import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  RouteOptionType,
  ConduitString,
  ConduitNumber,
  ConduitBoolean,
  ConduitJson,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import path from 'path';
import { isNil } from 'lodash';
import { FlowCreator } from '../controllers/flowCreator';
import { ActorFlow, ActorRun } from '../models'

const { readdirSync, readFileSync } = require('fs');

export class AdminHandlers {
  private warden: FlowCreator;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk
  ) {
    this.warden = new FlowCreator(grpcSdk, server);
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getActors: this.getActors.bind(this),
        getTriggers: this.getTriggers.bind(this),
        getFlow: this.getFlow.bind(this),
        getFlows: this.getFlows.bind(this),
        getFlowRuns: this.getFlowRuns.bind(this),
        createFlow: this.createFlow.bind(this),
        // editFlow: this.editFlow.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private getRegisteredRoutes(): any[] {
    return [
      constructConduitRoute(
        {
          path: '/actors',
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('GetActors', {
          actors: ConduitJson.Required,
        }),
        'getActors'
      ),
      constructConduitRoute(
        {
          path: '/triggers',
          action: ConduitRouteActions.GET,
        },
        new ConduitRouteReturnDefinition('GetTriggers', {
          triggers: ConduitJson.Required,
        }),
        'getTriggers'
      ),
      constructConduitRoute(
        {
          path: '/flows/:id',
          action: ConduitRouteActions.GET,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('Flow', ActorFlow.getInstance().fields),
        'getFlow'
      ),
      constructConduitRoute(
        {
          path: '/flows',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
          },
        },
        new ConduitRouteReturnDefinition('Flows', {
          flows: ['Flow'],
          count: ConduitNumber.Required,
        }),
        'getFlows'
      ),
      constructConduitRoute(
        {
          path: '/flows/:id/runs',
          action: ConduitRouteActions.GET,
          urlParams: {
            id: { type: RouteOptionType.String, required: true },
          },
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetFlowRuns', {
          runs: [ActorRun.getInstance().fields],
          count: ConduitNumber.Required,
        }),
        'getFlowRuns'
      ),
      constructConduitRoute(
        {
          path: '/flows',
          action: ConduitRouteActions.POST,
          bodyParams: {
            name: ConduitString.Required,
            trigger: ConduitJson.Required,
            actors: { type: [TYPE.JSON], required: true }, // handler array check is still required
            // actorPaths: , // unused
            enabled:  ConduitBoolean.Required,
          },
        },
        new ConduitRouteReturnDefinition('CreateFlow', ActorFlow.getInstance().fields),
        'createFlow'
      ),
      // constructConduitRoute(
      //   {
      //     path: '/flows/:id',
      //     action: ConduitRouteActions.UPDATE, // unimplemented
      //     urlParams: {
      //        id: { type: RouteOptionType.String, required: true },
      //     },
      //      bodyParams: { // TODO: Update these upon implementing the editFlow() handler
      //       name: ConduitString.Required,
      //       trigger: ConduitJson.Required,
      //       actors: ConduitJson.Required,
      //       // actorPaths: , // unused
      //       enabled:  ConduitBoolean.Required,
      //     },
      //   },
      //   new ConduitRouteReturnDefinition('EditFlow', ActorFlow.getInstance().fields),
      //   'editFlow'
      // ),
    ];
  }

  async getActors(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let actors = this._getActors();
    return { actors };
  }

  async getTriggers(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let triggers = this._getTriggers();
    return { triggers };
  }

  async getFlow(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const flow = await ActorFlow.getInstance()
      .findOne({ _id: call.request.params.id });
    if (isNil(flow)) {
      throw new GrpcError(status.NOT_FOUND, 'Flow does not exist');
    }
    return flow;
  }

  async getFlows(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const flowsPromise = ActorFlow.getInstance()
      .findMany(
        {},
        undefined,
        skip,
        limit,
      );
    const countPromise = ActorFlow.getInstance().countDocuments({});
    const [flows, count] = await Promise.all([flowsPromise, countPromise]).catch(
      (e: any) => { throw new GrpcError(status.INTERNAL, e.message); }
    );
    return { result: { flows, count } };
  }

  async getFlowRuns(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;

    const flow = await ActorFlow.getInstance().findOne({ _id: call.request.params.id });
    if (isNil(flow)) {
      throw new GrpcError(status.NOT_FOUND, 'Flow does not exist');
    }
    const flowRuns = ActorRun.getInstance()
      .findMany(
        { flow: flow._id },
        undefined,
        skip,
        limit,
      );
    const countPromise = ActorRun.getInstance().countDocuments({});
    const [runs, count] = await Promise.all([flowRuns, countPromise]).catch(
      (e: any) => { throw new GrpcError(status.INTERNAL, e.message); }
    );

    return { runs, count };
  }

  async createFlow(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, trigger, actors, enabled } = call.request.params;
    if (actors.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'Argument actors is required and must be a non-empty array!');
    }

    let triggers = this._getTriggers();
    let matchingTrigger = triggers.filter((trigr: any) => trigr.code === trigger.code);
    if (matchingTrigger.length === 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, `Trigger ${trigger.code} is not a valid trigger code.`);
    }
    let availableActors = this._getActors();
    for (let actor of actors) {
      let matchingActor = availableActors.filter((actr: any) => actr.code === actor.code);
      if (matchingActor.length === 0) {
        throw new GrpcError(status.INVALID_ARGUMENT, `Actor ${actor.code} is not a valid actor code.`);
      }
    }

    const flow = await ActorFlow.getInstance()
      .create({
        name,
        trigger,
        actors,
        enabled: enabled !== null ? enabled : true,
      })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    await this.warden.constructFlow(flow).catch(
      (e: any) => { throw new GrpcError(status.INTERNAL, e.message); }
    );

    return flow;
  }

  //todo
  async editFlow(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    throw new GrpcError(status.UNIMPLEMENTED, 'Not implemented yet');
  }

  private _getActors() {
    return readdirSync(path.resolve(__dirname, '../_actors'), { withFileTypes: true })
      .filter((dirent: any) => dirent.isDirectory())
      .map((dirent: any) => {
        try {
          let filePath = `../_actors/${dirent.name}/${dirent.name}.json`;
          let fileData = readFileSync(path.resolve(__dirname, filePath));
          return JSON.parse(fileData);
        } catch (e) {
          return {};
        }
      });
  }

  private _getTriggers() {
    return readdirSync(path.resolve(__dirname, '../_triggers'), { withFileTypes: true })
      .filter((dirent: any) => dirent.isDirectory())
      .map((dirent: any) => {
        try {
          let filePath = `../_triggers/${dirent.name}/${dirent.name}.json`;
          let fileData = readFileSync(path.resolve(__dirname, filePath));
          return JSON.parse(fileData);
        } catch (e) {
          return {};
        }
      });
  }
}
