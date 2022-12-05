export const TeamInviteTemplate = {
  name: 'TeamInvite',
  subject: 'You have been invited by {{inviterName}} to join team {{teamName}}',
  body: 'Click <a href="{{link}}">here</a> to accept the invite.',
  variables: ['link', 'teamName', 'inviterName'],
};
