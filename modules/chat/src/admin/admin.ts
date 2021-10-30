import ConduitGrpcSdk, {
  GrpcServer,
  RouterResponse,
  RouterRequest
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';

let paths = require('./admin.json').functions;
const escapeStringRegexp = require('escape-string-regexp');

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
        getRooms: this.getRooms.bind(this),
        deleteRooms: this.deleteRooms.bind(this),
        getMessages: this.getMessages.bind(this),
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

  async getRooms(call: RouterRequest, callback: RouterResponse){

    const { skip, limit,search } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {};
    let identifier;

    if(!isNil(search)){
      identifier = escapeStringRegexp(search);
      query['name'] =  { $regex: `.*${identifier}.*`, $options:'i'};
    }

    const chatRoomDocumentsPromise = this.database.findMany(
      'ChatRoom',
      query,
      null,
      skipNumber,
      limitNumber
    );
    const totalCountPromise = this.database.countDocuments('ChatRoom', {});

    let errorMessage: string | null = null;
    const [chatRoomDocuments, totalCount] = await Promise.all([
      chatRoomDocumentsPromise,
      totalCountPromise,
    ]).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ chatRoomDocuments, totalCount }) });
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

  async getMessages(call: RouterRequest, callback: RouterResponse) {
    const { skip,limit,senderId, roomId } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let errorMessage;
    let query : any = {};
    let schema = null;
    let id;
    let filter: boolean = false;
    if(!isNil(senderId) && isNil(roomId)){
      schema = 'User';
      query['senderUser'] = { senderId };
      id = senderId;
      filter = true;
    }
    else if(isNil(senderId) && !isNil(roomId)){
      schema = 'ChatRoom';
      query['room'] = { roomId };
      id = roomId;
      filter = true;
    }
    if(filter) {
      const room_or_user = await this.database
        .findOne(schema, id)
        .catch((err: any) => errorMessage = err);

      if (!isNil(errorMessage)) {
        return callback({
          code: status.INTERNAL,
          message: errorMessage
        });
      }
      if (isNil(room_or_user)) {
        return callback({
          code: status.NOT_FOUND,
          message: 'document with id ' + room_or_user + ' not found'
        })
      }
    }

    const messagesPromise = this.database.findMany(
      'ChatMessage',
      query,
      null,
      skipNumber,
      limitNumber
    );
    const countPromise = this.database.countDocuments('ChatMessage', {});
    const [messages, count] = await Promise.all([messagesPromise, countPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });

    return callback(null, { result: JSON.stringify({ messages, count }) });
  }

  async deleteRooms(call: RouterRequest, callback: RouterResponse){
    const {ids} = JSON.parse(call.request.params);
    if(isNil(ids) || !Array.isArray((ids))){
      return callback({
        code: status.INTERNAL,
        message: 'ids must be an array'
      })
    }
    let errorMessage;
    const deletedRooms = await this.database
      .deleteMany('ChatRoom', { _id: { $in: ids } })
      .catch((e: any) => (errorMessage = e.message));

    if(!isNil(errorMessage)){
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }
    const totalCount = deletedRooms.deletedCount;
    return callback(null, { result: JSON.stringify({ deletedRooms,totalCount }) });
  }
}