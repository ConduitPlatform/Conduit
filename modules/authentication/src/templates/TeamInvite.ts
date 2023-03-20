export const TeamInviteTemplate = {
  name: 'TeamInvite',
  subject: 'You have been invited by {{inviterName}} to join team {{teamName}}',
  body: '<p>Click <a href="{{link}}">here</a> to accept the invite.</p><p>or use this link: {{link}}</p>',
  variables: ['link', 'teamName', 'inviterName'],
};
