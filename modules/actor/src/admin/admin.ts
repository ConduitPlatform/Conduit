import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';

import path from 'path';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { FlowCreator } from '../controllers/flowCreator';

const { readdirSync, readFileSync } = require('fs');

let paths = require('./admin.json').functions;

export class AdminHandlers {
  private database: any;
  private warden: FlowCreator;

  constructor(server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider;
    });
    this.warden = new FlowCreator(grpcSdk, server);
    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        getActors: this.getActors.bind(this),
        getTriggers: this.getTriggers.bind(this),
        getFlows: this.getFlows.bind(this),
        getFlowById: this.getFlowById.bind(this),
        getFlowRuns: this.getFlowRuns.bind(this),
        createFlow: this.createFlow.bind(this),
        editFlowById: this.editFlowById.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  async getActors(call: RouterRequest, callback: RouterResponse) {
    let actors = this._getActors();

    return callback(null, { result: JSON.stringify({ actors }) });
  }

  async getTriggers(call: RouterRequest, callback: RouterResponse) {
    let triggers = this._getTriggers();
    return callback(null, { result: JSON.stringify({ triggers }) });
  }

  async getFlows(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const flowsPromise = this.database.findMany(
      'ActorFlow',
      {},
      undefined,
      skipNumber,
      limitNumber
    );
    const countPromise = this.database.countDocuments('ActorFlow', {});

    let errorMessage: string | null = null;
    const [flows, count] = await Promise.all([flowsPromise, countPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ flows, count }) });
  }

  async getFlowById(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);

    if (isNil(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Argument id is required!',
      });
    }
    let errorMessage = null;
    const flow = await this.database
      .findOne('ActorFlow', { _id: id })
      .catch((e: any) => (errorMessage = e.message));

    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ flow }) });
  }

  async getFlowRuns(call: RouterRequest, callback: RouterResponse) {
    const { id, skip, limit } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    if (isNil(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Argument id is required!',
      });
    }
    let errorMessage = null;
    const flow = await this.database
      .findOne('ActorFlow', { _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    const flowRuns = this.database.findMany(
      'ActorRun',
      { flow: flow._id },
      undefined,
      skipNumber,
      limitNumber
    );
    const countPromise = this.database.countDocuments('ActorRun', {});

    errorMessage = null;
    const [runs, count] = await Promise.all([flowRuns, countPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ runs, count }) });
  }

  async createFlow(call: RouterRequest, callback: RouterResponse) {
    const { name, trigger, actors, actorPaths, enabled } = JSON.parse(
      call.request.params
    );
    if (!name) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Argument name is required!',
      });
    }
    if (!trigger) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Argument trigger is required!',
      });
    }

    if (!actors || !Array.isArray(actors) || actors.length === 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Argument actors is required and must be a non-empty array!',
      });
    }
    if (!actorPaths || !Array.isArray(actorPaths) || actorPaths.length === 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Argument actorPaths is required and must be a non-empty array!',
      });
    }
    let triggers = this._getTriggers();
    let matchingTrigger = triggers.filter((trigr: any) => trigr.code === trigger.code);
    if (matchingTrigger.length === 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: `Trigger ${trigger.code} is not a valid trigger code.`,
      });
    }

    let availableActors = this._getActors();
    for (let actor of actors) {
      let matchingActor = availableActors.filter((actr: any) => actr.code === actor.code);
      if (matchingActor.length === 0) {
        return callback({
          code: status.INVALID_ARGUMENT,
          message: `Actor ${actor.code} is not a valid actor code.`,
        });
      }
    }
    let errorMessage = null;
    const flow = await this.database
      .create('ActorFlow', {
        name,
        trigger,
        actors,
        enabled: enabled !== null ? enabled : true,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    await this.warden.constructFlow(flow).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ flow }) });
  }

  //todo
  async editFlowById(call: RouterRequest, callback: RouterResponse) {
    return callback({ code: status.UNIMPLEMENTED, message: 'Not implemented yet' });
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
