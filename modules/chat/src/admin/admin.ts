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

    let errorMessage = null;
    let chatRoomDoc = { name,participants};
    const chatRoomDocument = this.database
      .create('ChatRoom',chatRoomDoc)
      .catch((err: any) => errorMessage = err);

    if(!isNil(errorMessage)){
      return callback({
        code: status.INTERNAL,
        message: errorMessage
      })
    }
    return callback(null, { result: JSON.stringify(chatRoomDocument)});
  }
}