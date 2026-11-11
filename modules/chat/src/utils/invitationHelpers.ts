import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';

export function validateInvitationAnswer(answer: string): void {
  if (answer !== 'accept' && answer !== 'decline') {
    throw new ModuleError(errors.INVALID_INVITATION_ANSWER);
  }
}

export function assertInvitationReceiver(userId: unknown, receiver: unknown): void {
  if (String(userId) !== String(receiver)) {
    throw new ModuleError(errors.INVITATION_NOT_FOR_USER);
  }
}

export function assertRoomJoinable<T extends { deleted?: boolean }>(
  room: T | null,
): asserts room is T {
  if (room == null || room.deleted === true) {
    throw new ModuleError(errors.ROOM_NOT_FOUND);
  }
}

export function buildInvitationHookUrl(
  hostUrl: string,
  answer: 'accept' | 'decline',
  invitationToken: string,
): string {
  return `${hostUrl.replace(/\/$/, '')}/hook/chat/invitations/${answer}/${invitationToken}`;
}

export function buildLoginRedirectUrl(
  loginUri: string,
  answer: string,
  invitationToken: string,
  redirectUri: string,
): string {
  if (!loginUri) {
    throw new ModuleError(
      errors.INVITATION_REDIRECT_MISCONFIGURED,
      'Invitation login redirect is not configured',
    );
  }
  if (!redirectUri) {
    throw new ModuleError(
      errors.INVITATION_REDIRECT_MISCONFIGURED,
      'Invitation hook return URL is required',
    );
  }
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(loginUri);
  } catch {
    throw new ModuleError(
      errors.INVITATION_REDIRECT_MISCONFIGURED,
      'login_uri must be an absolute URL',
    );
  }
  redirectUrl.searchParams.set('redirectUri', redirectUri);
  redirectUrl.searchParams.set('answer', answer);
  redirectUrl.searchParams.set('invitationToken', invitationToken);
  return redirectUrl.toString();
}

export function isAlreadyMember(participants: unknown[], receiver: unknown): boolean {
  return participants.some(p => String(p) === String(receiver));
}

export function replaceRoomIdInUri(uriTemplate: string, roomId: string): string {
  return uriTemplate.replace(/\{roomId\}/g, roomId);
}
