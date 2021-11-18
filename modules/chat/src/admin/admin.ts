import ConduitGrpcSdk, {
  GrpcServer,
  RouterResponse,
  RouterRequest,
} from '@quintessential-sft/conduit-grpc-sdk';
import { ChatRoom, ChatMessage, User } from '../models';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { populateArray } from '../utils';

let paths = require('./admin.json').functions;
const escapeStringRegexp = require('escape-string-regexp');

export class AdminHandlers{

  constructor(server: GrpcServer, private readonly  grpcSdk: ConduitGrpcSdk) {
    this.grpcSdk.admin
      .registerAdmin(server, paths, {
        createRoom: this.createRoom.bind(this),
        getRooms: this.getRooms.bind(this),
        deleteRooms: this.deleteRooms.bind(this),
        getMessages: this.getMessages.bind(this),
        deleteMessages: this.deleteMessages.bind(this)
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private async validateUsersInput(users: any[]) {
    const uniqueUsers = Array.from(new Set(users));
    let errorMessage: string | null = null;
    const usersToBeAdded:any = await User.getInstance()
      .findMany({ _id: { $in: uniqueUsers } })
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
    const { skip, limit,search,populate } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query:any = {},populates;
    let identifier;
    if(!isNil(populate)){
      populates = populateArray(populate);
    }
    if(!isNil(search)){
      identifier = escapeStringRegexp(search);
      query['name'] =  { $regex: `.*${identifier}.*`, $options:'i'};
    }

    const chatRoomDocumentsPromise = ChatRoom.getInstance()
      .findMany(
        query,
        undefined,
        skipNumber,
        limitNumber,
        undefined,
        populates,
      );
    const totalCountPromise = ChatRoom.getInstance().countDocuments(query);

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
        message: 'can not create chat room with no participants'
      })
    }
    try {
      await this.validateUsersInput(participants);
    } catch (e) {
      return callback({ code: e.code, message: e.message });
    }

    let errorMessage = null;
    const room = await ChatRoom.getInstance()
      .create({
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
    const { skip,limit,senderUser,roomId,populate } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let errorMessage,query:any = {};
    let populates;
    if(!isNil(populate)){
      populates = populateArray(populate);
    }
    if(!isNil(senderUser) ) {
      query['senderUser'] = senderUser;
      const user = await User.getInstance()
        .findOne({ _id: senderUser })
        .catch((err: any) => errorMessage = err);
      if (!isNil(errorMessage)) {
        return callback({
          code: status.INTERNAL,
          message: errorMessage
        });
      }
      if(isNil(user)){
        return callback({
          code: status.INTERNAL,
          message: 'User ' + senderUser + ' does not exists'
        });
      }
    }
    if(!isNil(roomId)){
      query['room'] =  roomId;
      const room = await ChatRoom.getInstance()
        .findOne({ _id: roomId })
        .catch((err: any) => errorMessage = err);
      if (!isNil(errorMessage)) {
        return callback({
          code: status.INTERNAL,
          message: errorMessage
        });
      }
      if(isNil(room)){
        return callback({
          code: status.INTERNAL,
          message: 'Room ' + roomId + ' does not exists'
        });
      }
    }
    const messagesPromise = ChatMessage.getInstance()
    .findMany(
      query,
      undefined,
      skipNumber,
      limitNumber,
      undefined,
      populates,
    );
    const countPromise = ChatMessage.getInstance().countDocuments(query);
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
    await ChatRoom.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: any) => (errorMessage = e.message));

    if(!isNil(errorMessage)){
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }

    await ChatMessage.getInstance()
      .deleteMany({ room: { $in: ids } })
      .catch((err:any) => errorMessage = err);
    if(!isNil(errorMessage)){
      return callback({
        code: status.INTERNAL,
        message: errorMessage
      })
    }
    return callback(null, { result: 'Done'});
  }

  async deleteMessages(call: RouterRequest, callback: RouterResponse){
    const {ids} = JSON.parse(call.request.params);
    if(isNil(ids) || !Array.isArray((ids))){
      return callback({
        code: status.INTERNAL,
        message: 'ids must be an array'
      })
    }
    let errorMessage;
    await ChatMessage.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: any) => (errorMessage = e.message));
    if(!isNil(errorMessage)){
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }
    return callback(null, { result: 'Done'});
  }
}