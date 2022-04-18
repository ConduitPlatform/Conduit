import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { Email } from '@conduitplatform/grpc-sdk';
import { ChatRoom, InvitationToken, User } from '../models';
import { v4 as uuid } from 'uuid';

export async function validateUsersInput(grpcSdk: ConduitGrpcSdk, users: any[]) {
  const uniqueUsers = Array.from(new Set(users));
  let errorMessage: string | null = null;
  const usersToBeAdded = (await grpcSdk
    .databaseProvider!.findMany('User', { _id: { $in: uniqueUsers } })
    .catch((e: Error) => {
      errorMessage = e.message;
    })) as any[];
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
  return usersToBeAdded;
}

export async function sendInvitations(users: any, sender: User, room: ChatRoom, url: string, config: any, grpcSdk: ConduitGrpcSdk) {

  const roomId = room._id;
  let retMessage: any [] = [];
  for (const invitedUser of users) {
    const invitationsCount = await InvitationToken.getInstance().countDocuments({
      room: roomId,
      receiver: invitedUser._id,
      sender: sender._id,
    });
    if (room.participants.includes(invitedUser._id)) {
      retMessage.push({
        receiver: invitedUser._id,
        message: 'Already member',
      });
      continue;
    }
    if (invitationsCount > 0) {
      retMessage.push({
        receiver: invitedUser._id,
        message: 'Already invited',
      });
      continue;
    }
    let invitationToken: InvitationToken = await InvitationToken.getInstance().create({
      receiver: invitedUser._id,
      sender: sender._id,
      token: uuid(),
      room: roomId,
    });
    if (config.explicit_room_joins.send_email) {
      let result = { invitationToken, hostUrl: url };
      const acceptLink = `${result.hostUrl}/hook/chat/accept/${result.invitationToken.token}`;
      const declineLink = `${result.hostUrl}/hook/chat/decline/${result.invitationToken.token}`;
      const roomName = room.name;
      const userName = sender.email;
      await grpcSdk.emailProvider!.sendEmail('ChatRoomInvitation', {
        email: invitedUser.email,
        sender: 'no-reply',
        variables: {
          acceptLink,
          declineLink,
          userName,
          roomName,
        },
      }).catch((e: Error) => {
        throw  new Error(e.message);
      });
      retMessage.push({
        receiver: invitedUser._id,
        message: 'Invitation sent',
      });
    }
  }
  return retMessage;
}

export function populateArray(pop: any) {
  if (!pop) return pop;
  if (pop.indexOf(',') !== -1) {
    pop = pop.split(',');
  } else if (Array.isArray(pop)) {
    return pop;
  } else {
    pop = [pop];
  }
  return pop;
}
