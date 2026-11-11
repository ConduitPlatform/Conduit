import { ConduitGrpcSdk, UntypedArray } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { ChatRoom, InvitationToken, User } from '../models/index.js';
import { v4 as uuid } from 'uuid';
import { buildInvitationHookUrl } from './invitationHelpers.js';

export { buildInvitationHookUrl };
export { editChatMessage } from './editMessage.js';
export { deleteChatMessage } from './deleteMessage.js';

export async function validateUsersInput(grpcSdk: ConduitGrpcSdk, users: UntypedArray) {
  const uniqueUsers = Array.from(new Set(users));
  const usersToBeAdded = (await User.getInstance()
    .findMany({ _id: { $in: uniqueUsers } })
    .catch(ModuleError.rethrow(errors.CHAT_DATABASE_ERROR))) as UntypedArray;
  if (usersToBeAdded.length != uniqueUsers.length) {
    const dbUserIds = usersToBeAdded.map((user: any) => user._id);
    const wrongIds = uniqueUsers.filter(id => !dbUserIds.includes(id));
    if (wrongIds.length != 0) {
      throw new ModuleError(errors.USERS_NOT_FOUND, `users [${wrongIds}] do not exist`);
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
      throw new ModuleError(errors.USERS_ALREADY_INVITED);
    }
    const invitationToken: InvitationToken = await InvitationToken.getInstance().create({
      receiver: invitedUser._id,
      sender: sender._id,
      token: uuid(),
      room: roomId,
    });
    const safeUser = await User.getInstance().findOne(
      { _id: invitedUser._id },
      { select: '-hashedPassword' },
    );
    if (sendEmail) {
      const result = { invitationToken, hostUrl: url };
      const acceptLink = buildInvitationHookUrl(
        result.hostUrl,
        'accept',
        result.invitationToken.token,
      );
      const declineLink = buildInvitationHookUrl(
        result.hostUrl,
        'decline',
        result.invitationToken.token,
      );
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
            user: safeUser,
          },
        })
        .catch(ModuleError.rethrow(errors.INVITATION_DELIVERY_FAILED));
    }
    if (sendNotification) {
      const body = `User ${sender._id} has invited you to join in room ${room.name}`;
      const title = 'You have an invitation request!';
      await grpcSdk
        .pushNotifications!.sendNotification(invitedUser._id, title, body)
        .catch(ModuleError.rethrow(errors.INVITATION_DELIVERY_FAILED));
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
