import ConduitGrpcSdk, {
  GrpcServer,
  RouterResponse,
  RouterRequest
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';

let paths = require('./admin.json').functions;

export class AdminHandlers{
  private database: any;

  constructor(server: GrpcServer, private readonly  grpcSdk: ConduitGrpcSdk) {
    const self = this;
    grpcSdk.waitForExistence('database-provider').then(() => {
      self.database =  self.grpcSdk.databaseProvider;
    });
    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        createRoom: this.createRoom.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private async validateUsersInput(users: any[]) {
    const uniqueUsers = Array.from(new Set(users));
    let errorMessage: string | null = null;
    const usersToBeAdded = await this.database
      .findMany('User', { _id: { $in: uniqueUsers } })
      .catch((e: Error) => {
        errorMessage = e.message;
      });
    if (!isNil(errorMessage)) {
      return Promise.reject({ code: status.INTERNAL, message: errorMessage });
    }
    if (usersToBeAdded.length != uniqueUsers.length) {
      const dbUserIds = usersToBeAdded.map((user: any) => user._id);
      const wrongIds = uniqueUsers.filter((id) => !dbUserIds.includes(id));
      if (wrongIds.length != 0) {
        return Promise.reject({
          code: status.INVALID_ARGUMENT,
          message: `users [${wrongIds}] do not exist`,
        });
      }
    }
  }

  async createRoom(call: RouterRequest, callback: RouterResponse){
    const {name,participants} = JSON.parse(call.request.params);

    if(isNil(name) || isNil(participants) || !Array.isArray(participants)){
      return callback({
        code: status.INTERNAL,
        message: 'name/participants are required to create a chat room'
      })
    }
    if(participants.length === 0 ){
      return callback({
        code: status.INTERNAL,
        message: 'cant create chat room with zero participants'
      })
    }
    try {
      await this.validateUsersInput(participants);
    } catch (e) {
      return callback({ code: e.code, message: e.message });
    }

    let errorMessage = null;
    const room = await this.database
      .create('ChatRoom', {
        name: name,
        participants: Array.from(new Set([...participants])),
      })
      .catch((e: Error) => {
        errorMessage = e.message;
      });

    if(!isNil(errorMessage)){
      return callback({
        code: status.INTERNAL,
        message: errorMessage
      })
    }
    return callback(null, { result: JSON.stringify(room)});
  }
}