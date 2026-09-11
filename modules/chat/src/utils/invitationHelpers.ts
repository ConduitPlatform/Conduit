export class InvitationError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
    this.name = 'InvitationError';
  }
}

export function validateInvitationAnswer(answer: string): void {
  if (answer !== 'accept' && answer !== 'decline') {
    throw new InvitationError(3, 'Answer must be accept or decline');
  }
}

export function assertInvitationReceiver(userId: unknown, receiver: unknown): void {
  if (String(userId) !== String(receiver)) {
    throw new InvitationError(7, 'Invitation is not for the current user');
  }
}

export function assertRoomJoinable<T extends { deleted?: boolean }>(
  room: T | null,
): asserts room is T {
  if (room == null || room.deleted === true) {
    throw new InvitationError(5, 'Chat room does not exist');
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
    throw new InvitationError(9, 'Invitation login redirect is not configured');
  }
  if (!redirectUri) {
    throw new InvitationError(9, 'Invitation hook return URL is required');
  }
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(loginUri);
  } catch {
    throw new InvitationError(9, 'login_uri must be an absolute URL');
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
