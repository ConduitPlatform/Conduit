import ConduitGrpcSdk, {
  GrpcServer,
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { isNil } from 'lodash';
import { ExecutorController } from '../controllers/executor.controller';

let paths = require('./admin.json').functions;

export class AdminHandlers {
  private database: any;

  constructor(
    server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly formsController: ExecutorController
  ) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database = self.grpcSdk.databaseProvider;
    });
    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        getActors: this.getActors.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  async getActors(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const formsPromise = this.database.findMany(
      'Forms',
      {},
      null,
      skipNumber,
      limitNumber
    );
    const countPromise = this.database.countDocuments('Forms', {});

    let errorMessage: string | null = null;
    const [forms, count] = await Promise.all([formsPromise, countPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ forms, count }) });
  }
}
