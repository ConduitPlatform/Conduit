import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { GrpcError, UntypedArray } from '@conduitplatform/grpc-sdk';
import { ChatRoom, InvitationToken, User } from '../models/index.js';
import { v4 as uuid } from 'uuid';

export async function validateUsersInput(grpcSdk: ConduitGrpcSdk, users: UntypedArray) {
  const uniqueUsers = Array.from(new Set(users));
  let errorMessage: string | null = null;
  const usersToBeAdded = (await User.getInstance()
    .findMany({ _id: { $in: uniqueUsers } })
    .catch((e: Error) => {
      errorMessage = e.message;
    })) as UntypedArray;
  if (!isNil(errorMessage)) {
    return Promise.reject({ code: status.INTERNAL, message: errorMessage });
  }
  if (usersToBeAdded.length != uniqueUsers.length) {
    const dbUserIds = usersToBeAdded.map((user: any) => user._id);
    const wrongIds = uniqueUsers.filter(id => !dbUserIds.includes(id));
    if (wrongIds.length != 0) {
      return Promise.reject({
        code: status.INVALID_ARGUMENT,
        message: `users [${wrongIds}] do not exist`,
      });
    }
  }
  return usersToBeAdded;
}

export async function sendInvitations(
  users: User[],
  sender: User,
  room: ChatRoom,
  url: string,
  sendEmail: boolean,
  sendNotification: boolean,
  grpcSdk: ConduitGrpcSdk,
) {
  const roomId = room._id;
  for (const invitedUser of users) {
    const invitationsCount = await InvitationToken.getInstance().countDocuments({
      room: roomId,
      receiver: invitedUser._id,
      sender: sender._id,
    });
    if (invitationsCount > 0) {
      throw new GrpcError(
        status.ALREADY_EXISTS,
        `users array contains invited member ids`,
      );
    }
    const invitationToken: InvitationToken = await InvitationToken.getInstance().create({
      receiver: invitedUser._id,
      sender: sender._id,
      token: uuid(),
      room: roomId,
    });
    if (sendEmail) {
      const result = { invitationToken, hostUrl: url };
      const acceptLink = `${result.hostUrl}/hook/chat/invitations/accept/${result.invitationToken.token}`;
      const declineLink = `${result.hostUrl}/hook/chat/invitations/decline/${result.invitationToken.token}`;
      const roomName = room.name;
      const userName = sender.email;
      await grpcSdk
        .emailProvider!.sendEmail('ChatRoomInvitation', {
          email: invitedUser.email,
          variables: {
            acceptLink,
            declineLink,
            userName,
            roomName,
          },
        })
        .catch((e: Error) => {
          throw new Error(e.message);
        });
    }
    if (sendNotification) {
      const body = `User ${sender._id} has invited you to join in room ${room.name}`;
      const title = 'You have an invitation request!';
      await grpcSdk
        .pushNotifications!.sendNotification(invitedUser._id, title, body)
        .catch((e: Error) => {
          throw new Error(e.message);
        });
    }
  }
  return 'Invitations sent';
}

export function populateArray(pop: string | string[] | undefined) {
  if (!pop) return pop;
  if (typeof pop === 'string' && pop.indexOf(',') !== -1) {
    pop = pop.split(',');
  } else if (Array.isArray(pop)) {
    return pop;
  } else {
    pop = [pop];
  }
  return pop;
}
