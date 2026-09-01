export class InvitationError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'InvitationError';
  }
}

export function validateInvitationAnswer(answer: string): void {
  if (answer !== 'accept' && answer !== 'decline') {
    throw new InvitationError(3, 'Answer must be accept or decline');
  }
}

export function buildLoginRedirectUrl(
  loginUri: string,
  answer: string,
  invitationToken: string,
): string {
  if (!loginUri) {
    throw new InvitationError(
      9,
      'Invitation login redirect is not configured',
    );
  }
  let redirectUrl: URL;
  try {
    redirectUrl = new URL(loginUri);
  } catch {
    throw new InvitationError(
      9,
      'login_uri must be an absolute URL',
    );
  }
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
