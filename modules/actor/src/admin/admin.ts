import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';

import { ExecutorController } from '../controllers/executor.controller';
import path from 'path';
import { isNil } from 'lodash';
import grpc from 'grpc';

const { readdirSync, readFileSync } = require('fs');

let paths = require('./admin.json').functions;

export class AdminHandlers {
  private database: any;

  constructor(
    server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly executorController: ExecutorController,
  ) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider;
    });
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
    let actors = readdirSync(path.resolve(__dirname, '../_actors'), { withFileTypes: true })
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

    return callback(null, { result: JSON.stringify({ actors }) });
  }

  async getTriggers(call: RouterRequest, callback: RouterResponse) {
    let triggers = readdirSync(path.resolve(__dirname, '../_triggers'), { withFileTypes: true })
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
      'ActorFlows',
      {},
      undefined,
      skipNumber,
      limitNumber,
    );
    const countPromise = this.database.countDocuments('ActorFlows', {});

    let errorMessage: string | null = null;
    const [flows, count] = await Promise.all([flowsPromise, countPromise]).catch(
      (e: any) => (errorMessage = e.message),
    );
    if (!isNil(errorMessage))
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ flows, count }) });
  }

  async getFlowById(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);

    if (isNil(id)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Argument id is required!',
      });
    }
    let errorMessage = null;
    const flow = await this.database.findOne('ActorFlows', { _id: id }).catch((e: any) => errorMessage = e.message);

    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

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
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Argument id is required!',
      });
    }
    let errorMessage = null;
    const flow = await this.database.findOne('ActorFlows', { _id: id }).catch((e: any) => errorMessage = e.message);
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const flowRuns = this.database.findMany(
      'ActorRuns',
      { flow: flow._id },
      undefined,
      skipNumber,
      limitNumber,
    );
    const countPromise = this.database.countDocuments('ActorRuns', {});

    errorMessage = null;
    const [runs, count] = await Promise.all([flowRuns, countPromise]).catch(
      (e: any) => (errorMessage = e.message),
    );
    if (!isNil(errorMessage))
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ runs, count }) });
  }

  //todo
  async createFlow(call: RouterRequest, callback: RouterResponse) {
    return callback({ code: grpc.status.UNIMPLEMENTED, message: 'Not implemented yet' });
  }

  //todo
  async editFlowById(call: RouterRequest, callback: RouterResponse) {
    return callback({ code: grpc.status.UNIMPLEMENTED, message: 'Not implemented yet' });
  }
}
