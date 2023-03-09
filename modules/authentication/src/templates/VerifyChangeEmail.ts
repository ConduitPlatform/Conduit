export const VerifyChangeEmailTemplate = {
  name: 'ChangeEmailVerification',
  subject: 'Verify your new email',
  body: '<p>Click <a href="{{link}}">here</a> to verify your new email</p><p>or use this link: {{link}}</p>',
  variables: ['link'],
};
